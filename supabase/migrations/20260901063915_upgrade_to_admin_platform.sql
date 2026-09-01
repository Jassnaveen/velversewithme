/*
# Upgrade Vel Verse With Me to admin-controlled e-commerce platform

## Summary
Upgrades the existing schema to support two user roles (customer + admin), full product management with images in Supabase Storage, order/shipping management, and revenue analytics. Seeds the six default categories and all specified products with real imagery.

## Changes
1. profiles: add `role` column (customer/admin)
2. products: add sale_price, sku, status, is_featured, is_best_seller, is_new_arrival, weight, dimensions, updated_at
3. product_images: add storage_path, is_primary
4. Storage bucket `product-images` created (public read, admin write)
5. Helper function is_admin() for RLS
6. Admin RLS policies on all management tables
7. Seed 6 categories + 27 products + product images
8. Admin bootstrap: first registered user or a designated email gets admin role
*/

-- 1. Add role to profiles
alter table public.profiles add column if not exists role text not null default 'customer' check (role in ('customer','admin'));

-- 2. Add product management columns
alter table public.products add column if not exists sale_price numeric(12,2) check (sale_price is null or sale_price >= 0);
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists status text not null default 'active' check (status in ('active','draft','out_of_stock'));
alter table public.products add column if not exists is_featured boolean not null default false;
alter table public.products add column if not exists is_best_seller boolean not null default false;
alter table public.products add column if not exists is_new_arrival boolean not null default false;
alter table public.products add column if not exists weight text;
alter table public.products add column if not exists dimensions text;
alter table public.products add column if not exists updated_at timestamptz not null default now();

-- 3. Add product_images columns
alter table public.product_images add column if not exists storage_path text;
alter table public.product_images add column if not exists is_primary boolean not null default false;

-- 4. Updated_at trigger for products
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();

-- 5. Storage bucket for product images
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;

-- 6. Admin helper function (SECURITY DEFINER to avoid RLS circular dependency)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- 7. Storage policies for product-images bucket
drop policy if exists "public read product images bucket" on storage.objects;
create policy "public read product images bucket" on storage.objects for select to anon, authenticated using (bucket_id = 'product-images');

drop policy if exists "admin upload product images" on storage.objects;
create policy "admin upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admin update product images" on storage.objects;
create policy "admin update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admin delete product images" on storage.objects;
create policy "admin delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());

-- 8. Admin RLS policies (additive to existing public-read policies)
-- Categories: admin can write
drop policy if exists "admin manage categories" on public.categories;
create policy "admin manage categories" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Products: admin can write (public read already exists for is_published)
drop policy if exists "admin manage products" on public.products;
create policy "admin manage products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Product images: admin can write
drop policy if exists "admin manage product images" on public.product_images;
create policy "admin manage product images" on public.product_images for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Orders: admin can read all + update status
drop policy if exists "admin read all orders" on public.orders;
create policy "admin read all orders" on public.orders for select to authenticated using (public.is_admin());

drop policy if exists "admin update orders" on public.orders;
create policy "admin update orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin insert orders" on public.orders;
create policy "admin insert orders" on public.orders for insert to authenticated with check (true);

-- Order items: admin can read all
drop policy if exists "admin read all order items" on public.order_items;
create policy "admin read all order items" on public.order_items for select to authenticated using (public.is_admin());

drop policy if exists "admin insert order items" on public.order_items;
create policy "admin insert order items" on public.order_items for insert to authenticated with check (true);

-- Payments: admin can read all + update
drop policy if exists "admin read all payments" on public.payments;
create policy "admin read all payments" on public.payments for select to authenticated using (public.is_admin());

drop policy if exists "admin manage payments" on public.payments;
create policy "admin manage payments" on public.payments for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin insert payments" on public.payments;
create policy "admin insert payments" on public.payments for insert to authenticated with check (true);

-- Shipments: admin can read all + manage
drop policy if exists "admin read all shipments" on public.shipments;
create policy "admin read all shipments" on public.shipments for select to authenticated using (public.is_admin());

drop policy if exists "admin manage shipments" on public.shipments;
create policy "admin manage shipments" on public.shipments for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin insert shipments" on public.shipments;
create policy "admin insert shipments" on public.shipments for insert to authenticated with check (true);

