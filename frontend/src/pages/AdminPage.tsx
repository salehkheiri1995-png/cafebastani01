import {
  useCallback, useEffect, useRef, useState,
  type FormEvent, type ChangeEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, clearToken } from "../api/client";
import Modal from "../components/Modal";
import PanelHeader from "../components/PanelHeader";
import type { Category, Product } from "../types";
import { formatToman } from "../utils/format";
import { resolveImageUrl } from "../utils/image";

interface DeleteResult { deleted: boolean; detail: string; }
interface ImageUploadResult { image_url: string; detail: string; }
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
type CatModal = { mode: "create" } | { mode: "edit"; category: Category };
type ProdModal = { mode: "create" } | { mode: "edit"; product: Product };

export default function AdminPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filterCat, setFilterCat] = useState<number | "all">("all");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [catModal, setCatModal] = useState<CatModal | null>(null);
  const [prodModal, setProdModal] = useState<ProdModal | null>(null);
  const [priceEditId, setPriceEditId] = useState<number | null>(null);
  const [priceValue, setPriceValue] = useState("");
  const [uploadingProductId, setUploadingProductId] = useState<number | null>(null);
  const flashTimer = useRef<number | null>(null);

  const describeError = useCallback((e: unknown): string => {
    if (e instanceof ApiError && e.status === 401) {
      clearToken();
      navigate("/login", { state: { from: "/admin" } });
      return "نشست منقضی شد";
    }
    return e instanceof ApiError ? e.message : "خطای غیرمنتظره رخ داد";
  }, [navigate]);

  const flash = (text: string) => {
    setMessage(text); setError(null);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setMessage(null), 3000);
  };

  const loadAll = useCallback(async () => {
    try {
      const [cats, prods] = await Promise.all([
        api.get<Category[]>("/api/admin/categories"),
        api.get<Product[]>("/api/admin/products"),
      ]);
      setCategories(cats); setProducts(prods);
    } catch (e) { setError(describeError(e)); }
  }, [describeError]);

  useEffect(() => {
    loadAll();
    return () => { if (flashTimer.current !== null) window.clearTimeout(flashTimer.current); };
  }, [loadAll]);

  const run = async (action: () => Promise<void>, successText: string) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await action(); await loadAll(); flash(successText); }
    catch (e) { setError(describeError(e)); }
    finally { setBusy(false); }
  };

  const toggleCategory = (cat: Category) =>
    run(async () => { await api.patch(`/api/admin/categories/${cat.id}`, { is_active: !cat.is_active }); },
      cat.is_active ? `دسته «${cat.name}» مخفی شد` : `دسته «${cat.name}» فعال شد`);

  const deleteCategory = (cat: Category) => {
    if (!window.confirm(`دسته «${cat.name}» حذف شود؟`)) return;
    run(async () => { await api.delete<DeleteResult>(`/api/admin/categories/${cat.id}`); }, "دسته حذف شد");
  };

  const toggleProduct = (product: Product) =>
    run(async () => { await api.patch(`/api/admin/products/${product.id}`, { is_available: !product.is_available }); },
      product.is_available ? `«${product.name}» ناموجود شد` : `«${product.name}» موجود شد`);

  const deleteProduct = (product: Product) => {
    if (!window.confirm(`محصول «${product.name}» حذف شود؟`)) return;
    if (busy) return;
    setBusy(true); setError(null);
    api.delete<DeleteResult>(`/api/admin/products/${product.id}`)
      .then(async (res) => { await loadAll(); flash(res.detail); })
      .catch((e) => setError(describeError(e)))
      .finally(() => setBusy(false));
  };

  const startPriceEdit = (product: Product) => {
    setPriceEditId(product.id); setPriceValue(String(product.price));
  };

  const savePrice = (product: Product) => {
    const parsed = Number(priceValue);
    setPriceEditId(null);
    if (!Number.isInteger(parsed) || parsed <= 0) { setError("قیمت باید عدد صحیح مثبت باشد"); return; }
    if (parsed === product.price) return;
    run(async () => { await api.patch(`/api/admin/products/${product.id}`, { price: parsed }); },
      `قیمت «${product.name}» به ${formatToman(parsed)} تغییر کرد`);
  };

  const uploadImage = async (product: Product, file: File | undefined) => {
    if (!file || busy) return;
    if (!file.type.startsWith("image/")) { setError("فقط فایل تصویری مجاز است"); return; }
    if (file.size > MAX_IMAGE_BYTES) { setError("حجم عکس باید کمتر از ۵ مگابایت باشد"); return; }
    setBusy(true); setUploadingProductId(product.id); setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.postForm<ImageUploadResult>(`/api/admin/products/${product.id}/image`, formData);
      await loadAll();
      flash(res.image_url ? `عکس «${product.name}» ذخیره شد` : `عکس «${product.name}» آپلود شد`);
    } catch (e) {
      setError(describeError(e) === "خطای غیرمنتظره رخ داد" ? "آپلود عکس ناموفق بود" : describeError(e));
    } finally { setBusy(false); setUploadingProductId(null); }
  };

  const removeImage = (product: Product) => {
    if (!window.confirm(`عکس «${product.name}» حذف شود؟`)) return;
    run(async () => { await api.delete(`/api/admin/products/${product.id}/image`); }, `عکس «${product.name}» حذف شد`);
  };

  const catName = (id: number) => categories.find((c) => c.id === id)?.name ?? "—";
  const visibleProducts = filterCat === "all" ? products : products.filter((p) => p.category_id === filterCat);

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-6" dir="rtl">
      <PanelHeader title="مدیریت منو" />

      {/* flash messages */}
      {message && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold animate-pulse"
          style={{ background: "linear-gradient(135deg, #e3f0e9, #d1e8db)", color: "#1a5c3a", border: "1px solid #b8dac8" }}>
          <span className="text-base">✓</span> {message}
        </div>
      )}
      {error && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
          style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
          <span>⚠️</span> {error}
        </div>
      )}

      {/* shortcut to reports */}
      <button type="button" onClick={() => navigate("/reports")}
        className="mb-6 flex w-full items-center justify-between rounded-2xl px-5 py-4 transition-all hover:scale-[1.01]"
        style={{ background: "linear-gradient(135deg, #eef2ff, #e0e7ff)", border: "1px solid #c7d2fe" }}>
        <div className="text-right">
          <div className="font-bold text-indigo-800">📊 گزارش‌گیری و آرشیو سفارش‌ها</div>
          <div className="mt-0.5 text-xs text-indigo-500">مشاهده همه سفارش‌ها، فیلتر زمانی، خروجی Excel / PDF</div>
        </div>
        <span className="text-2xl text-indigo-300">←</span>
      </button>

      {/* ── CATEGORIES ── */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-extrabold" style={{ color: "#33261D" }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg text-sm"
              style={{ background: "linear-gradient(135deg,#F7E6C4,#f3d9a0)" }}>🏷</span>
            دسته‌بندی‌ها
          </h2>
          <button type="button" onClick={() => setCatModal({ mode: "create" })}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #E9A13B, #B8791A)" }}>
            <span>+</span> دسته جدید
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((cat) => (
            <div key={cat.id}
              className="group flex items-center justify-between rounded-2xl px-4 py-3.5 transition-all"
              style={{ background: "white", border: "1px solid #f0ebe3", boxShadow: "0 1px 8px rgba(51,38,29,0.06)" }}>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg"
                  style={{ background: cat.is_active ? "#F7E6C4" : "#f3f4f6" }}>🏷</span>
                <div>
                  <p className={`font-bold text-sm ${cat.is_active ? "text-ink" : "text-gray-400 line-through"}`}>{cat.name}</p>
                  {!cat.is_active && <p className="text-[10px] text-gray-400">مخفی از منو</p>}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" disabled={busy} onClick={() => toggleCategory(cat)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all"
                  style={cat.is_active
                    ? { background: "#f3f4f6", color: "#6b7280" }
                    : { background: "#e3f0e9", color: "#2F7D5D" }}>
                  {cat.is_active ? "مخفی" : "فعال"}
                </button>
                <button type="button" disabled={busy} onClick={() => setCatModal({ mode: "edit", category: cat })}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all"
                  style={{ background: "#F7E6C4", color: "#B8791A" }}>ویرایش</button>
                <button type="button" disabled={busy} onClick={() => deleteCategory(cat)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all"
                  style={{ background: "#fef2f2", color: "#B3323B" }}>حذف</button>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="col-span-2 py-10 text-center">
              <span className="text-4xl">🏷</span>
              <p className="mt-2 text-sm text-gray-400">هنوز دسته‌ای ساخته نشده</p>
            </div>
          )}
        </div>
      </section>

      {/* ── PRODUCTS ── */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-extrabold" style={{ color: "#33261D" }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg text-sm"
              style={{ background: "linear-gradient(135deg,#F7E6C4,#f3d9a0)" }}>🍦</span>
            محصولات
          </h2>
          <div className="flex items-center gap-2">
            <select value={filterCat === "all" ? "all" : String(filterCat)}
              onChange={(e) => setFilterCat(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "#e5e0d8", background: "white" }}>
              <option value="all">همه دسته‌ها</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={() => setProdModal({ mode: "create" })}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #E9A13B, #B8791A)" }}>
              <span>+</span> محصول جدید
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} catName={catName(product.category_id)}
              busy={busy} priceEditId={priceEditId} priceValue={priceValue}
              uploadingProductId={uploadingProductId}
              onToggle={() => toggleProduct(product)}
              onEdit={() => setProdModal({ mode: "edit", product })}
              onDelete={() => deleteProduct(product)}
              onStartPriceEdit={() => startPriceEdit(product)}
              onPriceChange={(v) => setPriceValue(v)}
              onSavePrice={() => savePrice(product)}
              onCancelPriceEdit={() => setPriceEditId(null)}
              onUploadImage={(f) => uploadImage(product, f)}
              onRemoveImage={() => removeImage(product)}
            />
          ))}
          {visibleProducts.length === 0 && (
            <div className="col-span-2 py-10 text-center">
              <span className="text-4xl">🍦</span>
              <p className="mt-2 text-sm text-gray-400">محصولی در این دسته نیست</p>
            </div>
          )}
        </div>
      </section>

      {/* modals */}
      {catModal && (
        <CategoryForm initial={catModal.mode === "edit" ? catModal.category : null}
          busy={busy} onClose={() => setCatModal(null)}
          onSubmit={(name, displayOrder) => {
            const isEdit = catModal.mode === "edit";
            run(async () => {
              if (isEdit) await api.patch(`/api/admin/categories/${catModal.category.id}`, { name, display_order: displayOrder });
              else await api.post("/api/admin/categories", { name, display_order: displayOrder });
            }, isEdit ? "دسته ویرایش شد" : "دسته جدید ساخته شد").then(() => setCatModal(null));
          }} />
      )}
      {prodModal && (
        <ProductForm initial={prodModal.mode === "edit" ? prodModal.product : null}
          categories={categories} busy={busy} onClose={() => setProdModal(null)}
          onSubmit={(data) => {
            const isEdit = prodModal.mode === "edit";
            run(async () => {
              if (isEdit) await api.patch(`/api/admin/products/${prodModal.product.id}`, data);
              else await api.post("/api/admin/products", data);
            }, isEdit ? "محصول ویرایش شد" : "محصول جدید اضافه شد").then(() => setProdModal(null));
          }} />
      )}
    </div>
  );
}

