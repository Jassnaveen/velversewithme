import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import {
  ArrowRight, ChevronDown, ChevronLeft, ChevronRight, CircleUserRound, Heart, Instagram,
  Menu, Package, Plus, Search, ShieldCheck, ShoppingBag, Sparkles, Star, Truck, X, LogOut,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { AdminApp } from '@/admin/AdminApp';
import {
  formatPrice, fetchCategories, fetchProducts, fetchProductBySlug,
  getPrimaryImage, getEffectivePrice,
} from '@/lib/catalog';
import type { Product, Category, CartLine, Order } from '@/types';

type Route = 'home' | 'shop' | 'product' | 'cart' | 'checkout' | 'confirmation' | 'account' | 'login' | 'track' | 'about' | 'contact' | 'faq' | 'policy';

export default function App() {
  const { role, loading: authLoading } = useAuth();
  const [path, setPath] = useState(window.location.pathname);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.title = 'Vel Verse With Me | Premium Devotional Collection';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [path]);

  const isAdmin = path.startsWith('/admin');
  if (isAdmin) {
    if (authLoading) return <FullLoader />;
    if (role !== 'admin') return <AccessDenied />;
    return <AdminApp onExit={() => { window.history.pushState({}, '', '/'); setPath('/'); }} />;
  }

  const route = pathToRoute(path);
  const navigate = (next: Route, slug?: string) => {
    if (slug) setSelectedSlug(slug);
    const url = next === 'home' ? '/' : `/${next}`;
    window.history.pushState({}, '', url);
    setPath(url);
    setMenuOpen(false);
  };
  const addToCart = (product: Product) => {
    setCart((c) => {
      const line = c.find((i) => i.product.id === product.id);
      return line ? c.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i) : [...c, { product, quantity: 1 }];
    });
    setNotice(`${product.name} added to your cart`);
    window.setTimeout(() => setNotice(''), 2600);
  };
  const toggleWishlist = (id: string) => setWishlist((c) => c.includes(id) ? c.filter((i) => i !== id) : [...c, id]);
  const openProduct = (slug: string) => navigate('product', slug);

  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  return <div className="min-h-screen bg-cream text-ink selection:bg-gold selection:text-ink">
    <Announcement />
    <Header cartCount={cartCount} wishlistCount={wishlist.length} onNavigate={navigate} onMenu={() => setMenuOpen(true)} onSearch={() => setSearchOpen(true)} />
    {menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} onNavigate={navigate} cartCount={cartCount} />}
    {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} onProduct={openProduct} />}
    <main>
      {route === 'home' && <Home onNavigate={navigate} onProduct={openProduct} onAdd={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} onSubscribe={async (email) => { if (supabase) await supabase.from('newsletter_subscribers').upsert({ email }); setNotice('You are now part of our inner circle'); }} />}
      {route === 'shop' && <Shop onProduct={openProduct} onAdd={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} />}
      {route === 'product' && selectedSlug && <ProductDetailsPage slug={selectedSlug} onBack={() => navigate('shop')} onAdd={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} onProduct={openProduct} />}
      {route === 'cart' && <Cart cart={cart} setCart={setCart} onNavigate={navigate} />}
      {route === 'checkout' && <Checkout cart={cart} setCart={setCart} onNavigate={navigate} onOrderPlaced={(o) => { setLastOrder(o); navigate('confirmation'); }} />}
      {route === 'confirmation' && <Confirmation order={lastOrder} onNavigate={navigate} />}
      {route === 'account' && <AccountPage onNavigate={navigate} />}
      {route === 'login' && <Login onNavigate={navigate} />}
      {route === 'track' && <TrackOrder />}
      {route === 'about' && <About />}
      {route === 'contact' && <Contact onNotice={setNotice} />}
      {route === 'faq' && <Faq />}
      {route === 'policy' && <Policy />}
    </main>
    <Footer onNavigate={navigate} onSubscribe={async (email) => { if (supabase) await supabase.from('newsletter_subscribers').upsert({ email }); setNotice('Welcome to the circle'); }} />
    {notice && <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-gold/40 bg-charcoal px-5 py-3 text-sm text-white shadow-2xl"><Sparkles size={15} className="text-gold" />{notice}</div>}
    <MobileBottom route={route} onNavigate={navigate} cartCount={cartCount} />
  </div>;
}

function pathToRoute(path: string): Route {
  const seg = path.replace('/', '').split('/')[0];
  const map: Record<string, Route> = { shop: 'shop', product: 'product', cart: 'cart', checkout: 'checkout', confirmation: 'confirmation', account: 'account', login: 'login', track: 'track', about: 'about', contact: 'contact', faq: 'faq', policy: 'policy' };
  return map[seg] ?? 'home';
}

function FullLoader() { return <div className="flex min-h-screen items-center justify-center bg-charcoal"><div className="h-10 w-10 animate-spin rounded-full border-2 border-gold/30 border-t-gold" /></div>; }
function AccessDenied() {
  return <div className="flex min-h-screen flex-col items-center justify-center bg-charcoal px-6 text-center text-white">
    <ShieldCheck size={56} className="text-gold" />
    <h1 className="mt-6 font-serif text-4xl">Access Denied</h1>
    <p className="mt-3 max-w-sm text-white/50">Administrator access is required to view this page.</p>
    <a href="/" className="mt-8 rounded-full bg-gold px-6 py-3 text-xs font-bold uppercase tracking-wider text-charcoal">Return to store</a>
  </div>;
}

function Announcement() { return <div className="bg-gold px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[0.24em] text-charcoal sm:text-xs">A little more divinity in every delivery · complimentary shipping above ₹2,500</div>; }

