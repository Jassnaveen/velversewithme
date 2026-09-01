import { useEffect, useState, type ReactNode } from 'react';
import {
  LayoutDashboard, Package, FolderTree, ShoppingCart, Truck, Users, BarChart3,
  Settings, LogOut, Menu, X, ShieldCheck, Plus, Pencil, Trash2, Upload, Star,
  Search, ArrowRight, IndianRupee, TrendingUp, ShoppingBag, Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatPrice, slugify, fetchCategories, uploadProductImage, deleteProductImage, setPrimaryImage, getPrimaryImage, getEffectivePrice } from '@/lib/catalog';
import type { Product, Category, Order, Profile, ProductImage } from '@/types';

type AdminPage = 'dashboard' | 'products' | 'categories' | 'orders' | 'shipping' | 'customers' | 'analytics' | 'settings';

export function AdminApp({ onExit }: { onExit: () => void }) {
  const { profile, signOut } = useAuth();
  const [page, setPage] = useState(() => {
  return localStorage.getItem('velverse_admin_page') || 'dashboard';
});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
  localStorage.setItem('velverse_admin_page', page);
}, [page]);

  const navItems: [AdminPage, string, typeof LayoutDashboard][] = [
    ['dashboard', 'Dashboard', LayoutDashboard],
    ['products', 'Products', Package],
    ['categories', 'Categories', FolderTree],
    ['orders', 'Orders', ShoppingCart],
    ['shipping', 'Shipping', Truck],
    ['customers', 'Customers', Users],
    ['analytics', 'Analytics', BarChart3],
    ['settings', 'Settings', Settings],
  ];

  return <div className="flex min-h-screen bg-[#f6f1e8] text-charcoal">
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-charcoal text-white transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center gap-2 border-b border-white/10 p-5">
        <ShieldCheck size={20} className="text-gold" />
        <div>
          <p className="font-serif text-sm tracking-wider">VEL VERSE</p>
          <p className="text-[9px] uppercase tracking-[0.2em] text-gold">Admin Panel</p>
        </div>
      </div>
      <nav className="p-3">
        {navItems.map(([key, label, Icon]) => (
          <button key={key} onClick={() => { setPage(key); setSidebarOpen(false); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${page === key ? 'bg-gold text-charcoal font-semibold' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
            <Icon size={17} /> {label}
          </button>
        ))}
      </nav>
      <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-3">
        <button onClick={async () => { await signOut(); onExit(); }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/60 hover:bg-white/5 hover:text-white">
          <LogOut size={17} /> Sign out
        </button>
        <button onClick={onExit}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/40 hover:bg-white/5 hover:text-white/70">
          <ArrowRight size={17} /> Back to store
        </button>
      </div>
    </aside>
    {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    <div className="flex-1 overflow-x-hidden">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-charcoal/10 bg-[#f6f1e8]/95 px-5 py-4 backdrop-blur">
        <button className="lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>
        <div className="flex-1 lg:flex-none">
          <h1 className="font-serif text-2xl capitalize">{page}</h1>
        </div>
        <div className="hidden items-center gap-2 text-sm text-charcoal/60 sm:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 font-semibold text-antique">
            {(profile?.full_name ?? 'A')[0].toUpperCase()}
          </span>
          <span className="font-medium">{profile?.full_name ?? 'Admin'}</span>
        </div>
      </header>
      <div className="p-5 lg:p-8">
        {page === 'dashboard' && <Dashboard />}
        {page === 'products' && <ProductsAdmin />}
        {page === 'categories' && <CategoriesAdmin />}
        {page === 'orders' && <OrdersAdmin />}
        {page === 'shipping' && <ShippingAdmin />}
        {page === 'customers' && <CustomersAdmin />}
        {page === 'analytics' && <Analytics />}
        {page === 'settings' && <SettingsPage />}
      </div>
    </div>
  </div>;
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Package; label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-xl border p-5 ${accent ? 'border-gold/40 bg-gold/5' : 'border-charcoal/10 bg-white'}`}>
    <div className="flex items-center justify-between">
      <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent ? 'bg-gold text-charcoal' : 'bg-charcoal/5 text-charcoal/60'}`}><Icon size={20} /></span>
    </div>
    <p className="mt-4 text-2xl font-bold">{value}</p>
    <p className="mt-1 text-xs uppercase tracking-wider text-charcoal/50">{label}</p>
  </div>;
}

function Dashboard() {
  const [stats, setStats] = useState({ products: 0, orders: 0, customers: 0, revenue: 0, pending: 0 });
  const [recent, setRecent] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const [{ count: products }, { count: orders }, { count: customers }, { data: ordersData }] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5),
      ]);
      const revenue = (ordersData ?? []).reduce((sum, o) => sum + Number(o.total), 0);
      const pending = (ordersData ?? []).filter((o) => o.status === 'pending' || o.status === 'confirmed').length;
      setStats({ products: products ?? 0, orders: orders ?? 0, customers: customers ?? 0, revenue, pending });
      setRecent((ordersData as Order[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSpinner />;
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard icon={Package} label="Total Products" value={String(stats.products)} />
      <StatCard icon={ShoppingCart} label="Total Orders" value={String(stats.orders)} />
      <StatCard icon={Users} label="Customers" value={String(stats.customers)} />
      <StatCard icon={IndianRupee} label="Total Revenue" value={formatPrice(stats.revenue)} accent />
    </div>
    <div className="rounded-xl border border-charcoal/10 bg-white p-6">
      <h3 className="font-serif text-xl">Recent Orders</h3>
      {recent.length === 0 ? <EmptyState text="No orders yet" /> : <div className="mt-4 space-y-3">
        {recent.map((o) => <div key={o.id} className="flex items-center justify-between border-b border-charcoal/5 pb-3">
          <div><p className="font-semibold">{o.order_number}</p><p className="text-sm text-charcoal/50">{o.email}</p></div>
          <div className="text-right"><p className="font-semibold">{formatPrice(Number(o.total))}</p>
            <StatusBadge status={o.status} /></div>
        </div>)}
      </div>}
    </div>
  </div>;
}

function ProductsAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    const [{ data: prods }, cats] = await Promise.all([
      supabase.from('products').select('*, images:product_images(*), category:categories(*)').order('created_at', { ascending: false }),
      fetchCategories(),
    ]);
    setProducts((prods as Product[]) ?? []);
    setCategories(cats);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  if (showForm) return <ProductForm product={editing} categories={categories} onClose={() => { setShowForm(false); setEditing(null); }} onSaved={load} />;
  if (deleteTarget) return <DeleteConfirm product={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={async () => {
    if (supabase && deleteTarget.images) {
      const paths = deleteTarget.images.map((img) => img.storage_path).filter(Boolean) as string[];
      if (paths.length) await supabase.storage.from('product-images').remove(paths);
    }
    if (supabase) await supabase.from('products').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null); load();
  }} />;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="relative w-full max-w-xs">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="w-full rounded-lg border border-charcoal/15 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-antique" />
      </div>
      <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-semibold text-white hover:bg-antique">
        <Plus size={17} /> Add Product
      </button>
    </div>
    {loading ? <LoadingSpinner /> : filtered.length === 0 ? <EmptyState text="No products found" /> : <div className="overflow-x-auto rounded-xl border border-charcoal/10 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-charcoal/10 bg-charcoal/[0.02] text-left text-xs uppercase tracking-wider text-charcoal/50">
          <tr><th className="p-4">Product</th><th className="p-4">Category</th><th className="p-4">Price</th><th className="p-4">Stock</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr>
        </thead>
        <tbody>
          {filtered.map((p) => <tr key={p.id} className="border-b border-charcoal/5 last:border-0">
            <td className="p-4"><div className="flex items-center gap-3">
              {getPrimaryImage(p) ? <img src={getPrimaryImage(p)!} alt={p.name} className="h-12 w-12 rounded-lg object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-charcoal/5"><Package size={18} className="text-charcoal/30" /></div>}
              <div><p className="font-semibold">{p.name}</p>{p.is_featured && <span className="text-xs text-antique">Featured</span>}</div>
            </div></td>
            <td className="p-4 text-charcoal/60">{p.category?.name ?? '—'}</td>
            <td className="p-4 font-semibold">{formatPrice(getEffectivePrice(p))}</td>
            <td className="p-4"><span className={p.stock <= 5 ? 'font-semibold text-red-600' : ''}>{p.stock}</span></td>
            <td className="p-4"><StatusBadge status={p.status} /></td>
            <td className="p-4"><div className="flex justify-end gap-2">
              <button onClick={() => { setEditing(p); setShowForm(true); }} className="rounded-lg p-2 text-charcoal/60 hover:bg-charcoal/5 hover:text-charcoal"><Pencil size={16} /></button>
              <button onClick={() => setDeleteTarget(p)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
            </div></td>
          </tr>)}
        </tbody>
      </table>
    </div>}
  </div>;
}

function ProductForm({ product, categories, onClose, onSaved }: { product: Product | null; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState(product?.category_id ?? categories[0]?.id ?? '');
  const [price, setPrice] = useState(String(product?.price ?? ''));
  const [salePrice, setSalePrice] = useState(String(product?.sale_price ?? ''));
  const [description, setDescription] = useState(product?.description ?? '');
  const [stock, setStock] = useState(String(product?.stock ?? '0'));
  const [sku, setSku] = useState(product?.sku ?? '');
  const [status, setStatus] = useState<Product['status']>(product?.status ?? 'active');
  const [isFeatured, setIsFeatured] = useState(product?.is_featured ?? false);
  const [isBestSeller, setIsBestSeller] = useState(product?.is_best_seller ?? false);
  const [isNewArrival, setIsNewArrival] = useState(product?.is_new_arrival ?? false);
  const [images, setImages] = useState<ProductImage[]>(product?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleUpload(files: FileList) {
    if (!supabase || !product) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const img = await uploadProductImage(product.id, file);
      if (img) setImages((prev) => [...prev, img]);
    }
    setUploading(false);
  }

  async function handleDeleteImage(img: ProductImage) {
    await deleteProductImage(img);
    setImages((prev) => prev.filter((i) => i.id !== img.id));
  }

  async function handleSetPrimary(img: ProductImage) {
    await setPrimaryImage(product!.id, img.id);
    setImages((prev) => prev.map((i) => ({ ...i, is_primary: i.id === img.id })));
  }

  async function save() {
    if (!supabase) return;
    setSaving(true); setError('');
    const priceNum = parseFloat(price);
    const stockNum = parseInt(stock) || 0;
    if (!name.trim() || !categoryId || isNaN(priceNum)) { setError('Name, category and price are required.'); setSaving(false); return; }
    const payload = {
      name: name.trim(), slug: slugify(name), category_id: categoryId,
      description: description.trim(), price: priceNum,
      sale_price: salePrice ? parseFloat(salePrice) : null,
      stock: stockNum, sku: sku.trim() || null, status,
      is_featured: isFeatured, is_best_seller: isBestSeller, is_new_arrival: isNewArrival,
      is_published: status === 'active',
      rating: product?.rating ?? 0, review_count: product?.review_count ?? 0,
    };
    if (isEdit && product) {
      const { error: e } = await supabase.from('products').update(payload).eq('id', product.id);
      if (e) { setError(e.message); setSaving(false); return; }
    } else {
      const { data, error: e } = await supabase.from('products').insert(payload).select('*').maybeSingle();
      if (e) { setError(e.message); setSaving(false); return; }
      if (data) {
        const newProduct = data as Product;
        for (const file of Array.from(document.querySelectorAll<HTMLInputElement>('#file-input').forEach(() => []) as unknown as File[])) {
          await uploadProductImage(newProduct.id, file);
        }
      }
    }
    setSaving(false); onSaved(); onClose();
  }

  return <div className="mx-auto max-w-3xl space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="font-serif text-3xl">{isEdit ? 'Edit Product' : 'Add Product'}</h2>
      <button onClick={onClose} className="rounded-lg p-2 text-charcoal/50 hover:bg-charcoal/5"><X size={20} /></button>
    </div>
    <div className="rounded-xl border border-charcoal/10 bg-white p-6 space-y-5">
      <Field label="Product Name *"><input value={name} onChange={(e) => setName(e.target.value)} className="input" /></Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Category *"><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value as Product['status'])} className="input"><option value="active">Active</option><option value="draft">Draft</option><option value="out_of_stock">Out of Stock</option></select></Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Price (₹) *"><input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="input" /></Field>
        <Field label="Sale Price (₹)"><input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="input" /></Field>
        <Field label="Stock *"><input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="input" /></Field>
      </div>
      <Field label="Description *"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="input resize-none" /></Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="SKU"><input value={sku} onChange={(e) => setSku(e.target.value)} className="input" /></Field>
        <div className="flex items-end gap-4 pb-2">
          <Toggle label="Featured" checked={isFeatured} onChange={setIsFeatured} />
          <Toggle label="Best Seller" checked={isBestSeller} onChange={setIsBestSeller} />
          <Toggle label="New Arrival" checked={isNewArrival} onChange={setIsNewArrival} />
        </div>
      </div>
    </div>

    {isEdit && <div className="rounded-xl border border-charcoal/10 bg-white p-6">
      <h3 className="font-serif text-xl">Product Images</h3>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map((img) => <div key={img.id} className="group relative">
          <img src={img.image_url} alt="" className={`aspect-square w-full rounded-lg object-cover ${img.is_primary ? 'ring-2 ring-gold' : ''}`} />
          {img.is_primary && <span className="absolute left-1 top-1 rounded bg-gold px-1.5 py-0.5 text-[8px] font-bold uppercase">Main</span>}
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/50 opacity-0 transition group-hover:opacity-100">
            {!img.is_primary && <button onClick={() => handleSetPrimary(img)} className="rounded bg-white p-1.5" title="Set main"><Star size={14} /></button>}
            <button onClick={() => handleDeleteImage(img)} className="rounded bg-white p-1.5 text-red-500" title="Delete"><Trash2 size={14} /></button>
          </div>
        </div>)}
      </div>
      <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-charcoal/20 py-6 text-sm text-charcoal/50 hover:border-antique">
        <Upload size={18} /> {uploading ? 'Uploading...' : 'Click to upload images'}
        <input id="file-input" type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleUpload(e.target.files)} />
      </label>
    </div>}

    {error && <p className="text-sm text-red-600">{error}</p>}
    <div className="flex gap-3">
      <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-charcoal px-6 py-3 text-sm font-semibold text-white hover:bg-antique disabled:opacity-50">
        {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
      </button>
      <button onClick={onClose} className="rounded-lg border border-charcoal/15 px-6 py-3 text-sm font-semibold hover:bg-charcoal/5">Cancel</button>
    </div>
  </div>;
}

function DeleteConfirm({ product, onCancel, onConfirm }: { product: Product; onCancel: () => void; onConfirm: () => void }) {
  return <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-white p-8 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50"><Trash2 size={26} className="text-red-500" /></div>
    <h2 className="mt-5 font-serif text-2xl">Delete this product?</h2>
    <p className="mt-3 text-charcoal/60">Are you sure you want to delete <strong>{product.name}</strong>? This removes it from the shop, but existing order history is preserved.</p>
    <div className="mt-6 flex gap-3 justify-center">
      <button onClick={onCancel} className="rounded-lg border border-charcoal/15 px-6 py-2.5 text-sm font-semibold hover:bg-charcoal/5">Cancel</button>
      <button onClick={onConfirm} className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Delete Product</button>
    </div>
  </div>;
}

function CategoriesAdmin() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const load = async () => { const cats = await fetchCategories(); setCategories(cats); setLoading(false); };
  useEffect(() => { load(); }, []);

  async function save() {
    if (!supabase || !name.trim()) return;
    const payload = { name: name.trim(), slug: slugify(name), description: description.trim() || null, image_url: imageUrl.trim() || null };
    if (editing) {
      await supabase.from('categories').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('categories').insert(payload);
    }
    setShowForm(false); setEditing(null); setName(''); setDescription(''); setImageUrl('');
    load();
  }

  async function remove(id: string) {
    if (!supabase) return;
    if (!confirm('Delete this category? Products will remain but lose their category link.')) return;
    await supabase.from('categories').delete().eq('id', id);
    load();
  }

  if (showForm) return <div className="mx-auto max-w-lg space-y-5">
    <h2 className="font-serif text-3xl">{editing ? 'Edit Category' : 'Add Category'}</h2>
    <div className="rounded-xl border border-charcoal/10 bg-white p-6 space-y-4">
      <Field label="Category Name *"><input value={name} onChange={(e) => setName(e.target.value)} className="input" /></Field>
      <Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="input resize-none" /></Field>
      <Field label="Image URL"><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="input" /></Field>
    </div>
    <div className="flex gap-3">
      <button onClick={save} className="rounded-lg bg-charcoal px-6 py-2.5 text-sm font-semibold text-white hover:bg-antique">Save</button>
      <button onClick={() => { setShowForm(false); setEditing(null); }} className="rounded-lg border border-charcoal/15 px-6 py-2.5 text-sm font-semibold hover:bg-charcoal/5">Cancel</button>
    </div>
  </div>;

  return <div className="space-y-4">
    <button onClick={() => { setEditing(null); setName(''); setDescription(''); setImageUrl(''); setShowForm(true); }} className="flex items-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-semibold text-white hover:bg-antique">
      <Plus size={17} /> Add Category
    </button>
    {loading ? <LoadingSpinner /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((c) => <div key={c.id} className="rounded-xl border border-charcoal/10 bg-white p-5">
        {c.image_url && <img src={c.image_url} alt={c.name} className="mb-3 h-32 w-full rounded-lg object-cover" />}
        <h3 className="font-serif text-xl">{c.name}</h3>
        <p className="mt-1 text-sm text-charcoal/50">{c.description ?? 'No description'}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => { setEditing(c); setName(c.name); setDescription(c.description ?? ''); setImageUrl(c.image_url ?? ''); setShowForm(true); }} className="rounded-lg p-2 text-charcoal/60 hover:bg-charcoal/5"><Pencil size={16} /></button>
          <button onClick={() => remove(c.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
        </div>
      </div>)}
    </div>}
  </div>;
}

function OrdersAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from('orders').select('*, order_items:order_items(*), shipment:shipments(*)').order('created_at', { ascending: false });
      setOrders((data as Order[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const statuses = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'];

  async function updateStatus(orderId: string, status: string) {
    if (!supabase) return;
    await supabase.from('orders').update({ status }).eq('id', orderId);
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
  }

  if (loading) return <LoadingSpinner />;
  if (orders.length === 0) return <EmptyState text="No orders yet" />;
  return <div className="space-y-3">
    {orders.map((o) => <div key={o.id} className="rounded-xl border border-charcoal/10 bg-white">
      <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="flex w-full items-center justify-between p-5 text-left">
        <div><p className="font-semibold">{o.order_number}</p><p className="text-sm text-charcoal/50">{o.email} · {new Date(o.created_at).toLocaleDateString()}</p></div>
        <div className="flex items-center gap-3"><span className="font-semibold">{formatPrice(Number(o.total))}</span><StatusBadge status={o.status} /></div>
      </button>
      {expanded === o.id && <div className="border-t border-charcoal/10 p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {o.order_items?.map((item) => <div key={item.id} className="flex items-center gap-3">
            {item.image_url && <img src={item.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />}
            <div><p className="text-sm font-semibold">{item.product_name}</p><p className="text-xs text-charcoal/50">{item.quantity} × {formatPrice(Number(item.unit_price))}</p></div>
          </div>)}
        </div>
        <div><p className="text-xs uppercase tracking-wider text-charcoal/40">Shipping Address</p>
          <p className="mt-1 text-sm">{o.shipping_address?.full_name}, {o.shipping_address?.address_line}, {o.shipping_address?.city}, {o.shipping_address?.state} {o.shipping_address?.pincode}</p></div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold">Update Status:</label>
          <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)} className="input max-w-xs">
            {statuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>}
    </div>)}
  </div>;
}

function ShippingAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Order | null>(null);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from('orders').select('*, shipment:shipments(*)').order('created_at', { ascending: false });
      setOrders((data as Order[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (editing) return <ShippingForm order={editing} onClose={() => setEditing(null)} onSaved={() => {
    setEditing(null);
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from('orders').select('*, shipment:shipments(*)').order('created_at', { ascending: false });
      setOrders((data as Order[]) ?? []);
    })();
  }} />;
  return <div className="space-y-3">
    {orders.length === 0 ? <EmptyState text="No orders to ship" /> : orders.map((o) => <div key={o.id} className="flex items-center justify-between rounded-xl border border-charcoal/10 bg-white p-5">
      <div><p className="font-semibold">{o.order_number}</p><p className="text-sm text-charcoal/50">{o.email}</p>
        {o.shipment?.shipping_id && <p className="mt-1 text-xs text-antique">Ship ID: {o.shipment.shipping_id}</p>}</div>
      <div className="flex items-center gap-3"><StatusBadge status={o.shipment?.status ?? 'order_confirmed'} />
        <button onClick={() => setEditing(o)} className="rounded-lg bg-charcoal px-4 py-2 text-sm font-semibold text-white hover:bg-antique">Update Shipping</button></div>
    </div>)}
  </div>;
}

function ShippingForm({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const ship = order.shipment;
  const [shippingId, setShippingId] = useState(ship?.shipping_id ?? `VVM-SHIP-${Math.floor(Math.random() * 900000 + 100000)}`);
  const [trackingNumber, setTrackingNumber] = useState(ship?.tracking_number ?? '');
  const [courierPartner, setCourierPartner] = useState(ship?.courier_partner ?? '');
  const [status, setStatus] = useState(ship?.status ?? 'order_confirmed');
  const [estimatedDelivery, setEstimatedDelivery] = useState(ship?.estimated_delivery ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!supabase) return;
    setSaving(true);
    const payload = { order_id: order.id, shipping_id: shippingId, tracking_number: trackingNumber || null, courier_partner: courierPartner || null, status, estimated_delivery: estimatedDelivery || null };
    if (ship) {
      await supabase.from('shipments').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', ship.id);
    } else {
      await supabase.from('shipments').insert(payload);
    }
    setSaving(false); onSaved();
  }

  return <div className="mx-auto max-w-lg space-y-5">
    <div className="flex items-center justify-between"><h2 className="font-serif text-3xl">Shipping for {order.order_number}</h2><button onClick={onClose}><X size={20} /></button></div>
    <div className="rounded-xl border border-charcoal/10 bg-white p-6 space-y-4">
      <Field label="Shipping ID"><input value={shippingId} onChange={(e) => setShippingId(e.target.value)} className="input" /></Field>
      <Field label="Tracking Number"><input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="input" /></Field>
      <Field label="Courier Partner"><input value={courierPartner} onChange={(e) => setCourierPartner(e.target.value)} className="input" placeholder="Delhivery, DTDC..." /></Field>
      <Field label="Shipping Status"><select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
        {['order_confirmed','processing','packed','shipped','in_transit','out_for_delivery','delivered'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
      </select></Field>
      <Field label="Estimated Delivery"><input type="date" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)} className="input" /></Field>
    </div>
    <button onClick={save} disabled={saving} className="rounded-lg bg-charcoal px-6 py-3 text-sm font-semibold text-white hover:bg-antique disabled:opacity-50">{saving ? 'Saving...' : 'Save Shipping Details'}</button>
  </div>;
}

function CustomersAdmin() {
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from('profiles').select('*').eq('role', 'customer').order('created_at', { ascending: false });
      setCustomers((data as Profile[]) ?? []); setLoading(false);
    })();
  }, []);
  if (loading) return <LoadingSpinner />;
  if (customers.length === 0) return <EmptyState text="No customers yet" />;
  return <div className="overflow-x-auto rounded-xl border border-charcoal/10 bg-white">
    <table className="w-full text-sm"><thead className="border-b border-charcoal/10 bg-charcoal/[0.02] text-left text-xs uppercase tracking-wider text-charcoal/50"><tr><th className="p-4">Name</th><th className="p-4">Phone</th><th className="p-4">Joined</th></tr></thead>
      <tbody>{customers.map((c) => <tr key={c.id} className="border-b border-charcoal/5 last:border-0"><td className="p-4 font-semibold">{c.full_name ?? '—'}</td><td className="p-4 text-charcoal/60">{c.phone ?? '—'}</td><td className="p-4 text-charcoal/60">{new Date(c.created_at).toLocaleDateString()}</td></tr>)}</tbody>
    </table>
  </div>;
}

