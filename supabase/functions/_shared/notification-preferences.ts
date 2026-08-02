export type NotificationPreferenceCategory =
  | 'service_reminders'
  | 'fill_in_requests'
  | 'fill_in_updates'
  | 'service_comments'

type NotificationPreferenceRow = {
  member_id: string
  service_reminders?: boolean | null
  fill_in_requests?: boolean | null
  fill_in_updates?: boolean | null
  service_comments?: boolean | null
}

export type NotificationPreferenceResolution = {
  enabledMemberIds: string[]
  optedOutMemberIds: string[]
}

type PreferenceQueryResult = {
  data: unknown
  error: { message?: string } | null
}

type PreferenceQueryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, values: string[]) => PromiseLike<PreferenceQueryResult>
    }
  }
}

export function applyNotificationPreferenceRows(
  recipientMemberIds: string[],
  category: NotificationPreferenceCategory,
  rows: NotificationPreferenceRow[],
): NotificationPreferenceResolution {
  const recipients = Array.from(new Set(
    recipientMemberIds.map((id) => id.trim()).filter(Boolean),
  )).sort()
  const explicitlyDisabled = new Set(
    rows
      .filter((row) => row[category] === false)
      .map((row) => row.member_id),
  )

  return {
    enabledMemberIds: recipients.filter((id) => !explicitlyDisabled.has(id)),
    optedOutMemberIds: recipients.filter((id) => explicitlyDisabled.has(id)),
  }
}

export async function resolveNotificationPreferenceRecipients(
  client: unknown,
  recipientMemberIds: string[],
  category: NotificationPreferenceCategory,
): Promise<NotificationPreferenceResolution> {
  const recipients = Array.from(new Set(
    recipientMemberIds.map((id) => id.trim()).filter(Boolean),
  ))
  if (recipients.length === 0) {
    return { enabledMemberIds: [], optedOutMemberIds: [] }
  }

  const { data, error } = await (client as PreferenceQueryClient)
    .from('member_notification_preferences')
    .select(`member_id, ${category}`)
    .in('member_id', recipients)

  if (error) {
    throw new Error(
      `Failed to resolve notification preferences: ${error.message ?? 'Unknown database error'}`,
    )
  }

  const rows = Array.isArray(data)
    ? data.filter((row): row is NotificationPreferenceRow => (
      Boolean(row)
      && typeof row === 'object'
      && typeof (row as NotificationPreferenceRow).member_id === 'string'
    ))
    : []

  return applyNotificationPreferenceRows(recipients, category, rows)
}