function Header({ cartCount, wishlistCount, onNavigate, onMenu, onSearch }: { cartCount: number; wishlistCount: number; onNavigate: (r: Route) => void; onMenu: () => void; onSearch: () => void }) {
  return <header className="sticky top-0 z-40 border-b border-charcoal/10 bg-cream/95 backdrop-blur-xl"><div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:h-[88px] lg:px-8">
    <button className="lg:hidden" onClick={onMenu} aria-label="Open menu"><Menu size={23} /></button>
    <button onClick={() => onNavigate('home')} className="flex items-center gap-3 text-left"><img src="/assets/images/image.png" alt="Vel Verse With Me" className="h-14 w-14 rounded-full object-cover lg:h-[68px] lg:w-[68px]" /><span className="hidden font-serif text-[17px] font-semibold leading-none tracking-[0.14em] text-charcoal sm:block lg:text-lg">VEL VERSE<br /><em className="font-normal tracking-[0.1em] text-antique">WITH ME</em></span></button>
    <nav className="hidden items-center gap-7 text-[11px] font-bold uppercase tracking-[0.18em] text-charcoal/70 lg:flex"><button onClick={() => onNavigate('home')} className="nav-link">Home</button><button onClick={() => onNavigate('shop')} className="nav-link">Shop</button><button onClick={() => onNavigate('track')} className="nav-link">Track Order</button><button onClick={() => onNavigate('about')} className="nav-link">About</button><button onClick={() => onNavigate('contact')} className="nav-link">Contact</button></nav>
    <div className="flex items-center gap-3 text-charcoal"><button onClick={onSearch} aria-label="Search"><Search size={19} strokeWidth={1.8} /></button><button className="relative hidden sm:block" onClick={() => onNavigate('account')} aria-label="Account"><CircleUserRound size={20} strokeWidth={1.8} /></button><button className="relative hidden sm:block" onClick={() => onNavigate('shop')} aria-label="Wishlist"><Heart size={19} strokeWidth={1.8} />{wishlistCount > 0 && <Badge count={wishlistCount} />}</button><button className="relative" onClick={() => onNavigate('cart')} aria-label="Cart"><ShoppingBag size={20} strokeWidth={1.8} />{cartCount > 0 && <Badge count={cartCount} />}</button></div>
  </div></header>;
}
function Badge({ count }: { count: number }) { return <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold">{count}</span>; }
function MobileMenu({ onClose, onNavigate, cartCount }: { onClose: () => void; onNavigate: (r: Route) => void; cartCount: number }) { return <div className="fixed inset-0 z-50 bg-charcoal text-white lg:hidden"><div className="flex items-center justify-between border-b border-white/10 p-5"><span className="font-serif text-xl tracking-[0.12em]">VEL VERSE</span><button onClick={onClose}><X /></button></div><div className="space-y-2 px-6 py-10 font-serif text-3xl"><button onClick={() => onNavigate('home')} className="block py-3">Home</button><button onClick={() => onNavigate('shop')} className="block py-3">Shop</button><button onClick={() => onNavigate('track')} className="block py-3">Track Order</button><button onClick={() => onNavigate('about')} className="block py-3">About</button><button onClick={() => onNavigate('contact')} className="block py-3">Contact</button><button onClick={() => onNavigate('account')} className="block py-3">My Account</button><button onClick={() => onNavigate('cart')} className="flex items-center gap-3 py-3">Your Cart <span className="font-sans text-sm text-gold">{cartCount} pieces</span></button></div></div>; }
function SearchOverlay({ onClose, onProduct }: { onClose: () => void; onProduct: (slug: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => { setResults(await fetchProducts({ search: query, limit: 8 })); }, 300);
    return () => clearTimeout(t);
  }, [query]);
  return <div className="fixed inset-0 z-50 bg-cream/98 p-5 sm:p-12"><button onClick={onClose} className="absolute right-6 top-6"><X /></button><div className="mx-auto mt-16 max-w-3xl"><p className="eyebrow">Find your connection</p><div className="mt-4 flex items-center border-b-2 border-charcoal pb-4"><Search size={24} /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search brass, deepam, vel..." className="ml-4 w-full bg-transparent font-serif text-2xl outline-none placeholder:text-charcoal/30 sm:text-4xl" /></div><div className="mt-8 grid gap-3">{results.map((p) => <button key={p.id} onClick={() => { onProduct(p.slug); onClose(); }} className="flex items-center gap-4 border-b border-charcoal/10 py-3 text-left">{getPrimaryImage(p) && <img src={getPrimaryImage(p)!} className="h-16 w-16 rounded-xl object-cover" alt="" />}<span><span className="block font-serif text-xl">{p.name}</span><span className="text-sm text-charcoal/55">{p.category?.name} · {formatPrice(getEffectivePrice(p))}</span></span></button>)}</div></div></div>;
}

function Home({ onNavigate, onProduct, onAdd, wishlist, toggleWishlist, onSubscribe }: { onNavigate: (r: Route) => void; onProduct: (s: string) => void; onAdd: (p: Product) => void; wishlist: string[]; toggleWishlist: (id: string) => void; onSubscribe: (email: string) => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  useEffect(() => { (async () => { setCats(await fetchCategories()); setFeatured(await fetchProducts({ featured: true, limit: 4 })); setNewArrivals(await fetchProducts({ newArrival: true, limit: 4 })); })(); }, []);
  return <>
    <section className="hero relative overflow-hidden bg-charcoal"><div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_28%,rgba(212,175,55,.2),transparent_27%),radial-gradient(circle_at_12%_100%,rgba(166,124,0,.18),transparent_32%)]" /><div className="absolute -right-32 top-12 h-[520px] w-[520px] rounded-full border border-gold/20 opacity-70 sm:right-0 lg:h-[680px] lg:w-[680px]" /><div className="relative mx-auto grid max-w-7xl items-center gap-8 px-6 py-20 sm:py-28 lg:grid-cols-[1fr_0.85fr] lg:px-8 lg:py-32"><div className="max-w-xl"><p className="eyebrow text-gold">A modern devotional house</p><h1 className="mt-6 font-serif text-5xl leading-[0.98] text-cream sm:text-7xl lg:text-[92px]">Carry faith.<br /><em className="text-gold">Embrace divinity.</em></h1><p className="mt-7 max-w-md text-base leading-7 text-cream/65 sm:text-lg">Discover meaningful products inspired by devotion, tradition, and timeless elegance.</p><div className="mt-9 flex flex-wrap gap-3"><button onClick={() => onNavigate('shop')} className="button-gold">Shop the collection <ArrowRight size={16} /></button><button onClick={() => onNavigate('about')} className="button-ghost">Our story</button></div><div className="mt-12 flex items-center gap-6 text-xs text-cream/50"><span className="flex items-center gap-2"><ShieldCheck size={16} className="text-gold" /> Thoughtfully made</span><span className="flex items-center gap-2"><Truck size={16} className="text-gold" /> Ships with care</span></div></div><div className="relative mx-auto w-full max-w-[480px]"><div className="absolute inset-5 rounded-full border border-gold/40" /><img src="/assets/images/image.png" alt="Vel Verse With Me — Lord Murugan and peacock emblem" className="relative aspect-square w-full rounded-full object-cover shadow-[0_0_100px_rgba(212,175,55,.18)]" /></div></div></section>
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28"><SectionHeading eyebrow="Explore by intention" title="Find your sacred everyday." action="View all" onClick={() => onNavigate('shop')} /><div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">{cats.map((c) => <button key={c.id} onClick={() => onNavigate('shop')} className="category-card group relative overflow-hidden rounded-2xl text-left"><img src={c.image_url ?? ''} alt={c.name} className="h-full min-h-44 w-full object-cover transition duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-charcoal/85 via-charcoal/10 to-transparent" /><div className="absolute bottom-4 left-4 text-white sm:bottom-6 sm:left-6"><h3 className="font-serif text-lg sm:text-2xl">{c.name}</h3></div></button>)}</div></section>
    <section className="bg-beige/35 px-5 py-20 lg:px-8 lg:py-28"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow="The edit" title="Pieces with presence." action="Shop all" onClick={() => onNavigate('shop')} /><div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{featured.map((p) => <ProductCard key={p.id} product={p} onProduct={onProduct} onAdd={onAdd} wished={wishlist.includes(p.id)} onWishlist={() => toggleWishlist(p.id)} />)}</div></div></section>
    <TrustStrip />
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-28"><div className="relative"><div className="absolute -inset-3 border border-gold/35" /><img src="https://images.pexels.com/photos/6044266/pexels-photo-6044266.jpeg?auto=compress&cs=tinysrgb&w=1000" alt="Brass lamp glowing in a quiet sacred space" className="relative aspect-[4/5] w-full object-cover" /></div><div className="lg:pl-12"><p className="eyebrow">The heart behind the house</p><h2 className="mt-5 font-serif text-5xl leading-none sm:text-6xl">More than a product.<br /><em className="text-antique">A connection.</em></h2><p className="mt-7 max-w-lg leading-8 text-charcoal/65">Vel Verse With Me was born from a simple feeling — that the objects we keep close can hold meaning. Inspired by Lord Murugan, the beauty of Tamil tradition, and the quiet strength of a daily ritual, every piece is chosen to bring a little more intention into modern life.</p><button onClick={() => onNavigate('about')} className="button-dark mt-8">Meet the house <ArrowRight size={16} /></button></div></section>
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28"><SectionHeading eyebrow="Just arrived" title="New arrivals." action="Shop all" onClick={() => onNavigate('shop')} /><div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{newArrivals.map((p) => <ProductCard key={p.id} product={p} onProduct={onProduct} onAdd={onAdd} wished={wishlist.includes(p.id)} onWishlist={() => toggleWishlist(p.id)} />)}</div></section>
    <Reviews /><Newsletter onSubscribe={onSubscribe} />
  </>;
}