// ── Product Card ──
function ProductCard({
  product, catName, busy, priceEditId, priceValue, uploadingProductId,
  onToggle, onEdit, onDelete, onStartPriceEdit, onPriceChange,
  onSavePrice, onCancelPriceEdit, onUploadImage, onRemoveImage,
}: {
  product: Product; catName: string; busy: boolean;
  priceEditId: number | null; priceValue: string; uploadingProductId: number | null;
  onToggle: () => void; onEdit: () => void; onDelete: () => void;
  onStartPriceEdit: () => void; onPriceChange: (v: string) => void;
  onSavePrice: () => void; onCancelPriceEdit: () => void;
  onUploadImage: (f: File | undefined) => void; onRemoveImage: () => void;
}) {
  const isEditing = priceEditId === product.id;
  const isUploading = uploadingProductId === product.id;

  return (
    <div className="overflow-hidden rounded-2xl bg-white transition-all hover:shadow-md"
      style={{ border: "1px solid #f0ebe3", boxShadow: "0 2px 12px rgba(51,38,29,0.07)" }}>

      {/* image + availability overlay */}
      <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50">
        {product.image_url ? (
          <img src={resolveImageUrl(product.image_url) ?? undefined} alt={product.name}
            className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl opacity-30">🍦</div>
        )}
        {!product.is_available && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}>
            <span className="rounded-xl px-3 py-1 text-xs font-bold text-white"
              style={{ background: "rgba(179,50,59,0.85)" }}>ناموجود</span>
          </div>
        )}
        {/* image controls */}
        <div className="absolute bottom-2 left-2 flex gap-1.5">
          <label className={`cursor-pointer rounded-lg px-2.5 py-1 text-[10px] font-bold backdrop-blur-sm transition-all ${busy ? "opacity-40" : "hover:scale-105"}`}
            style={{ background: "rgba(233,161,59,0.9)", color: "white" }}>
            {isUploading ? "⏳" : product.image_url ? "📷 تغییر" : "📷 عکس"}
            <input type="file" accept="image/*" className="hidden" disabled={busy}
              onChange={(e: ChangeEvent<HTMLInputElement>) => { onUploadImage(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {product.image_url && (
            <button type="button" disabled={busy} onClick={onRemoveImage}
              className="rounded-lg px-2 py-1 text-[10px] font-bold backdrop-blur-sm"
              style={{ background: "rgba(179,50,59,0.85)", color: "white" }}>🗑</button>
          )}
        </div>
        {/* category chip */}
        <span className="absolute right-2 top-2 rounded-lg px-2 py-0.5 text-[10px] font-bold"
          style={{ background: "rgba(255,255,255,0.85)", color: "#B8791A" }}>{catName}</span>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-sm leading-snug" style={{ color: "#33261D" }}>{product.name}</p>
          {/* price edit */}
          {isEditing ? (
            <input type="number" autoFocus value={priceValue}
              onChange={(e) => onPriceChange(e.target.value)}
              onBlur={onSavePrice}
              onKeyDown={(e) => { if (e.key === "Enter") onSavePrice(); if (e.key === "Escape") onCancelPriceEdit(); }}
              className="w-28 rounded-xl border px-2 py-1 text-sm outline-none"
              style={{ borderColor: "#E9A13B" }} />
          ) : (
            <button type="button" disabled={busy} onClick={onStartPriceEdit}
              title="برای ویرایش کلیک کنید"
              className="flex-shrink-0 rounded-xl px-2.5 py-1 text-sm font-bold transition-all hover:scale-105"
              style={{ background: "#F7E6C4", color: "#B8791A" }}>
              {formatToman(product.price)}
            </button>
          )}
        </div>
        {product.description && (
          <p className="mt-1 text-xs text-gray-400 line-clamp-2">{product.description}</p>
        )}

        <div className="mt-3 flex items-center gap-1.5">
          <button type="button" disabled={busy} onClick={onToggle}
            className="flex-1 rounded-xl py-2 text-xs font-bold transition-all"
            style={product.is_available
              ? { background: "#f3f4f6", color: "#6b7280" }
              : { background: "#e3f0e9", color: "#2F7D5D" }}>
            {product.is_available ? "ناموجود کن" : "موجود کن"}
          </button>
          <button type="button" disabled={busy} onClick={onEdit}
            className="rounded-xl px-3 py-2 text-xs font-bold transition-all"
            style={{ background: "#F7E6C4", color: "#B8791A" }}>ویرایش</button>
          <button type="button" disabled={busy} onClick={onDelete}
            className="rounded-xl px-3 py-2 text-xs font-bold transition-all"
            style={{ background: "#fef2f2", color: "#B3323B" }}>حذف</button>
        </div>
      </div>
    </div>
  );
}

// ── CategoryForm ──
function CategoryForm({ initial, busy, onClose, onSubmit }: {
  initial: Category | null; busy: boolean;
  onClose: () => void; onSubmit: (name: string, displayOrder: number) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [order, setOrder] = useState(String(initial?.display_order ?? 0));
  const submit = (e: FormEvent) => { e.preventDefault(); if (!name.trim()) return; onSubmit(name.trim(), Number(order) || 0); };
  return (
    <Modal title={initial ? "ویرایش دسته" : "دسته جدید"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-gray-600">نام دسته</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100}
            className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all focus:ring-2"
            style={{ borderColor: "#e5e0d8", background: "#faf6ef" }} />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-gray-600">ترتیب نمایش</span>
          <input type="number" value={order} onChange={(e) => setOrder(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all"
            style={{ borderColor: "#e5e0d8", background: "#faf6ef" }} />
        </label>
        <button type="submit" disabled={busy || !name.trim()}
          className="w-full rounded-2xl py-3 font-bold text-white transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #E9A13B, #B8791A)" }}>ذخیره</button>
      </form>
    </Modal>
  );
}

// ── ProductForm ──
interface ProductFormData {
  category_id: number; name: string; description: string | null;
  price: number; display_order: number; is_available: boolean;
}

function ProductForm({ initial, categories, busy, onClose, onSubmit }: {
  initial: Product | null; categories: Category[]; busy: boolean;
  onClose: () => void; onSubmit: (data: ProductFormData) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? categories[0]?.id ?? 0);
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [order, setOrder] = useState(String(initial?.display_order ?? 0));
  const [available, setAvailable] = useState(initial?.is_available ?? true);
  const [formError, setFormError] = useState<string | null>(null);

  const inputCls = "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all";
  const inputStyle = { borderColor: "#e5e0d8", background: "#faf6ef" };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsedPrice = Number(price);
    if (!name.trim()) { setFormError("نام محصول را وارد کنید"); return; }
    if (!Number.isInteger(parsedPrice) || parsedPrice <= 0) { setFormError("قیمت باید عدد صحیح مثبت باشد"); return; }
    if (!categoryId) { setFormError("اول یک دسته بسازید"); return; }
    onSubmit({ category_id: categoryId, name: name.trim(), description: description.trim() || null, price: parsedPrice, display_order: Number(order) || 0, is_available: available });
  };

  return (
    <Modal title={initial ? "ویرایش محصول" : "محصول جدید"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm"><span className="mb-1.5 block font-medium text-gray-600">نام محصول</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} className={inputCls} style={inputStyle} /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-medium text-gray-600">دسته</span>
          <select value={String(categoryId)} onChange={(e) => setCategoryId(Number(e.target.value))} className={inputCls} style={inputStyle}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label className="block text-sm"><span className="mb-1.5 block font-medium text-gray-600">قیمت (تومان)</span>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required min={1} className={inputCls} style={inputStyle} /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-medium text-gray-600">توضیح کوتاه (اختیاری)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} className={inputCls} style={inputStyle} /></label>
        <div className="flex gap-3">
          <label className="block flex-1 text-sm"><span className="mb-1.5 block font-medium text-gray-600">ترتیب نمایش</span>
            <input type="number" value={order} onChange={(e) => setOrder(e.target.value)} className={inputCls} style={inputStyle} /></label>
          <label className="flex flex-1 items-end gap-2 pb-3 text-sm">
            <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="h-5 w-5 accent-amber-500" />
            موجود در منو
          </label>
        </div>
        {formError && <p className="rounded-2xl px-4 py-3 text-sm" style={{ background: "#fef2f2", color: "#991b1b" }}>{formError}</p>}
        <button type="submit" disabled={busy}
          className="w-full rounded-2xl py-3 font-bold text-white transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #E9A13B, #B8791A)" }}>ذخیره</button>
      </form>
    </Modal>
  );
}
