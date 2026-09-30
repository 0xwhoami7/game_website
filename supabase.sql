-- Run this once in Supabase → SQL Editor.
-- It creates the tiny realtime backend used by Common Ground.

create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) = 6),
  host_name text not null check (char_length(host_name) between 1 and 48),
  status text not null default 'lobby' check (status in ('lobby', 'answering', 'results', 'finished')),
  current_round integer not null default 0 check (current_round >= 0),
  rounds integer not null check (rounds between 1 and 20),
  range_max numeric not null check (range_max > 0 and range_max <= 10000),
  target_factor numeric not null check (target_factor > 0 and target_factor <= 1),
  duration_sec integer not null default 60 check (duration_sec between 0 and 600),
  started_at timestamptz,
  created_at timestamptz not null default now()
);

-- Facilitator secrets live separately so a public room query can never expose
-- them. This table has RLS enabled below and intentionally has no read policy.
create table if not exists public.room_hosts (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  host_token uuid not null unique
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 32),
  joined_at timestamptz not null default now()
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  round integer not null check (round > 0),
  value numeric not null check (value >= 0),
  created_at timestamptz not null default now(),
  unique (participant_id, round)
);

create index if not exists participants_room_idx on public.participants(room_id);
create index if not exists responses_room_round_idx on public.responses(room_id, round);

-- Creates the public room row and its private facilitator secret atomically.
create or replace function public.create_room(
  p_id uuid,
  p_code text,
  p_host_token uuid,
  p_host_name text,
  p_rounds integer,
  p_range_max numeric,
  p_target_factor numeric,
  p_duration_sec integer
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare new_room public.rooms;
begin
  insert into public.rooms (
    id, code, host_name, rounds, range_max, target_factor, duration_sec
  ) values (
    p_id, upper(p_code), p_host_name, p_rounds, p_range_max,
    p_target_factor, p_duration_sec
  ) returning * into new_room;

  insert into public.room_hosts (room_id, host_token)
  values (new_room.id, p_host_token);

  return new_room;
end;
$$;

-- Sensitive room state changes go through this token-checked function. The
-- browser keeps the random token only on the facilitator's device.
create or replace function public.host_update_room(
  p_room_id uuid,
  p_host_token uuid,
  p_status text,
  p_current_round integer,
  p_started_at timestamptz
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare updated_room public.rooms;
begin
  if p_status not in ('lobby', 'answering', 'results', 'finished') then
    raise exception 'Invalid room status';
  end if;

  update public.rooms
  set status = p_status,
      current_round = p_current_round,
      started_at = p_started_at
  where id = p_room_id
    and exists (
      select 1 from public.room_hosts h
      where h.room_id = p_room_id and h.host_token = p_host_token
    )
    and p_current_round between 0 and rounds
  returning * into updated_room;

  if updated_room.id is null then
    raise exception 'Invalid facilitator token';
  end if;
  return updated_room;
end;
$$;

revoke all on function public.create_room(uuid, text, uuid, text, integer, numeric, numeric, integer) from public;
grant execute on function public.create_room(uuid, text, uuid, text, integer, numeric, numeric, integer) to anon;
revoke all on function public.host_update_room(uuid, uuid, text, integer, timestamptz) from public;
grant execute on function public.host_update_room(uuid, uuid, text, integer, timestamptz) to anon;

alter table public.rooms enable row level security;
alter table public.room_hosts enable row level security;
alter table public.participants enable row level security;
alter table public.responses enable row level security;

-- The publishable browser key maps unsigned visitors to the anon role. Grant
-- only the operations the game UI uses; RLS policies below further restrict them.
grant select on public.rooms to anon;
grant select, insert on public.participants to anon;
grant select, insert on public.responses to anon;

-- Workshop rooms are deliberately anonymous and short-lived. The random
-- host_token is required for room changes, while submissions are insert-only.
create policy "rooms are readable" on public.rooms for select to anon using (true);

create policy "participants are readable" on public.participants for select to anon using (true);
create policy "anyone can join an open room" on public.participants for insert to anon
  with check (exists (select 1 from public.rooms r where r.id = room_id and r.status <> 'finished'));

create policy "responses are readable after submission" on public.responses for select to anon using (true);
create policy "participants can submit" on public.responses for insert to anon
  with check (
    exists (
      select 1 from public.rooms r
      where r.id = room_id
        and r.status = 'answering'
        and round = r.current_round
        and value <= r.range_max
    )
    and exists (select 1 from public.participants p where p.id = participant_id and p.room_id = room_id)
  );

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.responses;
