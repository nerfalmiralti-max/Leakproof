-- Initial migration. Run once in the Supabase SQL Editor as the project owner.
begin;
create table public.reports (
  id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'NEW' check (status in ('NEW','IN_REVIEW','ACCEPTED','RESOLVED')),
  risk text not null check (risk in ('LOW','MEDIUM','HIGH')),
  analysis jsonb not null check (
    jsonb_typeof(analysis) = 'object'
    and analysis @> '{"provider":"openai","waterDetected":true,"quality":"GOOD","scenario":null,"waterConfidence":null,"activeFlowProbability":null}'::jsonb
    and coalesce(analysis->>'leakRisk' = risk, false)
    and coalesce(analysis->>'waterEvidence' in ('MODERATE','STRONG'), false)
    and coalesce(analysis->>'activeFlow' in ('NO','YES'), false)
  ),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location_label text not null check (char_length(btrim(location_label)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1000),
  video_name text not null check (char_length(video_name) between 1 and 255),
  video_size bigint not null check (video_size between 1 and 52428800),
  video_type text not null check (video_type in ('video/mp4','video/webm','video/quicktime')),
  video_duration double precision not null check (video_duration between 5 and 10),
  video_width integer not null check (video_width > 0),
  video_height integer not null check (video_height > 0),
  evidence_path text not null unique,
  is_demo boolean not null default false check (is_demo = false),
  check (evidence_path = 'reports/' || id::text || '/evidence.' || case video_type when 'video/mp4' then 'mp4' when 'video/webm' then 'webm' else 'mov' end)
);
create index reports_created_at_idx on public.reports (created_at desc, id);
create index reports_status_risk_idx on public.reports (status, risk);
alter table public.reports enable row level security;
revoke all on table public.reports from public, anon, authenticated;
grant select, insert, update, delete on table public.reports to service_role;
-- No public table policies. Service-role access is only through server endpoints.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-evidence', 'report-evidence', false, 52428800, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- Restricts any pre-existing broad anon/authenticated storage policy for this bucket.
create policy "report evidence requires server authorization" on storage.objects
as restrictive for all to anon, authenticated
using (bucket_id <> 'report-evidence') with check (bucket_id <> 'report-evidence');
commit;
