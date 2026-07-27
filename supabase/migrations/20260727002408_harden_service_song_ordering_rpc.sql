revoke all on function public.reorder_service_songs(uuid, uuid[]) from public;
revoke execute on function public.reorder_service_songs(uuid, uuid[]) from anon;
grant execute on function public.reorder_service_songs(uuid, uuid[]) to authenticated;
