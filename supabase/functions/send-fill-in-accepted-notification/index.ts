import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildNotificationTargets,
  resolveNotificationSubscriptions,
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

    const { data: fillInRequest, error: fillInError } = await supabase
      .from('fill_in_requests')
      .select('id, church_id, requesting_member_id, filled_by_member_id, role_name, service_id, status')
      .eq('id', fillInRequestId)
      .single()

    if (fillInError || !fillInRequest) {
      return new Response(
        JSON.stringify({ error: 'Fill-in request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (fillInRequest.status !== 'filled' || !fillInRequest.filled_by_member_id) {
      return new Response(
        JSON.stringify({ sent: 0, errors: [], message: 'Fill-in request has not been accepted yet' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (fillInRequest.requesting_member_id === fillInRequest.filled_by_member_id) {
      return new Response(
        JSON.stringify({ sent: 0, errors: [], message: 'Requester accepted their own fill-in request' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const [{ data: requestingMember }, { data: fillingMember }, { data: church }] = await Promise.all([
      supabase
        .from('church_members')
        .select('id, name, email')
        .eq('id', fillInRequest.requesting_member_id)
        .single(),
      supabase
        .from('church_members')
        .select('id, name, email')
        .eq('id', fillInRequest.filled_by_member_id)
        .single(),
      supabase
        .from('churches')
        .select('name, admin_id')
        .eq('id', fillInRequest.church_id)
        .single(),
    ])

    const requesterName = requestingMember?.name ?? requestingMember?.email ?? 'A member'
    const fillingMemberName = fillingMember?.name ?? fillingMember?.email ?? 'Someone'
    const churchName = church?.name ?? 'Your Church'
    const churchOwnerUserId = church?.admin_id ?? null

    let serviceLabel = 'an upcoming service'
    if (fillInRequest.service_id) {
      const { data: service } = await supabase
        .from('services')
        .select('date, service_type, time')
        .eq('id', fillInRequest.service_id)
        .single()

      if (service?.date) {
        const date = new Date(service.date)
        serviceLabel = date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })

        if (service.time) {
          const [hours, minutes] = service.time.split(':')
          if (hours && minutes) {
            const serviceDateTime = new Date(service.date)
            serviceDateTime.setHours(Number(hours), Number(minutes), 0, 0)
            serviceLabel += ` at ${serviceDateTime.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}`
          }
        }

        if (service.service_type) {
          serviceLabel += ` (${service.service_type})`
        }
      }
    }

    const { data: churchMembers } = await supabase
      .from('church_members')
      .select('id, member_id, is_admin')
      .eq('church_id', fillInRequest.church_id)

    const adminMemberIds = Array.from(new Set((churchMembers ?? [])
      .filter((member: { id: string; member_id: string; is_admin: boolean }) =>
        member.id !== fillInRequest.filled_by_member_id
        && (member.is_admin || (churchOwnerUserId && member.member_id === churchOwnerUserId))
      )
      .map((member: { id: string }) => member.id)))

    const recipientMemberIds = Array.from(new Set([
      fillInRequest.requesting_member_id,
      ...adminMemberIds,
    ].filter((memberId): memberId is string => Boolean(memberId) && memberId !== fillInRequest.filled_by_member_id)))

    if (recipientMemberIds.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, errors: [], message: 'No requester or admin recipients found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const subscriptionRows = await resolveNotificationSubscriptions(
      supabase,
      recipientMemberIds,
    )

    const targets = buildNotificationTargets(
      recipientMemberIds,
      subscriptionRows,
    )

    const notificationTitle = `Fill-In Covered - ${churchName}`
    const notificationBody = `${fillingMemberName} accepted ${requesterName}'s fill-in request for ${fillInRequest.role_name} on ${serviceLabel}.`
    const notificationData = {
      type: 'fill_in_accepted',
      fillInRequestId: fillInRequest.id,
      serviceId: fillInRequest.service_id,
      filledByMemberId: fillInRequest.filled_by_member_id,
    }

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
      eventKey: `fill_in_accepted:${fillInRequest.id}`,
      externalIds: targets.externalIds,
      subscriptionIds: targets.subscriptionIds,
      title: notificationTitle,
      body: notificationBody,
      data: notificationData,
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
            church_id: fillInRequest.church_id,
            member_id: memberId,
            event_key: `fill_in_accepted:${fillInRequest.id}`,
            notification_type: 'fill_in_accepted',
            title: notificationTitle,
            body: notificationBody,
            data: notificationData,
          })), {
            onConflict: 'member_id,event_key',
            ignoreDuplicates: true,
          })

        if (notificationHistoryError) {
          console.error('Error recording accepted fill-in notification:', notificationHistoryError)
        }
      }
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
      notes: `fill-in accepted ${fillInRequest.id}; requester=${requesterName}; filledBy=${fillingMemberName}; admins=${adminMemberIds.length}; externalFallback=${targets.externalIds.length}`,
    })

    return new Response(
      JSON.stringify({ sent, errors, successfulTargetLabels }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('send-fill-in-accepted-notification error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function normalizeSecret(value?: string | null): string | undefined {
  if (!value) return undefined

  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}
