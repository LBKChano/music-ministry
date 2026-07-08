import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')
  ?? Deno.env.get('ONE_SIGNAL_APP_ID')
  ?? 'd22a0591-70f3-4c9b-b006-00beed197e85'
const ONESIGNAL_REST_API_KEY_NAMES = [
  'ONESIGNAL_REST_API_KEY',
  'ONE_SIGNAL_REST_API_KEY',
  'ONESIGNAL_API_KEY',
  'ONE_SIGNAL_API_KEY',
  'ONESIGNAL_REST_KEY',
]
const ONESIGNAL_REST_API_KEY = ONESIGNAL_REST_API_KEY_NAMES
  .map((name) => Deno.env.get(name))
  .find((value): value is string => Boolean(value))
const SERVICE_TIME_ZONE = Deno.env.get('SERVICE_TIME_ZONE') ?? 'America/Chihuahua'
const REMINDER_TOLERANCE_MINUTES = Number(Deno.env.get('REMINDER_TOLERANCE_MINUTES') ?? '5')

type OneSignalMessage = {
  memberId: string
  subscriptionIds: string[]
  reminderKey: string
  title: string
  body: string
  data: Record<string, string>
}

async function sendOneSignalMessages(messages: OneSignalMessage[]) {
  if (!ONESIGNAL_REST_API_KEY) {
    throw new Error(`OneSignal REST API key is not configured. Set one of: ${ONESIGNAL_REST_API_KEY_NAMES.join(', ')}`)
  }

  let sent = 0
  const errors: string[] = []
  const successfulReminderKeys = new Set<string>()

  for (const message of messages) {
    const target = message.subscriptionIds.length > 0
      ? { include_subscription_ids: message.subscriptionIds }
      : {
        include_aliases: {
          external_id: [message.memberId],
        },
        target_channel: 'push',
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
        ...target,
        headings: { en: message.title },
        contents: { en: message.body },
        data: message.data,
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok || result.errors || !result.id) {
      errors.push(`${message.memberId}: ${JSON.stringify(result.errors ?? result)}`)
      continue
    }

    sent += result.recipients ?? 1
    successfulReminderKeys.add(message.reminderKey)
  }

  return { sent, errors, successfulReminderKeys: Array.from(successfulReminderKeys) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestBody = await req.clone().json().catch(() => ({}))
  if (requestBody?.diagnostic === true) {
    return new Response(JSON.stringify({
      onesignalConfigured: Boolean(ONESIGNAL_REST_API_KEY),
      checkedSecretNames: ONESIGNAL_REST_API_KEY_NAMES,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const now = new Date()
    const toleranceMs = Math.max(1, REMINDER_TOLERANCE_MINUTES) * 60 * 1000

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

    const todayStr = formatDateInTimeZone(now, SERVICE_TIME_ZONE)
    const windowEndStr = formatDateInTimeZone(windowEnd, SERVICE_TIME_ZONE)

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
    const pendingSentKeys = new Set<string>()
    const stats = {
      churches: churchIds.length,
      services: services.length,
      assignedMembers: allMemberIds.size,
      subscriptions: subscriptionRows?.length ?? 0,
      dueAssignments: 0,
      skippedNoSubscription: 0,
      skippedAlreadySent: 0,
    }

    // Build a map of church_id -> notification_hours
    const churchHoursMap = new Map<string, number[]>()
    for (const s of notifSettings) {
      churchHoursMap.set(s.church_id, s.notification_hours ?? [24, 6])
    }

    for (const service of services) {
      const notifHours = churchHoursMap.get(service.church_id) ?? [24, 6]
      const churchName = churchNameMap.get(service.church_id) ?? 'Your Church'

      const serviceDateTime = makeZonedDate(service.date, service.time ?? '09:00', SERVICE_TIME_ZONE)

      // Skip past services
      if (serviceDateTime <= now) continue

      for (const windowHours of notifHours) {
        const reminderDueAt = new Date(serviceDateTime.getTime() - windowHours * 60 * 60 * 1000)
        const msSinceDue = now.getTime() - reminderDueAt.getTime()
        if (msSinceDue < 0 || msSinceDue > toleranceMs) continue

        const roundedDays = Math.round(windowHours / 24)
        const reminderLabel = windowHours >= 24
          ? `${roundedDays} day${roundedDays !== 1 ? 's' : ''}`
          : `${windowHours} hour${windowHours !== 1 ? 's' : ''}`

        const dateDisplay = serviceDateTime.toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric', timeZone: SERVICE_TIME_ZONE,
        })
        const timeDisplay = service.time ? formatTime(service.time) : null

        for (const assignment of (service.assignments ?? [])) {
          if (!assignment.member_id) continue

          const subscriptionIds = subscriptionMap.get(assignment.member_id) ?? []

          const reminderKey = `${service.id}:${assignment.member_id}:${windowHours}`
          if (sentKeys.has(reminderKey) || pendingSentKeys.has(reminderKey)) {
            stats.skippedAlreadySent += 1
            continue
          }

          const title = `${churchName} — Service Reminder`
          const body = timeDisplay
            ? `You're scheduled as ${assignment.role} for ${service.service_type} on ${dateDisplay} at ${timeDisplay} (in ~${reminderLabel})`
            : `You're scheduled as ${assignment.role} for ${service.service_type} on ${dateDisplay} (in ~${reminderLabel})`

          stats.dueAssignments += 1
          if (subscriptionIds.length === 0) stats.skippedNoSubscription += 1
          messages.push({
            memberId: assignment.member_id,
            subscriptionIds,
            reminderKey,
            title,
            body,
            data: {
              type: 'service_reminder',
              serviceId: service.id,
              serviceType: service.service_type,
              serviceDate: service.date,
              role: assignment.role,
              reminderHours: String(windowHours),
            },
          })

          pendingSentKeys.add(reminderKey)
        }
      }
    }

    if (messages.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No reminders due', stats }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 9. Send via OneSignal Push API
    const { sent, errors, successfulReminderKeys } = await sendOneSignalMessages(messages)

    await supabase.from('notification_log').insert({
      run_at: new Date().toISOString(),
      members_found: stats.dueAssignments,
      tokens_found: messages.length,
      notifications_sent: sent,
      onesignal_response: JSON.stringify({ errors, successfulReminderKeys }),
      notes: `service reminder batch; stats=${JSON.stringify(stats)}`,
    })

    // 10. Record only reminders that OneSignal accepted so failed sends can retry.
    if (successfulReminderKeys.length > 0) {
      console.log(`Recording ${successfulReminderKeys.length} sent reminder keys`)
      await supabase.from('sent_reminders').insert(
        successfulReminderKeys.map(key => ({ reminder_key: key }))
      )
    }

    console.log(`send-service-reminders: sent=${sent}, errors=${errors.length}`)
    return new Response(JSON.stringify({ sent, errors, stats }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('send-service-reminders error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function makeZonedDate(dateString: string, timeString: string, timeZone: string): Date {
  const [year, month, day] = dateString.split('-').map((part) => parseInt(part, 10))
  const [hour, minute] = timeString.split(':').map((part) => parseInt(part, 10))
  const utcGuess = Date.UTC(year, month - 1, day, hour || 0, minute || 0, 0, 0)
  let utcTime = utcGuess

  for (let i = 0; i < 2; i += 1) {
    const offset = getTimeZoneOffsetMs(new Date(utcTime), timeZone)
    utcTime = utcGuess - offset
  }

  return new Date(utcTime)
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const values = new Map(parts.map((part) => [part.type, part.value]))
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const values = new Map(parts.map((part) => [part.type, part.value]))
  const asUTC = Date.UTC(
    parseInt(values.get('year') ?? '1970', 10),
    parseInt(values.get('month') ?? '1', 10) - 1,
    parseInt(values.get('day') ?? '1', 10),
    parseInt(values.get('hour') ?? '0', 10) % 24,
    parseInt(values.get('minute') ?? '0', 10),
    parseInt(values.get('second') ?? '0', 10),
  )

  return asUTC - date.getTime()
}

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