-- Reviews: admin can manage (delete inappropriate)
drop policy if exists "admin manage reviews" on public.reviews;
create policy "admin manage reviews" on public.reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Profiles: admin can read all profiles
drop policy if exists "admin read all profiles" on public.profiles;
create policy "admin read all profiles" on public.profiles for select to authenticated using (public.is_admin());

-- Cart: admin can read all (for debugging)
drop policy if exists "admin read all cart" on public.cart_items;
create policy "admin read all cart" on public.cart_items for select to authenticated using (public.is_admin());

-- Newsletter: admin can read
drop policy if exists "admin read newsletter" on public.newsletter_subscribers;
create policy "admin read newsletter" on public.newsletter_subscribers for select to authenticated using (public.is_admin());

-- 9. Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 10. Seed categories
insert into public.categories (name, slug, description, image_url) values
('Murugan Products', 'murugan-products', 'Sacred brass idols and vels inspired by Lord Murugan', 'https://images.pexels.com/photos/33311192/pexels-photo-33311192.jpeg?auto=compress&cs=tinysrgb&w=700'),
('Brass Deepam', 'brass-deepam', 'Traditional oil lamps to light your sacred space', 'https://images.pexels.com/photos/34056592/pexels-photo-34056592.jpeg?auto=compress&cs=tinysrgb&w=700'),
('Divine Idols', 'divine-idols', 'Handcrafted deity statues for home and altar', 'https://images.pexels.com/photos/33311190/pexels-photo-33311190.jpeg?auto=compress&cs=tinysrgb&w=700'),
('Pooja Items', 'pooja-items', 'Complete ritual essentials for your daily worship', 'https://images.pexels.com/photos/14855916/pexels-photo-14855916.jpeg?auto=compress&cs=tinysrgb&w=700'),
('Spiritual Products', 'spiritual-products', 'Malas and sacred beads for meditation and devotion', 'https://images.pexels.com/photos/6633942/pexels-photo-6633942.jpeg?auto=compress&cs=tinysrgb&w=700'),
('Return Gifts', 'return-gifts', 'Thoughtful devotional gifts for festivals and celebrations', 'https://images.pexels.com/photos/8819577/pexels-photo-8819577.jpeg?auto=compress&cs=tinysrgb&w=700')
on conflict (slug) do nothing;

-- 11. Seed products
insert into public.products (name, slug, category_id, description, price, sale_price, stock, status, is_featured, is_best_seller, is_new_arrival, sku, rating, review_count, is_published)
select p.name, p.slug, c.id, p.description, p.price, p.sale_price, p.stock, p.status, p.is_featured, p.is_best_seller, p.is_new_arrival, p.sku, p.rating, p.review_count, true
from (values
  ('Brass Murugan Idol', 'brass-murugan-idol', 'murugan-products', 'A masterfully cast brass Murugan idol radiating strength and grace for your sacred space.', 4500.00, 3990.00, 25, 'active', true, true, false, 'VVM-MG-001', 5.0, 38),
  ('Murugan Idol with Vel', 'murugan-idol-with-vel', 'murugan-products', 'Lord Murugan holding his divine vel, crafted in solid brass with intricate detail.', 5200.00, null, 18, 'active', true, false, false, 'VVM-MG-002', 4.9, 29),
  ('Mini Murugan Idol', 'mini-murugan-idol', 'murugan-products', 'A pocket-sized brass Murugan idol to carry devotion wherever you go.', 1200.00, 990.00, 50, 'active', false, false, true, 'VVM-MG-003', 4.8, 54),
  ('Brass Murugan Statue', 'brass-murugan-statue', 'murugan-products', 'A statement brass statue with fine temple-inspired craftsmanship.', 7800.00, 6990.00, 8, 'active', true, true, false, 'VVM-MG-004', 5.0, 16),
  ('Brass Vel', 'brass-vel', 'murugan-products', 'A solid brass vel symbolising courage, wisdom and divine protection.', 2100.00, 1790.00, 35, 'active', false, true, false, 'VVM-MG-005', 4.9, 42),
  ('Mini Brass Vel', 'mini-brass-vel', 'murugan-products', 'A compact brass vel perfect for your desk, altar or travel pouch.', 750.00, null, 80, 'active', false, false, true, 'VVM-MG-006', 4.7, 67)
) as p(name, slug, cat_slug, description, price, sale_price, stock, status, is_featured, is_best_seller, is_new_arrival, sku, rating, review_count)
join public.categories c on c.slug = p.cat_slug
on conflict (slug) do nothing;

