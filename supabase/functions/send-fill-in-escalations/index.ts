import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildNotificationTargets,
  emptyOneSignalSendResult,
  resolveNotificationSubscriptions,
  sendOneSignalNotification,
} from '../_shared/onesignal.ts'
import { resolveNotificationPreferenceRecipients } from '../_shared/notification-preferences.ts'
import {
  buildFillInEscalationRecipients,
  fillInEscalationEventKey,
  normalizeRoleName,
} from '../_shared/fill-in-escalation.ts'

const CRON_SECRET_HEADER = 'x-music-ministry-cron-secret'
const ONESIGNAL_APP_ID = 'd22a0591-70f3-4c9b-b006-00beed197e85'
const ONESIGNAL_REST_API_KEY_NAMES = [
  'ONESIGNAL_REST_API_KEY',
  'ONE_SIGNAL_REST_API_KEY',
  'ONESIGNAL_API_KEY',
  'ONE_SIGNAL_API_KEY',
  'ONESIGNAL_REST_KEY',
]
const ONESIGNAL_REST_API_KEY = ONESIGNAL_REST_API_KEY_NAMES
  .map((name) => Deno.env.get(name))
  .map(normalizeSecret)
  .find((value): value is string => Boolean(value))

type ClaimedDelivery = {
  fill_in_request_id: string
  eligible_at: string
  attempt_count: number
}

type EscalationContext = {
  fill_in_request_id: string
  assignment_id: string
  service_id: string
  church_id: string
  requesting_member_id: string
  role_name: string
  reason: string | null
  request_created_at: string
  church_name: string
  church_owner_user_id: string | null
  requester_name: string | null
  requester_email: string
  service_date: string
  service_time: string | null
  service_type: string | null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const suppliedSecret = normalizeSecret(req.headers.get(CRON_SECRET_HEADER))
  const { data: secretAccepted, error: secretError } = await supabase.rpc(
    'verify_fill_in_escalation_cron_secret',
    { candidate_secret: suppliedSecret ?? '' },
  )

  if (secretError || secretAccepted !== true) {
    console.warn('Rejected fill-in escalation request', {
      reason: secretError ? 'secret_verification_failed' : 'invalid_secret',
    })
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let body: { diagnostic?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    // Cron requests are allowed to omit a body.
  }

  if (body.diagnostic === true) {
    const { data, error } = await supabase.rpc('get_fill_in_escalation_diagnostics')
    if (error) return jsonResponse({ error: error.message }, 500)
    return jsonResponse({ configured: Boolean(ONESIGNAL_REST_API_KEY), queue: data })
  }

  const workerToken = crypto.randomUUID()
  const stats = {
    due: 0,
    claimed: 0,
    sent: 0,
    skipped: 0,
    retried: 0,
    failed: 0,
    recipients: 0,
    subscriptions: 0,
    optedOut: 0,
  }

  const { data: queueBefore } = await supabase.rpc('get_fill_in_escalation_diagnostics')
  stats.due = getNumericStat(queueBefore, 'due')
  const skippedBefore = getNumericStat(queueBefore, 'skipped')

  const { data: claimedRows, error: claimError } = await supabase.rpc(
    'claim_due_fill_in_escalations',
    { worker_token: workerToken, max_count: 25, lease_seconds: 120 },
  )
  if (claimError) return jsonResponse({ error: claimError.message, stats }, 500)

  const claims = Array.isArray(claimedRows)
    ? claimedRows as ClaimedDelivery[]
    : []
  stats.claimed = claims.length
  stats.retried = claims.filter((claim) => claim.attempt_count > 1).length

  for (const claim of claims) {
    try {
      const outcome = await processClaim(supabase, claim, workerToken)
      stats.sent += outcome.sent
      stats.skipped += outcome.skipped ? 1 : 0
      stats.recipients += outcome.recipients
      stats.subscriptions += outcome.subscriptions
      stats.optedOut += outcome.optedOut
    } catch (error) {
      stats.failed += 1
      const failureMessage = error instanceof Error ? error.message : String(error)
      console.error('Fill-in escalation delivery failed', {
        fillInRequestId: claim.fill_in_request_id,
        error: failureMessage,
      })
      await supabase.rpc('release_fill_in_escalation', {
        target_fill_in_request_id: claim.fill_in_request_id,
        worker_token: workerToken,
        failure_message: failureMessage,
      })
    }
  }

  const { data: queueAfter } = await supabase.rpc('get_fill_in_escalation_diagnostics')
  stats.skipped = Math.max(
    stats.skipped,
    getNumericStat(queueAfter, 'skipped') - skippedBefore,
  )

  return jsonResponse({ sent: stats.sent, stats, queue: queueAfter })
})

