import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') ?? 'd22a0591-70f3-4c9b-b006-00beed197e85'
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')

type OneSignalMessage = {
  subscriptionId: string
  title: string
  body: string
  data: Record<string, string>
}

async function sendOneSignalMessages(messages: OneSignalMessage[]) {
  if (!ONESIGNAL_REST_API_KEY) {
    throw new Error('ONESIGNAL_REST_API_KEY is not configured')
  }

  let sent = 0
  const errors: string[] = []

  for (const message of messages) {
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_subscription_ids: [message.subscriptionId],
        headings: { en: message.title },
        contents: { en: message.body },
        data: message.data,
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok || result.errors) {
      errors.push(JSON.stringify(result.errors ?? result))
      continue
    }

    sent += result.recipients ?? 1
  }

  return { sent, errors }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const now = new Date()

    // 1. Get all churches with notification settings enabled
    const { data: notifSettings, error: settingsError } = await supabase
      .from('notification_settings')
      .select('church_id, notification_hours, enabled')
      .eq('enabled', true)

    if (settingsError) {
      console.error('Error fetching notification settings:', settingsError)
      return new Response(JSON.stringify({ error: settingsError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!notifSettings || notifSettings.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No churches with notifications enabled' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Find the maximum notification window across all churches (to limit service query)
    const allHours = notifSettings.flatMap((s: { notification_hours: number[] }) => s.notification_hours ?? [])
    const maxHours = allHours.length > 0 ? Math.max(...allHours) : 48
    const windowEnd = new Date(now.getTime() + (maxHours + 2) * 60 * 60 * 1000)

    const todayStr = now.toISOString().split('T')[0]
    const windowEndStr = windowEnd.toISOString().split('T')[0]

    // 3. Fetch upcoming services with assignments for all relevant churches
    const churchIds = notifSettings.map((s: { church_id: string }) => s.church_id)

    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select(`
        id, church_id, date, time, service_type,
        assignments ( id, member_id, role, person_name )
      `)
      .in('church_id', churchIds)
      .gte('date', todayStr)
      .lte('date', windowEndStr)

    if (servicesError) {
      console.error('Error fetching services:', servicesError)
      return new Response(JSON.stringify({ error: servicesError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!services || services.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No upcoming services in window' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Get church names
    const { data: churches } = await supabase
      .from('churches')
      .select('id, name')
      .in('id', churchIds)

    const churchNameMap = new Map<string, string>()
    for (const c of (churches ?? [])) {
      churchNameMap.set(c.id, c.name)
    }

    // 5. Collect all member IDs that have assignments in upcoming services
    const allMemberIds = new Set<string>()
    for (const service of services) {
      for (const assignment of (service.assignments ?? [])) {
        if (assignment.member_id) allMemberIds.add(assignment.member_id)
      }
    }

    if (allMemberIds.size === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No assigned members in upcoming services' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 6. Get OneSignal subscription IDs for all relevant members
    const { data: subscriptionRows } = await supabase
      .from('onesignal_subscriptions')
      .select('member_id, subscription_id')
      .in('member_id', Array.from(allMemberIds))

    const subscriptionMap = new Map<string, string[]>()
    for (const row of (subscriptionRows ?? [])) {
      if (!subscriptionMap.has(row.member_id)) subscriptionMap.set(row.member_id, [])
      subscriptionMap.get(row.member_id)!.push(row.subscription_id)
    }

    // 7. Check which reminders have already been sent (deduplication)
    // Key format: "{service_id}:{member_id}:{hours_window}"
    const { data: sentReminders } = await supabase
      .from('sent_reminders')
      .select('reminder_key')
      .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())

    const sentKeys = new Set<string>((sentReminders ?? []).map((r: { reminder_key: string }) => r.reminder_key))

    // 8. Build messages
    const messages: OneSignalMessage[] = []
    const newSentKeys: string[] = []

    // Build a map of church_id -> notification_hours
    const churchHoursMap = new Map<string, number[]>()
    for (const s of notifSettings) {
      churchHoursMap.set(s.church_id, s.notification_hours ?? [24, 6])
    }

    for (const service of services) {
      const notifHours = churchHoursMap.get(service.church_id) ?? [24, 6]
      const churchName = churchNameMap.get(service.church_id) ?? 'Your Church'

      // Build service datetime
      const dateParts = service.date.split('-')
      const year = parseInt(dateParts[0], 10)
      const month = parseInt(dateParts[1], 10) - 1
      const day = parseInt(dateParts[2], 10)

      let serviceDateTime: Date
      if (service.time) {
        const timeParts = service.time.split(':')
        serviceDateTime = new Date(year, month, day, parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), 0, 0)
      } else {
        serviceDateTime = new Date(year, month, day, 9, 0, 0, 0)
      }

      // Skip past services
      if (serviceDateTime <= now) continue

      const hoursUntil = (serviceDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)

      for (const windowHours of notifHours) {
        // Send when within the window (with 1h buffer on upper end)
        if (hoursUntil > windowHours + 1 || hoursUntil <= 0) continue

        const roundedDays = Math.round(windowHours / 24)
        const reminderLabel = windowHours >= 24
          ? `${roundedDays} day${roundedDays !== 1 ? 's' : ''}`
          : `${windowHours} hour${windowHours !== 1 ? 's' : ''}`

        const dateDisplay = serviceDateTime.toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric'
        })
        const timeDisplay = service.time ? formatTime(service.time) : null

        for (const assignment of (service.assignments ?? [])) {
          if (!assignment.member_id) continue

          const subscriptionIds = subscriptionMap.get(assignment.member_id)
          if (!subscriptionIds || subscriptionIds.length === 0) continue

          const reminderKey = `${service.id}:${assignment.member_id}:${windowHours}`
          if (sentKeys.has(reminderKey)) continue

          const title = `${churchName} — Service Reminder`
          const body = timeDisplay
            ? `You're scheduled as ${assignment.role} for ${service.service_type} on ${dateDisplay} at ${timeDisplay} (in ~${reminderLabel})`
            : `You're scheduled as ${assignment.role} for ${service.service_type} on ${dateDisplay} (in ~${reminderLabel})`

          for (const subscriptionId of subscriptionIds) {
            messages.push({
              subscriptionId,
              title,
              body,
              data: { serviceId: service.id, serviceType: service.service_type, serviceDate: service.date, role: assignment.role },
            })
          }

          newSentKeys.push(reminderKey)
          sentKeys.add(reminderKey) // prevent duplicates within this run
        }
      }
    }

    if (messages.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No reminders due' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 9. Send via OneSignal Push API
    const { sent, errors } = await sendOneSignalMessages(messages)

    // 10. Record sent reminders for deduplication
    if (newSentKeys.length > 0) {
      console.log(`Recording ${newSentKeys.length} sent reminder keys`)
      await supabase.from('sent_reminders').insert(
        newSentKeys.map(key => ({ reminder_key: key }))
      )
    }

    console.log(`send-service-reminders: sent=${sent}, errors=${errors.length}`)
    return new Response(JSON.stringify({ sent, errors }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('send-service-reminders error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function formatTime(timeString: string): string {
  try {
    const parts = timeString.split(':')
    const hour = parseInt(parts[0], 10)
    const minutes = parts[1] || '00'
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  } catch {
    return timeString
  }
}