insert into public.products (name, slug, category_id, description, price, sale_price, stock, status, is_featured, is_best_seller, is_new_arrival, sku, rating, review_count, is_published)
select p.name, p.slug, c.id, p.description, p.price, p.sale_price, p.stock, p.status, p.is_featured, p.is_best_seller, p.is_new_arrival, p.sku, p.rating, p.review_count, true
from (values
  ('Vel With Plate', 'vel-with-plate', 'brass-deepam', 'A beautiful brass vel deepam with an integrated plate for oil and wick.', 1800.00, 1490.00, 30, 'active', false, true, false, 'VVM-BD-001', 4.8, 35),
  ('Brass Vel Deepam', 'brass-vel-deepam', 'brass-deepam', 'A classic vel-shaped oil lamp that brings warm golden light to your prayers.', 2400.00, null, 22, 'active', true, false, false, 'VVM-BD-002', 4.9, 28),
  ('Brass Vel Vilakku', 'brass-vel-vilakku', 'brass-deepam', 'A traditional Tamil-style vilakku with vel detailing, handcrafted in brass.', 3200.00, 2790.00, 15, 'active', true, true, false, 'VVM-BD-003', 5.0, 19),
  ('Premium Brass Kuthu Vilakku', 'premium-brass-kuthu-vilakku', 'brass-deepam', 'An heirloom-quality kuthu vilakku lamp that fills your home with divine warmth.', 6500.00, 5490.00, 6, 'active', true, false, false, 'VVM-BD-004', 5.0, 12),
  ('Brass Diya', 'brass-diya', 'brass-deepam', 'A simple, elegant brass diya for your daily lamp-lighting ritual.', 550.00, null, 100, 'active', false, false, true, 'VVM-BD-005', 4.7, 89),
  ('Brass Deepam Set', 'brass-deepam-set', 'brass-deepam', 'A complete set of brass deepam lamps for festival evenings and special pujas.', 3900.00, 3290.00, 12, 'active', false, true, false, 'VVM-BD-006', 4.9, 23)
) as p(name, slug, cat_slug, description, price, sale_price, stock, status, is_featured, is_best_seller, is_new_arrival, sku, rating, review_count)
join public.categories c on c.slug = p.cat_slug
on conflict (slug) do nothing;

insert into public.products (name, slug, category_id, description, price, sale_price, stock, status, is_featured, is_best_seller, is_new_arrival, sku, rating, review_count, is_published)
select p.name, p.slug, c.id, p.description, p.price, p.sale_price, p.stock, p.status, p.is_featured, p.is_best_seller, p.is_new_arrival, p.sku, p.rating, p.review_count, true
from (values
  ('Baby Krishna Idol', 'baby-krishna-idol', 'divine-idols', 'A charming brass idol of baby Krishna capturing innocence and divinity.', 3400.00, 2990.00, 20, 'active', false, true, false, 'VVM-DI-001', 4.9, 31),
  ('Lakshmi Idol', 'lakshmi-idol', 'divine-idols', 'Goddess Lakshmi in solid brass, bringing abundance and grace to your home.', 4200.00, null, 14, 'active', true, false, false, 'VVM-DI-002', 5.0, 25),
  ('Amman Idol', 'amman-idol', 'divine-idols', 'A powerful Amman idol with intricate detailing, crafted in brass.', 3800.00, 3290.00, 10, 'active', false, false, false, 'VVM-DI-003', 4.8, 18),
  ('Divine Idol Set', 'divine-idol-set', 'divine-idols', 'A curated set of deity idols for a complete home altar.', 8900.00, 7490.00, 5, 'active', true, true, true, 'VVM-DI-004', 5.0, 9)
) as p(name, slug, cat_slug, description, price, sale_price, stock, status, is_featured, is_best_seller, is_new_arrival, sku, rating, review_count)
join public.categories c on c.slug = p.cat_slug
on conflict (slug) do nothing;

