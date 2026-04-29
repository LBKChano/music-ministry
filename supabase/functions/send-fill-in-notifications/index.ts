import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      .eq('member_id', fillInRequest.requesting_member_id)
      .eq('church_id', fillInRequest.church_id)
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

    // 6. Get push tokens for eligible members
    const { data: pushTokenRows } = await supabase
      .from('push_tokens')
      .select('member_id, token')
      .in('member_id', eligibleMemberIds)

    if (!pushTokenRows || pushTokenRows.length === 0) {
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

    // 8. Send via Expo Push API
    const messages = pushTokenRows.map((row: { member_id: string; token: string }) => ({
      to: row.token,
      title: notificationTitle,
      body: notificationBody,
      data: {
        fillInRequestId: fillInRequest.id,
        serviceId: fillInRequest.service_id,
        roleName: fillInRequest.role_name,
      },
      sound: 'default',
      channelId: 'default',
    }))

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    })

    const expoResult = await expoResponse.json()

    const errors: string[] = []
    let sent = 0

    if (expoResult?.data && Array.isArray(expoResult.data)) {
      for (const ticket of expoResult.data) {
        if (ticket.status === 'ok') {
          sent++
        } else if (ticket.status === 'error') {
          errors.push(ticket.message ?? 'Unknown error')
        }
      }
    } else {
      sent = messages.length
    }

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
