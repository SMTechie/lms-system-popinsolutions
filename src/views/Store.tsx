import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Archive, BadgeDollarSign, BarChart3, Copy, Download, Edit3, Eye, History,
  ImagePlus, PackagePlus, Plus, Search, ShoppingCart, Store as StoreIcon,
  Trash2, Upload, Warehouse, X
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import { useBranding } from '../settings/BrandingContext';
import { apiRequest } from '../lib/api';

type Mode = 'storefront' | 'management' | 'orders';
type HistoryKind = 'stock' | 'sales';

interface StoreProduct {
  id: string; name: string; slug: string; sku?: string | null; barcode?: string | null;
  basePrice?: number | null; costPrice?: number | null; vatRate?: number; vatInclusive?: boolean;
  shortDescription?: string | null; longDescription?: string | null; primaryImage?: string | null;
  stockQuantity?: number | null; lowStockThreshold?: number | null; reorderQuantity?: number;
  categoryId?: string | null; category?: { name: string } | null; isActive: boolean; isFeatured: boolean;
  allowOnlinePurchase?: boolean; sizeOptions?: string[]; colorOptions?: string[];
  genderGroup?: string | null; gradeGroup?: string | null; supplierId?: string | null;
  collectionLocation?: string | null; returnPolicy?: string | null;
  variants?: Array<{ id?: string; name: string; size?: string; color?: string; stockQuantity?: number }>;
  images?: Array<{ url: string; isPrimary?: boolean }>;
}

interface ProductForm {
  name: string; categoryId: string; shortDescription: string; imageUrl: string; basePrice: number;
  costPrice: number; vatRate: number; vatInclusive: boolean; sku: string; barcode: string;
  sizeOptions: string; colorOptions: string; genderGroup: string; gradeGroup: string;
  stockQuantity: number; lowStockThreshold: number; supplierId: string; reorderQuantity: number;
  isActive: boolean; isFeatured: boolean; allowOnlinePurchase: boolean;
  collectionLocation: string; returnPolicy: string;
}

const emptyForm: ProductForm = {
  name: '', categoryId: '', shortDescription: '', imageUrl: '', basePrice: 0, costPrice: 0,
  vatRate: 15, vatInclusive: true, sku: '', barcode: '', sizeOptions: '', colorOptions: '',
  genderGroup: '', gradeGroup: '', stockQuantity: 0, lowStockThreshold: 5, supplierId: '',
  reorderQuantity: 10, isActive: true, isFeatured: false, allowOnlinePurchase: true,
  collectionLocation: 'School reception', returnPolicy: 'Returns accepted within 14 days with proof of purchase.'
};

const fieldClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10';

