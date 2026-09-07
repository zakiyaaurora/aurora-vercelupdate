-- =====================================================================
-- AURORA SEWA KEBAYA — 003: Fitur Ketersediaan Kebaya (Availability)
-- Jalankan SETELAH 001_init.sql (dan 002_storage.sql).
-- NON-DESTRUKTIF: hanya create or replace function + grant/revoke.
-- Tidak ada drop table / delete data.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) CHECK AVAILABILITY (diperbaiki)
--    - Rental yang BELUM dikembalikan tetap memakai unit sampai
--      max(due_date, hari ini), walau sudah lewat jatuh tempo.
--    - Unit berstatus RENTED (fisik sedang keluar) dianggap terpakai
--      untuk rentang yang menyentuh hari ini.
--    - Unit DAMAGED/LOST tidak dihitung sebagai stok.
-- ---------------------------------------------------------------------
create or replace function public.check_availability(p_product_id uuid, p_start date, p_end date)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_total int; v_busy int;
begin
  select count(*) into v_total from inventory_items
    where product_id = p_product_id and status not in ('DAMAGED','LOST');

  select count(distinct u.id) into v_busy from inventory_items u
   where u.product_id = p_product_id
     and u.status not in ('DAMAGED','LOST')
     and (
       u.status = 'MAINTENANCE'
       or (u.status = 'RENTED' and p_start <= current_date)
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
            and r.pickup_date <= p_end
            and greatest(coalesce(r.due_date, r.pickup_date), current_date) >= p_start)
     );

  return json_build_object(
    'total', v_total,
    'busy', v_busy,
    'available', greatest(v_total - v_busy, 0)
  );
end; $$;

-- ---------------------------------------------------------------------
-- 2) CATALOG AVAILABILITY — semua produk aktif dalam satu panggilan
--    (dipakai Katalog internal & katalog publik /sewa)
-- ---------------------------------------------------------------------
create or replace function public.catalog_availability(p_start date, p_end date)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
           'product_id', p.id,
           'total', (a->>'total')::int,
           'busy', (a->>'busy')::int,
           'available', (a->>'available')::int
         )), '[]'::json)
  from products p
  cross join lateral check_availability(p.id, p_start, p_end) a
  where p.status = 'ACTIVE';
$$;

-- ---------------------------------------------------------------------
-- 3) PRODUCT SCHEDULE — jadwal per unit (kalender)
--    Pemanggil belum login  -> nama penyewa disamarkan
--    KASIR/STAFF            -> nama penyewa + nomor booking/rental
--    OWNER/ADMIN            -> + nomor telepon penyewa
-- ---------------------------------------------------------------------
create or replace function public.product_schedule(p_product_id uuid, p_start date, p_end date)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_role text; v_internal boolean; v_full boolean; v json;
begin
  select role into v_role from profiles where id = auth.uid() and status = 'ACTIVE';
  v_internal := v_role is not null;
  v_full := v_role in ('OWNER','ADMIN');

  select json_build_object(
    'product', (select json_build_object('id', p.id, 'name', p.name, 'product_code', p.product_code, 'photo_url', p.photo_url)
                from products p where p.id = p_product_id),
    'range', json_build_object('start', p_start, 'end', p_end),
    'internal', v_internal,
    'availability', check_availability(p_product_id, p_start, p_end),
    'units', (
      select coalesce(json_agg(json_build_object(
        'id', i.id, 'sku', i.sku, 'status', i.status, 'condition', i.condition,
        'location', case when v_internal then i.location else null end,
        'occupancies', (
          select coalesce(json_agg(row_to_json(o) order by o.start_date), '[]'::json) from (
            select 'BOOKING' as kind, b.id as ref_id,
                   case when v_internal then b.booking_number else null end as ref_number,
                   b.status, b.start_date, b.end_date, false as is_overdue,
                   case when v_internal then c.name else 'Sudah dipesan' end as customer_name,
                   case when v_full then coalesce(c.whatsapp, c.phone) else null end as customer_phone,
                   case when v_internal then b.customer_id else null end as customer_id
            from booking_items bi
            join bookings b on b.id = bi.booking_id
            left join customers c on c.id = b.customer_id
            where bi.inventory_item_id = i.id
              and b.status in ('PENDING','CONFIRMED','READY','PAID')
              and b.start_date <= p_end and b.end_date >= p_start
            union all
            select 'RENTAL' as kind, r.id as ref_id,
                   case when v_internal then r.rental_number else null end as ref_number,
                   r.status, r.pickup_date as start_date,
                   greatest(coalesce(r.due_date, r.pickup_date), current_date) as end_date,
                   (r.due_date < current_date) as is_overdue,
                   case when v_internal then c.name else 'Sedang disewa' end as customer_name,
                   case when v_full then coalesce(c.whatsapp, c.phone) else null end as customer_phone,
                   case when v_internal then r.customer_id else null end as customer_id
            from rental_items ri
            join rentals r on r.id = ri.rental_id
            left join customers c on c.id = r.customer_id
            where ri.inventory_item_id = i.id
              and r.status in ('READY','BOOKED','OUT','ACTIVE','OVERDUE','LATE')
              and r.actual_return_date is null
              and r.pickup_date <= p_end
              and greatest(coalesce(r.due_date, r.pickup_date), current_date) >= p_start
          ) o
        )
      ) order by i.sku), '[]'::json)
      from inventory_items i
      where i.product_id = p_product_id and i.status not in ('DAMAGED','LOST')
    )
  ) into v;
  return v;
