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
  ].filter(Boolean) as Array<{
    label: string
    expectedRecipients: number
    target: Record<string, unknown>
  }>

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

  return { sent, errors, successfulTargetLabels }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { serviceCommentId, notifyMemberIds } = await req.json()

    if (!serviceCommentId) {
      return new Response(
        JSON.stringify({ error: 'serviceCommentId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const requestedMemberIds = Array.isArray(notifyMemberIds)
      ? Array.from(new Set(notifyMemberIds.filter((id): id is string => typeof id === 'string' && id.length > 0)))
      : []

    if (requestedMemberIds.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, errors: [], message: 'No members selected for notification' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: comment, error: commentError } = await supabase
      .from('service_comments')
      .select(`
        id,
        church_id,
        service_id,
        member_id,
        comment_text,
        services (
          service_type,
          date,
          time
        ),
        church_members (
          name,
          email
        )
      `)
      .eq('id', serviceCommentId)
      .single()

    if (commentError || !comment) {
      return new Response(
        JSON.stringify({ error: 'Service comment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const selectedMemberIds = requestedMemberIds.filter((id) => id !== comment.member_id)
    if (selectedMemberIds.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, errors: [], message: 'No other assigned members selected' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: assignments } = await supabase
      .from('assignments')
      .select('member_id')
      .eq('service_id', comment.service_id)
      .in('member_id', selectedMemberIds)

    const eligibleMemberIds = Array.from(new Set((assignments ?? [])
      .map((assignment: { member_id: string | null }) => assignment.member_id)
      .filter((id): id is string => Boolean(id) && id !== comment.member_id)))

    if (eligibleMemberIds.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, errors: [], message: 'No selected members are assigned to this service' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: subscriptionRows } = await supabase
      .from('onesignal_subscriptions')
      .select('member_id, subscription_id')
      .in('member_id', eligibleMemberIds)

    const memberIdsWithSubscriptions = new Set((subscriptionRows ?? []).map((row: { member_id: string }) => row.member_id))
    const fallbackExternalIds = eligibleMemberIds.filter((memberId) => !memberIdsWithSubscriptions.has(memberId))

    const service = Array.isArray(comment.services) ? comment.services[0] : comment.services
    const author = Array.isArray(comment.church_members) ? comment.church_members[0] : comment.church_members
    const authorName = author?.name ?? author?.email ?? 'A member'
    const serviceLabel = service?.service_type ? `${service.service_type}` : 'a service'
    const notificationTitle = `New comment for ${serviceLabel}`
    const notificationBody = `${authorName}: ${truncateComment(comment.comment_text)}`

    const { sent, errors, successfulTargetLabels } = await sendOneSignalNotification({
      externalIds: fallbackExternalIds,
      subscriptionIds: (subscriptionRows ?? []).map((row: { subscription_id: string }) => row.subscription_id),
      title: notificationTitle,
      body: notificationBody,
      data: {
        type: 'service_comment',
        serviceId: comment.service_id,
        serviceCommentId: comment.id,
      },
    })

    if (sent > 0) {
      const notifiedMemberIds = new Set<string>()
      if (successfulTargetLabels.includes('subscription_ids')) {
        ;(subscriptionRows ?? []).forEach((row: { member_id: string }) => notifiedMemberIds.add(row.member_id))
      }
      if (successfulTargetLabels.includes('external_ids')) {
        fallbackExternalIds.forEach((memberId) => notifiedMemberIds.add(memberId))
      }

      if (notifiedMemberIds.size > 0) {
        const { error: notificationHistoryError } = await supabase
          .from('member_notifications')
          .insert(Array.from(notifiedMemberIds).map(memberId => ({
            church_id: comment.church_id,
            member_id: memberId,
            notification_type: 'service_comment',
            title: notificationTitle,
            body: notificationBody,
            data: {
              type: 'service_comment',
              serviceId: comment.service_id,
              serviceCommentId: comment.id,
            },
          })))

        if (notificationHistoryError) {
          console.error('Error recording member notifications:', notificationHistoryError)
        }
      }
    }

    await supabase.from('notification_log').insert({
      run_at: new Date().toISOString(),
      church_id: comment.church_id,
      service_id: comment.service_id,
      members_found: eligibleMemberIds.length,
      tokens_found: subscriptionRows?.length ?? 0,
      notifications_sent: sent,
      onesignal_response: JSON.stringify({ errors, successfulTargetLabels }),
      notes: `service comment ${comment.id}; selected=${selectedMemberIds.length}; fallbackExternalIds=${fallbackExternalIds.length}`,
    })

    return new Response(
      JSON.stringify({ sent, errors, stats: { selectedMembers: selectedMemberIds.length, eligibleMembers: eligibleMemberIds.length, subscriptions: subscriptionRows?.length ?? 0 } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('send-service-comment-notifications error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

function truncateComment(comment: string): string {
  const normalized = comment.trim().replace(/\s+/g, ' ')
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized
}

function normalizeSecret(value?: string | null): string | undefined {
  if (!value) return undefined

  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}
