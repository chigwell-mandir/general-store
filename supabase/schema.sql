-- General Store — database schema
-- Run this ONCE in Supabase → SQL Editor → New query → paste → Run.
--
-- Every event-specific table carries event_id (always 1 for now) so that
-- multi-event support can be added later without reshaping the data.

create extension if not exists pgcrypto;

-- ── Event settings ────────────────────────────────────────────────────────
create table events (
  id              int primary key,
  name            text not null,
  overdue_time    text not null default '21:00',          -- HH:MM, local time
  escalation_mode text not null default 'zone'
                  check (escalation_mode in ('zone', 'confirmer'))
);
insert into events (id, name) values (1, 'Diwali 2026');

-- ── Zone leads (who unreturned items are escalated to) ───────────────────
create table zone_leads (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  created_at timestamptz not null default now()
);
-- (volunteer_id, linking a zone lead to their own directory entry, is added
--  after the volunteers table below.)

create table department_leads (
  department   text primary key,
  zone_lead_id uuid not null references zone_leads(id) on delete cascade
);

-- ── Volunteer directory (imported from the mastersheet) ──────────────────
create table volunteers (
  id            uuid primary key default gen_random_uuid(),
  satsang_id    text unique,
  full_name     text not null,
  mandal        text,
  phone         text,
  department    text,
  vcd           text,
  comments      text,
  added_at_desk boolean not null default false,
  zone_lead_id  uuid references zone_leads(id) on delete set null, -- manual override
  created_at    timestamptz not null default now()
);

-- A zone lead can also be a volunteer with their own items to return.
alter table zone_leads add column volunteer_id uuid references volunteers(id) on delete set null;

-- ── Item catalogue + live stock ───────────────────────────────────────────
create table items (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,
  name          text not null,
  returnable    boolean not null default true,
  track_stock   boolean not null default false,  -- false = no count yet, just log
  in_store      int not null default 0 check (in_store >= 0),
  low_threshold int not null default 0,
  unit_tracking boolean not null default false,  -- optional box / WT no. / channel
  active        boolean not null default true,
  sort          int not null default 0,
  unique (category, name)
);

-- ── Confirmed kit per volunteer ──────────────────────────────────────────
create table kit_requirements (
  id           uuid primary key default gen_random_uuid(),
  event_id     int not null default 1 references events(id),
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  item_id      uuid not null references items(id) on delete cascade,
  qty          int not null default 1 check (qty > 0),
  confirmed_by text not null,
  note         text,
  created_at   timestamptz not null default now(),
  created_by   text
);

-- ── Issues (one row per hand-out; returns update it) ─────────────────────
create table issues (
  id            uuid primary key default gen_random_uuid(),
  event_id      int not null default 1 references events(id),
  item_id       uuid not null references items(id),
  volunteer_id  uuid not null references volunteers(id),
  qty           int not null check (qty > 0),
  returned_qty  int not null default 0,
  issued_at     timestamptz not null default now(),
  issued_by     text not null,
  returned_at   timestamptz,
  returned_by   text,
  note          text,
  unit_box      text,
  unit_wt_no    text,
  unit_channel  text,
  unit_earpiece boolean,
  zone_lead_id  uuid references zone_leads(id) on delete set null, -- manual override
  kit_id        uuid references kit_requirements(id) on delete set null,
  check (returned_qty between 0 and qty)
);
create index on issues (volunteer_id);
create index on issues (item_id);

-- ── On-the-day karyakar (KK) registration: check-in / check-out ───────────
create table checkins (
  id               uuid primary key default gen_random_uuid(),
  event_id         int not null default 1 references events(id),
  volunteer_id     uuid not null references volunteers(id) on delete cascade,
  checked_in_at    timestamptz not null default now(),
  checked_in_by    text not null,
  checked_out_at timestamptz,
  checked_out_by text,
  unique (event_id, volunteer_id)
);

-- ── Audit log ─────────────────────────────────────────────────────────────
create table activity (
  id           bigint generated always as identity primary key,
  event_id     int not null default 1 references events(id),
  at           timestamptz not null default now(),
  actor        text not null,
  action       text not null,
  volunteer_id uuid references volunteers(id) on delete set null,
  item_id      uuid references items(id) on delete set null,
  qty          int,
  details      text
);
create index on activity (at desc);

-- ── Security: only the desk login(s) in allowed_logins can read or write ─
-- Add the shared desk email here (Table Editor → allowed_logins) — other accounts see nothing.
create table allowed_logins (email text primary key);
alter table allowed_logins enable row level security;  -- no policies: only editable from the dashboard

create or replace function is_desk() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from allowed_logins where email = lower(coalesce(auth.jwt() ->> 'email', '')))
$$;

