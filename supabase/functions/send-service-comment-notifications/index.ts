import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildNotificationTargets,
  sendOneSignalNotification,
  successfulSubscriptionMembers,
} from '../_shared/onesignal.ts'

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
    const { serviceCommentId, serviceCommentIds, notifyMemberIds } = await req.json()

    const requestedCommentIds = Array.isArray(serviceCommentIds)
      ? serviceCommentIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : typeof serviceCommentId === 'string' && serviceCommentId.length > 0
        ? [serviceCommentId]
        : []
    const uniqueCommentIds = Array.from(new Set(requestedCommentIds))

    if (uniqueCommentIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'serviceCommentId or serviceCommentIds is required' }),
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

    const { data: comments, error: commentError } = await supabase
      .from('service_comments')
      .select(`
        id,
        church_id,
        service_id,
        member_id,
        comment_text,
        song_type,
        song_number,
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
      .in('id', uniqueCommentIds)
      .order('created_at', { ascending: true })

    if (commentError || !comments || comments.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Service comment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const comment = comments[0]
    const allCommentsMatch = comments.every((item) =>
      item.church_id === comment.church_id
      && item.service_id === comment.service_id
      && item.member_id === comment.member_id
    )

    if (!allCommentsMatch) {
      return new Response(
        JSON.stringify({ error: 'All service comments must belong to the same service and author' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
      .select('member_id, subscription_id, updated_at')
      .in('member_id', eligibleMemberIds)

    const targets = buildNotificationTargets(
      eligibleMemberIds,
      subscriptionRows ?? [],
    )

    const service = Array.isArray(comment.services) ? comment.services[0] : comment.services
    const author = Array.isArray(comment.church_members) ? comment.church_members[0] : comment.church_members
    const authorName = author?.name?.trim() || author?.email || 'A member'
    const serviceLabel = service?.service_type ? `${service.service_type}` : 'a service'
    const songLabels = comments.map((item) => [
      item.song_type || 'Song',
      item.song_number ? `#${item.song_number}` : null,
    ].filter(Boolean).join(' '))
    const notificationTitle = comments.length > 1
      ? `Songs added for ${serviceLabel}`
      : `Song added for ${serviceLabel}`
    const notificationBody = comments.length > 1
      ? `${authorName} added ${comments.length} songs: ${truncateComment(songLabels.slice(0, 3).join(', '))}${comments.length > 3 ? '...' : ''}`
      : `${authorName} added ${songLabels[0]}: ${truncateComment(comment.comment_text)}`

    const eventKey = `service_comment:${comments
      .map((item) => item.id)
      .sort()
      .join(':')}`
    if (!ONESIGNAL_REST_API_KEY) {
      throw new Error(`OneSignal REST API key is not configured. Set one of: ${ONESIGNAL_REST_API_KEY_NAMES.join(', ')}`)
    }
    const {
      sent,
      errors,
      warnings,
      invalidSubscriptionIds,
      successfulTargetLabels,
    } = await sendOneSignalNotification({
      appId: ONESIGNAL_APP_ID,
      apiKey: ONESIGNAL_REST_API_KEY,
      eventKey,
      externalIds: targets.externalIds,
      subscriptionIds: targets.subscriptionIds,
      title: notificationTitle,
      body: notificationBody,
      data: {
        type: 'service_comment',
        serviceId: comment.service_id,
        serviceCommentId: comment.id,
        serviceCommentCount: String(comments.length),
      },
    })

    if (invalidSubscriptionIds.length > 0) {
      await supabase
        .from('onesignal_subscriptions')
        .delete()
        .in('subscription_id', invalidSubscriptionIds)
    }

    if (sent > 0) {
      const notifiedMemberIds = new Set<string>()
      if (successfulTargetLabels.includes('subscription_ids')) {
        successfulSubscriptionMembers(
          targets.subscriptionRows,
          invalidSubscriptionIds,
        ).forEach((memberId) => notifiedMemberIds.add(memberId))
      }
      if (successfulTargetLabels.includes('external_ids')) {
        targets.externalIds.forEach((memberId) => notifiedMemberIds.add(memberId))
      }

      if (notifiedMemberIds.size > 0) {
        const { error: notificationHistoryError } = await supabase
          .from('member_notifications')
          .upsert(Array.from(notifiedMemberIds).map(memberId => ({
            church_id: comment.church_id,
            member_id: memberId,
            event_key: eventKey,
            notification_type: 'service_comment',
            title: notificationTitle,
            body: notificationBody,
            data: {
              type: 'service_comment',
              serviceId: comment.service_id,
              serviceCommentId: comment.id,
              serviceCommentCount: String(comments.length),
            },
          })), {
            onConflict: 'member_id,event_key',
            ignoreDuplicates: true,
          })

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
      tokens_found: targets.subscriptionRows.length,
      notifications_sent: sent,
      onesignal_response: JSON.stringify({
        errors,
        warnings,
        invalidSubscriptionIds,
        successfulTargetLabels,
      }),
      notes: `service comments ${uniqueCommentIds.join(',')}; selected=${selectedMemberIds.length}; fallbackExternalIds=${targets.externalIds.length}`,
    })

    return new Response(
      JSON.stringify({ sent, errors, stats: { selectedMembers: selectedMemberIds.length, eligibleMembers: eligibleMemberIds.length, subscriptions: targets.subscriptionRows.length } }),
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