end; $$;

-- ---------------------------------------------------------------------
-- 4) PUBLIC CATALOG — data produk yang aman untuk calon penyewa (tanpa login)
--    Tanpa parameter. Ketersediaan per tanggal -> catalog_availability(start,end)
--    Jadwal/tanggal tidak tersedia   -> product_schedule(product,start,end)
--    Tidak ada data pelanggan, harga beli, atau catatan internal.
--    total_units / available_today / availability_status dihitung dari
--    booking & rental nyata (via check_availability untuk hari ini).
-- ---------------------------------------------------------------------
create or replace function public.public_catalog()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'generated_at', now(),
    'categories', (select coalesce(json_agg(json_build_object('id', c.id, 'name', c.name) order by c.name), '[]'::json)
                   from categories c where c.status = 'ACTIVE'),
    'products', (select coalesce(json_agg(row_to_json(t) order by t.name), '[]'::json) from (
      select p.id, p.product_code, p.name, p.description, p.color, p.size, p.material, p.brand,
             p.rental_price, p.deposit, p.late_fee_per_day, p.photo_url, p.category_id,
             c.name as category_name,
             (a->>'total')::int as total_units,
             (a->>'available')::int as available_today,
             case when (a->>'total')::int = 0 then 'NO_STOCK'
                  when (a->>'available')::int <= 0 then 'UNAVAILABLE'
                  when (a->>'available')::int < (a->>'total')::int then 'PARTIAL'
                  else 'AVAILABLE' end as availability_status
      from products p
      left join categories c on c.id = p.category_id
      cross join lateral check_availability(p.id, current_date, current_date) a
      where p.status = 'ACTIVE') t)
  );
$$;