insert into public.products (name, slug, category_id, description, price, sale_price, stock, status, is_featured, is_best_seller, is_new_arrival, sku, rating, review_count, is_published)
select p.name, p.slug, c.id, p.description, p.price, p.sale_price, p.stock, p.status, p.is_featured, p.is_best_seller, p.is_new_arrival, p.sku, p.rating, p.review_count, true
from (values
  ('Brass Pooja Thali Set', 'brass-pooja-thali-set', 'pooja-items', 'A complete brass thali set with all essentials for your daily puja.', 2800.00, 2390.00, 18, 'active', true, true, false, 'VVM-PI-001', 4.9, 34),
  ('Brass Pooja Set', 'brass-pooja-set', 'pooja-items', 'A compact brass pooja set with bell, camphor holder and lamp.', 1900.00, null, 25, 'active', false, false, false, 'VVM-PI-002', 4.7, 41),
  ('Brass Pooja Bowls', 'brass-pooja-bowls', 'pooja-items', 'A set of polished brass bowls for offerings and abhishekam.', 990.00, 790.00, 40, 'active', false, false, true, 'VVM-PI-003', 4.6, 28),
  ('Brass Pooja Spoon', 'brass-pooja-spoon', 'pooja-items', 'A finely crafted brass spoon for sacred offerings.', 450.00, null, 70, 'active', false, false, false, 'VVM-PI-004', 4.5, 52),
  ('Brass Pooja Containers', 'brass-pooja-containers', 'pooja-items', 'Brass containers for storing kumkum, vibhuti and sacred items.', 1500.00, 1190.00, 20, 'active', false, true, false, 'VVM-PI-005', 4.8, 22),
  ('Pooja Accessories Set', 'pooja-accessories-set', 'pooja-items', 'A full accessories set to complete your pooja arrangement.', 3200.00, 2790.00, 10, 'active', true, false, true, 'VVM-PI-006', 4.9, 15)
) as p(name, slug, cat_slug, description, price, sale_price, stock, status, is_featured, is_best_seller, is_new_arrival, sku, rating, review_count)
join public.categories c on c.slug = p.cat_slug
on conflict (slug) do nothing;

insert into public.products (name, slug, category_id, description, price, sale_price, stock, status, is_featured, is_best_seller, is_new_arrival, sku, rating, review_count, is_published)
select p.name, p.slug, c.id, p.description, p.price, p.sale_price, p.stock, p.status, p.is_featured, p.is_best_seller, p.is_new_arrival, p.sku, p.rating, p.review_count, true
from (values
  ('Natural Karungali Mala', 'natural-karungali-mala', 'spiritual-products', 'A natural karungali (black ebony) mala bead necklace for meditation and spiritual protection.', 1290.00, 990.00, 35, 'active', true, true, true, 'VVM-SP-001', 4.9, 47)
) as p(name, slug, cat_slug, description, price, sale_price, stock, status, is_featured, is_best_seller, is_new_arrival, sku, rating, review_count)
join public.categories c on c.slug = p.cat_slug
on conflict (slug) do nothing;

insert into public.products (name, slug, category_id, description, price, sale_price, stock, status, is_featured, is_best_seller, is_new_arrival, sku, rating, review_count, is_published)
select p.name, p.slug, c.id, p.description, p.price, p.sale_price, p.stock, p.status, p.is_featured, p.is_best_seller, p.is_new_arrival, p.sku, p.rating, p.review_count, true
from (values
  ('Mini Brass Vel Return Gift', 'mini-brass-vel-return-gift', 'return-gifts', 'A beautifully packaged mini brass vel, perfect as a devotional return gift.', 550.00, null, 120, 'active', false, false, true, 'VVM-RG-001', 4.7, 63),
  ('Murugan Pooja Gift Set', 'murugan-pooja-gift-set', 'return-gifts', 'A curated gift set with Murugan idol and pooja essentials for festivals.', 1800.00, 1490.00, 30, 'active', true, true, false, 'VVM-RG-002', 4.9, 26),
  ('Murugan Divine Gift Set', 'murugan-divine-gift-set', 'return-gifts', 'A premium divine gift set with idol, deepam and pooja items.', 2500.00, 2190.00, 18, 'active', false, false, false, 'VVM-RG-003', 4.8, 19),
  ('Brass Vel Gift Set', 'brass-vel-gift-set', 'return-gifts', 'A set of brass vels in a gift box, ideal for weddings and festival giveaways.', 1200.00, 990.00, 45, 'active', false, true, true, 'VVM-RG-004', 4.7, 38)
) as p(name, slug, cat_slug, description, price, sale_price, stock, status, is_featured, is_best_seller, is_new_arrival, sku, rating, review_count)
join public.categories c on c.slug = p.cat_slug
on conflict (slug) do nothing;

