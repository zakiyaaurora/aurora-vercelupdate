-- =====================================================================
-- AURORA SEWA KEBAYA — Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)
-- Idempotent-ish: safe to run once on a fresh project.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Numbering sequences
-- ---------------------------------------------------------------------
create sequence if not exists public.seq_booking;
create sequence if not exists public.seq_rental;
create sequence if not exists public.seq_invoice;
create sequence if not exists public.seq_payment;
create sequence if not exists public.seq_customer;
create sequence if not exists public.seq_product;
create sequence if not exists public.seq_sku;

-- ---------------------------------------------------------------------
-- PROFILES (mirror of auth.users with role/status)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  role text not null default 'STAFF' check (role in ('OWNER','ADMIN','KASIR','STAFF')),
  phone text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- role helper (security definer avoids RLS recursion)
create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- auto-create profile when an auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'STAFF'),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- generic updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ---------------------------------------------------------------------
-- CATEGORIES
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PRODUCTS
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  product_code text unique,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  description text,
  color text,
  size text,
  material text,
  brand text,
  rental_price numeric(14,2) not null default 0,
  deposit numeric(14,2) not null default 0,
  late_fee_per_day numeric(14,2) not null default 0,
  purchase_price numeric(14,2) not null default 0,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_category on public.products(category_id);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- INVENTORY ITEMS (physical units)
-- ---------------------------------------------------------------------
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text unique,
  serial_number text,
  condition text not null default 'GOOD' check (condition in ('GOOD','MINOR_DAMAGE','DAMAGED','NEEDS_REPAIR')),
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','BOOKED','RENTED','MAINTENANCE','DAMAGED','LOST','RESERVED')),
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_inv_product on public.inventory_items(product_id);
create index if not exists idx_inv_status on public.inventory_items(status);

-- ---------------------------------------------------------------------
-- CUSTOMERS (+ measurements)
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text unique,
  name text not null,
  phone text,
  whatsapp text,
  email text,
  address text,
  birth_date date,
  gender text,
  notes text,
  lingkar_dada numeric(6,1),
  lingkar_perut numeric(6,1),
  lingkar_lengan numeric(6,1),
  lingkar_ketiak numeric(6,1),
  tinggi_badan numeric(6,1),
  berat_badan numeric(6,1),
  panjang_badan numeric(6,1),
  panjang_lengan numeric(6,1),
  measurement_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customers_name on public.customers(name);

-- ---------------------------------------------------------------------
-- BOOKINGS + ITEMS
-- ---------------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  booking_date date not null default current_date,
  event_date date,
  start_date date not null,
  end_date date not null,
  status text not null default 'CONFIRMED' check (status in ('DRAFT','PENDING','CONFIRMED','READY','PAID','RENTED','COMPLETED','RETURNED','CANCELLED')),
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  deposit numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bookings_customer on public.bookings(customer_id);
create index if not exists idx_bookings_dates on public.bookings(start_date, end_date);

create table if not exists public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  quantity int not null default 1,
  rental_price numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  notes text
);
create index if not exists idx_bitems_booking on public.booking_items(booking_id);

