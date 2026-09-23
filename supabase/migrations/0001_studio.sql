-- Plixa studio: one Postgres database replaces DynamoDB, and Storage
-- replaces the private S3 bucket. Tenant isolation is row-level security.
-- Apply this in the Supabase SQL editor when you connect a project.

create table public.organizations (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id text not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'reviewer', 'viewer')),
  primary key (org_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  jurisdiction text not null,
  status text not null default 'ready',
  perception jsonb not null,
  ir jsonb not null,
  report jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index projects_org_created_idx on public.projects (org_id, created_at desc);
create index projects_search_idx on public.projects using gin (
  to_tsvector('english', name || ' ' || coalesce(report::text, ''))
);

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.projects enable row level security;

create policy "members read orgs"
  on public.organizations for select
  using (exists (
    select 1 from public.memberships m
    where m.org_id = organizations.id and m.user_id = auth.uid()
  ));

create policy "members read memberships"
  on public.memberships for select
  using (user_id = auth.uid());

create policy "members read projects"
  on public.projects for select
  using (exists (
    select 1 from public.memberships m
    where m.org_id = projects.org_id and m.user_id = auth.uid()
  ));

create policy "reviewers insert projects"
  on public.projects for insert
  with check (exists (
    select 1 from public.memberships m
    where m.org_id = projects.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'reviewer')
  ));

-- Floor-plan files: create a private Storage bucket named "plans".
-- Object key: {org_id}/{project_id}/original
-- Storage policy should allow read/write only when a membership row exists
-- for the first folder segment and auth.uid().
