-- Run this in Supabase SQL Editor if you want the app to work without login.
-- Anyone who has the app URL can read and update products.

alter table public.products enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "products_select_authenticated" on public.products;
drop policy if exists "products_insert_authenticated" on public.products;
drop policy if exists "products_update_authenticated" on public.products;
drop policy if exists "products_select_public" on public.products;
drop policy if exists "products_insert_public" on public.products;
drop policy if exists "products_update_public" on public.products;

create policy "products_select_public"
on public.products for select
to anon, authenticated
using (true);

create policy "products_insert_public"
on public.products for insert
to anon, authenticated
with check (true);

create policy "products_update_public"
on public.products for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "audit_select_authenticated" on public.audit_logs;
drop policy if exists "audit_insert_authenticated" on public.audit_logs;
drop policy if exists "audit_select_public" on public.audit_logs;
drop policy if exists "audit_insert_public" on public.audit_logs;

create policy "audit_select_public"
on public.audit_logs for select
to anon, authenticated
using (true);

create policy "audit_insert_public"
on public.audit_logs for insert
to anon, authenticated
with check (true);

insert into storage.buckets (id, name, public)
values ('drug-images', 'drug-images', true)
on conflict (id) do update set public = true;

drop policy if exists "drug_images_authenticated_insert" on storage.objects;
drop policy if exists "drug_images_authenticated_update" on storage.objects;
drop policy if exists "drug_images_public_insert" on storage.objects;
drop policy if exists "drug_images_public_update" on storage.objects;

create policy "drug_images_public_insert"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'drug-images');

create policy "drug_images_public_update"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'drug-images')
with check (bucket_id = 'drug-images');
