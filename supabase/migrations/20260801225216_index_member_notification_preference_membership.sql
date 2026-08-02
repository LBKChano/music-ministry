-- Cover the composite membership foreign key used for cascade cleanup and
-- membership-scoped preference lookups.
create index if not exists member_notification_preferences_member_church_idx
on public.member_notification_preferences (member_id, church_id);