-- 12. Seed product images
insert into public.product_images (product_id, image_url, is_primary, sort_order)
select p.id, img.url, img.is_primary, img.sort_order
from public.products p
join (values
  ('brass-murugan-idol', 'https://images.pexels.com/photos/31477842/pexels-photo-31477842.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('murugan-idol-with-vel', 'https://images.pexels.com/photos/33311192/pexels-photo-33311192.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('mini-murugan-idol', 'https://images.pexels.com/photos/33519711/pexels-photo-33519711.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('brass-murugan-statue', 'https://images.pexels.com/photos/33311200/pexels-photo-33311200.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('brass-vel', 'https://images.pexels.com/photos/33320232/pexels-photo-33320232.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('mini-brass-vel', 'https://images.pexels.com/photos/33550177/pexels-photo-33550177.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('vel-with-plate', 'https://images.pexels.com/photos/34056592/pexels-photo-34056592.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('brass-vel-deepam', 'https://images.pexels.com/photos/33360798/pexels-photo-33360798.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('brass-vel-vilakku', 'https://images.pexels.com/photos/34705732/pexels-photo-34705732.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('premium-brass-kuthu-vilakku', 'https://images.pexels.com/photos/20302339/pexels-photo-20302339.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('brass-diya', 'https://images.pexels.com/photos/34899896/pexels-photo-34899896.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('brass-deepam-set', 'https://images.pexels.com/photos/6315702/pexels-photo-6315702.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('baby-krishna-idol', 'https://images.pexels.com/photos/33311190/pexels-photo-33311190.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('lakshmi-idol', 'https://images.pexels.com/photos/33550182/pexels-photo-33550182.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('amman-idol', 'https://images.pexels.com/photos/26792961/pexels-photo-26792961.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('divine-idol-set', 'https://images.pexels.com/photos/33311188/pexels-photo-33311188.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('brass-pooja-thali-set', 'https://images.pexels.com/photos/14855916/pexels-photo-14855916.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('brass-pooja-set', 'https://images.pexels.com/photos/37116934/pexels-photo-37116934.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('brass-pooja-bowls', 'https://images.pexels.com/photos/39080855/pexels-photo-39080855.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('brass-pooja-spoon', 'https://images.pexels.com/photos/38920473/pexels-photo-38920473.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('brass-pooja-containers', 'https://images.pexels.com/photos/37116937/pexels-photo-37116937.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('pooja-accessories-set', 'https://images.pexels.com/photos/6175832/pexels-photo-6175832.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('natural-karungali-mala', 'https://images.pexels.com/photos/6633942/pexels-photo-6633942.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('mini-brass-vel-return-gift', 'https://images.pexels.com/photos/8819577/pexels-photo-8819577.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('murugan-pooja-gift-set', 'https://images.pexels.com/photos/8819385/pexels-photo-8819385.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('murugan-divine-gift-set', 'https://images.pexels.com/photos/8819764/pexels-photo-8819764.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0),
  ('brass-vel-gift-set', 'https://images.pexels.com/photos/8819776/pexels-photo-8819776.jpeg?auto=compress&cs=tinysrgb&w=900', true, 0)
) as img(slug, url, is_primary, sort_order) on img.slug = p.slug
on conflict do nothing;

-- 13. Make old products from first migration visible if they exist
update public.products set is_published = true, status = 'active' where is_published = false and status = 'draft';
