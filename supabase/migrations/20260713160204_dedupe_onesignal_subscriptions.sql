delete from public.onesignal_subscriptions os
using (
  select
    id,
    row_number() over (
      partition by member_id
      order by updated_at desc nulls last, id desc
    ) as row_rank
  from public.onesignal_subscriptions
) ranked
where os.id = ranked.id
  and ranked.row_rank > 1;
