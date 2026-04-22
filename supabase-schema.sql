-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id text primary key,
  name text not null,
  official_name text default '',
  category text default '',
  price text default '',
  stock text default '',
  manufacturer text default '',
  location text default '',
  description text default '',
  image_url text default '',
  source_url text default '',
  source_name text default '',
  item_seq text default '',
  matched_score numeric,
  matched_at date,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  product_id text references public.products(id) on delete cascade,
  action text not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz default now(),
  before_data jsonb,
  after_data jsonb
);

alter table public.products enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "products_select_authenticated" on public.products;
create policy "products_select_authenticated"
on public.products for select
to authenticated
using (true);

drop policy if exists "products_insert_authenticated" on public.products;
create policy "products_insert_authenticated"
on public.products for insert
to authenticated
with check (true);

drop policy if exists "products_update_authenticated" on public.products;
create policy "products_update_authenticated"
on public.products for update
to authenticated
using (true)
with check (true);

drop policy if exists "audit_select_authenticated" on public.audit_logs;
create policy "audit_select_authenticated"
on public.audit_logs for select
to authenticated
using (true);

drop policy if exists "audit_insert_authenticated" on public.audit_logs;
create policy "audit_insert_authenticated"
on public.audit_logs for insert
to authenticated
with check (true);

create or replace function public.set_product_update_fields()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_set_product_update_fields on public.products;
create trigger trg_set_product_update_fields
before insert or update on public.products
for each row execute function public.set_product_update_fields();

create or replace function public.log_product_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs(product_id, action, changed_by, after_data)
    values (new.id, 'insert', auth.uid(), to_jsonb(new));
    return new;
  end if;

  if tg_op = 'UPDATE' then
    insert into public.audit_logs(product_id, action, changed_by, before_data, after_data)
    values (new.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_product_update on public.products;
create trigger trg_log_product_update
after insert or update on public.products
for each row execute function public.log_product_update();

insert into storage.buckets (id, name, public)
values ('drug-images', 'drug-images', true)
on conflict (id) do update set public = true;

drop policy if exists "drug_images_public_read" on storage.objects;
create policy "drug_images_public_read"
on storage.objects for select
to public
using (bucket_id = 'drug-images');

drop policy if exists "drug_images_authenticated_insert" on storage.objects;
create policy "drug_images_authenticated_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'drug-images');

drop policy if exists "drug_images_authenticated_update" on storage.objects;
create policy "drug_images_authenticated_update"
on storage.objects for update
to authenticated
using (bucket_id = 'drug-images')
with check (bucket_id = 'drug-images');
