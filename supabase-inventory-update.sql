-- Run this in Supabase SQL Editor before using the new inventory features.

alter table public.products
add column if not exists warehouse_stock text default '창고에 재고 없음';

update public.products
set stock = case
  when stock = '있음' then '재고 있음'
  when stock = '없음' then '재고 없음'
  when stock is null or stock = '' then '재고 있음'
  else stock
end,
warehouse_stock = coalesce(nullif(warehouse_stock, ''), '창고에 재고 없음');
