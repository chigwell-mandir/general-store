-- Adds per-person desk permissions (Setup → Desk volunteers & permissions).
-- Run once in Supabase → SQL Editor on a project created before this feature.

alter table events add column if not exists restrict_access boolean not null default false;

create table if not exists desk_users (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  volunteer_id uuid references volunteers(id) on delete set null,
  pin_hash     text,
  can_items    boolean not null default false,
  can_karyakar boolean not null default false,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);
alter table desk_users enable row level security;
drop policy if exists "desk access" on desk_users;
create policy "desk access" on desk_users for all to authenticated using (is_desk()) with check (is_desk());
alter publication supabase_realtime add table desk_users;
