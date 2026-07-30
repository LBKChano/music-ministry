export type SubscriptionRow = {
  member_id: string
  subscription_id: string | null
  updated_at?: string | null
}

export type UniqueSubscriptionRow = {
  member_id: string
  subscription_id: string
}

export type NotificationTargets = {
  subscriptionRows: UniqueSubscriptionRow[]
  subscriptionIds: string[]
  externalIds: string[]
}

type OneSignalSendParams = {
  appId: string
  apiKey: string
  eventKey: string
  externalIds: string[]
  subscriptionIds: string[]
  title: string
  body: string
  data: Record<string, string | null>
}

export type OneSignalSendResult = {
  sent: number
  errors: string[]
  warnings: string[]
  invalidSubscriptionIds: string[]
  successfulTargetLabels: string[]
}

type RecipientSubscriptionRpcResult = {
  data: unknown
  error: { message?: string } | null
}

type RecipientSubscriptionRpcClient = {
  rpc: (
    functionName: string,
    args: { target_member_ids: string[] },
  ) => PromiseLike<RecipientSubscriptionRpcResult>
}

export async function resolveNotificationSubscriptions(
  client: unknown,
  recipientMemberIds: string[],
): Promise<SubscriptionRow[]> {
  const memberIds = Array.from(
    new Set(recipientMemberIds.map((id) => id.trim()).filter(Boolean)),
  )
  if (memberIds.length === 0) return []

  const { data, error } = await (
    client as RecipientSubscriptionRpcClient
  ).rpc('resolve_notification_recipient_subscriptions', {
    target_member_ids: memberIds,
  })

  if (error) {
    throw new Error(
      `Failed to resolve notification subscriptions: ${error.message ?? 'Unknown database error'}`,
    )
  }

  if (!Array.isArray(data)) return []

  return data
    .filter((row): row is Record<string, unknown> => (
      Boolean(row)
      && typeof row === 'object'
      && typeof row.member_id === 'string'
      && typeof row.subscription_id === 'string'
    ))
    .map((row) => ({
      member_id: row.member_id as string,
      subscription_id: row.subscription_id as string,
    }))
}

export function buildNotificationTargets(
  recipientMemberIds: string[],
  rows: SubscriptionRow[],
): NotificationTargets {
  const recipientIds = new Set(recipientMemberIds.filter(Boolean))
  const latestByMemberSubscription = new Map<string, SubscriptionRow>()

  for (const row of rows) {
    const subscriptionId = row.subscription_id?.trim()
    if (!row.member_id || !subscriptionId || !recipientIds.has(row.member_id)) continue

    const key = `${row.member_id}\u0000${subscriptionId}`
    const previous = latestByMemberSubscription.get(key)
    if (!previous || getUpdatedAt(row) > getUpdatedAt(previous)) {
      latestByMemberSubscription.set(key, {
        ...row,
        subscription_id: subscriptionId,
      })
    }
  }

  const subscriptionRows = Array.from(latestByMemberSubscription.values())
    .map((row) => ({
      member_id: row.member_id,
      subscription_id: row.subscription_id!,
    }))
    .sort((left, right) => (
      left.member_id.localeCompare(right.member_id)
      || left.subscription_id.localeCompare(right.subscription_id)
    ))
  const memberIdsWithSubscriptions = new Set(
    subscriptionRows.map((row) => row.member_id),
  )

  return {
    subscriptionRows,
    subscriptionIds: Array.from(new Set(
      subscriptionRows.map((row) => row.subscription_id),
    )).sort(),
    externalIds: Array.from(recipientIds)
      .filter((memberId) => !memberIdsWithSubscriptions.has(memberId))
      .sort(),
  }
}