function SectionHeading({ eyebrow, title, action, onClick }: { eyebrow: string; title: string; action?: string; onClick?: () => void }) { return <div className="flex items-end justify-between gap-4"><div><p className="eyebrow">{eyebrow}</p><h2 className="mt-3 font-serif text-4xl leading-none sm:text-5xl">{title}</h2></div>{action && <button onClick={onClick} className="hidden items-center gap-2 border-b border-antique pb-1 text-xs font-bold uppercase tracking-[0.16em] text-antique sm:flex">{action}<ArrowRight size={14} /></button>}</div>; }
function ProductCard({ product, onProduct, onAdd, wished, onWishlist }: { product: Product; onProduct: (s: string) => void; onAdd: (p: Product) => void; wished: boolean; onWishlist: () => void }) {
  const img = getPrimaryImage(product);
  const price = getEffectivePrice(product);
  return <article className="group"><div className="product-image relative overflow-hidden rounded-2xl bg-beige"><button onClick={() => onProduct(product.slug)} className="block w-full">{img ? <img src={img} alt={product.name} className="aspect-[0.88] w-full object-cover transition duration-700 group-hover:scale-105" /> : <div className="flex aspect-[0.88] items-center justify-center"><Package size={32} className="text-charcoal/20" /></div>}</button>{product.is_best_seller && <span className="absolute left-3 top-3 rounded-full bg-cream px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-antique">Bestseller</span>}{product.is_new_arrival && <span className="absolute left-3 top-3 rounded-full bg-cream px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-antique">New</span>}<button onClick={onWishlist} className={`absolute right-3 top-3 rounded-full p-2.5 backdrop-blur ${wished ? 'bg-gold text-charcoal' : 'bg-cream/80 text-charcoal'}`} aria-label="Toggle wishlist"><Heart size={16} fill={wished ? 'currentColor' : 'none'} /></button><button onClick={() => onAdd(product)} className="absolute bottom-3 left-3 right-3 flex translate-y-16 items-center justify-center gap-2 rounded-full bg-charcoal py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white transition group-hover:translate-y-0">Add to cart <Plus size={14} /></button></div><button onClick={() => onProduct(product.slug)} className="mt-4 text-left"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-antique">{product.category?.name}</p><h3 className="mt-1 font-serif text-xl">{product.name}</h3><div className="mt-2 flex items-center justify-between"><span className="font-semibold">{formatPrice(price)} {product.sale_price && product.sale_price > 0 && <del className="ml-1 text-sm font-normal text-charcoal/35">{formatPrice(product.price)}</del>}</span><span className="flex items-center gap-1 text-xs text-antique"><Star size={12} fill="currentColor" /> {product.rating}</span></div></button></article>;
}
function TrustStrip() { const items = [['Secure payments', ShieldCheck], ['Safe packaging', Package], ['Order tracking', Truck], ['Made with care', Sparkles]] as const; return <section className="border-y border-charcoal/10 bg-cream px-5 py-8"><div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 lg:grid-cols-4">{items.map(([label, Icon]) => <div key={label} className="flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-[0.1em] text-charcoal/60"><Icon size={18} className="text-antique" />{label}</div>)}</div></section>; }
function Reviews() { return <section className="bg-charcoal px-5 py-20 text-white lg:px-8 lg:py-28"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow="Kind words" title="Kept close, shared often." /><div className="mt-10 grid gap-4 md:grid-cols-3">{[['Ananya R.', 'The pendant feels so personal and beautifully made. Even the packaging felt like opening a blessing.', 'Verified devotee'], ['Karthik S.', 'The lamp has transformed our prayer corner. It is minimal, warm and full of character.', 'Verified customer'], ['Meera P.', 'A thoughtful gift for my parents. The care in every detail really comes through.', 'Verified customer']].map(([name, quote, role]) => <div key={name} className="border border-white/10 bg-white/[0.04] p-7"><div className="flex gap-1 text-gold">{[1,2,3,4,5].map((i) => <Star key={i} size={13} fill="currentColor" />)}</div><p className="mt-6 font-serif text-xl leading-7 text-cream">“{quote}”</p><p className="mt-8 text-sm font-semibold">{name}</p><p className="mt-1 text-xs text-white/40">{role}</p></div>)}</div></div></section>; }
function Newsletter({ onSubscribe }: { onSubscribe: (email: string) => void }) { const [email, setEmail] = useState(''); const submit = (e: FormEvent) => { e.preventDefault(); if (email) { onSubscribe(email); setEmail(''); } }; return <section className="bg-gold px-5 py-16 lg:px-8 lg:py-20"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 lg:flex-row lg:items-end"><div><p className="eyebrow text-charcoal/60">A note from us</p><h2 className="mt-3 max-w-xl font-serif text-4xl leading-none sm:text-5xl">Stay connected with divinity.</h2></div><form onSubmit={submit} className="flex w-full max-w-md border-b border-charcoal pb-3"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Your email address" className="w-full bg-transparent text-sm outline-none placeholder:text-charcoal/55" /><button className="text-xs font-bold uppercase tracking-[0.14em]">Subscribe <ArrowRight size={15} className="ml-2 inline" /></button></form></div></section>; }

function Shop({ onProduct, onAdd, wishlist, toggleWishlist }: { onProduct: (s: string) => void; onAdd: (p: Product) => void; wishlist: string[]; toggleWishlist: (id: string) => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('Featured');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { setCats(await fetchCategories()); setAllProducts(await fetchProducts()); setLoading(false); })(); }, []);
  const filtered = allProducts
    .filter((p) => (filter === 'All' || p.category?.slug === filter || p.category?.name === filter) && p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'Price: Low') return getEffectivePrice(a) - getEffectivePrice(b);
      if (sort === 'Price: High') return getEffectivePrice(b) - getEffectivePrice(a);
      return 0;
    });
  return <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20"><div className="flex flex-col justify-between gap-8 border-b border-charcoal/10 pb-10 lg:flex-row lg:items-end"><div><p className="eyebrow">The full collection</p><h1 className="mt-4 font-serif text-6xl leading-none">Shop with intention.</h1><p className="mt-4 max-w-lg leading-7 text-charcoal/60">Objects for your altar, your home, and the moments that matter.</p></div><div className="relative w-full max-w-sm border-b border-charcoal/30 pb-3"><Search size={17} className="inline text-charcoal/50" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="ml-3 bg-transparent text-sm outline-none" placeholder="Search the collection" /></div></div><div className="mt-8 flex flex-wrap items-center justify-between gap-4"><div className="flex flex-wrap gap-2">{['All', ...cats.map((c) => c.name)].map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition ${filter === item ? 'border-charcoal bg-charcoal text-white' : 'border-charcoal/15 hover:border-antique'}`}>{item}</button>)}</div><label className="flex items-center gap-2 text-xs text-charcoal/60">Sort by <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-transparent font-bold text-charcoal outline-none"><option>Featured</option><option>Price: Low</option><option>Price: High</option></select></label></div>{loading ? <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-charcoal/15 border-t-antique" /></div> : <div className="mt-10 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">{filtered.map((p) => <ProductCard key={p.id} product={p} onProduct={onProduct} onAdd={onAdd} wished={wishlist.includes(p.id)} onWishlist={() => toggleWishlist(p.id)} />)}</div>}{!loading && filtered.length === 0 && <div className="py-24 text-center"><p className="font-serif text-3xl">Nothing found yet.</p><p className="mt-2 text-charcoal/55">Try a different search or collection.</p></div>}</div>;
}