function Analytics() {
  const [data, setData] = useState<{ month: string; revenue: number; orders: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data: orders } = await supabase.from('orders').select('total, created_at');
      const { data: items } = await supabase.from('order_items').select('product_name, quantity, unit_price');
      const monthMap = new Map<string, { revenue: number; orders: number }>();
      (orders ?? []).forEach((o) => {
        const d = new Date(o.created_at);
        const key = d.toLocaleString('en', { month: 'short' });
        const entry = monthMap.get(key) ?? { revenue: 0, orders: 0 };
        entry.revenue += Number(o.total); entry.orders += 1;
        monthMap.set(key, entry);
      });
      setData(Array.from(monthMap.entries()).map(([month, v]) => ({ month, ...v })));
      const prodMap = new Map<string, { qty: number; revenue: number }>();
      (items ?? []).forEach((i) => {
        const entry = prodMap.get(i.product_name) ?? { qty: 0, revenue: 0 };
        entry.qty += i.quantity; entry.revenue += Number(i.unit_price) * i.quantity;
        prodMap.set(i.product_name, entry);
      });
      setTopProducts(Array.from(prodMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 5));
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSpinner />;
  const maxRev = Math.max(...data.map((d) => d.revenue), 1);
  const maxOrd = Math.max(...data.map((d) => d.orders), 1);
  const totalRev = data.reduce((s, d) => s + d.revenue, 0);

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard icon={IndianRupee} label="Total Revenue" value={formatPrice(totalRev)} accent />
      <StatCard icon={ShoppingBag} label="Total Orders" value={String(data.reduce((s, d) => s + d.orders, 0))} />
      <StatCard icon={TrendingUp} label="Avg Order Value" value={formatPrice(totalRev / (data.reduce((s, d) => s + d.orders, 0) || 1))} />
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-charcoal/10 bg-white p-6">
        <h3 className="font-serif text-xl">Revenue by Month</h3>
        {data.length === 0 ? <EmptyState text="No data yet" /> : <div className="mt-6 space-y-3">{data.map((d) => <div key={d.month}>
          <div className="flex justify-between text-sm"><span>{d.month}</span><span className="font-semibold">{formatPrice(d.revenue)}</span></div>
          <div className="mt-1 h-2 rounded-full bg-charcoal/5"><div className="h-2 rounded-full bg-gold" style={{ width: `${(d.revenue / maxRev) * 100}%` }} /></div>
        </div>)}</div>}
      </div>
      <div className="rounded-xl border border-charcoal/10 bg-white p-6">
        <h3 className="font-serif text-xl">Orders by Month</h3>
        {data.length === 0 ? <EmptyState text="No data yet" /> : <div className="mt-6 space-y-3">{data.map((d) => <div key={d.month}>
          <div className="flex justify-between text-sm"><span>{d.month}</span><span className="font-semibold">{d.orders} orders</span></div>
          <div className="mt-1 h-2 rounded-full bg-charcoal/5"><div className="h-2 rounded-full bg-charcoal" style={{ width: `${(d.orders / maxOrd) * 100}%` }} /></div>
        </div>)}</div>}
      </div>
    </div>
    <div className="rounded-xl border border-charcoal/10 bg-white p-6">
      <h3 className="font-serif text-xl">Top Selling Products</h3>
      {topProducts.length === 0 ? <EmptyState text="No sales data yet" /> : <table className="mt-4 w-full text-sm"><thead className="text-left text-xs uppercase tracking-wider text-charcoal/50"><tr><th className="pb-3">Product</th><th className="pb-3">Units Sold</th><th className="pb-3 text-right">Revenue</th></tr></thead>
        <tbody>{topProducts.map((p) => <tr key={p.name} className="border-b border-charcoal/5"><td className="py-3 font-semibold">{p.name}</td><td className="py-3">{p.qty}</td><td className="py-3 text-right font-semibold">{formatPrice(p.revenue)}</td></tr>)}</tbody>
      </table>}
    </div>
  </div>;
}

