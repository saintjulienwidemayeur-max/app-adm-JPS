create extension if not exists "pgcrypto";

create type parcel_status as enum
  ('PENDING_ACTIVATION','ACTIVATED_AT_ORIGIN','IN_WAREHOUSE','IN_TRANSIT','ARRIVED','DELIVERED','RETURNED');
create type payment_status as enum ('UNPAID','PARTIAL','PAID');

create table customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  address text,
  created_at timestamptz not null default now()
);
create unique index customers_phone_key on customers (phone);

create table parcels (
  id uuid primary key default gen_random_uuid(),
  tracking_number text not null unique,
  sender_id uuid references customers(id),
  receiver_name text,
  receiver_phone text,
  destination text,
  weight_lbs numeric(8,2),
  length numeric(8,2), width numeric(8,2), height numeric(8,2),
  chargeable_weight numeric(8,2),
  total_cost numeric(10,2),
  status parcel_status not null default 'PENDING_ACTIVATION',
  shelf_location text,
  created_at timestamptz not null default now()
);
create index parcels_status_idx on parcels (status);
create index parcels_sender_idx on parcels (sender_id);

create table parcel_events (
  id uuid primary key default gen_random_uuid(),
  parcel_id uuid not null references parcels(id) on delete cascade,
  event_type text not null,
  location text,
  scanned_by_user_id uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now()
);
create index parcel_events_parcel_idx on parcel_events (parcel_id, created_at desc);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  parcel_id uuid not null references parcels(id) on delete cascade,
  amount numeric(10,2) not null,
  payment_status payment_status not null default 'UNPAID',
  payment_method text,
  created_at timestamptz not null default now()
);

-- RLS: any authenticated staff member has access. Tighten with roles later.
alter table customers enable row level security;
alter table parcels enable row level security;
alter table parcel_events enable row level security;
alter table invoices enable row level security;
create policy staff_all on customers for all to authenticated using (true) with check (true);
create policy staff_all on parcels for all to authenticated using (true) with check (true);
create policy staff_all on parcel_events for all to authenticated using (true) with check (true);
create policy staff_all on invoices for all to authenticated using (true) with check (true);
