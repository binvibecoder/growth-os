-- Run this in Supabase Dashboard → SQL Editor → New Query

create table if not exists dashboard_data (
  id         text primary key,
  user_id    text not null default 'binoy',
  section    text not null,
  data       jsonb not null default '{}',
  updated_at timestamptz default now()
);

create index if not exists idx_dashboard_user on dashboard_data(user_id);

create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_updated_at on dashboard_data;
create trigger trg_updated_at
  before update on dashboard_data
  for each row execute function update_updated_at();

alter table dashboard_data enable row level security;

drop policy if exists "allow_all" on dashboard_data;
create policy "allow_all" on dashboard_data for all using (true) with check (true);

insert into dashboard_data (id, user_id, section, data) values
  ('binoy_financial',    'binoy', 'financial',    '{}'),
  ('binoy_exercise',     'binoy', 'exercise',     '{}'),
  ('binoy_professional', 'binoy', 'professional', '{}')
on conflict (id) do nothing;
