import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type CleanupStats = {
  memberRows: number
  ownedChurches: number
  ownedChurchMemberRows: number
  clearedAssignments: number
  deletedAssignments: number
  deletedFillInRequests: number
  deletedMemberNotifications: number
  deletedMemberNotificationPreferences: number
  deletedMemberUnavailability: number
  deletedMemberRoles: number
  deactivatedNotificationDevices: number
  deletedOneSignalSubscriptions: number
  deletedPushTokens: number
  deletedServiceComments: number
  deletedChurchMembers: number
  deletedNotificationSettings: number
  deletedRecurringServiceRoles: number
  deletedRecurringServices: number
  deletedChurchRoles: number
  deletedServices: number
  deletedChurches: number
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function rowCount(count: number | null): number {
  return count ?? 0
}

function uniqueStrings(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function isMissingPreferenceTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const databaseError = error as { code?: string; message?: string }
  return databaseError.code === '42P01'
    || databaseError.code === 'PGRST205'
    || Boolean(
      databaseError.message?.includes('member_notification_preferences')
      && databaseError.message.includes('schema cache'),
    )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const requestBody = await req.clone().json().catch(() => ({})) as {
      preview?: unknown
    }
    const previewRequested = requestBody.preview === true
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: 'Delete account function is not configured' }, 500)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing authorization bearer token' }, 401)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return jsonResponse({ error: 'Invalid session' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })
    const userId = userData.user.id

    const { data: memberRows, error: memberRowsError } = await adminClient
      .from('church_members')
      .select('id, church_id')
      .eq('member_id', userId)

    if (memberRowsError) throw memberRowsError

    const { data: ownedChurchRows, error: ownedChurchesError } = await adminClient
      .from('churches')
      .select('id, name')
      .eq('admin_id', userId)

    if (ownedChurchesError) throw ownedChurchesError

    const memberIds = uniqueStrings((memberRows ?? []).map((member) => member.id))
    const ownedChurchIds = uniqueStrings((ownedChurchRows ?? []).map((church) => church.id))
    const { data: ownedChurchMemberRows, error: ownedChurchMembersError } = ownedChurchIds.length > 0
      ? await adminClient
        .from('church_members')
        .select('id')
        .in('church_id', ownedChurchIds)
      : { data: [], error: null }

    if (ownedChurchMembersError) throw ownedChurchMembersError

    const { data: ownedServiceRows, error: ownedServicesError } = ownedChurchIds.length > 0
      ? await adminClient
        .from('services')
        .select('id')
        .in('church_id', ownedChurchIds)
      : { data: [], error: null }

    if (ownedServicesError) throw ownedServicesError

    const { data: ownedRecurringServiceRows, error: ownedRecurringServicesError } = ownedChurchIds.length > 0
      ? await adminClient
        .from('recurring_services')
        .select('id')
        .in('church_id', ownedChurchIds)
      : { data: [], error: null }

    if (ownedRecurringServicesError) throw ownedRecurringServicesError

    const ownedChurchMemberIds = uniqueStrings((ownedChurchMemberRows ?? []).map((member) => member.id))
    const allMemberIdsToDelete = uniqueStrings([...memberIds, ...ownedChurchMemberIds])
    const ownedServiceIds = uniqueStrings((ownedServiceRows ?? []).map((service) => service.id))
    const ownedRecurringServiceIds = uniqueStrings((ownedRecurringServiceRows ?? []).map((service) => service.id))

    if (previewRequested) {
      const { count: assignmentsToClear, error: assignmentsToClearError } = memberIds.length > 0
        ? await adminClient
          .from('assignments')
          .select('id', { count: 'exact', head: true })
          .in('member_id', memberIds)
        : { count: 0, error: null }

      if (assignmentsToClearError) throw assignmentsToClearError

      const ownMembershipIds = new Set(memberIds)
      const otherChurchMembersRemoved = ownedChurchMemberIds.filter(
        (memberId) => !ownMembershipIds.has(memberId),
      ).length

      return jsonResponse({
        preview: true,
        impact: {
          memberships_removed: memberIds.length,
          owned_churches_deleted: ownedChurchIds.length,
          owned_church_names: (ownedChurchRows ?? [])
            .map((church) => church.name?.trim())
            .filter((name): name is string => Boolean(name))
            .sort((left, right) => left.localeCompare(right)),
          other_church_members_removed: otherChurchMembersRemoved,
          owned_services_deleted: ownedServiceIds.length,
          owned_weekly_services_deleted: ownedRecurringServiceIds.length,
          assignments_cleared: rowCount(assignmentsToClear),
        },
      })
    }

    const stats: CleanupStats = {
      memberRows: memberIds.length,
      ownedChurches: ownedChurchIds.length,
      ownedChurchMemberRows: ownedChurchMemberIds.length,
      clearedAssignments: 0,
      deletedAssignments: 0,
      deletedFillInRequests: 0,
      deletedMemberNotifications: 0,
      deletedMemberNotificationPreferences: 0,
      deletedMemberUnavailability: 0,
      deletedMemberRoles: 0,
      deactivatedNotificationDevices: 0,
      deletedOneSignalSubscriptions: 0,
      deletedPushTokens: 0,
      deletedServiceComments: 0,
      deletedChurchMembers: 0,
      deletedNotificationSettings: 0,
      deletedRecurringServiceRoles: 0,
      deletedRecurringServices: 0,
      deletedChurchRoles: 0,
      deletedServices: 0,
      deletedChurches: 0,
    }

    const {
      count: deactivatedNotificationDevices,
      error: deactivateNotificationDevicesError,
    } = await adminClient
      .from('account_notification_devices')
      .update(
        {
          active: false,
          updated_at: new Date().toISOString(),
        },
        { count: 'exact' },
      )
      .eq('account_id', userId)
      .eq('active', true)

    if (deactivateNotificationDevicesError) {
      throw deactivateNotificationDevicesError
    }
    stats.deactivatedNotificationDevices = rowCount(
      deactivatedNotificationDevices,
    )

    if (ownedChurchIds.length > 0) {
      const {
        count: preferencesByChurch,
        error: preferencesByChurchError,
      } = await adminClient
        .from('member_notification_preferences')
        .delete({ count: 'exact' })
        .in('church_id', ownedChurchIds)
      if (
        preferencesByChurchError
        && !isMissingPreferenceTableError(preferencesByChurchError)
      ) {
        throw preferencesByChurchError
      }
      stats.deletedMemberNotificationPreferences += rowCount(
        preferencesByChurch,
      )

      const { count: fillInRequestsByChurch, error: fillInByChurchError } = await adminClient
        .from('fill_in_requests')
        .delete({ count: 'exact' })
        .in('church_id', ownedChurchIds)
      if (fillInByChurchError) throw fillInByChurchError
      stats.deletedFillInRequests += rowCount(fillInRequestsByChurch)

      const { count: serviceCommentsByChurch, error: serviceCommentsByChurchError } = await adminClient
        .from('service_comments')
        .delete({ count: 'exact' })
        .in('church_id', ownedChurchIds)
      if (serviceCommentsByChurchError) throw serviceCommentsByChurchError
      stats.deletedServiceComments += rowCount(serviceCommentsByChurch)

      const { count: memberNotificationsByChurch, error: memberNotificationsByChurchError } = await adminClient
        .from('member_notifications')
        .delete({ count: 'exact' })
        .in('church_id', ownedChurchIds)
      if (memberNotificationsByChurchError) throw memberNotificationsByChurchError
      stats.deletedMemberNotifications += rowCount(memberNotificationsByChurch)

      const { count: notificationSettings, error: notificationSettingsError } = await adminClient
        .from('notification_settings')
        .delete({ count: 'exact' })
        .in('church_id', ownedChurchIds)
      if (notificationSettingsError) throw notificationSettingsError
      stats.deletedNotificationSettings = rowCount(notificationSettings)
    }

    if (ownedServiceIds.length > 0) {
      const { count: ownedAssignments, error: ownedAssignmentsError } = await adminClient
        .from('assignments')
        .delete({ count: 'exact' })
        .in('service_id', ownedServiceIds)
      if (ownedAssignmentsError) throw ownedAssignmentsError
      stats.deletedAssignments = rowCount(ownedAssignments)

      const { count: services, error: servicesError } = await adminClient
        .from('services')
        .delete({ count: 'exact' })
        .in('id', ownedServiceIds)
      if (servicesError) throw servicesError
      stats.deletedServices = rowCount(services)
    }

    if (ownedRecurringServiceIds.length > 0) {
      const { count: recurringServiceRoles, error: recurringServiceRolesError } = await adminClient
        .from('recurring_service_roles')
        .delete({ count: 'exact' })
        .in('recurring_service_id', ownedRecurringServiceIds)
      if (recurringServiceRolesError) throw recurringServiceRolesError
      stats.deletedRecurringServiceRoles = rowCount(recurringServiceRoles)

      const { count: recurringServices, error: recurringServicesError } = await adminClient
        .from('recurring_services')
        .delete({ count: 'exact' })
        .in('id', ownedRecurringServiceIds)
      if (recurringServicesError) throw recurringServicesError
      stats.deletedRecurringServices = rowCount(recurringServices)
    }

    if (memberIds.length > 0) {
      const { count: clearedAssignments, error: assignmentsError } = await adminClient
        .from('assignments')
        .update({ member_id: null, person_name: '' }, { count: 'exact' })
        .in('member_id', memberIds)
      if (assignmentsError) throw assignmentsError
      stats.clearedAssignments = rowCount(clearedAssignments)

      const { count: fillInRequestsByRequester, error: fillInRequesterError } = await adminClient
        .from('fill_in_requests')
        .delete({ count: 'exact' })
        .in('requesting_member_id', memberIds)
      if (fillInRequesterError) throw fillInRequesterError

      const { count: fillInRequestsByFiller, error: fillInFillerError } = await adminClient
        .from('fill_in_requests')
        .delete({ count: 'exact' })
        .in('filled_by_member_id', memberIds)
      if (fillInFillerError) throw fillInFillerError
      stats.deletedFillInRequests += rowCount(fillInRequestsByRequester) + rowCount(fillInRequestsByFiller)
    }

    if (allMemberIdsToDelete.length > 0) {
      const {
        count: memberNotificationPreferences,
        error: memberNotificationPreferencesError,
      } = await adminClient
        .from('member_notification_preferences')
        .delete({ count: 'exact' })
        .in('member_id', allMemberIdsToDelete)
      if (
        memberNotificationPreferencesError
        && !isMissingPreferenceTableError(memberNotificationPreferencesError)
      ) {
        throw memberNotificationPreferencesError
      }
      stats.deletedMemberNotificationPreferences += rowCount(
        memberNotificationPreferences,
      )

      const { count: serviceComments, error: serviceCommentsError } = await adminClient
        .from('service_comments')
        .delete({ count: 'exact' })
        .in('member_id', allMemberIdsToDelete)
      if (serviceCommentsError) throw serviceCommentsError
      stats.deletedServiceComments += rowCount(serviceComments)

      const { count: memberNotifications, error: memberNotificationsError } = await adminClient
        .from('member_notifications')
        .delete({ count: 'exact' })
        .in('member_id', allMemberIdsToDelete)
      if (memberNotificationsError) throw memberNotificationsError
      stats.deletedMemberNotifications += rowCount(memberNotifications)

      const { count: memberUnavailability, error: memberUnavailabilityError } = await adminClient
        .from('member_unavailability')
        .delete({ count: 'exact' })
        .in('member_id', allMemberIdsToDelete)
      if (memberUnavailabilityError) throw memberUnavailabilityError
      stats.deletedMemberUnavailability = rowCount(memberUnavailability)

      const { count: memberRoles, error: memberRolesError } = await adminClient
        .from('member_roles')
        .delete({ count: 'exact' })
        .in('member_id', allMemberIdsToDelete)
      if (memberRolesError) throw memberRolesError
      stats.deletedMemberRoles = rowCount(memberRoles)

      const { count: oneSignalSubscriptions, error: oneSignalSubscriptionsError } = await adminClient
        .from('onesignal_subscriptions')
        .delete({ count: 'exact' })
        .in('member_id', allMemberIdsToDelete)
      if (oneSignalSubscriptionsError) throw oneSignalSubscriptionsError
      stats.deletedOneSignalSubscriptions = rowCount(oneSignalSubscriptions)

      const { count: pushTokens, error: pushTokensError } = await adminClient
        .from('push_tokens')
        .delete({ count: 'exact' })
        .in('member_id', allMemberIdsToDelete)
      if (pushTokensError) throw pushTokensError
      stats.deletedPushTokens = rowCount(pushTokens)

      const { count: churchMembers, error: churchMembersError } = await adminClient
        .from('church_members')
        .delete({ count: 'exact' })
        .in('id', allMemberIdsToDelete)
      if (churchMembersError) throw churchMembersError
      stats.deletedChurchMembers = rowCount(churchMembers)
    }

    if (ownedChurchIds.length > 0) {
      const { count: churchRoles, error: churchRolesError } = await adminClient
        .from('church_roles')
        .delete({ count: 'exact' })
        .in('church_id', ownedChurchIds)
      if (churchRolesError) throw churchRolesError
      stats.deletedChurchRoles = rowCount(churchRoles)
    }

    if (ownedChurchIds.length > 0) {
      const { count: churches, error: churchesError } = await adminClient
        .from('churches')
        .delete({ count: 'exact' })
        .in('id', ownedChurchIds)
      if (churchesError) throw churchesError
      stats.deletedChurches = rowCount(churches)
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId)
    if (deleteUserError) throw deleteUserError

    return jsonResponse({ deleted: true, stats })
  } catch (error) {
    console.error('[delete-account] failed:', error)
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Failed to delete account',
    }, 500)
  }
})
