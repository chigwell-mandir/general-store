-- Restricts all data to the desk login(s) listed in allowed_logins.
-- Anyone else who manages to create an account sees and changes nothing.
-- Safe to run more than once.

create table if not exists allowed_logins (email text primary key);
alter table allowed_logins enable row level security;  -- no policies: only editable from the dashboard
insert into allowed_logins (email) values ('general-store@chigwellmandir.org') on conflict do nothing;

create or replace function is_desk() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from allowed_logins where email = lower(coalesce(auth.jwt() ->> 'email', '')))
$$;

do $$
declare t text;
begin
  foreach t in array array['events','zone_leads','department_leads','volunteers','items',
                           'kit_requirements','issues','checkins','activity'] loop
    execute format('drop policy if exists "desk access" on %I', t);
    execute format('create policy "desk access" on %I for all to authenticated using (is_desk()) with check (is_desk())', t);
  end loop;
end $$;