do $$
declare t text;
begin
  foreach t in array array['events','zone_leads','department_leads','volunteers','items',
                           'kit_requirements','issues','checkins','activity'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "desk access" on %I for all to authenticated using (is_desk()) with check (is_desk())', t);
    execute format('alter publication supabase_realtime add table %I', t);
  end loop;
end $$;

-- ── Stock operations (atomic: two desks can never oversell the last item) ─

create or replace function issue_item(
  p_item_id uuid, p_volunteer_id uuid, p_qty int, p_issued_by text,
  p_note text default null, p_unit_box text default null, p_unit_wt_no text default null,
  p_unit_channel text default null, p_unit_earpiece boolean default null,
  p_zone_lead_id uuid default null, p_kit_id uuid default null, p_force boolean default false
) returns issues language plpgsql as $$
declare v_item items; v_issue issues;
begin
  if p_qty is null or p_qty < 1 then raise exception 'Quantity must be at least 1'; end if;
  select * into v_item from items where id = p_item_id for update;
  if not found then raise exception 'Item not found'; end if;

  if v_item.track_stock then
    if v_item.in_store < p_qty and not p_force then
      raise exception 'INSUFFICIENT_STOCK:%', v_item.in_store;
    end if;
    update items set in_store = greatest(in_store - p_qty, 0) where id = p_item_id;
  end if;

  insert into issues (item_id, volunteer_id, qty, issued_by, note, unit_box, unit_wt_no,
                      unit_channel, unit_earpiece, zone_lead_id, kit_id)
  values (p_item_id, p_volunteer_id, p_qty, p_issued_by, nullif(trim(p_note), ''), nullif(trim(p_unit_box), ''),
          nullif(trim(p_unit_wt_no), ''), nullif(trim(p_unit_channel), ''), p_unit_earpiece, p_zone_lead_id, p_kit_id)
  returning * into v_issue;

  insert into activity (actor, action, volunteer_id, item_id, qty, details)
  values (p_issued_by, 'issue', p_volunteer_id, p_item_id, p_qty,
          nullif(concat_ws(' · ', nullif(trim(p_note), ''),
                 case when nullif(trim(p_unit_wt_no), '') is not null then 'WT ' || trim(p_unit_wt_no) end,
                 case when p_force then 'issued beyond counted stock' end), ''));
  return v_issue;
end $$;

create or replace function return_issue(p_issue_id uuid, p_qty int, p_by text)
returns issues language plpgsql as $$
declare v_issue issues; v_left int;
begin
  select * into v_issue from issues where id = p_issue_id for update;
  if not found then raise exception 'That issue no longer exists'; end if;
  v_left := v_issue.qty - v_issue.returned_qty;
  if p_qty is null or p_qty < 1 or p_qty > v_left then
    raise exception 'Only % still out', v_left;
  end if;

  update issues set returned_qty = returned_qty + p_qty, returned_at = now(), returned_by = p_by
  where id = p_issue_id returning * into v_issue;
  update items set in_store = in_store + p_qty where id = v_issue.item_id and track_stock;

  insert into activity (actor, action, volunteer_id, item_id, qty, details)
  values (p_by, 'return', v_issue.volunteer_id, v_issue.item_id, p_qty,
          case when v_issue.returned_qty < v_issue.qty
               then (v_issue.qty - v_issue.returned_qty) || ' still out' end);
  return v_issue;
end $$;

-- Cancels an issue entered by mistake: puts stock back and logs it.
create or replace function void_issue(p_issue_id uuid, p_by text)
returns void language plpgsql as $$
declare v_issue issues;
begin
  select * into v_issue from issues where id = p_issue_id for update;
  if not found then raise exception 'That issue no longer exists'; end if;
  update items set in_store = in_store + (v_issue.qty - v_issue.returned_qty)
  where id = v_issue.item_id and track_stock;
  delete from issues where id = p_issue_id;
  insert into activity (actor, action, volunteer_id, item_id, qty, details)
  values (p_by, 'void', v_issue.volunteer_id, v_issue.item_id, v_issue.qty, 'Issue cancelled (entered by mistake)');
end $$;

create or replace function set_stock_count(p_item_id uuid, p_count int, p_by text, p_reason text default null)
returns void language plpgsql as $$
declare v_item items;
begin
  if p_count is null or p_count < 0 then raise exception 'Count must be 0 or more'; end if;
  select * into v_item from items where id = p_item_id for update;
  if not found then raise exception 'Item not found'; end if;
  update items set in_store = p_count, track_stock = true where id = p_item_id;
  insert into activity (actor, action, item_id, qty, details)
  values (p_by, 'stock', p_item_id, p_count,
          concat_ws(' · ',
            case when v_item.track_stock then v_item.in_store || ' → ' || p_count else 'first count: ' || p_count end,
            nullif(trim(p_reason), '')));
end $$;

revoke execute on function issue_item, return_issue, void_issue, set_stock_count from public, anon;
grant execute on function issue_item, return_issue, void_issue, set_stock_count to authenticated;

-- Called by the GitHub keep-alive job so the free project never pauses.
create or replace function keepalive() returns int language sql security definer as $$ select 1 $$;
grant execute on function keepalive() to anon;
