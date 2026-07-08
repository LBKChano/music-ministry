import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') ?? 'd22a0591-70f3-4c9b-b006-00beed197e85'
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')

async function sendOneSignalNotification(params: {
  subscriptionIds: string[]
  title: string
  body: string
  data: Record<string, string | null>
}) {
  if (!ONESIGNAL_REST_API_KEY) {
    throw new Error('ONESIGNAL_REST_API_KEY is not configured')
  }

  const response = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_subscription_ids: params.subscriptionIds,
      headings: { en: params.title },
      contents: { en: params.body },
      data: params.data,
    }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok || result.errors) {
    return {
      sent: 0,
      errors: [JSON.stringify(result.errors ?? result)],
    }
  }

  return {
    sent: result.recipients ?? params.subscriptionIds.length,
    errors: [] as string[],
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
      .select('id, church_id, requesting_member_id, role_name, reason, service_id, status')
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

    // 3. Church name
    const { data: church } = await supabase
      .from('churches')
      .select('name')
      .eq('id', fillInRequest.church_id)
      .single()

    const churchName = church?.name ?? 'Your Church'

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

    // 5. Find role id for the requested role name
    const { data: churchRole } = await supabase
      .from('church_roles')
      .select('id')
      .eq('church_id', fillInRequest.church_id)
      .ilike('name', fillInRequest.role_name)
      .single()

    let eligibleMemberIds: string[] = []

    if (churchRole) {
      const { data: memberRoles } = await supabase
        .from('member_roles')
        .select('member_id')
        .eq('role_id', churchRole.id)

      if (memberRoles && memberRoles.length > 0) {
        eligibleMemberIds = memberRoles
          .map((mr: { member_id: string }) => mr.member_id)
          .filter((id: string) => id !== fillInRequest.requesting_member_id)
      }
    }

    if (eligibleMemberIds.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, errors: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Get OneSignal subscription IDs for eligible members
    const { data: subscriptionRows } = await supabase
      .from('onesignal_subscriptions')
      .select('member_id, subscription_id')
      .in('member_id', eligibleMemberIds)

    if (!subscriptionRows || subscriptionRows.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, errors: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. Build notification content
    const notificationTitle = `Fill-In Needed — ${churchName}`
    let notificationBody = `${requestingMemberName} needs a fill-in for ${fillInRequest.role_name} on ${serviceDateStr}`
    if (fillInRequest.reason) {
      notificationBody += ` — Reason: ${fillInRequest.reason}`
    }

    // 8. Send via OneSignal Push API
    const { sent, errors } = await sendOneSignalNotification({
      subscriptionIds: subscriptionRows.map((row: { subscription_id: string }) => row.subscription_id),
      title: notificationTitle,
      body: notificationBody,
      data: {
        fillInRequestId: fillInRequest.id,
        serviceId: fillInRequest.service_id,
        roleName: fillInRequest.role_name,
      },
    })

    return new Response(
      JSON.stringify({ sent, errors }),
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
