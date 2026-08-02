import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildNotificationTargets,
  emptyOneSignalSendResult,
  resolveNotificationSubscriptions,
  sendOneSignalNotification,
} from '../_shared/onesignal.ts'
import { resolveNotificationPreferenceRecipients } from '../_shared/notification-preferences.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { fillInRequestId } = await req.json()

    if (!fillInRequestId) {
      return new Response(
        JSON.stringify({ error: 'fillInRequestId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Look up the fill-in request
    const { data: fillInRequest, error: fillInError } = await supabase
      .from('fill_in_requests')
      .select('id, church_id, requesting_member_id, role_name, reason, service_id, status, assignment_id')
      .eq('id', fillInRequestId)
      .single()

    if (fillInError || !fillInRequest) {
      return new Response(
        JSON.stringify({ error: 'Fill-in request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Requesting member name
    const { data: requestingMember } = await supabase
      .from('church_members')
      .select('name, email')
      .eq('id', fillInRequest.requesting_member_id)
      .single()

    const requestingMemberName = requestingMember?.name?.trim() || requestingMember?.email || 'A member'

    // 3. Church name and admin owner
    const { data: church } = await supabase
      .from('churches')
      .select('name, admin_id')
      .eq('id', fillInRequest.church_id)
      .single()

    const churchName = church?.name ?? 'Your Church'
    const churchOwnerUserId = church?.admin_id ?? null

    // 4. Service date
    let serviceDateStr = 'an upcoming service'
    if (fillInRequest.service_id) {
      const { data: service } = await supabase
        .from('services')
        .select('date, service_type, time')
        .eq('id', fillInRequest.service_id)
        .single()

      if (service?.date) {
        const date = new Date(service.date)
        serviceDateStr = date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })
        if (service.service_type) {
          serviceDateStr += ` (${service.service_type})`
        }
      }
    }

    const stats = {
      matchingRoles: 0,
      eligibleMembers: 0,
      adminMembers: 0,
      totalRecipients: 0,
      subscriptions: 0,
      optedOut: 0,
    }

    // 5. Find role ids for the requested role name. Fetch and normalize locally so
    // small spacing/case differences do not make fill-in requests silently fail.
    const { data: churchRoles } = await supabase
      .from('church_roles')
      .select('id, name')
      .eq('church_id', fillInRequest.church_id)

    const requestedRole = normalizeRoleName(fillInRequest.role_name)
    const matchingRoleIds = (churchRoles ?? [])
      .filter((role: { id: string; name: string }) => normalizeRoleName(role.name) === requestedRole)
      .map((role: { id: string }) => role.id)

    stats.matchingRoles = matchingRoleIds.length

    let eligibleMemberIds: string[] = []

    if (matchingRoleIds.length > 0) {
      const { data: memberRoles } = await supabase
        .from('member_roles')
        .select('member_id')
        .in('role_id', matchingRoleIds)

      if (memberRoles && memberRoles.length > 0) {
        eligibleMemberIds = Array.from(new Set(memberRoles
          .map((mr: { member_id: string }) => mr.member_id)
          .filter((id: string) => id !== fillInRequest.requesting_member_id)))
      }
    }

    stats.eligibleMembers = eligibleMemberIds.length

    const { data: churchMembers } = await supabase
      .from('church_members')
      .select('id, member_id, is_admin')
      .eq('church_id', fillInRequest.church_id)

    const adminMemberIds = Array.from(new Set((churchMembers ?? [])
      .filter((member: { id: string; member_id: string; is_admin: boolean }) =>
        member.id !== fillInRequest.requesting_member_id
        && (member.is_admin || (churchOwnerUserId && member.member_id === churchOwnerUserId))
      )
      .map((member: { id: string }) => member.id)))

    stats.adminMembers = adminMemberIds.length

    const recipientMemberIds = Array.from(new Set([...eligibleMemberIds, ...adminMemberIds]))
    stats.totalRecipients = recipientMemberIds.length

    if (recipientMemberIds.length === 0) {
      await supabase.from('notification_log').insert({
        run_at: new Date().toISOString(),
        church_id: fillInRequest.church_id,
        service_id: fillInRequest.service_id,
        members_found: 0,
        tokens_found: 0,
        notifications_sent: 0,
        onesignal_response: '[]',
        notes: `fill-in request ${fillInRequest.id}; no eligible members/admins for role ${fillInRequest.role_name}; stats=${JSON.stringify(stats)}`,
      })

      return new Response(
        JSON.stringify({ sent: 0, errors: [], message: 'No eligible members or admins found for this request', stats }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const preferenceResolution = await resolveNotificationPreferenceRecipients(
      supabase,
      recipientMemberIds,
      'fill_in_requests',
    )
    stats.optedOut = preferenceResolution.optedOutMemberIds.length

    // 6. Prefer saved OneSignal subscription IDs because they target the exact
    // device. Fall back to external_id aliases for members without a saved row.
    const subscriptionRows = await resolveNotificationSubscriptions(
      supabase,
      preferenceResolution.enabledMemberIds,
    )

    const targets = buildNotificationTargets(
      preferenceResolution.enabledMemberIds,
      subscriptionRows,
    )
    stats.subscriptions = targets.subscriptionRows.length

    // 7. Build notification content
    const notificationTitle = `Fill-In Needed — ${churchName}`
    let notificationBody = `${requestingMemberName} needs a fill-in for ${fillInRequest.role_name} on ${serviceDateStr}`
    if (fillInRequest.reason) {
      notificationBody += ` — Reason: ${fillInRequest.reason}`
    }
    const notificationData = {
      type: 'fill_in_request',
      fillInRequestId: fillInRequest.id,
      serviceId: fillInRequest.service_id,
      roleName: fillInRequest.role_name,
    }

    // 8. Send via OneSignal Push API
    let sendResult = emptyOneSignalSendResult()
    if (preferenceResolution.enabledMemberIds.length > 0) {
      if (!ONESIGNAL_REST_API_KEY) {
        throw new Error(`OneSignal REST API key is not configured. Set one of: ${ONESIGNAL_REST_API_KEY_NAMES.join(', ')}`)
      }
      sendResult = await sendOneSignalNotification({
        appId: ONESIGNAL_APP_ID,
        apiKey: ONESIGNAL_REST_API_KEY,
        eventKey: `fill_in_request:${fillInRequest.id}`,
        externalIds: targets.externalIds,
        subscriptionIds: targets.subscriptionIds,
        title: notificationTitle,
        body: notificationBody,
        data: notificationData,
      })
    }
    const {
      sent,
      errors,
      warnings,
      invalidSubscriptionIds,
      successfulTargetLabels,
    } = sendResult

    if (invalidSubscriptionIds.length > 0) {
      await supabase
        .from('onesignal_subscriptions')
        .delete()
        .in('subscription_id', invalidSubscriptionIds)
    }

    const { error: notificationHistoryError } = await supabase
      .from('member_notifications')
      .upsert(recipientMemberIds.map(memberId => ({
        church_id: fillInRequest.church_id,
        member_id: memberId,
        event_key: `fill_in_request:${fillInRequest.id}`,
        notification_type: 'fill_in_request',
        title: notificationTitle,
        body: notificationBody,
        data: notificationData,
      })), {
        onConflict: 'member_id,event_key',
        ignoreDuplicates: true,
      })

    if (notificationHistoryError) {
      console.error('Error recording member notifications:', notificationHistoryError)
    }

    await supabase.from('notification_log').insert({
      run_at: new Date().toISOString(),
      church_id: fillInRequest.church_id,
      service_id: fillInRequest.service_id,
      members_found: recipientMemberIds.length,
      tokens_found: targets.subscriptionRows.length,
      notifications_sent: sent,
      onesignal_response: JSON.stringify({
        errors,
        warnings,
        invalidSubscriptionIds,
        successfulTargetLabels,
      }),
      notes: `fill-in request ${fillInRequest.id}; role=${fillInRequest.role_name}; optedOut=${preferenceResolution.optedOutMemberIds.length}; fallbackExternalIds=${targets.externalIds.length}; stats=${JSON.stringify(stats)}`,
    })

    return new Response(
      JSON.stringify({ sent, errors, stats }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('send-fill-in-notifications error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function normalizeRoleName(roleName: string): string {
  return roleName.trim().replace(/\s+/g, ' ').toLowerCase()
}

function normalizeSecret(value?: string | null): string | undefined {
  if (!value) return undefined

  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}
