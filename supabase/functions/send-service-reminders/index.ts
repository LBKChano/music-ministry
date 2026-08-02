import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildNotificationTargets,
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
const SERVICE_TIME_ZONE = Deno.env.get('SERVICE_TIME_ZONE') ?? 'America/Chihuahua'
const REMINDER_TOLERANCE_MINUTES = Number(Deno.env.get('REMINDER_TOLERANCE_MINUTES') ?? '5')

type OneSignalMessage = {
  churchId: string
  memberId: string
  subscriptionIds: string[]
  reminderKey: string
  title: string
  body: string
  data: Record<string, string>
}

async function sendOneSignalMessages(messages: OneSignalMessage[]) {
  if (messages.length === 0) {
    return {
      sent: 0,
      errors: [] as string[],
      warnings: [] as string[],
      invalidSubscriptionIds: [] as string[],
      notificationRows: [] as {
        church_id: string
        member_id: string
        notification_type: string
        title: string
        body: string
        data: Record<string, string>
        event_key: string
      }[],
      reminderKeysToRecord: [] as string[],
    }
  }

  if (!ONESIGNAL_REST_API_KEY) {
    throw new Error(`OneSignal REST API key is not configured. Set one of: ${ONESIGNAL_REST_API_KEY_NAMES.join(', ')}`)
  }

  let sent = 0
  const errors: string[] = []
  const warnings: string[] = []
  const successfulReminderKeys = new Set<string>()
  const terminalReminderKeys = new Set<string>()
  const invalidSubscriptionIds = new Set<string>()
  const notificationRows: {
    church_id: string
    member_id: string
    notification_type: string
    title: string
    body: string
    data: Record<string, string>
    event_key: string
  }[] = []

  for (const message of messages) {
    const subscriptionIds = Array.from(new Set(message.subscriptionIds))
    const result = await sendOneSignalNotification({
      appId: ONESIGNAL_APP_ID,
      apiKey: ONESIGNAL_REST_API_KEY,
      eventKey: `service_reminder:${message.reminderKey}`,
      externalIds: subscriptionIds.length === 0 ? [message.memberId] : [],
      subscriptionIds,
      title: message.title,
      body: message.body,
      data: message.data,
    })

    result.invalidSubscriptionIds.forEach((id) => invalidSubscriptionIds.add(id))
    result.errors.forEach((error) => errors.push(`${message.memberId}: ${error}`))
    result.warnings.forEach((warning) => warnings.push(`${message.memberId}: ${warning}`))

    if (result.successfulTargetLabels.length === 0) {
      if (
        subscriptionIds.length > 0
        && result.invalidSubscriptionIds.length >= subscriptionIds.length
      ) {
        terminalReminderKeys.add(message.reminderKey)
      }
      continue
    }

    sent += result.sent
    successfulReminderKeys.add(message.reminderKey)
    notificationRows.push({
      church_id: message.churchId,
      member_id: message.memberId,
      event_key: `service_reminder:${message.reminderKey}`,
      notification_type: 'service_reminder',
      title: message.title,
      body: message.body,
      data: message.data,
    })
  }

  return {
    sent,
    errors,
    warnings,
    invalidSubscriptionIds: Array.from(invalidSubscriptionIds),
    notificationRows,
    reminderKeysToRecord: Array.from(new Set([
      ...successfulReminderKeys,
      ...terminalReminderKeys,
    ])),
  }
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

    const preferenceResolution = await resolveNotificationPreferenceRecipients(
      supabase,
      Array.from(allMemberIds),
      'service_reminders',
    )
    const optedOutMemberIds = new Set(preferenceResolution.optedOutMemberIds)

    // 6. Get OneSignal subscription IDs for members with reminder push enabled.
    const subscriptionRows = await resolveNotificationSubscriptions(
      supabase,
      preferenceResolution.enabledMemberIds,
    )

    const targets = buildNotificationTargets(
      preferenceResolution.enabledMemberIds,
      subscriptionRows,
    )
    const subscriptionMap = new Map<string, string[]>()
    for (const row of targets.subscriptionRows) {
      const memberSubscriptions = subscriptionMap.get(row.member_id) ?? []
      memberSubscriptions.push(row.subscription_id)
      subscriptionMap.set(row.member_id, memberSubscriptions)
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
    const preferenceSuppressedNotificationRows: {
      church_id: string
      member_id: string
      notification_type: string
      title: string
      body: string
      data: Record<string, string>
      event_key: string
    }[] = []
    const preferenceSuppressedReminderKeys = new Set<string>()
    const pendingSentKeys = new Set<string>()
    const stats = {
      churches: churchIds.length,
      services: services.length,
      assignedMembers: allMemberIds.size,
      subscriptions: targets.subscriptionRows.length,
      dueAssignments: 0,
      skippedNoSubscription: 0,
      skippedAlreadySent: 0,
      skippedPreference: 0,
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
          const data = {
            type: 'service_reminder',
            serviceId: service.id,
            serviceType: service.service_type,
            serviceDate: service.date,
            role: assignment.role,
            reminderHours: String(windowHours),
          }

          stats.dueAssignments += 1
          if (optedOutMemberIds.has(assignment.member_id)) {
            stats.skippedPreference += 1
            preferenceSuppressedNotificationRows.push({
              church_id: service.church_id,
              member_id: assignment.member_id,
              event_key: `service_reminder:${reminderKey}`,
              notification_type: 'service_reminder',
              title,
              body,
              data,
            })
            preferenceSuppressedReminderKeys.add(reminderKey)
            pendingSentKeys.add(reminderKey)
            continue
          }

          if (subscriptionIds.length === 0) stats.skippedNoSubscription += 1
          messages.push({
            churchId: service.church_id,
            memberId: assignment.member_id,
            subscriptionIds,
            reminderKey,
            title,
            body,
            data,
          })

          pendingSentKeys.add(reminderKey)
        }
      }
    }

    if (messages.length === 0 && preferenceSuppressedNotificationRows.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No reminders due', stats }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 9. Send via OneSignal Push API
    const {
      sent,
      errors,
      warnings,
      invalidSubscriptionIds,
      notificationRows,
      reminderKeysToRecord,
    } = await sendOneSignalMessages(messages)
    const allNotificationRows = [
      ...notificationRows,
      ...preferenceSuppressedNotificationRows,
    ]
    const allReminderKeysToRecord = Array.from(new Set([
      ...reminderKeysToRecord,
      ...preferenceSuppressedReminderKeys,
    ]))

    if (invalidSubscriptionIds.length > 0) {
      await supabase
        .from('onesignal_subscriptions')
        .delete()
        .in('subscription_id', invalidSubscriptionIds)
    }

    if (allNotificationRows.length > 0) {
      const { error: notificationHistoryError } = await supabase
        .from('member_notifications')
        .upsert(allNotificationRows, {
          onConflict: 'member_id,event_key',
          ignoreDuplicates: true,
        })

      if (notificationHistoryError) {
        console.error('Error recording member notifications:', notificationHistoryError)
      }
    }

    await supabase.from('notification_log').insert({
      run_at: new Date().toISOString(),
      members_found: stats.dueAssignments,
      tokens_found: messages.length,
      notifications_sent: sent,
      onesignal_response: JSON.stringify({ errors, warnings, invalidSubscriptionIds, notificationHistoryRows: allNotificationRows.length, reminderKeysToRecord: allReminderKeysToRecord }),
      notes: `service reminder batch; stats=${JSON.stringify(stats)}`,
    })

    // 10. Record reminders that were accepted, or whose saved subscriptions are
    // all invalid, so cron does not retry the same device cleanup every minute.
    if (allReminderKeysToRecord.length > 0) {
      console.log(`Recording ${allReminderKeysToRecord.length} reminder keys`)
      const { error: sentReminderError } = await supabase
        .from('sent_reminders')
        .upsert(
          allReminderKeysToRecord.map(key => ({ reminder_key: key })),
          { onConflict: 'reminder_key' }
        )

      if (sentReminderError) {
        console.error('Error recording sent reminder keys:', sentReminderError)
      }
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

function normalizeSecret(value?: string | null): string | undefined {
  if (!value) return undefined

  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}