-- ---------------------------------------------------------------------
-- RENTALS + ITEMS
-- ---------------------------------------------------------------------
create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),
  rental_number text unique,
  booking_id uuid references public.bookings(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  pickup_date date not null default current_date,
  due_date date not null,
  actual_return_date date,
  status text not null default 'OUT' check (status in ('READY','BOOKED','OUT','ACTIVE','OVERDUE','LATE','RETURNED','CANCELLED')),
  subtotal numeric(14,2) not null default 0,
  deposit numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  late_fee numeric(14,2) not null default 0,
  damage_fee numeric(14,2) not null default 0,
  lost_fee numeric(14,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rentals_customer on public.rentals(customer_id);
create index if not exists idx_rentals_status on public.rentals(status);

create table if not exists public.rental_items (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  product_id uuid not null references public.products(id) on delete restrict,
  rental_price numeric(14,2) not null default 0,
  condition_out text default 'GOOD',
  condition_return text,
  damage_fee numeric(14,2) not null default 0,
  lost_fee numeric(14,2) not null default 0,
  notes text
);
create index if not exists idx_ritems_rental on public.rental_items(rental_id);

-- ---------------------------------------------------------------------
-- INVOICES
-- ---------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique,
  booking_id uuid references public.bookings(id) on delete set null,
  rental_id uuid references public.rentals(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  invoice_date date not null default current_date,
  due_date date,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  deposit numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0,
  remaining numeric(14,2) not null default 0,
  status text not null default 'UNPAID' check (status in ('UNPAID','PARTIAL','PAID','CANCELLED')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_invoices_customer on public.invoices(customer_id);

-- ---------------------------------------------------------------------
-- PAYMENTS
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text unique,
  invoice_id uuid references public.invoices(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  rental_id uuid references public.rentals(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  amount numeric(14,2) not null default 0,
  payment_method text not null default 'CASH' check (payment_method in ('CASH','TRANSFER','QRIS','DEBIT','CREDIT','OTHER')),
  payment_type text not null default 'PARTIAL' check (payment_type in ('DEPOSIT','DP','PARTIAL','FULL','REFUND','PENALTY')),
  payment_date date not null default current_date,
  reference_number text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_payments_date on public.payments(payment_date);

-- ---------------------------------------------------------------------
-- STOCK MOVEMENTS
-- ---------------------------------------------------------------------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  quantity int not null default 0,
  type text not null check (type in ('STOCK_IN','RENTAL_OUT','RENTAL_RETURN','ADJUSTMENT','DAMAGE','MAINTENANCE','LOST')),
  reference_type text,
  reference_id uuid,
  user_id uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_stockmv_product on public.stock_movements(product_id);

-- ---------------------------------------------------------------------
-- AUDIT LOGS
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  description text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_created on public.audit_logs(created_at);

-- ---------------------------------------------------------------------
-- SETTINGS (key/value)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings(key, value) values
  ('store', '{"name":"AURORA SEWA KEBAYA","address":"","phone":"","email":"","tax_percent":0,"terms":"Barang yang telah disewa menjadi tanggung jawab penyewa. Kerusakan/kehilangan dikenakan biaya sesuai ketentuan."}'::jsonb)
on conflict (key) do nothing;

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['profiles','categories','products','inventory_items','customers','bookings','rentals']
  loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s;', t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$s for each row execute procedure public.touch_updated_at();', t);
  end loop;
end $$;

-- =====================================================================
-- AUDIT HELPER
-- =====================================================================
create or replace function public.log_audit(p_action text, p_entity text, p_entity_id uuid, p_desc text)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs(user_id, action, entity_type, entity_id, description)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_desc);
$$;

-- =====================================================================
-- AVAILABILITY ENGINE
-- =====================================================================
create or replace function public.check_availability(p_product_id uuid, p_start date, p_end date)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_total int; v_busy int;
begin
  select count(*) into v_total from inventory_items
    where product_id = p_product_id and status not in ('DAMAGED','LOST');

  select count(distinct u.id) into v_busy from inventory_items u
   where u.product_id = p_product_id and (
     u.status in ('MAINTENANCE')
     or exists (
        select 1 from booking_items bi join bookings b on b.id = bi.booking_id
        where bi.inventory_item_id = u.id
          and b.status in ('PENDING','CONFIRMED','READY','PAID','RENTED')
          and b.start_date <= p_end and b.end_date >= p_start)
     or exists (
        select 1 from rental_items ri join rentals r on r.id = ri.rental_id
        where ri.inventory_item_id = u.id
          and r.status in ('READY','BOOKED','OUT','ACTIVE','OVERDUE','LATE')
          and r.actual_return_date is null
          and r.pickup_date <= p_end and coalesce(r.due_date, r.pickup_date) >= p_start)
   );

  return json_build_object(
    'total', v_total,
    'busy', v_busy,
    'available', greatest(v_total - v_busy, 0)
  );
end; $$;

-- =====================================================================
-- CREATE BOOKING (atomic + availability validated)
-- =====================================================================
create or replace function public.create_booking(p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid := nullif(p->>'customer_id','')::uuid;
  v_start date := (p->>'start_date')::date;
  v_end date := (p->>'end_date')::date;
  v_event date := nullif(p->>'event_date','')::date;
  v_discount numeric := coalesce((p->>'discount')::numeric, 0);
  v_deposit numeric := coalesce((p->>'deposit')::numeric, 0);
  v_notes text := p->>'notes';
  v_status text := coalesce(p->>'status','CONFIRMED');
  v_items jsonb := coalesce(p->'items','[]'::jsonb);
  v_item jsonb;
  v_bid uuid; v_bnum text; v_subtotal numeric := 0; v_total numeric;
  v_inv uuid; v_invnum text;
  v_avail json; v_inv_item uuid; v_price numeric; v_qty int;
begin
  if v_customer is null then raise exception 'customer_required'; end if;
  if jsonb_array_length(v_items) = 0 then raise exception 'items_required'; end if;
  if v_start is null or v_end is null or v_end < v_start then raise exception 'invalid_dates'; end if;

  for v_item in select * from jsonb_array_elements(v_items) loop
    v_avail := check_availability((v_item->>'product_id')::uuid, v_start, v_end);
    if (v_avail->>'available')::int < coalesce((v_item->>'quantity')::int, 1) then
      raise exception 'not_available:%', (v_item->>'product_id');
    end if;
  end loop;

  v_bnum := 'BK-' || to_char(now(),'YYYY') || '-' || lpad(nextval('seq_booking')::text, 6, '0');
  insert into bookings(booking_number, customer_id, booking_date, event_date, start_date, end_date, status, discount, deposit, notes, created_by)
  values (v_bnum, v_customer, current_date, v_event, v_start, v_end, v_status, v_discount, v_deposit, v_notes, auth.uid())
  returning id into v_bid;

  for v_item in select * from jsonb_array_elements(v_items) loop
    v_qty := coalesce((v_item->>'quantity')::int, 1);
    v_price := coalesce((v_item->>'rental_price')::numeric, 0);
    v_inv_item := nullif(v_item->>'inventory_item_id','')::uuid;
    if v_inv_item is null then
      select u.id into v_inv_item from inventory_items u
        where u.product_id = (v_item->>'product_id')::uuid and u.status = 'AVAILABLE'
          and not exists (
            select 1 from booking_items bi join bookings b on b.id = bi.booking_id
            where bi.inventory_item_id = u.id
              and b.status in ('PENDING','CONFIRMED','READY','PAID','RENTED')
              and b.start_date <= v_end and b.end_date >= v_start)
        limit 1;
    end if;
    insert into booking_items(booking_id, product_id, inventory_item_id, quantity, rental_price, subtotal, notes)
    values (v_bid, (v_item->>'product_id')::uuid, v_inv_item, v_qty, v_price, v_price * v_qty, v_item->>'notes');
    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;

  v_total := v_subtotal - v_discount;
  update bookings set subtotal = v_subtotal, total = v_total where id = v_bid;

  v_invnum := 'INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('seq_invoice')::text, 6, '0');
  insert into invoices(invoice_number, booking_id, customer_id, invoice_date, due_date, subtotal, discount, deposit, tax, total, paid, remaining, status, notes)
  values (v_invnum, v_bid, v_customer, current_date, v_end, v_subtotal, v_discount, v_deposit, 0, v_total, 0, v_total, 'UNPAID', v_notes)
  returning id into v_inv;

  perform log_audit('create','booking', v_bid, 'Booking ' || v_bnum);
  return json_build_object('booking_id', v_bid, 'booking_number', v_bnum,
    'invoice_id', v_inv, 'invoice_number', v_invnum, 'subtotal', v_subtotal, 'total', v_total);
end; $$;

-- =====================================================================
-- CHECKOUT RENTAL (booking -> rental, inventory -> RENTED)
-- =====================================================================
create or replace function public.checkout_rental(p_booking_id uuid, p_pickup date default current_date)
returns json language plpgsql security definer set search_path = public as $$
declare v_rid uuid; v_rnum text; v_b bookings%rowtype; v_bi record;
begin
  select * into v_b from bookings where id = p_booking_id;
  if not found then raise exception 'booking_not_found'; end if;
  if v_b.status = 'RENTED' then raise exception 'already_checked_out'; end if;

  v_rnum := 'RN-' || to_char(now(),'YYYY') || '-' || lpad(nextval('seq_rental')::text, 6, '0');
  insert into rentals(rental_number, booking_id, customer_id, pickup_date, due_date, status, subtotal, deposit, total, created_by)
  values (v_rnum, v_b.id, v_b.customer_id, p_pickup, v_b.end_date, 'OUT', v_b.subtotal, v_b.deposit, v_b.total, auth.uid())
  returning id into v_rid;

  for v_bi in select * from booking_items where booking_id = p_booking_id loop
    insert into rental_items(rental_id, inventory_item_id, product_id, rental_price, condition_out)
    values (v_rid, v_bi.inventory_item_id, v_bi.product_id, v_bi.rental_price, 'GOOD');
    if v_bi.inventory_item_id is not null then
      update inventory_items set status = 'RENTED' where id = v_bi.inventory_item_id;
      insert into stock_movements(product_id, inventory_item_id, quantity, type, reference_type, reference_id, user_id, notes)
      values (v_bi.product_id, v_bi.inventory_item_id, -1, 'RENTAL_OUT', 'rental', v_rid, auth.uid(), 'Rental ' || v_rnum);
    end if;
  end loop;

  update bookings set status = 'RENTED' where id = p_booking_id;
  update invoices set rental_id = v_rid where booking_id = p_booking_id;
  perform log_audit('create','rental', v_rid, 'Rental ' || v_rnum);
  return json_build_object('rental_id', v_rid, 'rental_number', v_rnum);
end; $$;

-- =====================================================================
-- RETURN RENTAL (atomic: fees + inventory + stock + invoice)
-- =====================================================================
create or replace function public.return_rental(p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_rid uuid := (p->>'rental_id')::uuid;
  v_actual date := coalesce(nullif(p->>'actual_return_date','')::date, current_date);
  v_late numeric := coalesce((p->>'late_fee')::numeric, 0);
  v_items jsonb := coalesce(p->'items','[]'::jsonb);
  v_it jsonb; v_damage numeric := 0; v_lost numeric := 0; v_extra numeric;
  v_r rentals%rowtype; v_inv uuid; v_new_remaining numeric;
begin
  select * into v_r from rentals where id = v_rid;
  if not found then raise exception 'rental_not_found'; end if;

  for v_it in select * from jsonb_array_elements(v_items) loop
    update rental_items set
      condition_return = v_it->>'condition_return',
      damage_fee = coalesce((v_it->>'damage_fee')::numeric, 0),
      lost_fee = coalesce((v_it->>'lost_fee')::numeric, 0),
      notes = v_it->>'notes'
     where id = (v_it->>'rental_item_id')::uuid;

    v_damage := v_damage + coalesce((v_it->>'damage_fee')::numeric, 0);
    v_lost := v_lost + coalesce((v_it->>'lost_fee')::numeric, 0);

    if nullif(v_it->>'inventory_item_id','') is not null then
      update inventory_items set
        status = case coalesce(v_it->>'inventory_status','AVAILABLE')
                   when 'DAMAGED' then 'DAMAGED'
                   when 'LOST' then 'LOST'
                   when 'MAINTENANCE' then 'MAINTENANCE'
                   else 'AVAILABLE' end,
        condition = coalesce(v_it->>'condition_return','GOOD')
       where id = (v_it->>'inventory_item_id')::uuid;

      insert into stock_movements(product_id, inventory_item_id, quantity, type, reference_type, reference_id, user_id, notes)
      select ri.product_id, ri.inventory_item_id, 1,
             case coalesce(v_it->>'inventory_status','AVAILABLE')
               when 'DAMAGED' then 'DAMAGE' when 'LOST' then 'LOST'
               when 'MAINTENANCE' then 'MAINTENANCE' else 'RENTAL_RETURN' end,
             'rental', v_rid, auth.uid(), 'Return rental'
      from rental_items ri where ri.id = (v_it->>'rental_item_id')::uuid;
    end if;
  end loop;

  v_extra := v_late + v_damage + v_lost;
  update rentals set status = 'RETURNED', actual_return_date = v_actual,
    late_fee = v_late, damage_fee = v_damage, lost_fee = v_lost,
    total = total + v_extra, notes = coalesce(p->>'notes', notes)
   where id = v_rid;

  if v_r.booking_id is not null then
    update bookings set status = 'RETURNED' where id = v_r.booking_id;
  end if;

  select id into v_inv from invoices where rental_id = v_rid or booking_id = v_r.booking_id limit 1;
  if v_inv is not null and v_extra > 0 then
    update invoices set total = total + v_extra, remaining = remaining + v_extra,
      status = case when (remaining + v_extra) <= 0 then 'PAID' when paid > 0 then 'PARTIAL' else 'UNPAID' end
     where id = v_inv;
  end if;

  perform log_audit('return','rental', v_rid, 'Return rental ' || coalesce(v_r.rental_number,''));
  return json_build_object('rental_id', v_rid, 'late_fee', v_late, 'damage_fee', v_damage, 'lost_fee', v_lost, 'extra', v_extra);
end; $$;

-- =====================================================================
-- ADD PAYMENT (recomputes invoice paid/remaining/status)
-- =====================================================================
create or replace function public.add_payment(p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_inv uuid := nullif(p->>'invoice_id','')::uuid;
  v_amount numeric := coalesce((p->>'amount')::numeric, 0);
  v_pnum text; v_pid uuid; v_row invoices%rowtype;
  v_paid numeric; v_remaining numeric; v_status text;
begin
  if v_inv is null then raise exception 'invoice_required'; end if;
  if v_amount <= 0 then raise exception 'invalid_amount'; end if;
  select * into v_row from invoices where id = v_inv;
  if not found then raise exception 'invoice_not_found'; end if;

  v_pnum := 'PAY-' || to_char(now(),'YYYY') || '-' || lpad(nextval('seq_payment')::text, 6, '0');
  insert into payments(payment_number, invoice_id, booking_id, rental_id, customer_id, amount, payment_method, payment_type, payment_date, reference_number, notes, created_by)
  values (v_pnum, v_inv, v_row.booking_id, v_row.rental_id, v_row.customer_id, v_amount,
    coalesce(p->>'payment_method','CASH'), coalesce(p->>'payment_type','PARTIAL'), current_date,
    p->>'reference_number', p->>'notes', auth.uid())
  returning id into v_pid;

  select coalesce(sum(amount),0) into v_paid from payments where invoice_id = v_inv;
  v_remaining := v_row.total - v_paid;
  v_status := case when v_remaining <= 0 then 'PAID' when v_paid > 0 then 'PARTIAL' else 'UNPAID' end;
  update invoices set paid = v_paid, remaining = v_remaining, status = v_status where id = v_inv;

  perform log_audit('payment','invoice', v_inv, 'Payment ' || v_pnum);
  return json_build_object('payment_id', v_pid, 'payment_number', v_pnum,
    'paid', v_paid, 'remaining', v_remaining, 'status', v_status);
end; $$;

-- =====================================================================
-- DASHBOARD STATS
-- =====================================================================
create or replace function public.dashboard_stats()
returns json language plpgsql stable security definer set search_path = public as $$
declare v json;
begin
  select json_build_object(
    'total_products', (select count(*) from products),
    'total_units', (select count(*) from inventory_items),
    'available_units', (select count(*) from inventory_items where status = 'AVAILABLE'),
    'rented_units', (select count(*) from inventory_items where status = 'RENTED'),
    'maintenance_units', (select count(*) from inventory_items where status = 'MAINTENANCE'),
    'damaged_units', (select count(*) from inventory_items where status in ('DAMAGED','LOST')),
    'total_customers', (select count(*) from customers),
    'bookings_today', (select count(*) from bookings where booking_date = current_date),
    'upcoming_bookings', (select count(*) from bookings where start_date >= current_date and status in ('PENDING','CONFIRMED','READY','PAID')),
    'active_rentals', (select count(*) from rentals where status in ('OUT','ACTIVE','OVERDUE','LATE')),
    'overdue_rentals', (select count(*) from rentals where status in ('OUT','ACTIVE') and due_date < current_date and actual_return_date is null),
    'revenue_today', (select coalesce(sum(amount),0) from payments where payment_date = current_date and payment_type <> 'REFUND'),
    'revenue_month', (select coalesce(sum(amount),0) from payments where date_trunc('month', payment_date) = date_trunc('month', current_date) and payment_type <> 'REFUND'),
    'receivables', (select coalesce(sum(remaining),0) from invoices where status in ('UNPAID','PARTIAL')),
    'payments_today', (select count(*) from payments where payment_date = current_date),
    'revenue_7days', (select coalesce(json_agg(row_to_json(t)),'[]'::json) from (
        select to_char(d::date,'YYYY-MM-DD') as date,
               coalesce((select sum(amount) from payments where payment_date = d::date and payment_type <> 'REFUND'),0) as amount
        from generate_series(current_date - 6, current_date, interval '1 day') d order by d) t)
  ) into v;
  return v;
end; $$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','categories','products','product_images','inventory_items','customers',
    'bookings','booking_items','rentals','rental_items','invoices','payments',
    'stock_movements','audit_logs','settings'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- Business tables: any authenticated staff can operate.
do $$
declare t text;
begin
  foreach t in array array[
    'categories','products','product_images','inventory_items','customers',
    'bookings','booking_items','rentals','rental_items','invoices','payments',
    'stock_movements','audit_logs','settings'
  ] loop
    execute format('drop policy if exists p_auth_all on public.%I;', t);
    execute format('create policy p_auth_all on public.%I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- Profiles: everyone authenticated can read; only OWNER/ADMIN (or self) can write.
drop policy if exists p_profiles_select on public.profiles;
create policy p_profiles_select on public.profiles for select to authenticated using (true);

drop policy if exists p_profiles_insert on public.profiles;
create policy p_profiles_insert on public.profiles for insert to authenticated
  with check (public.current_role() in ('OWNER','ADMIN') or id = auth.uid());

drop policy if exists p_profiles_update on public.profiles;
create policy p_profiles_update on public.profiles for update to authenticated
  using (public.current_role() in ('OWNER','ADMIN') or id = auth.uid())
  with check (public.current_role() in ('OWNER','ADMIN') or id = auth.uid());

drop policy if exists p_profiles_delete on public.profiles;
create policy p_profiles_delete on public.profiles for delete to authenticated
  using (public.current_role() = 'OWNER');
