-- Link provider-level requests back to AI Quality runs for admin reconciliation.

alter table public.ai_provider_requests
  add column if not exists ai_quality_run_id uuid
    references public.ai_quality_runs(id) on delete set null;

create index if not exists idx_ai_provider_requests_ai_quality_run
  on public.ai_provider_requests(ai_quality_run_id);

create index if not exists idx_ai_provider_requests_route_created
  on public.ai_provider_requests(source_route, created_at desc);
