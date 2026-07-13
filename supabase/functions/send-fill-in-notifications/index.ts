import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

type SubscriptionRow = {
  member_id: string
  subscription_id: string | null
  updated_at?: string | null
}

async function sendOneSignalNotification(params: {
  externalIds: string[]
  subscriptionIds: string[]
  title: string
  body: string
  data: Record<string, string | null>
}) {
  if (!ONESIGNAL_REST_API_KEY) {
    throw new Error(`OneSignal REST API key is not configured. Set one of: ${ONESIGNAL_REST_API_KEY_NAMES.join(', ')}`)
  }

  let sent = 0
  const errors: string[] = []
  const successfulTargetLabels: string[] = []

  const sends = [
    params.subscriptionIds.length > 0
      ? {
        label: 'subscription_ids',
        expectedRecipients: params.subscriptionIds.length,
        target: { include_subscription_ids: params.subscriptionIds },
      }
      : null,
    params.externalIds.length > 0
      ? {
        label: 'external_ids',
        expectedRecipients: params.externalIds.length,
        target: {
          include_aliases: {
            external_id: params.externalIds,
          },
          target_channel: 'push',
        },
      }
      : null,
  ].filter(Boolean) as {
    label: string
    expectedRecipients: number
    target: Record<string, unknown>
  }[]

  for (const send of sends) {
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        ...send.target,
        headings: { en: params.title },
        contents: { en: params.body },
        data: params.data,
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok || result.errors || !result.id) {
      errors.push(`${send.label}: ${JSON.stringify(result.errors ?? result)}`)
      continue
    }

    sent += result.recipients ?? send.expectedRecipients
    successfulTargetLabels.push(send.label)
  }

  return {
    sent,
    errors,
    successfulTargetLabels,
  }
}

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
      .select('name')
      .eq('id', fillInRequest.requesting_member_id)
      .single()

    const requestingMemberName = requestingMember?.name ?? 'A member'

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

    // 6. Prefer saved OneSignal subscription IDs because they target the exact
    // device. Fall back to external_id aliases for members without a saved row.
    const { data: subscriptionRows } = await supabase
      .from('onesignal_subscriptions')
      .select('member_id, subscription_id, updated_at')
      .in('member_id', recipientMemberIds)

    const latestSubscriptionRows = getLatestSubscriptionRows(subscriptionRows ?? [])
    stats.subscriptions = latestSubscriptionRows.length
    const memberIdsWithSubscriptions = new Set(latestSubscriptionRows.map((row) => row.member_id))
    const fallbackExternalIds = recipientMemberIds.filter((memberId) => !memberIdsWithSubscriptions.has(memberId))

    // 7. Build notification content
    const notificationTitle = `Fill-In Needed — ${churchName}`
    let notificationBody = `${requestingMemberName} needs a fill-in for ${fillInRequest.role_name} on ${serviceDateStr}`
    if (fillInRequest.reason) {
      notificationBody += ` — Reason: ${fillInRequest.reason}`
    }

    // 8. Send via OneSignal Push API
    const { sent, errors, successfulTargetLabels } = await sendOneSignalNotification({
      externalIds: fallbackExternalIds,
      subscriptionIds: latestSubscriptionRows.map((row) => row.subscription_id),
      title: notificationTitle,
      body: notificationBody,
      data: {
        type: 'fill_in_request',
        fillInRequestId: fillInRequest.id,
        serviceId: fillInRequest.service_id,
        roleName: fillInRequest.role_name,
      },
    })

    if (sent > 0) {
      const notifiedMemberIds = new Set<string>()
      if (successfulTargetLabels.includes('subscription_ids')) {
        latestSubscriptionRows.forEach((row) => notifiedMemberIds.add(row.member_id))
      }
      if (successfulTargetLabels.includes('external_ids')) {
        fallbackExternalIds.forEach((memberId) => notifiedMemberIds.add(memberId))
      }

      if (notifiedMemberIds.size > 0) {
        const { error: notificationHistoryError } = await supabase
          .from('member_notifications')
          .insert(Array.from(notifiedMemberIds).map(memberId => ({
            church_id: fillInRequest.church_id,
            member_id: memberId,
            notification_type: 'fill_in_request',
            title: notificationTitle,
            body: notificationBody,
            data: {
              type: 'fill_in_request',
              fillInRequestId: fillInRequest.id,
              serviceId: fillInRequest.service_id,
              roleName: fillInRequest.role_name,
            },
          })))

        if (notificationHistoryError) {
          console.error('Error recording member notifications:', notificationHistoryError)
        }
      }
    }

    await supabase.from('notification_log').insert({
      run_at: new Date().toISOString(),
      church_id: fillInRequest.church_id,
      service_id: fillInRequest.service_id,
      members_found: recipientMemberIds.length,
      tokens_found: latestSubscriptionRows.length,
      notifications_sent: sent,
      onesignal_response: JSON.stringify({ errors, successfulTargetLabels }),
      notes: `fill-in request ${fillInRequest.id}; role=${fillInRequest.role_name}; fallbackExternalIds=${fallbackExternalIds.length}; stats=${JSON.stringify(stats)}`,
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

function getLatestSubscriptionRows(rows: SubscriptionRow[]): { member_id: string; subscription_id: string }[] {
  const latestByMember = new Map<string, SubscriptionRow>()

  for (const row of rows) {
    if (!row.member_id || !row.subscription_id) continue

    const previous = latestByMember.get(row.member_id)
    if (!previous || getSubscriptionUpdatedAt(row) > getSubscriptionUpdatedAt(previous)) {
      latestByMember.set(row.member_id, row)
    }
  }

  return Array.from(latestByMember.values()).map((row) => ({
    member_id: row.member_id,
    subscription_id: row.subscription_id!,
  }))
}

function getSubscriptionUpdatedAt(row: SubscriptionRow): number {
  return row.updated_at ? new Date(row.updated_at).getTime() : 0
}

function normalizeSecret(value?: string | null): string | undefined {
  if (!value) return undefined

  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}