export async function sendOneSignalNotification(
  params: OneSignalSendParams,
): Promise<OneSignalSendResult> {
  const subscriptionIds = Array.from(new Set(
    params.subscriptionIds.map((id) => id.trim()).filter(Boolean),
  )).sort()
  const externalIds = Array.from(new Set(
    params.externalIds.map((id) => id.trim()).filter(Boolean),
  )).sort()
  const sends = [
    subscriptionIds.length > 0
      ? {
        label: 'subscription_ids',
        expectedRecipients: subscriptionIds.length,
        target: { include_subscription_ids: subscriptionIds },
      }
      : null,
    externalIds.length > 0
      ? {
        label: 'external_ids',
        expectedRecipients: externalIds.length,
        target: {
          include_aliases: { external_id: externalIds },
          target_channel: 'push',
        },
      }
      : null,
  ].filter(Boolean) as {
    label: string
    expectedRecipients: number
    target: Record<string, unknown>
  }[]

  let sent = 0
  const errors: string[] = []
  const warnings: string[] = []
  const invalidSubscriptionIds = new Set<string>()
  const successfulTargetLabels: string[] = []

  for (const send of sends) {
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${params.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        app_id: params.appId,
        ...send.target,
        headings: { en: params.title },
        contents: { en: params.body },
        data: params.data,
        idempotency_key: await createIdempotencyKey(
          `${params.eventKey}:${send.label}`,
        ),
      }),
    })

    const result = await response.json().catch(() => ({})) as {
      id?: unknown
      recipients?: unknown
      errors?: unknown
      warnings?: unknown
      invalid_player_ids?: unknown
    }
    const invalidIds = getInvalidSubscriptionIds(result)
    invalidIds.forEach((id) => invalidSubscriptionIds.add(id))
    const accepted = (
      response.ok
      && typeof result.id === 'string'
      && result.id.length > 0
    )

    if (!accepted) {
      errors.push(`${send.label}: ${JSON.stringify(result.errors ?? result)}`)
      continue
    }

    const fallbackRecipientCount = Math.max(
      0,
      send.expectedRecipients - invalidIds.length,
    )
    sent += typeof result.recipients === 'number'
      ? result.recipients
      : fallbackRecipientCount
    successfulTargetLabels.push(send.label)

    if (result.errors) {
      warnings.push(`${send.label}: ${JSON.stringify(result.errors)}`)
    }
    if (result.warnings) {
      warnings.push(`${send.label}: ${JSON.stringify(result.warnings)}`)
    }
  }

  return {
    sent,
    errors,
    warnings,
    invalidSubscriptionIds: Array.from(invalidSubscriptionIds),
    successfulTargetLabels,
  }
}

export function successfulSubscriptionMembers(
  subscriptionRows: UniqueSubscriptionRow[],
  invalidSubscriptionIds: string[],
): Set<string> {
  const invalidIds = new Set(invalidSubscriptionIds)
  return new Set(
    subscriptionRows
      .filter((row) => !invalidIds.has(row.subscription_id))
      .map((row) => row.member_id),
  )
}

async function createIdempotencyKey(eventKey: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(eventKey),
    ),
  )
  const bytes = digest.slice(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

function getUpdatedAt(row: SubscriptionRow): number {
  return row.updated_at ? new Date(row.updated_at).getTime() : 0
}

function getInvalidSubscriptionIds(result: unknown): string[] {
  if (!result || typeof result !== 'object') return []

  const payload = result as {
    invalid_player_ids?: unknown
    errors?: unknown
  }
  const directIds = Array.isArray(payload.invalid_player_ids)
    ? payload.invalid_player_ids
    : []
  const nestedIds = (
    payload.errors
    && typeof payload.errors === 'object'
    && !Array.isArray(payload.errors)
    && Array.isArray(
      (payload.errors as { invalid_player_ids?: unknown }).invalid_player_ids,
    )
  )
    ? (payload.errors as { invalid_player_ids: unknown[] }).invalid_player_ids
    : []

  return Array.from(new Set([...directIds, ...nestedIds]))
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}