function ProductDetailsPage({ slug, onBack, onAdd, wishlist, toggleWishlist, onProduct }: { slug: string; onBack: () => void; onAdd: (p: Product) => void; wishlist: string[]; toggleWishlist: (id: string) => void; onProduct: (s: string) => void }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  useEffect(() => { (async () => { setLoading(true); const p = await fetchProductBySlug(slug); setProduct(p); if (p) { const all = await fetchProducts({ category: p.category?.name }); setRelated(all.filter((r) => r.id !== p.id).slice(0, 3)); } setLoading(false); })(); }, [slug]);
  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-charcoal/15 border-t-antique" /></div>;
  if (!product) return <div className="py-24 text-center"><h1 className="font-serif text-4xl">Product not found.</h1><button onClick={onBack} className="button-dark mt-6">Back to shop</button></div>;
  const imgs = product.images ?? [];
  const mainImg = imgs[activeImg]?.image_url ?? getPrimaryImage(product);
  const price = getEffectivePrice(product);
  return <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-16"><button onClick={onBack} className="mb-8 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-charcoal/55"><ChevronLeft size={16} /> Back to collection</button><div className="grid gap-10 lg:grid-cols-2 lg:gap-20"><div><div className="relative"><div className="absolute inset-5 border border-gold/40" />{mainImg ? <img src={mainImg} alt={product.name} className="relative aspect-square w-full object-cover" /> : <div className="relative flex aspect-square items-center justify-center bg-beige"><Package size={48} className="text-charcoal/20" /></div>}</div>{imgs.length > 1 && <div className="mt-4 flex gap-3">{imgs.map((img, i) => <button key={img.id} onClick={() => setActiveImg(i)} className={`h-20 w-20 overflow-hidden rounded-lg border-2 ${i === activeImg ? 'border-gold' : 'border-transparent'}`}><img src={img.image_url} alt="" className="h-full w-full object-cover" /></button>)}</div>}</div><div className="lg:py-8"><p className="eyebrow">{product.category?.name}</p><h1 className="mt-4 font-serif text-5xl leading-none sm:text-6xl">{product.name}</h1><div className="mt-5 flex items-center gap-3"><span className="flex gap-1 text-gold">{[1,2,3,4,5].map((i) => <Star key={i} size={14} fill="currentColor" />)}</span><span className="text-sm text-charcoal/55">{product.rating} · {product.review_count} reviews</span></div><div className="mt-7 flex items-baseline gap-3"><span className="text-2xl font-semibold">{formatPrice(price)}</span>{product.sale_price && product.sale_price > 0 && <del className="text-charcoal/35">{formatPrice(product.price)}</del>}</div><p className="mt-7 max-w-lg leading-8 text-charcoal/65">{product.description}</p><p className="mt-4 text-sm text-charcoal/50">{product.stock > 0 ? <span className="text-green-700">In stock ({product.stock} available)</span> : <span className="text-red-600">Out of stock</span>}</p><div className="mt-9 flex flex-wrap gap-3"><div className="flex items-center rounded-full border border-charcoal/15"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 py-3"><ChevronLeft size={15} /></button><span className="w-6 text-center text-sm">{quantity}</span><button onClick={() => setQuantity(quantity + 1)} className="px-4 py-3"><ChevronRight size={15} /></button></div><button onClick={() => { for (let i = 0; i < quantity; i++) onAdd(product); }} className="button-dark flex-1" disabled={product.stock === 0}>Add to cart <ShoppingBag size={16} /></button><button onClick={() => toggleWishlist(product.id)} className={`rounded-full border p-3 ${wishlist.includes(product.id) ? 'border-gold bg-gold' : 'border-charcoal/15'}`}><Heart size={19} fill={wishlist.includes(product.id) ? 'currentColor' : 'none'} /></button></div><div className="mt-10 grid grid-cols-2 gap-4 border-y border-charcoal/10 py-6 text-xs text-charcoal/65"><span className="flex items-center gap-2"><ShieldCheck size={17} className="text-antique" /> Secure payments</span><span className="flex items-center gap-2"><Package size={17} className="text-antique" /> Safe packaging</span><span className="flex items-center gap-2"><Truck size={17} className="text-antique" /> Easy tracking</span><span className="flex items-center gap-2"><Sparkles size={17} className="text-antique" /> Made with care</span></div></div></div>{related.length > 0 && <section className="mt-20 border-t border-charcoal/10 pt-14"><p className="eyebrow">You may also like</p><h2 className="mt-3 font-serif text-4xl">Complete the ritual.</h2><div className="mt-8 grid gap-5 sm:grid-cols-3">{related.map((p) => <ProductCard key={p.id} product={p} onProduct={onProduct} onAdd={onAdd} wished={wishlist.includes(p.id)} onWishlist={() => toggleWishlist(p.id)} />)}</div></section>}</div>;
}

