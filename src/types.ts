export type Role = 'customer' | 'admin';

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: Role;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
};

export type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  storage_path: string | null;
  is_primary: boolean;
  sort_order: number;
};

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string;
  price: number;
  sale_price: number | null;
  stock: number;
  sku: string | null;
  status: 'active' | 'draft' | 'out_of_stock';
  is_featured: boolean;
  is_best_seller: boolean;
  is_new_arrival: boolean;
  is_published: boolean;
  rating: number;
  review_count: number;
  weight: string | null;
  dimensions: string | null;
  created_at: string;
  updated_at: string;
  images?: ProductImage[];
  category?: Category | null;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  image_url: string | null;
  unit_price: number;
  quantity: number;
};

export type Order = {
  id: string;
  user_id: string;
  order_number: string;
  email: string;
  phone: string;
  shipping_address: Record<string, string>;
  subtotal: number;
  shipping_fee: number;
  discount: number;
  total: number;
  status: string;
  created_at: string;
  order_items?: OrderItem[];
  shipment?: Shipment | null;
  payment?: Payment | null;
};

export type Payment = {
  id: string;
  order_id: string;
  provider: string;
  provider_payment_id: string | null;
  status: string;
  paid_at: string | null;
};

export type Shipment = {
  id: string;
  order_id: string;
  shipping_id: string | null;
  tracking_number: string | null;
  courier_partner: string | null;
  status: string;
  estimated_delivery: string | null;
  updated_at: string;
};

export type CartLine = {
  product: Product;
  quantity: number;
};
