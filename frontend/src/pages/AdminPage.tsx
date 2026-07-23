import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
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

// سقف حجم عکس محصول: ۵ مگابایت
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
  // شناسه محصولی که عکسش در حال آپلود است — فقط همان ردیف حالت لودینگ می‌گیرد
  const [uploadingProductId, setUploadingProductId] = useState<number | null>(null);
  const flashTimer = useRef<number | null>(null);

  const describeError = useCallback((e: unknown): string => {
    if (e instanceof ApiError && e.status === 401) {
      clearToken();
      navigate("/login", { state: { from: "/admin" } });
      return "نشست منقضی شد — دوباره وارد شوید";
    }
    return e instanceof ApiError ? e.message : "خطای غیرمنتظره رخ داد";
  }, [navigate]);

  const flash = (text: string) => {
    setMessage(text);
    setError(null);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setMessage(null), 3000);
  };

  const loadAll = useCallback(async () => {
    try {
      const [cats, prods] = await Promise.all([
        api.get<Category[]>("/api/admin/categories"),
        api.get<Product[]>("/api/admin/products"),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (e) { setError(describeError(e)); }
  }, [describeError]);

  useEffect(() => {
    loadAll();
    return () => { if (flashTimer.current !== null) window.clearTimeout(flashTimer.current); };
  }, [loadAll]);

  const run = async (action: () => Promise<void>, successText: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      await loadAll();
      flash(successText);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleCategory = (cat: Category) =>
    run(async () => {
      await api.patch(`/api/admin/categories/${cat.id}`, { is_active: !cat.is_active });
    }, cat.is_active ? `دسته «${cat.name}» از منو مخفی شد` : `دسته «${cat.name}» فعال شد`);

  const deleteCategory = (cat: Category) => {
    if (!window.confirm(`دسته «${cat.name}» حذف شود؟`)) return;
    run(async () => { await api.delete<DeleteResult>(`/api/admin/categories/${cat.id}`); }, "دسته حذف شد");
  };

  const toggleProduct = (product: Product) =>
    run(async () => {
      await api.patch(`/api/admin/products/${product.id}`, { is_available: !product.is_available });
    }, product.is_available ? `«${product.name}» ناموجود شد` : `«${product.name}» موجود شد`);

  const deleteProduct = (product: Product) => {
    if (!window.confirm(`محصول «${product.name}» حذف شود؟`)) return;
    if (busy) return;
    setBusy(true);
    setError(null);
    api.delete<DeleteResult>(`/api/admin/products/${product.id}`)
      .then(async (res) => { await loadAll(); flash(res.detail); })
      .catch((e) => setError(describeError(e)))
      .finally(() => setBusy(false));
  };

  const startPriceEdit = (product: Product) => {
    setPriceEditId(product.id);
    setPriceValue(String(product.price));
  };

  const savePrice = (product: Product) => {
    const parsed = Number(priceValue);
    setPriceEditId(null);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError("قیمت باید یک عدد صحیح مثبت (به تومان) باشد");
      return;
    }
    if (parsed === product.price) return;
    run(async () => {
      await api.patch(`/api/admin/products/${product.id}`, { price: parsed });
    }, `قیمت «${product.name}» به ${formatToman(parsed)} تغییر کرد`);
  };

  // ── آپلود عکس محصول ──────────────────────────────────────────────────────
  const uploadImage = async (product: Product, file: File | undefined) => {
    if (!file || busy) return;

    // اعتبارسنجی سمت کلاینت قبل از ارسال (سرور هم دوباره چک می‌کند)
    if (!file.type.startsWith("image/")) {
      setError("فقط فایل تصویری مجاز است");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("حجم عکس باید کمتر از ۵ مگابایت باشد");
      return;
    }

    setBusy(true);
    setUploadingProductId(product.id);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.postForm<ImageUploadResult>(
        `/api/admin/products/${product.id}/image`,
        formData,
      );
      // خواندن دوباره لیست از سرور تا thumbnail همان لحظه آپدیت شود
      await loadAll();
      flash(
        res.image_url
          ? `عکس «${product.name}» ذخیره شد`
          : `عکس «${product.name}» آپلود شد`,
      );
    } catch (e) {
      const msg = describeError(e);
      setError(msg === "خطای غیرمنتظره رخ داد" ? "آپلود عکس ناموفق بود" : msg);
    } finally {
      setBusy(false);
      setUploadingProductId(null);
    }
  };

  const removeImage = (product: Product) => {
    if (!window.confirm(`عکس «${product.name}» حذف شود؟`)) return;
    run(async () => {
      await api.delete(`/api/admin/products/${product.id}/image`);
    }, `عکس «${product.name}» حذف شد`);
  };

  const catName = (id: number) => categories.find((c) => c.id === id)?.name ?? "—";
  const visibleProducts = filterCat === "all" ? products : products.filter((p) => p.category_id === filterCat);

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-6" dir="rtl">
      <PanelHeader title="مدیریت منو" />

      {message && (
        <div className="mb-4 rounded-xl bg-pistachio-light p-3 text-sm font-medium text-pistachio">
          ✓ {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl bg-berry-light p-3 text-sm text-berry">{error}</div>
      )}

      {/* ── categories ── */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">دسته‌بندی‌ها</h2>
          <button type="button" onClick={() => setCatModal({ mode: "create" })}
            className="rounded-xl bg-saffron px-4 py-2 text-sm font-bold text-white hover:bg-saffron-dark">
            + دسته جدید
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {categories.map((cat) => (
            <div key={cat.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 last:border-b-0">
              <div className="flex items-center gap-3">
                <span className={`font-bold ${cat.is_active ? "" : "text-gray-400 line-through"}`}>{cat.name}</span>
                {!cat.is_active && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">مخفی از منو</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <button type="button" disabled={busy} onClick={() => toggleCategory(cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${cat.is_active ? "bg-gray-100 text-gray-600" : "bg-pistachio-light text-pistachio"}`}>
                  {cat.is_active ? "مخفی کن" : "فعال کن"}
                </button>
                <button type="button" disabled={busy} onClick={() => setCatModal({ mode: "edit", category: cat })}
                  className="rounded-lg bg-saffron-light px-3 py-1.5 text-xs font-bold text-saffron-dark">ویرایش</button>
                <button type="button" disabled={busy} onClick={() => deleteCategory(cat)}
                  className="rounded-lg bg-berry-light px-3 py-1.5 text-xs font-bold text-berry">حذف</button>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="p-6 text-center text-sm text-gray-400">هنوز دسته‌ای ساخته نشده</p>
          )}
        </div>
      </section>

      {/* ── products ── */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">محصولات</h2>
          <div className="flex items-center gap-2">
            <select value={filterCat === "all" ? "all" : String(filterCat)}
              onChange={(e) => setFilterCat(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none">
              <option value="all">همه دسته‌ها</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={() => setProdModal({ mode: "create" })}
              className="rounded-xl bg-saffron px-4 py-2 text-sm font-bold text-white hover:bg-saffron-dark">
              + محصول جدید
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {visibleProducts.map((product) => (
            <div key={product.id}
              className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 last:border-b-0">

              {/* ── image cell ── */}
              <div className="flex items-start gap-3">
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-cream">
                  {product.image_url ? (
                    <img src={resolveImageUrl(product.image_url) ?? undefined} alt={product.name}
                      className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300">🖼️</div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-bold ${product.is_available ? "" : "text-gray-400 line-through"}`}>
                      {product.name}
                    </span>
                    <span className="rounded-full bg-cream px-2 py-0.5 text-xs text-gray-500">
                      {catName(product.category_id)}
                    </span>
                  </div>
                  {product.description && (
                    <p className="mt-0.5 text-xs text-gray-400">{product.description}</p>
                  )}
                  {/* image upload / remove buttons */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <label className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-bold ${busy ? "cursor-not-allowed opacity-50 bg-gray-100 text-gray-500" : "bg-saffron-light text-saffron-dark hover:bg-saffron/20"}`}>
                      {uploadingProductId === product.id
                        ? "⏳ در حال آپلود..."
                        : `📷 ${product.image_url ? "تغییر عکس" : "آپلود عکس"}`}
                      <input type="file" accept="image/*" className="hidden"
                        disabled={busy}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          uploadImage(product, e.target.files?.[0]);
                          e.target.value = "";
                        }} />
                    </label>
                    {product.image_url && (
                      <button type="button" disabled={busy}
                        onClick={() => removeImage(product)}
                        className="rounded-lg bg-berry-light px-2.5 py-1 text-xs font-bold text-berry">
                        🗑 حذف عکس
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── action buttons ── */}
              <div className="flex flex-wrap items-center gap-2">
                {priceEditId === product.id ? (
                  <input type="number" autoFocus value={priceValue}
                    onChange={(e) => setPriceValue(e.target.value)}
                    onBlur={() => savePrice(product)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") savePrice(product);
                      if (e.key === "Escape") setPriceEditId(null);
                    }}
                    className="w-28 rounded-lg border border-saffron bg-white px-2 py-1.5 text-sm outline-none" />
                ) : (
                  <button type="button" disabled={busy} onClick={() => startPriceEdit(product)}
                    title="کلیک برای ویرایش قیمت"
                    className="rounded-lg px-2 py-1.5 text-sm font-bold text-saffron-dark underline decoration-dotted underline-offset-4 hover:bg-saffron-light">
                    {formatToman(product.price)}
                  </button>
                )}
                <button type="button" disabled={busy} onClick={() => toggleProduct(product)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${product.is_available ? "bg-gray-100 text-gray-600" : "bg-pistachio-light text-pistachio"}`}>
                  {product.is_available ? "ناموجود کن" : "موجود کن"}
                </button>
                <button type="button" disabled={busy} onClick={() => setProdModal({ mode: "edit", product })}
                  className="rounded-lg bg-saffron-light px-3 py-1.5 text-xs font-bold text-saffron-dark">ویرایش</button>
                <button type="button" disabled={busy} onClick={() => deleteProduct(product)}
                  className="rounded-lg bg-berry-light px-3 py-1.5 text-xs font-bold text-berry">حذف</button>
              </div>
            </div>
          ))}
          {visibleProducts.length === 0 && (
            <p className="p-6 text-center text-sm text-gray-400">محصولی در این دسته نیست</p>
          )}
        </div>
      </section>

      {/* ── modals ── */}
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

// ── CategoryForm ──────────────────────────────────────────────────────────────
function CategoryForm({ initial, busy, onClose, onSubmit }: {
  initial: Category | null; busy: boolean;
  onClose: () => void; onSubmit: (name: string, displayOrder: number) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [order, setOrder] = useState(String(initial?.display_order ?? 0));
  const submit = (e: FormEvent) => { e.preventDefault(); if (!name.trim()) return; onSubmit(name.trim(), Number(order) || 0); };
  return (
    <Modal title={initial ? "ویرایش دسته" : "دسته جدید"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-gray-500">نام دسته</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100}
            className="w-full rounded-xl border border-gray-200 bg-cream p-3 outline-none focus:border-saffron" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-gray-500">ترتیب نمایش (عدد کوچک‌تر = بالاتر)</span>
          <input type="number" value={order} onChange={(e) => setOrder(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-cream p-3 outline-none focus:border-saffron" />
        </label>
        <button type="submit" disabled={busy || !name.trim()}
          className="w-full rounded-xl bg-saffron py-3 font-bold text-white hover:bg-saffron-dark disabled:opacity-50">
          ذخیره
        </button>
      </form>
    </Modal>
  );
}

// ── ProductForm ───────────────────────────────────────────────────────────────
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
        <label className="block text-sm">
          <span className="mb-1 block text-gray-500">نام محصول</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={150}
            className="w-full rounded-xl border border-gray-200 bg-cream p-3 outline-none focus:border-saffron" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-gray-500">دسته</span>
          <select value={String(categoryId)} onChange={(e) => setCategoryId(Number(e.target.value))}
            className="w-full rounded-xl border border-gray-200 bg-cream p-3 outline-none focus:border-saffron">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-gray-500">قیمت (تومان)</span>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required min={1}
            className="w-full rounded-xl border border-gray-200 bg-cream p-3 outline-none focus:border-saffron" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-gray-500">توضیح کوتاه (اختیاری)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500}
            className="w-full rounded-xl border border-gray-200 bg-cream p-3 outline-none focus:border-saffron" />
        </label>
        <div className="flex gap-3">
          <label className="block flex-1 text-sm">
            <span className="mb-1 block text-gray-500">ترتیب نمایش</span>
            <input type="number" value={order} onChange={(e) => setOrder(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-cream p-3 outline-none focus:border-saffron" />
          </label>
          <label className="flex flex-1 items-end gap-2 pb-3 text-sm">
            <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)}
              className="h-5 w-5 accent-saffron" />
            موجود در منو
          </label>
        </div>
        {formError && <p className="rounded-xl bg-berry-light p-3 text-sm text-berry">{formError}</p>}
        <button type="submit" disabled={busy}
          className="w-full rounded-xl bg-saffron py-3 font-bold text-white hover:bg-saffron-dark disabled:opacity-50">
          ذخیره
        </button>
      </form>
    </Modal>
  );
}
