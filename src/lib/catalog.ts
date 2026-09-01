import { supabase } from '@/lib/supabase';
import type { Product, Category, ProductImage } from '@/types';

export const formatPrice = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

export function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

export async function fetchCategories(): Promise<Category[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) { console.error(error); return []; }
  return (data as Category[]) ?? [];
}

export async function fetchProducts(filters?: {
  category?: string;
  search?: string;
  featured?: boolean;
  bestSeller?: boolean;
  newArrival?: boolean;
  limit?: number;
}): Promise<Product[]> {
  if (!supabase) return [];
  let query = supabase.from('products').select(`
    *,
    images:product_images(*),
    category:categories(*)
  `).eq('is_published', true).eq('status', 'active');

  if (filters?.category && filters.category !== 'All') {
    query = query.eq('category.slug', filters.category);
  }
  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }
  if (filters?.featured) query = query.eq('is_featured', true);
  if (filters?.bestSeller) query = query.eq('is_best_seller', true);
  if (filters?.newArrival) query = query.eq('is_new_arrival', true);

  query = query.order('created_at', { ascending: false });
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) { console.error(error); return []; }
  return (data as Product[]) ?? [];
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('products').select(`
    *,
    images:product_images(*),
    category:categories(*)
  `).eq('slug', slug).maybeSingle();
  if (error) { console.error(error); return null; }
  return data as Product | null;
}

export async function uploadProductImage(productId: string, file: File): Promise<ProductImage | null> {
  if (!supabase) return null;
  const ext = file.name.split('.').pop();
  const path = `${productId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('product-images').upload(path, file);
  if (upErr) { console.error(upErr); return null; }
  const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
  const { data, error } = await supabase.from('product_images').insert({
    product_id: productId, image_url: urlData.publicUrl, storage_path: path, is_primary: false,
  }).select('*').maybeSingle();
  if (error) { console.error(error); return null; }
  return data as ProductImage | null;
}

export async function deleteProductImage(image: ProductImage): Promise<boolean> {
  if (!supabase) return false;
  if (image.storage_path) {
    await supabase.storage.from('product-images').remove([image.storage_path]);
  }
  const { error } = await supabase.from('product_images').delete().eq('id', image.id);
  return !error;
}

export async function setPrimaryImage(productId: string, imageId: string): Promise<boolean> {
  if (!supabase) return false;
  await supabase.from('product_images').update({ is_primary: false }).eq('product_id', productId);
  const { error } = await supabase.from('product_images').update({ is_primary: true }).eq('id', imageId);
  return !error;
}

export function getPrimaryImage(product: Product): string | null {
  if (product.images && product.images.length > 0) {
    const primary = product.images.find((img) => img.is_primary);
    return (primary ?? product.images[0]).image_url;
  }
  return null;
}

export function getEffectivePrice(product: Product): number {
  return product.sale_price && product.sale_price > 0 ? product.sale_price : product.price;
}
