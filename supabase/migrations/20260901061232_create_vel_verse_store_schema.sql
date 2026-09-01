/*
# Create Vel Verse With Me commerce schema

1. New Tables
- profiles: authenticated customer profiles.
- categories: public product groupings.
- products: public catalog items and inventory.
- product_images: product gallery assets.
- addresses: private customer delivery addresses.
- cart_items: private customer cart contents.
- wishlists: private saved products.
- orders: private customer orders with totals and status.
- order_items: immutable item snapshots belonging to orders.
- payments: private payment provider references and status; never card data.
- shipments: private fulfillment and tracking data.
- reviews: public published product reviews tied to verified customers.
- newsletter_subscribers: email subscriptions.

2. Security
- RLS enabled on every table.
- Catalog and published reviews are readable by anonymous visitors.
- Customer data is owner-scoped with auth.uid().
- Admin-only writes are intentionally reserved for server-side service-role workflows.
- Payments store provider identifiers only, never card numbers or CVV.
*/

create extension if not exists pgcrypto;

create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, phone text, is_admin boolean not null default false, created_at timestamptz not null default now());
create table if not exists public.categories (id uuid primary key default gen_random_uuid(), name text not null unique, slug text not null unique, description text, image_url text, created_at timestamptz not null default now());
create table if not exists public.products (id uuid primary key default gen_random_uuid(), category_id uuid references public.categories(id) on delete set null, name text not null, slug text not null unique, description text not null, price numeric(12,2) not null check (price >= 0), compare_at numeric(12,2) check (compare_at is null or compare_at >= price), stock integer not null default 0 check (stock >= 0), rating numeric(2,1) not null default 0 check (rating between 0 and 5), review_count integer not null default 0, is_published boolean not null default false, created_at timestamptz not null default now());
create table if not exists public.product_images (id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade, image_url text not null, alt_text text, sort_order integer not null default 0);
create table if not exists public.addresses (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, full_name text not null, phone text not null, email text not null, address_line text not null, city text not null, state text not null, pincode text not null, country text not null default 'India', is_default boolean not null default false, created_at timestamptz not null default now());
create table if not exists public.cart_items (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, quantity integer not null default 1 check (quantity > 0), created_at timestamptz not null default now(), unique(user_id, product_id));
create table if not exists public.wishlists (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, created_at timestamptz not null default now(), unique(user_id, product_id));
create table if not exists public.orders (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete restrict, order_number text not null unique, email text not null, phone text not null, shipping_address jsonb not null, subtotal numeric(12,2) not null check (subtotal >= 0), shipping_fee numeric(12,2) not null default 0, discount numeric(12,2) not null default 0, total numeric(12,2) not null check (total >= 0), status text not null default 'pending', created_at timestamptz not null default now());
create table if not exists public.order_items (id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, product_id uuid references public.products(id) on delete set null, product_name text not null, image_url text, unit_price numeric(12,2) not null, quantity integer not null check (quantity > 0));
create table if not exists public.payments (id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id) on delete cascade, provider text not null, provider_payment_id text, status text not null default 'pending', paid_at timestamptz, created_at timestamptz not null default now());
create table if not exists public.shipments (id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id) on delete cascade, shipping_id text unique, tracking_number text, courier_partner text, status text not null default 'order_confirmed', estimated_delivery date, updated_at timestamptz not null default now());
create table if not exists public.reviews (id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade, user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, customer_name text not null, rating integer not null check (rating between 1 and 5), body text not null, is_published boolean not null default false, created_at timestamptz not null default now());
create table if not exists public.newsletter_subscribers (id uuid primary key default gen_random_uuid(), email text not null unique, created_at timestamptz not null default now());

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.addresses enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.shipments enable row level security;
alter table public.reviews enable row level security;
alter table public.newsletter_subscribers enable row level security;

create index if not exists products_category_idx on public.products(category_id);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists orders_user_idx on public.orders(user_id);
create index if not exists shipments_shipping_idx on public.shipments(shipping_id);

 drop policy if exists "public read categories" on public.categories; create policy "public read categories" on public.categories for select to anon, authenticated using (true);
 drop policy if exists "public read products" on public.products; create policy "public read products" on public.products for select to anon, authenticated using (is_published = true);
 drop policy if exists "public read product images" on public.product_images; create policy "public read product images" on public.product_images for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and p.is_published = true));
 drop policy if exists "public read reviews" on public.reviews; create policy "public read reviews" on public.reviews for select to anon, authenticated using (is_published = true);
 drop policy if exists "public subscribe newsletter" on public.newsletter_subscribers; create policy "public subscribe newsletter" on public.newsletter_subscribers for insert to anon, authenticated with check (length(email) between 5 and 320);

create policy "users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "users read own addresses" on public.addresses for select to authenticated using (auth.uid() = user_id);
create policy "users insert own addresses" on public.addresses for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own addresses" on public.addresses for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own addresses" on public.addresses for delete to authenticated using (auth.uid() = user_id);
create policy "users read own cart" on public.cart_items for select to authenticated using (auth.uid() = user_id);
create policy "users insert own cart" on public.cart_items for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own cart" on public.cart_items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own cart" on public.cart_items for delete to authenticated using (auth.uid() = user_id);
create policy "users read own wishlist" on public.wishlists for select to authenticated using (auth.uid() = user_id);
create policy "users insert own wishlist" on public.wishlists for insert to authenticated with check (auth.uid() = user_id);
create policy "users delete own wishlist" on public.wishlists for delete to authenticated using (auth.uid() = user_id);
create policy "users read own orders" on public.orders for select to authenticated using (auth.uid() = user_id);
create policy "users read own order items" on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "users read own payments" on public.payments for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "users read own shipments" on public.shipments for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "users insert own reviews" on public.reviews for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own reviews" on public.reviews for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own reviews" on public.reviews for delete to authenticated using (auth.uid() = user_id);