function Cart({ cart, setCart, onNavigate }: { cart: CartLine[]; setCart: Dispatch<SetStateAction<CartLine[]>>; onNavigate: (r: Route) => void }) {
  const total = cart.reduce((s, l) => s + getEffectivePrice(l.product) * l.quantity, 0);
  const update = (id: string, amount: number) => setCart((items) => items.map((i) => i.product.id === id ? { ...i, quantity: Math.max(0, i.quantity + amount) } : i).filter((i) => i.quantity));
  return <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20"><p className="eyebrow">Your ritual, gathered</p><h1 className="mt-4 font-serif text-6xl">Your cart.</h1>{cart.length ? <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_370px]"><div className="space-y-5">{cart.map(({ product, quantity }) => { const img = getPrimaryImage(product); return <div key={product.id} className="flex gap-4 border-b border-charcoal/10 pb-5">{img && <img src={img} alt={product.name} className="h-28 w-24 rounded-xl object-cover" />}<div className="flex flex-1 flex-col justify-between"><div className="flex justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-antique">{product.category?.name}</p><h3 className="mt-1 font-serif text-xl">{product.name}</h3></div><span className="font-semibold">{formatPrice(getEffectivePrice(product) * quantity)}</span></div><div className="flex items-center justify-between"><div className="flex items-center rounded-full border border-charcoal/15"><button onClick={() => update(product.id, -1)} className="px-3 py-1.5">−</button><span className="px-2 text-sm">{quantity}</span><button onClick={() => update(product.id, 1)} className="px-3 py-1.5">+</button></div><button onClick={() => setCart((items) => items.filter((i) => i.product.id !== product.id))} className="text-xs text-charcoal/45 underline">Remove</button></div></div></div>})}</div><div className="h-fit rounded-2xl bg-charcoal p-7 text-white"><h2 className="font-serif text-3xl text-cream">Order summary</h2><div className="mt-7 space-y-4 border-b border-white/10 pb-6 text-sm"><div className="flex justify-between text-white/60"><span>Subtotal</span><span>{formatPrice(total)}</span></div><div className="flex justify-between text-white/60"><span>Shipping</span><span>{total >= 2500 ? 'Complimentary' : formatPrice(120)}</span></div></div><div className="flex justify-between py-6 text-lg"><span>Total</span><span className="font-semibold text-gold">{formatPrice(total + (total >= 2500 ? 0 : 120))}</span></div><button onClick={() => onNavigate('checkout')} className="button-gold w-full">Proceed to checkout <ArrowRight size={16} /></button><p className="mt-5 text-center text-xs text-white/40">Secure checkout · encrypted payments</p></div></div> : <div className="py-24 text-center"><ShoppingBag size={38} className="mx-auto text-antique" /><h2 className="mt-5 font-serif text-4xl">Your cart is resting.</h2><p className="mt-3 text-charcoal/55">Find something meaningful to bring home.</p><button onClick={() => onNavigate('shop')} className="button-dark mt-8">Explore the collection</button></div>}</div>;
}

function Checkout({ cart, setCart, onNavigate, onOrderPlaced }: { cart: CartLine[]; setCart: Dispatch<SetStateAction<CartLine[]>>; onNavigate: (r: Route) => void; onOrderPlaced: (o: Order) => void }) {
  const { session } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(session?.user?.email ?? '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [shippingMethod, setShippingMethod] = useState('standard');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  const subtotal = cart.reduce((s, l) => s + getEffectivePrice(l.product) * l.quantity, 0);
  const shippingFee = shippingMethod === 'express' ? 250 : subtotal >= 2500 ? 0 : 120;
  const total = subtotal + shippingFee;

  async function placeOrder() {
    if (!fullName || !phone || !email || !address || !city || !state || !pincode) { setError('Please fill in all fields.'); return; }
    if (cart.length === 0) { setError('Your cart is empty.'); return; }
    setPlacing(true); setError('');
    if (!supabase) { setPlacing(false); return; }
    const orderNumber = `VVM-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000 + 100000)}`;
    const shippingAddress = { full_name: fullName, phone, email, address_line: address, city, state, pincode, country: 'India' };
    const orderPayload: Record<string, unknown> = {
      order_number: orderNumber, email, phone, shipping_address: shippingAddress,
      subtotal, shipping_fee: shippingFee, discount: 0, total, status: 'pending',
    };
    if (session?.user?.id) orderPayload.user_id = session.user.id;
    else orderPayload.user_id = null;
    const { data: orderData, error: orderErr } = await supabase.from('orders').insert(orderPayload).select('*').maybeSingle();
    if (orderErr || !orderData) { setError(orderErr?.message ?? 'Could not place order.'); setPlacing(false); return; }
    const order = orderData as Order;
    const items = cart.map((l) => ({ order_id: order.id, product_id: l.product.id, product_name: l.product.name, image_url: getPrimaryImage(l.product), unit_price: getEffectivePrice(l.product), quantity: l.quantity }));
    await supabase.from('order_items').insert(items);
    await supabase.from('payments').insert({ order_id: order.id, provider: paymentMethod === 'cod' ? 'cod' : 'razorpay', status: paymentMethod === 'cod' ? 'pending' : 'pending' });
    await supabase.from('shipments').insert({ order_id: order.id, status: 'order_confirmed' });
    setCart([]); setPlacing(false); onOrderPlaced(order);
  }

  if (cart.length === 0) return <div className="py-24 text-center"><h1 className="font-serif text-4xl">Your cart is empty.</h1><button onClick={() => onNavigate('shop')} className="button-dark mt-6">Browse products</button></div>;
  return <div className="mx-auto max-w-5xl px-5 py-14 lg:px-8 lg:py-20"><h1 className="font-serif text-6xl">Checkout.</h1><div className="mt-12 grid gap-12 lg:grid-cols-[1fr_360px]"><div className="space-y-8">
    <div><h2 className="font-serif text-2xl">Shipping Address</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name *" className="field" /><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone *" className="field" /><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email *" className="field sm:col-span-2" /><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address *" className="field sm:col-span-2" /><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City *" className="field" /><input value={state} onChange={(e) => setState(e.target.value)} placeholder="State *" className="field" /><input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="Pincode *" className="field" /></div></div>
    <div><h2 className="font-serif text-2xl">Shipping Method</h2><div className="mt-4 space-y-3">{[['standard', 'Standard Delivery', '4-7 working days', shippingFee === 0 ? 'Free' : formatPrice(120)], ['express', 'Express Delivery', '2-3 working days', formatPrice(250)]].map(([val, label, desc, price]) => <label key={val} className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 ${shippingMethod === val ? 'border-gold bg-gold/5' : 'border-charcoal/15'}`}><div className="flex items-center gap-3"><input type="radio" checked={shippingMethod === val} onChange={() => setShippingMethod(val)} className="accent-antique" /><div><p className="font-semibold">{label}</p><p className="text-xs text-charcoal/50">{desc}</p></div></div><span className="font-semibold">{price}</span></label>)}</div></div>
    <div><h2 className="font-serif text-2xl">Payment Method</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{[['cod', 'Cash on Delivery'], ['upi', 'UPI'], ['card', 'Credit / Debit Card'], ['netbanking', 'Net Banking']].map(([val, label]) => <label key={val} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${paymentMethod === val ? 'border-gold bg-gold/5' : 'border-charcoal/15'}`}><input type="radio" checked={paymentMethod === val} onChange={() => setPaymentMethod(val)} className="accent-antique" /><span className="font-semibold">{label}</span></label>)}</div><p className="mt-3 flex items-center gap-2 text-xs text-charcoal/45"><ShieldCheck size={14} className="text-antique" /> Secure SSL encrypted checkout · we never store card details</p></div>
  </div><div className="h-fit rounded-2xl bg-charcoal p-7 text-white"><h2 className="font-serif text-3xl text-cream">Order summary</h2><div className="mt-6 space-y-3 text-sm"><div className="flex justify-between text-white/60"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div><div className="flex justify-between text-white/60"><span>Shipping</span><span>{shippingFee === 0 ? 'Free' : formatPrice(shippingFee)}</span></div></div><div className="flex justify-between border-t border-white/10 py-6 text-lg"><span>Total</span><span className="font-semibold text-gold">{formatPrice(total)}</span></div><button onClick={placeOrder} disabled={placing} className="button-gold w-full disabled:opacity-50">{placing ? 'Placing order...' : 'Place order'}</button>{error && <p className="mt-3 text-sm text-red-400">{error}</p>}</div></div></div>;
}

