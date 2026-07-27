-- Deployed as Supabase migration 20260727012039. Covers the composite
-- member-role foreign key used for cascade checks and
-- cleanup. This is additive and does not change any client-visible contract.

create index if not exists member_scheduling_preferences_member_role_idx
on public.member_scheduling_preferences (member_id, role_id);
