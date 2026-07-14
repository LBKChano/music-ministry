with ranked_pending_requests as (
  select
    id,
    row_number() over (
      partition by assignment_id
      order by created_at desc, id desc
    ) as pending_rank
  from public.fill_in_requests
  where status = 'pending'
)
update public.fill_in_requests fir
set
  status = 'cancelled',
  updated_at = now()
from ranked_pending_requests ranked
where ranked.id = fir.id
  and ranked.pending_rank > 1;

create unique index if not exists fill_in_requests_one_pending_per_assignment_idx
on public.fill_in_requests (assignment_id)
where status = 'pending';