-- ---------------------------------------------------------------------
-- 5) CREATE BOOKING (diperbaiki)
--    - quantity > 1 mengunci N unit BERBEDA (1 baris booking_items per unit)
--    - penugasan unit menghindari booking aktif DAN rental yang belum kembali
--    - error format: not_available:<product_id>:<jumlah_tersedia>
-- ---------------------------------------------------------------------
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
  v_avail json; v_pid uuid; v_inv_item uuid; v_price numeric; v_qty int; v_n int;
  v_used uuid[] := '{}';
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if v_customer is null then raise exception 'customer_required'; end if;
  if jsonb_array_length(v_items) = 0 then raise exception 'items_required'; end if;
  if v_start is null or v_end is null or v_end < v_start then raise exception 'invalid_dates'; end if;

  -- Validasi ketersediaan (logic yang SAMA dengan katalog)
  for v_item in select * from jsonb_array_elements(v_items) loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := coalesce((v_item->>'quantity')::int, 1);
    v_avail := check_availability(v_pid, v_start, v_end);
    if (v_avail->>'available')::int < v_qty then
      raise exception 'not_available:%:%', v_pid, (v_avail->>'available');
    end if;
  end loop;

  v_bnum := 'BK-' || to_char(now(),'YYYY') || '-' || lpad(nextval('seq_booking')::text, 6, '0');
  insert into bookings(booking_number, customer_id, booking_date, event_date, start_date, end_date, status, discount, deposit, notes, created_by)
  values (v_bnum, v_customer, current_date, v_event, v_start, v_end, v_status, v_discount, v_deposit, v_notes, auth.uid())
  returning id into v_bid;

  for v_item in select * from jsonb_array_elements(v_items) loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := coalesce((v_item->>'quantity')::int, 1);
    v_price := coalesce((v_item->>'rental_price')::numeric, 0);

    for v_n in 1..v_qty loop
      v_inv_item := null;
      if v_n = 1 then v_inv_item := nullif(v_item->>'inventory_item_id','')::uuid; end if;

      if v_inv_item is null then
        select u.id into v_inv_item from inventory_items u
          where u.product_id = v_pid
            and u.status not in ('DAMAGED','LOST','MAINTENANCE')
            and not (u.status = 'RENTED' and v_start <= current_date)
            and not (u.id = any(v_used))
            and not exists (
              select 1 from booking_items bi join bookings b on b.id = bi.booking_id
              where bi.inventory_item_id = u.id
                and b.status in ('PENDING','CONFIRMED','READY','PAID','RENTED')
                and b.start_date <= v_end and b.end_date >= v_start)
            and not exists (
              select 1 from rental_items ri join rentals r on r.id = ri.rental_id
              where ri.inventory_item_id = u.id
                and r.status in ('READY','BOOKED','OUT','ACTIVE','OVERDUE','LATE')
                and r.actual_return_date is null
                and r.pickup_date <= v_end
                and greatest(coalesce(r.due_date, r.pickup_date), current_date) >= v_start)
          order by u.sku
          limit 1;
      end if;

      if v_inv_item is null then
        raise exception 'not_available:%:%', v_pid, (v_n - 1);
      end if;

      v_used := v_used || v_inv_item;
      insert into booking_items(booking_id, product_id, inventory_item_id, quantity, rental_price, subtotal, notes)
      values (v_bid, v_pid, v_inv_item, 1, v_price, v_price, v_item->>'notes');
      v_subtotal := v_subtotal + v_price;
    end loop;
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

-- ---------------------------------------------------------------------
-- 6) HAK AKSES
--    Publik (anon) hanya boleh: baca katalog, cek ketersediaan, lihat jadwal (tersamar)
--    RPC penulisan & statistik hanya untuk user login
-- ---------------------------------------------------------------------
grant execute on function public.check_availability(uuid, date, date) to anon, authenticated, service_role;
grant execute on function public.catalog_availability(date, date) to anon, authenticated, service_role;
grant execute on function public.product_schedule(uuid, date, date) to anon, authenticated, service_role;
grant execute on function public.public_catalog() to anon, authenticated, service_role;
grant execute on function public.create_booking(jsonb) to authenticated, service_role;

revoke execute on function public.create_booking(jsonb) from public, anon;
revoke execute on function public.checkout_rental(uuid, date) from public, anon;
revoke execute on function public.return_rental(jsonb) from public, anon;
revoke execute on function public.add_payment(jsonb) from public, anon;
revoke execute on function public.log_audit(text, text, uuid, text) from public, anon;
revoke execute on function public.dashboard_stats() from public, anon;

-- ---------------------------------------------------------------------
-- 7) Muat ulang schema cache PostgREST agar RPC baru langsung terlihat
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';