function SettingsPage() {
  return <div className="mx-auto max-w-lg rounded-xl border border-charcoal/10 bg-white p-8 text-center">
    <Settings size={36} className="mx-auto text-charcoal/30" />
    <h2 className="mt-4 font-serif text-2xl">Admin Settings</h2>
    <p className="mt-2 text-charcoal/50">Payment gateway configuration, shipping rules, and store settings will appear here.</p>
    <div className="mt-6 rounded-lg bg-charcoal/[0.02] p-4 text-left text-sm text-charcoal/60">
      <p className="font-semibold text-charcoal">Payment Gateway</p>
      <p className="mt-1">Configure Razorpay or Stripe keys in your Supabase project secrets for production payments.</p>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-charcoal/50">{label}</label>{children}</div>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex cursor-pointer items-center gap-2 text-sm"><button type="button" onClick={() => onChange(!checked)} className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-gold' : 'bg-charcoal/15'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-[18px]' : 'left-0.5'}`} /></button>{label}</label>;
}
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { pending: 'bg-amber-100 text-amber-700', confirmed: 'bg-blue-100 text-blue-700', processing: 'bg-blue-100 text-blue-700', packed: 'bg-purple-100 text-purple-700', shipped: 'bg-indigo-100 text-indigo-700', in_transit: 'bg-indigo-100 text-indigo-700', out_for_delivery: 'bg-cyan-100 text-cyan-700', delivered: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700', active: 'bg-green-100 text-green-700', draft: 'bg-gray-100 text-gray-600', out_of_stock: 'bg-red-100 text-red-700', order_confirmed: 'bg-green-100 text-green-700' };
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>{status.replace(/_/g, ' ')}</span>;
}
function LoadingSpinner() { return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-charcoal/15 border-t-antique" /></div>; }
function EmptyState({ text }: { text: string }) { return <div className="py-16 text-center text-charcoal/40">{text}</div>; }