function Confirmation({ order, onNavigate }: { order: Order | null; onNavigate: (r: Route) => void }) {
  if (!order) return <div className="py-24 text-center"><h1 className="font-serif text-4xl">No order found.</h1><button onClick={() => onNavigate('home')} className="button-dark mt-6">Go home</button></div>;
  return <div className="mx-auto max-w-2xl px-5 py-20 text-center lg:py-28"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold"><Sparkles size={32} className="text-charcoal" /></div><h1 className="mt-6 font-serif text-5xl">Thank you for your order.</h1><p className="mt-4 text-charcoal/60">Your order has been placed successfully. We will begin packing it with care.</p><div className="mt-10 rounded-2xl border border-gold/40 bg-gold/5 p-7 text-left"><div className="grid gap-4 sm:grid-cols-2"><div><p className="text-xs uppercase tracking-wider text-charcoal/40">Order ID</p><p className="mt-1 font-serif text-xl">{order.order_number}</p></div><div><p className="text-xs uppercase tracking-wider text-charcoal/40">Date</p><p className="mt-1 font-serif text-xl">{new Date(order.created_at).toLocaleDateString()}</p></div><div><p className="text-xs uppercase tracking-wider text-charcoal/40">Payment Status</p><p className="mt-1 font-semibold capitalize">{order.status}</p></div><div><p className="text-xs uppercase tracking-wider text-charcoal/40">Total</p><p className="mt-1 font-semibold">{formatPrice(Number(order.total))}</p></div></div><div className="mt-5 border-t border-charcoal/10 pt-4"><p className="text-xs uppercase tracking-wider text-charcoal/40">Shipping Address</p><p className="mt-1 text-sm">{order.shipping_address?.full_name}, {order.shipping_address?.address_line}, {order.shipping_address?.city}, {order.shipping_address?.state} {order.shipping_address?.pincode}</p></div></div><div className="mt-8 flex justify-center gap-3"><button onClick={() => onNavigate('track')} className="button-dark">Track my order</button><button onClick={() => onNavigate('shop')} className="rounded-full border border-charcoal/15 px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider hover:bg-charcoal/5">Continue shopping</button></div></div>;
}

function Login({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    const result = mode === 'login' ? await signIn(email, password) : await signUp(email, password, fullName);
    if (result.error) setError(result.error);
    else onNavigate('account');
    setBusy(false);
  };
  return <div className="mx-auto grid min-h-[620px] max-w-7xl items-center gap-10 px-5 py-14 lg:grid-cols-2 lg:px-8"><div className="hidden bg-charcoal p-14 text-cream lg:block"><p className="eyebrow text-gold">Welcome home</p><h1 className="mt-5 font-serif text-6xl leading-none">A little more<br /><em className="text-gold">meaningful.</em></h1><p className="mt-7 max-w-sm leading-7 text-cream/60">Keep your orders, saved pieces and future rituals together in one place.</p></div><form onSubmit={submit} className="mx-auto w-full max-w-md"><p className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Begin your journey'}</p><h1 className="mt-4 font-serif text-5xl">{mode === 'login' ? 'Sign in.' : 'Create account.'}</h1><div className="mt-10 space-y-5">{mode === 'register' && <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="field" />}<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="field" /><input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="field" /></div>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="button-dark mt-7 w-full disabled:opacity-50">{busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></button><button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="mt-6 w-full text-center text-sm text-charcoal/55 underline">{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button></form></div>;
}

