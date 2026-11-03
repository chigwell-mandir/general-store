-- Lets a zone lead collect items on behalf of a team member.
-- Run once in Supabase → SQL Editor on a project created before this feature. Safe to run twice.

alter table issues add column if not exists for_volunteer_id uuid references volunteers(id) on delete set null;

drop function if exists issue_item(uuid, uuid, int, text, text, text, text, text, boolean, uuid, uuid, boolean);

create or replace function issue_item(
  p_item_id uuid, p_volunteer_id uuid, p_qty int, p_issued_by text,
  p_note text default null, p_unit_box text default null, p_unit_wt_no text default null,
  p_unit_channel text default null, p_unit_earpiece boolean default null,
  p_zone_lead_id uuid default null, p_kit_id uuid default null, p_force boolean default false,
  p_for_volunteer_id uuid default null
) returns issues language plpgsql as $$
declare v_item items; v_issue issues; v_for text;
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
                      unit_channel, unit_earpiece, zone_lead_id, kit_id, for_volunteer_id)
  values (p_item_id, p_volunteer_id, p_qty, p_issued_by, nullif(trim(p_note), ''), nullif(trim(p_unit_box), ''),
          nullif(trim(p_unit_wt_no), ''), nullif(trim(p_unit_channel), ''), p_unit_earpiece, p_zone_lead_id, p_kit_id,
          p_for_volunteer_id)
  returning * into v_issue;

  select full_name into v_for from volunteers where id = p_for_volunteer_id;
  insert into activity (actor, action, volunteer_id, item_id, qty, details)
  values (p_issued_by, 'issue', p_volunteer_id, p_item_id, p_qty,
          nullif(concat_ws(' · ', case when v_for is not null then 'for ' || v_for end, nullif(trim(p_note), ''),
                 case when nullif(trim(p_unit_wt_no), '') is not null then 'WT ' || trim(p_unit_wt_no) end,
                 case when p_force then 'issued beyond counted stock' end), ''));
  return v_issue;
end $$;

revoke execute on function issue_item from public, anon;
grant execute on function issue_item to authenticated;
