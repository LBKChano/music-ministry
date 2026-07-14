revoke all on function private.auto_assign_service_slots_impl(uuid, text) from public;
revoke all on function private.auto_assign_service_slots_impl(uuid, text) from anon;
revoke all on function public.auto_assign_service_slots(uuid, text) from public;
revoke all on function public.auto_assign_service_slots(uuid, text) from anon;

grant execute on function private.auto_assign_service_slots_impl(uuid, text) to authenticated;
grant execute on function public.auto_assign_service_slots(uuid, text) to authenticated;