function AccountPage({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const { session, profile, signOut } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      if (!supabase || !session?.user?.id) { setLoading(false); return; }
      const { data } = await supabase.from('orders').select('*, order_items:order_items(*)').eq('user_id', session.user.id).order('created_at', { ascending: false });
      setOrders((data as Order[]) ?? []); setLoading(false);
    })();
  }, [session?.user?.id]);

  if (!session) return <div className="mx-auto max-w-md px-5 py-20 text-center"><CircleUserRound size={40} className="mx-auto text-antique" /><h1 className="mt-5 font-serif text-4xl">Sign in to continue.</h1><p className="mt-3 text-charcoal/55">Access your orders, wishlist and saved addresses.</p><button onClick={() => onNavigate('login')} className="button-dark mt-6">Sign in / Register</button></div>;

  return <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20"><div className="flex items-center justify-between"><div><p className="eyebrow">Your space</p><h1 className="mt-4 font-serif text-5xl">Hello, {profile?.full_name ?? 'there'}.</h1></div><button onClick={async () => { await signOut(); onNavigate('home'); }} className="flex items-center gap-2 text-sm text-charcoal/55 hover:text-charcoal"><LogOut size={16} /> Sign out</button></div><div className="mt-12"><h2 className="font-serif text-3xl">Your orders</h2>{loading ? <div className="flex justify-center py-10"><div className="h-8 w-8 animate-spin rounded-full border-2 border-charcoal/15 border-t-antique" /></div> : orders.length === 0 ? <div className="py-16 text-center text-charcoal/40"><Package size={32} className="mx-auto" /><p className="mt-3">No orders yet.</p><button onClick={() => onNavigate('shop')} className="button-dark mt-4">Start shopping</button></div> : <div className="mt-6 space-y-3">{orders.map((o) => <div key={o.id} className="flex items-center justify-between rounded-xl border border-charcoal/10 bg-white p-5"><div><p className="font-semibold">{o.order_number}</p><p className="text-sm text-charcoal/50">{new Date(o.created_at).toLocaleDateString()} · {formatPrice(Number(o.total))}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-gold/10 px-3 py-1 text-xs font-bold capitalize text-antique">{o.status}</span><button onClick={() => onNavigate('track')} className="rounded-lg bg-charcoal px-4 py-2 text-xs font-semibold text-white hover:bg-antique">Track</button></div></div>)}</div>}</div></div>;
}

function TrackOrder() {
  const [orderId, setOrderId] = useState('');
  const [verify, setVerify] = useState('');
  const [result, setResult] = useState<{ order: Order; shipment: Order['shipment'] } | null>(null);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const steps = ['order_confirmed', 'processing', 'packed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'];

  async function search() {
    if (!supabase || !orderId.trim()) { setError('Enter your order ID.'); return; }
    setSearching(true); setError(''); setResult(null);
    const { data } = await supabase.from('orders').select('*, order_items:order_items(*), shipment:shipments(*)').eq('order_number', orderId.trim()).maybeSingle();
    const order = data as Order | null;
    if (!order || (order.email.toLowerCase() !== verify.trim().toLowerCase() && order.phone !== verify.trim())) { setError('Order not found. Check your order ID and email/phone.'); setSearching(false); return; }
    setResult({ order, shipment: order.shipment }); setSearching(false);
  }

  const currentStep = result?.shipment?.status ? steps.indexOf(result.shipment.status) : 0;

  return <div className="mx-auto max-w-5xl px-5 py-14 lg:px-8 lg:py-24"><div className="mx-auto max-w-2xl text-center"><p className="eyebrow">A little peace of mind</p><h1 className="mt-4 font-serif text-6xl">Track your order.</h1><p className="mt-5 leading-7 text-charcoal/60">Enter your order ID and the email or phone used at checkout.</p><div className="mt-10 grid gap-3 text-left sm:grid-cols-2"><input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Order ID · VVM-2026-000123" className="field" /><input value={verify} onChange={(e) => setVerify(e.target.value)} placeholder="Email or phone number" className="field" /></div><button onClick={search} disabled={searching} className="button-dark mt-4 w-full sm:w-auto disabled:opacity-50">{searching ? 'Searching...' : 'Find my order'} <ArrowRight size={16} /></button>{error && <p className="mt-4 text-sm text-red-600">{error}</p>}</div>{result && <div className="mt-20 border border-gold/50 bg-gold/5 p-7 sm:p-10"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="eyebrow">Order found</p><h2 className="mt-2 font-serif text-3xl">{result.order.order_number}</h2>{result.shipment?.shipping_id && <p className="mt-2 text-sm text-charcoal/55">Shipping ID · {result.shipment.shipping_id}</p>}</div><span className="rounded-full bg-gold px-4 py-2 text-xs font-bold uppercase tracking-[0.12em]">{result.shipment?.status?.replace(/_/g, ' ') ?? 'Order confirmed'}</span></div><div className="mt-12 grid gap-7 sm:grid-cols-7">{steps.map((step, index) => <div key={step} className="relative"><div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs ${index <= currentStep ? 'border-gold bg-gold text-charcoal' : 'border-charcoal/20 text-transparent'}`}>{index < currentStep ? '✓' : index === currentStep ? <Truck size={13} /> : ''}</div><p className="mt-3 text-[10px] font-semibold capitalize leading-tight">{step.replace(/_/g, ' ')}</p>{index < steps.length - 1 && <div className={`absolute left-7 top-3 hidden h-px w-[calc(100%+0.5rem)] sm:block ${index < currentStep ? 'bg-gold' : 'bg-charcoal/10'}`} />}</div>)}</div><div className="mt-10 grid gap-4 border-t border-charcoal/10 pt-5 text-sm sm:grid-cols-2"><div><p className="text-xs uppercase tracking-wider text-charcoal/40">Courier Partner</p><p className="mt-1 font-semibold">{result.shipment?.courier_partner ?? 'To be assigned'}</p></div><div><p className="text-xs uppercase tracking-wider text-charcoal/40">Tracking Number</p><p className="mt-1 font-semibold">{result.shipment?.tracking_number ?? 'To be assigned'}</p></div><div><p className="text-xs uppercase tracking-wider text-charcoal/40">Estimated Delivery</p><p className="mt-1 font-semibold">{result.shipment?.estimated_delivery ?? 'To be confirmed'}</p></div></div></div>}</div>;
}