async function processClaim(
  supabase: SupabaseClient,
  claim: ClaimedDelivery,
  workerToken: string,
): Promise<{
  sent: number
  skipped: boolean
  recipients: number
  subscriptions: number
  optedOut: number
}> {
  const { data: contextRows, error: contextError } = await supabase.rpc(
    'recheck_fill_in_escalation',
    {
      target_fill_in_request_id: claim.fill_in_request_id,
      worker_token: workerToken,
    },
  )
  if (contextError) throw new Error(`Recheck failed: ${contextError.message}`)

  const context = Array.isArray(contextRows)
    ? contextRows[0] as EscalationContext | undefined
    : undefined
  if (!context) {
    return { sent: 0, skipped: true, recipients: 0, subscriptions: 0, optedOut: 0 }
  }

  const [{ data: churchRoles, error: rolesError }, { data: churchMembers, error: membersError }] = await Promise.all([
    supabase
      .from('church_roles')
      .select('id, name')
      .eq('church_id', context.church_id),
    supabase
      .from('church_members')
      .select('id, member_id, is_admin, role')
      .eq('church_id', context.church_id),
  ])
  if (rolesError) throw new Error(`Role lookup failed: ${rolesError.message}`)
  if (membersError) throw new Error(`Member lookup failed: ${membersError.message}`)

  const requestedRole = normalizeRoleName(context.role_name)
  const matchingRoleIds = (churchRoles ?? [])
    .filter((role: { id: string; name: string }) => normalizeRoleName(role.name) === requestedRole)
    .map((role: { id: string }) => role.id)
  let memberRoleMemberIds: string[] = []
  if (matchingRoleIds.length > 0) {
    const { data: memberRoles, error: memberRolesError } = await supabase
      .from('member_roles')
      .select('member_id')
      .in('role_id', matchingRoleIds)
    if (memberRolesError) throw new Error(`Member-role lookup failed: ${memberRolesError.message}`)
    memberRoleMemberIds = (memberRoles ?? []).map((row: { member_id: string }) => row.member_id)
  }

  const recipients = buildFillInEscalationRecipients({
    requestingMemberId: context.requesting_member_id,
    requestedRoleName: context.role_name,
    churchOwnerUserId: context.church_owner_user_id,
    churchMembers: churchMembers ?? [],
    memberRoleMemberIds,
  })
  const preferenceResolution = await resolveNotificationPreferenceRecipients(
    supabase,
    recipients.recipientMemberIds,
    'fill_in_requests',
  )
  const subscriptionRows = await resolveNotificationSubscriptions(
    supabase,
    preferenceResolution.enabledMemberIds,
  )
  const targets = buildNotificationTargets(
    preferenceResolution.enabledMemberIds,
    subscriptionRows,
  )

  const requesterName = context.requester_name?.trim() || context.requester_email || 'A member'
  const serviceLabel = formatServiceLabel(context)
  const notificationTitle = `Fill-In Still Needed - ${context.church_name}`
  const notificationBody = `${requesterName} still needs a fill-in for ${context.role_name} on ${serviceLabel}.`
  const notificationData = {
    type: 'fill_in_request',
    fillInRequestId: context.fill_in_request_id,
    serviceId: context.service_id,
    roleName: context.role_name,
  }
  const eventKey = fillInEscalationEventKey(context.fill_in_request_id)

  let sendResult = emptyOneSignalSendResult()
  if (preferenceResolution.enabledMemberIds.length > 0) {
    if (!ONESIGNAL_REST_API_KEY) {
      throw new Error(`OneSignal REST API key is not configured. Set one of: ${ONESIGNAL_REST_API_KEY_NAMES.join(', ')}`)
    }
    sendResult = await sendOneSignalNotification({
      appId: ONESIGNAL_APP_ID,
      apiKey: ONESIGNAL_REST_API_KEY,
      eventKey,
      externalIds: targets.externalIds,
      subscriptionIds: targets.subscriptionIds,
      title: notificationTitle,
      body: notificationBody,
      data: notificationData,
    })
  }

  if (sendResult.invalidSubscriptionIds.length > 0) {
    const { error } = await supabase
      .from('onesignal_subscriptions')
      .delete()
      .in('subscription_id', sendResult.invalidSubscriptionIds)
    if (error) console.warn('Failed to clean invalid OneSignal subscriptions', error)
  }
  if (sendResult.errors.length > 0) {
    throw new Error(`OneSignal rejected escalation: ${sendResult.errors.join('; ')}`)
  }

  if (preferenceResolution.enabledMemberIds.length > 0) {
    const { error: historyError } = await supabase
      .from('member_notifications')
      .upsert(preferenceResolution.enabledMemberIds.map((memberId) => ({
        church_id: context.church_id,
        member_id: memberId,
        event_key: eventKey,
        notification_type: 'fill_in_request',
        title: notificationTitle,
        body: notificationBody,
        data: notificationData,
      })), {
        onConflict: 'member_id,event_key',
        ignoreDuplicates: true,
      })
    if (historyError) throw new Error(`Notification history failed: ${historyError.message}`)
  }

  const deliveryResult = {
    sent: sendResult.sent,
    recipients: preferenceResolution.enabledMemberIds.length,
    optedOut: preferenceResolution.optedOutMemberIds.length,
    subscriptions: targets.subscriptionIds.length,
    externalFallbacks: targets.externalIds.length,
    successfulTargetLabels: sendResult.successfulTargetLabels,
    warnings: sendResult.warnings,
  }
  const { data: completed, error: completionError } = await supabase.rpc(
    'complete_fill_in_escalation',
    {
      target_fill_in_request_id: context.fill_in_request_id,
      worker_token: workerToken,
      delivery_result: deliveryResult,
    },
  )
  if (completionError || completed !== true) {
    throw new Error(`Completion failed: ${completionError?.message ?? 'lease no longer owned'}`)
  }

  await supabase.from('notification_log').insert({
    run_at: new Date().toISOString(),
    church_id: context.church_id,
    service_id: context.service_id,
    members_found: preferenceResolution.enabledMemberIds.length,
    tokens_found: targets.subscriptionRows.length,
    notifications_sent: sendResult.sent,
    onesignal_response: JSON.stringify(deliveryResult),
    notes: `fill-in reminder ${context.fill_in_request_id}; role=${context.role_name}; eligible=${recipients.eligibleMemberIds.length}; admins=${recipients.adminMemberIds.length}`,
  })

  return {
    sent: sendResult.sent,
    skipped: false,
    recipients: preferenceResolution.enabledMemberIds.length,
    subscriptions: targets.subscriptionIds.length,
    optedOut: preferenceResolution.optedOutMemberIds.length,
  }
}

function formatServiceLabel(context: EscalationContext): string {
  const serviceDate = new Date(context.service_date)
  let label = serviceDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
  if (context.service_time) {
    const [hours, minutes] = context.service_time.split(':')
    const time = new Date(Date.UTC(2000, 0, 1, Number(hours), Number(minutes)))
    label += ` at ${time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    })}`
  }
  if (context.service_type) label += ` (${context.service_type})`
  return label
}

function getNumericStat(value: unknown, key: string): number {
  if (!value || typeof value !== 'object') return 0
  const candidate = (value as Record<string, unknown>)[key]
  return typeof candidate === 'number' ? candidate : Number(candidate) || 0
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function normalizeSecret(value?: string | null): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}