export default function Store() {
  const [mode, setMode] = useState<Mode>('storefront');
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<Array<{ product: StoreProduct; quantity: number }>>([]);
  const [showCart, setShowCart] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('eft');
  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [stockProduct, setStockProduct] = useState<StoreProduct | null>(null);
  const [stockAction, setStockAction] = useState({ type: 'RESTOCK', quantity: 1, reason: '' });
  const [historyProduct, setHistoryProduct] = useState<StoreProduct | null>(null);
  const [historyKind, setHistoryKind] = useState<HistoryKind>('stock');
  const [history, setHistory] = useState<{ stock: any[]; sales: any[] }>({ stock: [], sales: [] });
  const [orders, setOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const { branding } = useBranding();
  const canManage = permissions.includes('uniform_store:store.manage');
  const schoolName = branding?.schoolName || 'Your School';

  const loadCatalog = async () => {
    setLoading(true); setError('');
    try {
      const data = await apiRequest<any>('/store/catalog?visibility=internal&includeImages=true&includeVariants=true');
      setProducts(data.products || []); setCategories(data.categories || []);
    } catch (err: any) { setError(err.message || 'Unable to load the catalog.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    void Promise.all([
      loadCatalog(),
      apiRequest<any>('/auth/me').then((me) => setPermissions(me.permissions || [])).catch(() => setPermissions([]))
    ]);
  }, []);

  const filtered = useMemo(() => products.filter((product) => {
    const haystack = `${product.name} ${product.sku || ''} ${product.barcode || ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase()) && (!category || product.categoryId === category) && (mode === 'management' || (product.isActive && product.allowOnlinePurchase));
  }), [products, search, category, mode]);

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.basePrice || 0) * item.quantity, 0);

  const openEditor = (product?: StoreProduct) => {
    setEditing(product || null);
    setForm(product ? {
      name: product.name, categoryId: product.categoryId || '', shortDescription: product.shortDescription || '',
      imageUrl: product.primaryImage || '', basePrice: product.basePrice || 0, costPrice: product.costPrice || 0,
      vatRate: product.vatRate ?? 15, vatInclusive: product.vatInclusive ?? true, sku: product.sku || '', barcode: product.barcode || '',
      sizeOptions: (product.sizeOptions || []).join(', '), colorOptions: (product.colorOptions || []).join(', '),
      genderGroup: product.genderGroup || '', gradeGroup: product.gradeGroup || '', stockQuantity: product.stockQuantity || 0,
      lowStockThreshold: product.lowStockThreshold || 0, supplierId: product.supplierId || '', reorderQuantity: product.reorderQuantity || 0,
      isActive: product.isActive, isFeatured: product.isFeatured, allowOnlinePurchase: product.allowOnlinePurchase ?? true,
      collectionLocation: product.collectionLocation || '', returnPolicy: product.returnPolicy || ''
    } : emptyForm);
    setShowEditor(true);
  };

  const productPayload = () => ({
    ...form,
    slug: editing?.slug || `${form.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`,
    categoryId: form.categoryId || undefined, supplierId: form.supplierId || undefined,
    sizeOptions: form.sizeOptions.split(',').map((value) => value.trim()).filter(Boolean),
    colorOptions: form.colorOptions.split(',').map((value) => value.trim()).filter(Boolean),
    visibility: 'universal', trackInventory: true,
    images: form.imageUrl ? [{ url: form.imageUrl, altText: form.name, isPrimary: true }] : [],
    variants: form.sizeOptions.split(',').map((value) => value.trim()).filter(Boolean).flatMap((size) => {
      const colours = form.colorOptions.split(',').map((value) => value.trim()).filter(Boolean);
      return (colours.length ? colours : ['']).map((color) => ({ name: [size, color].filter(Boolean).join(' / '), size, color: color || undefined, isActive: true }));
    })
  });

  const saveProduct = async () => {
    if (!form.name.trim() || form.basePrice < 0 || form.stockQuantity < 0) return setError('Product name, a valid price, and valid stock are required.');
    setBusy(true); setError('');
    try {
      await apiRequest(editing ? `/store/products/${editing.id}` : '/store/products', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(productPayload()) });
      setShowEditor(false); await loadCatalog();
    } catch (err: any) { setError(err.message || 'Unable to save product.'); }
    finally { setBusy(false); }
  };

  const mutate = async (path: string, options: RequestInit, confirmation?: string) => {
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(true); setError('');
    try { await apiRequest(path, options); await loadCatalog(); }
    catch (err: any) { setError(err.message || 'Action failed.'); }
    finally { setBusy(false); }
  };

  const openHistory = async (product: StoreProduct, kind: HistoryKind) => {
    setHistoryProduct(product); setHistoryKind(kind);
    try { setHistory(await apiRequest(`/store/products/${product.id}/history`)); }
    catch (err: any) { setError(err.message); }
  };

  const adjustStock = async () => {
    if (!stockProduct) return;
    await mutate(`/store/products/${stockProduct.id}/stock`, { method: 'POST', body: JSON.stringify(stockAction) });
    setStockProduct(null);
  };

  const addToCart = (product: StoreProduct) => setCart((current) => {
    const existing = current.find((item) => item.product.id === product.id);
    return existing
      ? current.map((item) => item.product.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stockQuantity || 0) } : item)
      : [...current, { product, quantity: 1 }];
  });

  const placeOrder = async () => {
    setBusy(true);
    try {
      await apiRequest('/store/orders', { method: 'POST', body: JSON.stringify({ paymentMethod, items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })) }) });
      setCart([]); setShowCart(false); await loadCatalog();
      alert('Order placed successfully. You can track it in Order History.');
    } catch (err: any) { setError(err.message || 'Order could not be placed.'); }
    finally { setBusy(false); }
  };

  const showOrders = async () => {
    setMode('orders');
    try { setOrders(await apiRequest('/store/orders/mine')); }
    catch (err: any) { setError(err.message); }
  };

  const exportProducts = () => {
    const rows = [['Name', 'SKU', 'Category', 'Price', 'Cost', 'Stock', 'Minimum stock', 'Active'], ...products.map((p) => [p.name, p.sku || '', p.category?.name || '', p.basePrice || 0, p.costPrice || 0, p.stockQuantity || 0, p.lowStockThreshold || 0, p.isActive])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'uniform-products.csv'; link.click();
  };

  const importProducts = async (file?: File) => {
    if (!file) return;
    const lines = (await file.text()).split(/\r?\n/).filter(Boolean).slice(1);
    setBusy(true);
    try {
      for (const [index, line] of lines.entries()) {
        const [name, sku, , price, cost, stock, minimum] = line.split(',').map((value) => value.replace(/^"|"$/g, '').trim());
        if (!name) continue;
        await apiRequest('/store/products', { method: 'POST', body: JSON.stringify({ ...emptyForm, name, sku, slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${index}`, basePrice: Number(price || 0), costPrice: Number(cost || 0), stockQuantity: Number(stock || 0), lowStockThreshold: Number(minimum || 0), visibility: 'universal' }) });
      }
      await loadCatalog();
    } catch (err: any) { setError(err.message || 'Import failed.'); }
    finally { setBusy(false); if (importRef.current) importRef.current.value = ''; }
  };

  return (
    <DashboardLayout title="Uniform Store">
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">{schoolName}</p><h2 className="mt-1 text-2xl font-bold">Uniform Store</h2><p className="mt-1 text-sm text-blue-100">Commerce for families. Inventory control for staff.</p></div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setMode('storefront')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'storefront' ? 'bg-white text-blue-800' : 'bg-white/10 hover:bg-white/20'}`}><StoreIcon className="mr-2 inline h-4 w-4" />Storefront</button>
              <button onClick={showOrders} className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'orders' ? 'bg-white text-blue-800' : 'bg-white/10 hover:bg-white/20'}`}><History className="mr-2 inline h-4 w-4" />Order History</button>
              {canManage && <button onClick={() => setMode('management')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'management' ? 'bg-amber-400 text-slate-950' : 'bg-white/10 hover:bg-white/20'}`}><Warehouse className="mr-2 inline h-4 w-4" />Manage Products</button>}
              {mode === 'storefront' && <button onClick={() => setShowCart(true)} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold"><ShoppingCart className="mr-2 inline h-4 w-4" />Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)})</button>}
            </div>
          </div>
        </div>

        {error && <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button onClick={() => setError('')}><X className="h-4 w-4" /></button></div>}

        {mode !== 'orders' && <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input className={`${fieldClass} pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, SKU, or barcode" /></div>
          <select className={`${fieldClass} w-auto min-w-[180px]`} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          {mode === 'management' && <>
            <button onClick={() => openEditor()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><Plus className="mr-2 inline h-4 w-4" />New Product</button>
            <button onClick={() => importRef.current?.click()} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold"><Upload className="mr-2 inline h-4 w-4" />Import Products</button>
            <input ref={importRef} type="file" accept=".csv" hidden onChange={(e) => void importProducts(e.target.files?.[0])} />
            <button onClick={exportProducts} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold"><Download className="mr-2 inline h-4 w-4" />Export Products</button>
            <button onClick={() => setStockProduct(products[0] || null)} disabled={!products.length} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40"><PackagePlus className="mr-2 inline h-4 w-4" />Stock Adjustments</button>
          </>}
        </div>}

        {loading && <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Loading store inventory…</div>}

        {!loading && mode === 'storefront' && <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product, index) => <motion.article key={product.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .03 }} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="relative h-48 bg-slate-100">{product.primaryImage ? <img src={product.primaryImage} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-gray-400">No product image</div>}{product.isFeatured && <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-2 py-1 text-xs font-bold text-slate-900">Featured</span>}</div>
            <div className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{product.category?.name || 'Uniform'}</p><h3 className="mt-1 text-lg font-bold text-gray-900">{product.name}</h3><p className="mt-1 line-clamp-2 text-sm text-gray-500">{product.shortDescription}</p>
              {!!product.sizeOptions?.length && <div className="mt-3 flex flex-wrap gap-1">{product.sizeOptions.map((size) => <span key={size} className="rounded border border-gray-200 px-2 py-1 text-xs">{size}</span>)}</div>}
              <div className="mt-4 flex items-end justify-between"><div><p className="text-xl font-bold">R {(product.basePrice || 0).toFixed(2)}</p><p className={`text-xs ${(product.stockQuantity || 0) <= (product.lowStockThreshold || 0) ? 'text-amber-600' : 'text-emerald-600'}`}>{(product.stockQuantity || 0) > 0 ? `${product.stockQuantity} available` : 'Out of stock'}</p></div><button onClick={() => addToCart(product)} disabled={(product.stockQuantity || 0) < 1} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Plus className="mr-1 inline h-4 w-4" />Add to cart</button></div>
            </div>
          </motion.article>)}
        </div>}

        {!loading && mode === 'management' && <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((product) => <article key={product.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${product.isActive ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-75'}`}>
            <div className="flex gap-4"><div className="h-20 w-20 overflow-hidden rounded-xl bg-slate-100">{product.primaryImage && <img src={product.primaryImage} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="truncate font-bold text-gray-900">{product.name}</p><p className="text-xs text-gray-500">{product.sku || 'No SKU'} · {product.category?.name || 'Uncategorised'}</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${product.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{product.isActive ? 'Active' : 'Hidden'}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-gray-400">Price</p><p className="font-bold">R {product.basePrice || 0}</p></div><div><p className="text-gray-400">Cost</p><p className="font-bold">R {product.costPrice || 0}</p></div><div><p className="text-gray-400">Stock</p><p className={`font-bold ${(product.stockQuantity || 0) <= (product.lowStockThreshold || 0) ? 'text-amber-600' : ''}`}>{product.stockQuantity || 0}</p></div></div></div></div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Action icon={Eye} label="View" onClick={() => { setMode('storefront'); setSearch(product.name); }} />
              <Action icon={Edit3} label="Edit" onClick={() => openEditor(product)} />
              <Action icon={Copy} label="Duplicate" onClick={() => void mutate(`/store/products/${product.id}/duplicate`, { method: 'POST' })} />
              <Action icon={Archive} label={product.isActive ? 'Disable / Hide' : 'Enable'} onClick={() => void mutate(`/store/products/${product.id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: !product.isActive }) })} />
              <Action icon={Trash2} label="Delete" danger onClick={() => void mutate(`/store/products/${product.id}`, { method: 'DELETE' }, `Delete ${product.name}? This cannot be undone.`)} />
              <Action icon={PackagePlus} label="Restock" onClick={() => { setStockProduct(product); setStockAction({ type: 'RESTOCK', quantity: product.reorderQuantity || 1, reason: 'Scheduled restock' }); }} />
              <Action icon={BadgeDollarSign} label="Adjust price" onClick={() => openEditor(product)} />
              <Action icon={History} label="Stock history" onClick={() => void openHistory(product, 'stock')} />
              <Action icon={BarChart3} label="Sales history" onClick={() => void openHistory(product, 'sales')} />
            </div>
          </article>)}
        </div>}

        {!loading && mode === 'orders' && <div className="space-y-3">{orders.length === 0 ? <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">No orders yet.</div> : orders.map((order) => <div key={order.id} className="rounded-xl border border-gray-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold">Order #{order.id.slice(0, 8).toUpperCase()}</p><p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleString()}</p></div><div className="text-right"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{order.status}</span><p className="mt-2 font-bold">R {order.totalAmount.toFixed(2)}</p></div></div><div className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">{order.items.map((item: any) => <p key={item.id}>{item.quantity} × {item.name}</p>)}</div></div>)}</div>}
      </div>

      <Modal title={`${editing ? 'Edit' : 'New'} Product`} isOpen={showEditor} onClose={() => setShowEditor(false)}><div className="max-h-[72vh] space-y-5 overflow-y-auto pr-1"><Section title="Product details"><Field label="Product name"><input className={fieldClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Category"><select className={fieldClass} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">Select</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="SKU"><input className={fieldClass} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field></div><Field label="Description"><textarea className={fieldClass} rows={3} value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} /></Field><Field label="Product image"><label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 p-4 text-sm text-gray-500"><ImagePlus className="h-5 w-5" />Upload image<input hidden type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setForm((current) => ({ ...current, imageUrl: String(reader.result) })); reader.readAsDataURL(file); }} /></label>{form.imageUrl && <img src={form.imageUrl} alt="Preview" className="mt-2 h-28 w-full rounded-lg object-cover" />}</Field></Section>
        <Section title="Pricing & tax"><div className="grid grid-cols-2 gap-3"><NumberField label="Price" value={form.basePrice} onChange={(basePrice) => setForm({ ...form, basePrice })} /><NumberField label="Cost price" value={form.costPrice} onChange={(costPrice) => setForm({ ...form, costPrice })} /><NumberField label="VAT %" value={form.vatRate} onChange={(vatRate) => setForm({ ...form, vatRate })} /><Toggle label="VAT inclusive" checked={form.vatInclusive} onChange={(vatInclusive) => setForm({ ...form, vatInclusive })} /></div></Section>
        <Section title="Variants & identity"><div className="grid grid-cols-2 gap-3"><Field label="Barcode"><input className={fieldClass} value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></Field><Field label="Gender"><input className={fieldClass} value={form.genderGroup} onChange={(e) => setForm({ ...form, genderGroup: e.target.value })} /></Field><Field label="Sizes (comma separated)"><input className={fieldClass} value={form.sizeOptions} onChange={(e) => setForm({ ...form, sizeOptions: e.target.value })} /></Field><Field label="Colours (comma separated)"><input className={fieldClass} value={form.colorOptions} onChange={(e) => setForm({ ...form, colorOptions: e.target.value })} /></Field></div><Field label="Grade group"><input className={fieldClass} value={form.gradeGroup} onChange={(e) => setForm({ ...form, gradeGroup: e.target.value })} /></Field></Section>
        <Section title="Inventory & fulfilment"><div className="grid grid-cols-2 gap-3"><NumberField label="Stock quantity" value={form.stockQuantity} onChange={(stockQuantity) => setForm({ ...form, stockQuantity })} /><NumberField label="Minimum stock" value={form.lowStockThreshold} onChange={(lowStockThreshold) => setForm({ ...form, lowStockThreshold })} /><NumberField label="Reorder quantity" value={form.reorderQuantity} onChange={(reorderQuantity) => setForm({ ...form, reorderQuantity })} /><Field label="Supplier"><input className={fieldClass} value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} placeholder="Supplier reference" /></Field></div><Field label="Collection location"><input className={fieldClass} value={form.collectionLocation} onChange={(e) => setForm({ ...form, collectionLocation: e.target.value })} /></Field><Field label="Return policy"><textarea className={fieldClass} value={form.returnPolicy} onChange={(e) => setForm({ ...form, returnPolicy: e.target.value })} /></Field></Section>
        <Section title="Availability"><div className="grid grid-cols-2 gap-3"><Toggle label="Active" checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} /><Toggle label="Featured" checked={form.isFeatured} onChange={(isFeatured) => setForm({ ...form, isFeatured })} /><Toggle label="Allow online purchase" checked={form.allowOnlinePurchase} onChange={(allowOnlinePurchase) => setForm({ ...form, allowOnlinePurchase })} /></div></Section>
        <button disabled={busy} onClick={() => void saveProduct()} className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : editing ? 'Save Product' : 'Create Product'}</button></div></Modal>

      <Modal title={`Stock adjustment · ${stockProduct?.name || ''}`} isOpen={!!stockProduct} onClose={() => setStockProduct(null)}><div className="space-y-4"><Field label="Action"><select className={fieldClass} value={stockAction.type} onChange={(e) => setStockAction({ ...stockAction, type: e.target.value })}>{['RESTOCK', 'ADD', 'REMOVE', 'TRANSFER', 'RESERVE', 'DAMAGED'].map((type) => <option key={type}>{type}</option>)}</select></Field><NumberField label="Quantity" value={stockAction.quantity} onChange={(quantity) => setStockAction({ ...stockAction, quantity })} /><Field label="Reason"><input className={fieldClass} value={stockAction.reason} onChange={(e) => setStockAction({ ...stockAction, reason: e.target.value })} /></Field><button onClick={() => void adjustStock()} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white">Post stock movement</button></div></Modal>

      <Modal title={`${historyKind === 'stock' ? 'Stock' : 'Sales'} history · ${historyProduct?.name || ''}`} isOpen={!!historyProduct} onClose={() => setHistoryProduct(null)}><div className="max-h-[60vh] space-y-2 overflow-y-auto">{history[historyKind].length === 0 && <p className="py-8 text-center text-sm text-gray-500">No history yet.</p>}{history[historyKind].map((item: any) => historyKind === 'stock' ? <div key={item.id} className="rounded-lg border border-gray-100 p-3 text-sm"><div className="flex justify-between"><b>{item.type}</b><span className={item.quantityChange >= 0 ? 'text-emerald-600' : 'text-red-600'}>{item.quantityChange > 0 ? '+' : ''}{item.quantityChange}</span></div><p className="text-xs text-gray-500">{item.previousQuantity} → {item.newQuantity} · {new Date(item.createdAt).toLocaleString()}</p><p className="mt-1 text-xs">{item.reason}</p></div> : <div key={item.id} className="rounded-lg border border-gray-100 p-3 text-sm"><div className="flex justify-between"><b>{item.quantity} sold</b><span>R {(item.price * item.quantity).toFixed(2)}</span></div><p className="text-xs text-gray-500">{new Date(item.order.createdAt).toLocaleString()} · {item.order.status}</p></div>)}</div></Modal>

      <Modal title="Your cart" isOpen={showCart} onClose={() => setShowCart(false)}><div className="space-y-4">{cart.length === 0 && <p className="py-8 text-center text-sm text-gray-500">Your cart is empty.</p>}{cart.map((item) => <div key={item.product.id} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3"><div><p className="text-sm font-semibold">{item.product.name}</p><p className="text-xs text-gray-500">R {item.product.basePrice || 0} each</p></div><div className="flex items-center gap-2"><button onClick={() => setCart((current) => current.map((line) => line.product.id === item.product.id ? { ...line, quantity: Math.max(0, line.quantity - 1) } : line).filter((line) => line.quantity))} className="rounded border px-2">−</button><span>{item.quantity}</span><button onClick={() => addToCart(item.product)} className="rounded border px-2">+</button></div></div>)}{cart.length > 0 && <><div className="flex justify-between text-lg font-bold"><span>Total</span><span>R {cartTotal.toFixed(2)}</span></div><Field label="Payment method"><select className={fieldClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="eft">Manual EFT</option><option value="payfast">PayFast</option><option value="ozow">Ozow</option></select></Field><button disabled={busy} onClick={() => void placeOrder()} className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white">Checkout</button></>}</div></Modal>
    </DashboardLayout>
  );
}

function Action({ icon: Icon, label, onClick, danger = false }: { icon: any; label: string; onClick: () => void; danger?: boolean }) { return <button disabled={false} onClick={onClick} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition hover:bg-gray-50 ${danger ? 'border-red-100 text-red-600' : 'border-gray-200 text-gray-700'}`}><Icon className="h-3.5 w-3.5" />{label}</button>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="space-y-3 rounded-xl border border-gray-100 p-4"><h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h4>{children}</section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-semibold text-gray-600"><span className="mb-1.5 block">{label}</span>{children}</label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <Field label={label}><input type="number" min="0" step="0.01" className={fieldClass} value={value} onChange={(e) => onChange(Number(e.target.value))} /></Field>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-blue-600" /></label>; }