function About() { return <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-24"><div className="max-w-3xl"><p className="eyebrow">Our story</p><h1 className="mt-5 font-serif text-6xl leading-none sm:text-8xl">Devotion,<br /><em className="text-antique">made tangible.</em></h1></div><div className="mt-16 grid gap-10 lg:grid-cols-2 lg:items-center"><img src="https://images.pexels.com/photos/6044266/pexels-photo-6044266.jpeg?auto=compress&cs=tinysrgb&w=1200" className="aspect-[4/3] w-full object-cover" alt="Warm brass lamp" /><div className="lg:pl-10"><p className="text-xl leading-9 text-charcoal/75">We believe devotion does not only live in temples. It lives in the pendant you touch before a difficult day, the lamp you light at dusk, and the gift chosen with someone's heart in mind.</p><p className="mt-6 leading-8 text-charcoal/60">Vel Verse With Me brings the soul of South Indian tradition into a considered, contemporary collection. Every object is selected for its story, its craft, and the feeling it leaves behind.</p></div></div></div>; }
function Contact({ onNotice }: { onNotice: (s: string) => void }) { const submit = (e: FormEvent) => { e.preventDefault(); onNotice('Your message has been received. We will be in touch soon.'); }; return <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-24"><div className="grid gap-12 lg:grid-cols-2"><div><p className="eyebrow">We are here for you</p><h1 className="mt-5 font-serif text-6xl leading-none">Let's talk<br /><em className="text-antique">meaning.</em></h1><p className="mt-7 max-w-md leading-8 text-charcoal/60">Questions about an order, a gift, or choosing something special? Our team would love to hear from you.</p><div className="mt-10 space-y-5 text-sm"><p><span className="block text-xs font-bold uppercase tracking-[0.16em] text-antique">Email</span>hello@velversewithme.com</p><p><span className="block text-xs font-bold uppercase tracking-[0.16em] text-antique">Instagram</span>@velversewithme</p></div></div><form onSubmit={submit} className="space-y-4"><input required className="field" placeholder="Your name" /><input required type="email" className="field" placeholder="Email address" /><input className="field" placeholder="Phone number (optional)" /><textarea required className="field min-h-36 resize-none" placeholder="How can we help?" /><button className="button-dark">Send message <ArrowRight size={16} /></button></form></div></div>; }
function Faq() { const faqs = [['How long will my order take?', 'Most orders arrive within 4-7 working days across India. You will receive a tracking link as soon as your parcel leaves our house.'], ['How do I track my order?', 'Use your order ID and the email or phone number used at checkout on our Track Order page.'], ['Are payments secure?', 'Yes. Payments are processed by our secure payment partners. We never store raw card numbers or CVV details.'], ['Can I return an item?', 'Unused items in their original packaging can be requested for return within 7 days of delivery. Contact us to begin.']]; return <div className="mx-auto max-w-3xl px-5 py-14 lg:px-8 lg:py-24"><p className="eyebrow">The little details</p><h1 className="mt-5 font-serif text-6xl">Frequently asked.</h1><div className="mt-12 space-y-3">{faqs.map(([q, a]) => <details key={q} className="group border-b border-charcoal/15 py-5"><summary className="flex cursor-pointer list-none items-center justify-between font-serif text-xl">{q}<ChevronDown size={18} className="transition group-open:rotate-180" /></summary><p className="mt-4 max-w-2xl leading-7 text-charcoal/60">{a}</p></details>)}</div></div>; }
function Policy() { return <div className="mx-auto max-w-3xl px-5 py-14 lg:px-8 lg:py-24"><p className="eyebrow">The fine print</p><h1 className="mt-5 font-serif text-6xl">Shipping & returns.</h1><div className="prose prose-stone mt-12 max-w-none"><h2>Shipping policy</h2><p>We lovingly pack orders within 1-2 working days. Standard delivery across India usually takes 4-7 working days. You will receive a shipping ID and courier details by email once dispatched.</p><h2>Returns</h2><p>We accept return requests within 7 days of delivery for unused pieces in original condition. Personalized and used items cannot be returned. Please contact our support team with your order ID.</p><h2>Privacy</h2><p>Your details are used only to fulfill your order and support your experience. Payment details are handled by secure payment providers and are never stored by Vel Verse With Me.</p></div></div>; }

function Footer({ onNavigate, onSubscribe }: { onNavigate: (r: Route) => void; onSubscribe: (email: string) => void }) { const [email, setEmail] = useState(''); return <footer className="bg-charcoal px-5 pb-24 pt-16 text-cream lg:px-8 lg:pb-12"><div className="mx-auto max-w-7xl"><div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1.4fr]"><div><div className="flex items-center gap-3"><img src="/assets/images/image.png" className="h-14 w-14 rounded-full" alt="" /><span className="font-serif text-lg tracking-[0.13em]">VEL VERSE<br /><em className="font-normal text-gold">WITH ME</em></span></div><p className="mt-6 max-w-xs text-sm leading-7 text-cream/50">A modern devotional house inspired by the beauty, strength and spirit of Tamil tradition.</p></div><div><p className="eyebrow text-gold">Explore</p><div className="mt-5 space-y-3 text-sm text-cream/60"><button onClick={() => onNavigate('shop')} className="block hover:text-gold">All products</button><button onClick={() => onNavigate('about')} className="block hover:text-gold">Our story</button><button onClick={() => onNavigate('track')} className="block hover:text-gold">Track order</button></div></div><div><p className="eyebrow text-gold">Care</p><div className="mt-5 space-y-3 text-sm text-cream/60"><button onClick={() => onNavigate('contact')} className="block hover:text-gold">Contact us</button><button onClick={() => onNavigate('faq')} className="block hover:text-gold">FAQ</button><button onClick={() => onNavigate('policy')} className="block hover:text-gold">Shipping & returns</button></div></div><div><p className="eyebrow text-gold">Stay in the circle</p><p className="mt-5 text-sm leading-6 text-cream/50">New rituals, considered gifts and notes from our house.</p><form onSubmit={(e) => { e.preventDefault(); if (email) { onSubscribe(email); setEmail(''); } }} className="mt-5 flex border-b border-cream/20 pb-3"><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="w-full bg-transparent text-sm outline-none placeholder:text-cream/35" /><button><ArrowRight size={17} className="text-gold" /></button></form><div className="mt-6 flex items-center gap-3 text-cream/60"><Instagram size={17} /><span className="text-xs">@velversewithme</span></div></div></div><div className="mt-14 flex flex-col justify-between gap-3 border-t border-white/10 pt-6 text-xs text-cream/35 sm:flex-row"><span>© 2026 Vel Verse With Me. All rights reserved.</span><span>Made with faith · Shipped with care</span></div></div></footer>; }
function MobileBottom({ route, onNavigate, cartCount }: { route: Route; onNavigate: (r: Route) => void; cartCount: number }) { return <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t border-charcoal/10 bg-cream/95 px-3 py-2 backdrop-blur lg:hidden"><BottomItem icon={Sparkles} label="Home" active={route === 'home'} onClick={() => onNavigate('home')} /><BottomItem icon={Search} label="Shop" active={route === 'shop'} onClick={() => onNavigate('shop')} /><BottomItem icon={Heart} label="Account" active={route === 'account'} onClick={() => onNavigate('account')} /><BottomItem icon={ShoppingBag} label={`Cart${cartCount ? ` · ${cartCount}` : ''}`} active={route === 'cart'} onClick={() => onNavigate('cart')} /></nav>; }
function BottomItem({ icon: Icon, label, active, onClick }: { icon: typeof Sparkles; label: string; active: boolean; onClick: () => void }) { return <button onClick={onClick} className={`flex flex-col items-center gap-1 py-1 text-[9px] font-bold uppercase tracking-[0.1em] ${active ? 'text-antique' : 'text-charcoal/45'}`}><Icon size={18} /><span>{label}</span></button>; }
