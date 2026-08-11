import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Sparkles, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ItemService, uploadFabricImage } from '../../services/storeService';
import { generateModelShot } from '../../services/geminiService';
import type { FashionItem, ShowcaseType } from '../../types';
import AdminAccessNotice from '../../components/AdminAccessNotice';
import AdminShell from '../../components/AdminShell';
import RoleBadge from '../../components/RoleBadge';

const emptyItem: Omit<FashionItem, 'id' | 'createdAt'> = {
  name: '',
  description: '',
  price: 0,
  costPrice: 0,
  category: 'Suit',
  fabricImageUrl: '',
  renderedImageUrl: '',
  stock: 1,
  isOneOfOne: false,
  styles: [],
  showcaseType: 'ready_stock',
  salePrice: undefined,
  sku: '',
  gstRate: 5,
  isPublished: true,
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });
}

const AdminInventory = () => {
  const { canAccessInventory, role } = useAuth();
  const [items, setItems] = useState<FashionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [shotNote, setShotNote] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [newItem, setNewItem] = useState<Omit<FashionItem, 'id' | 'createdAt'>>(emptyItem);
  const [sourcePreview, setSourcePreview] = useState('');

  const categories = useMemo(
    () =>
      Array.from(
        new Set(['Suit', 'Lehenga', 'Saree', 'Ghangra', 'Indo-Western', ...items.map((item) => item.category)])
      ),
    [items]
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await ItemService.getAllItems();
      setItems(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the inventory atelier.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setError('');
    setShotNote('');
    try {
      const dataUrl = await fileToDataUrl(file);
      setSourcePreview(dataUrl);
      const publicUrl = await uploadFabricImage(file, 'source-photos');
      setNewItem((current) => ({
        ...current,
        fabricImageUrl: publicUrl,
        renderedImageUrl: '',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload product photo.');
    } finally {
      setSaving(false);
    }
  };

  const runModelShot = async () => {
    if (!sourcePreview && !newItem.fabricImageUrl) return;
    setSaving(true);
    setError('');
    setShotNote('');
    try {
      const dataUrl = sourcePreview || newItem.fabricImageUrl;
      const [meta, base64 = ''] = dataUrl.includes(',') ? dataUrl.split(',') : ['data:image/jpeg;base64', dataUrl];
      const mimeType = meta.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';

      const result = await generateModelShot({
        imageBase64: base64,
        mimeType,
        showcaseType: newItem.showcaseType,
        garmentHint: `${newItem.name || 'Garment'} · ${newItem.category}`,
      });

      setNewItem((current) => ({
        ...current,
        renderedImageUrl: result.generatedImageUrl || current.renderedImageUrl,
        description: current.description || result.description || current.description,
      }));
      setShotNote(result.description || 'Model shot ready.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate model shot.');
    } finally {
      setSaving(false);
    }
  };

  const saveItem = async () => {
    setSaving(true);
    setError('');
    try {
      const catalogImage = newItem.renderedImageUrl || newItem.fabricImageUrl;
      await ItemService.addItem({
        ...newItem,
        fabricImageUrl: newItem.fabricImageUrl,
        renderedImageUrl: catalogImage,
        stock: newItem.showcaseType === 'delivered_craft' ? Math.max(newItem.stock, 0) : newItem.stock,
      });
      setNewItem(emptyItem);
      setSourcePreview('');
      setShotNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the inventory item.');
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    setPendingDeleteIds([id]);
  };

  const toggleSelection = (id: string) => {
    setSelectedItemIds((current) =>
      current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedItemIds((current) => (current.length === items.length ? [] : items.map((item) => item.id)));
  };

  const openBulkDelete = () => {
    if (selectedItemIds.length === 0) return;
    setPendingDeleteIds(selectedItemIds);
  };

  const confirmDelete = async () => {
    if (pendingDeleteIds.length === 0) return;
    setSaving(true);
    setError('');
    try {
      await Promise.all(pendingDeleteIds.map((id) => ItemService.deleteItem(id)));
      setSelectedItemIds((current) => current.filter((id) => !pendingDeleteIds.includes(id)));
      setPendingDeleteIds([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove inventory items.');
    } finally {
      setSaving(false);
    }
  };

  if (!canAccessInventory) return <AdminAccessNotice />;
  if (loading) return <div className="h-screen flex items-center justify-center font-serif italic">Preparing the atelier...</div>;

  return (
    <AdminShell
      title={
        <>
          <span>Inventory & </span>
          <span className="italic">Model Shots</span>
        </>
      }
      subtitle="Upload finished-product photos, generate boutique model shots, and publish ready stock or crafted deliveries"
    >
      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-8">
        <section className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Product Intake</p>
              <h2 className="text-2xl font-serif mt-2">Add inventory piece</h2>
            </div>
            <RoleBadge role={role ?? 'customer'} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {([
              ['ready_stock', 'Ready Stock'],
              ['delivered_craft', 'Crafted & Delivered'],
            ] as [ShowcaseType, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setNewItem((c) => ({ ...c, showcaseType: value }))}
                className={`px-4 py-3 text-[10px] uppercase tracking-[0.25em] font-bold border ${
                  newItem.showcaseType === value
                    ? 'bg-black text-white border-black'
                    : 'border-black/10 hover:border-black'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Design Name</span>
              <input
                value={newItem.name}
                onChange={(e) => setNewItem((c) => ({ ...c, name: e.target.value }))}
                className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Category</span>
              <select
                value={newItem.category}
                onChange={(e) => setNewItem((c) => ({ ...c, category: e.target.value }))}
                className="w-full border border-black/10 px-4 py-3 bg-white outline-none focus:border-[#D4AF37]"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Cost Price (INR)</span>
              <input
                type="number"
                value={newItem.costPrice ?? 0}
                onChange={(e) => setNewItem((c) => ({ ...c, costPrice: Number(e.target.value) }))}
                className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Selling Price (INR)</span>
              <input
                type="number"
                value={newItem.price}
                onChange={(e) => setNewItem((c) => ({ ...c, price: Number(e.target.value) }))}
                className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Sale Price (optional)</span>
              <input
                type="number"
                value={newItem.salePrice ?? ''}
                onChange={(e) =>
                  setNewItem((c) => ({
                    ...c,
                    salePrice: e.target.value === '' ? undefined : Number(e.target.value),
                  }))
                }
                className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Stock</span>
              <input
                type="number"
                value={newItem.stock}
                onChange={(e) => setNewItem((c) => ({ ...c, stock: Number(e.target.value) }))}
                className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]"
                disabled={newItem.showcaseType === 'delivered_craft'}
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">SKU</span>
              <input
                value={newItem.sku || ''}
                onChange={(e) => setNewItem((c) => ({ ...c, sku: e.target.value }))}
                className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">GST %</span>
              <select
                value={newItem.gstRate ?? 5}
                onChange={(e) => setNewItem((c) => ({ ...c, gstRate: Number(e.target.value) as FashionItem['gstRate'] }))}
                className="w-full border border-black/10 px-4 py-3 bg-white outline-none focus:border-[#D4AF37]"
              >
                {[0, 3, 5, 12, 18, 28].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}%
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-2 block">
            <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Boutique Description</span>
            <textarea
              value={newItem.description}
              onChange={(e) => setNewItem((c) => ({ ...c, description: e.target.value }))}
              className="w-full min-h-[120px] border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]"
            />
          </label>

          <div className="border border-dashed border-black/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Product Photo</p>
                <p className="text-sm opacity-60 mt-2">
                  Upload a finished dress on hanger / plain background. Stored in Supabase Storage (not base64).
                </p>
              </div>
              <label className="inline-flex items-center gap-2 border border-black/10 px-4 py-3 text-[10px] uppercase tracking-[0.3em] font-bold cursor-pointer hover:border-black">
                <Upload size={14} />
                Choose Image
                <input type="file" accept="image/*" onChange={(e) => void handleImageUpload(e)} className="hidden" />
              </label>
            </div>

            {(sourcePreview || newItem.fabricImageUrl) && (
              <img
                src={sourcePreview || newItem.fabricImageUrl}
                alt="Product upload"
                className="w-full max-h-72 object-cover rounded-2xl"
              />
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void runModelShot()}
              disabled={saving || !newItem.fabricImageUrl}
              className="inline-flex items-center gap-2 border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-3 text-[10px] uppercase tracking-[0.3em] font-bold text-[#a17f1a] disabled:opacity-50"
            >
              <Sparkles size={14} />
              Generate Model Shot
            </button>
            <button
              type="button"
              onClick={() => void saveItem()}
              disabled={saving || !newItem.name || !newItem.fabricImageUrl}
              className="inline-flex items-center gap-2 bg-black text-white px-5 py-3 text-[10px] uppercase tracking-[0.3em] font-bold disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              Save to Inventory
            </button>
          </div>

          {newItem.renderedImageUrl && (
            <div className="rounded-2xl border border-black/5 bg-[#fcfaf5] p-5 space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Storefront Catalog Image</p>
                <h3 className="font-serif text-xl mt-2">AI boutique model shot</h3>
              </div>
              <img
                src={newItem.renderedImageUrl}
                alt="AI model shot"
                className="w-full max-h-[32rem] object-cover rounded-2xl"
              />
              {shotNote && <p className="text-sm opacity-70">{shotNote}</p>}
            </div>
          )}
        </section>

        <section className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Current Collection</p>
              <h2 className="text-2xl font-serif mt-2">Active inventory</h2>
            </div>
            <div className="flex items-center gap-3">
              {items.length > 0 && (
                <label className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] opacity-55">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedItemIds.length === items.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 accent-black"
                  />
                  Select All
                </label>
              )}
              {selectedItemIds.length > 0 && (
                <button
                  type="button"
                  onClick={openBulkDelete}
                  disabled={saving}
                  className="inline-flex items-center gap-2 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-[10px] uppercase tracking-[0.25em] font-bold hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Delete Selected ({selectedItemIds.length})
                </button>
              )}
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-45">{items.length} live pieces</span>
            </div>
          </div>

          <div className="space-y-4 max-h-[900px] overflow-auto pr-1">
            {items.map((item) => (
              <article
                key={item.id}
                className="grid grid-cols-[auto_92px_1fr_auto] gap-4 items-center border border-black/5 rounded-2xl p-4"
              >
                <label className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectedItemIds.includes(item.id)}
                    onChange={() => toggleSelection(item.id)}
                    className="h-4 w-4 accent-black"
                    aria-label={`Select ${item.name}`}
                  />
                </label>
                <img
                  src={item.renderedImageUrl || item.fabricImageUrl}
                  alt={item.name}
                  className="w-[92px] h-[92px] object-cover rounded-2xl"
                />
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-lg">{item.name}</h3>
                    <span className="text-[9px] uppercase tracking-[0.2em] border border-black/10 px-2 py-1">
                      {item.showcaseType === 'delivered_craft' ? 'Crafted' : 'Ready'}
                    </span>
                    {item.isOneOfOne && (
                      <span className="text-[10px] uppercase tracking-[0.25em] bg-black text-white px-2 py-1">
                        1 of 1
                      </span>
                    )}
                  </div>
                  <p className="text-sm opacity-60 line-clamp-2">{item.description}</p>
                  <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.25em] opacity-50">
                    <span>{item.category}</span>
                    <span>•</span>
                    <span>{item.stock} in stock</span>
                    <span>•</span>
                    <span>₹{item.price.toLocaleString()}</span>
                    {item.costPrice != null && (
                      <>
                        <span>•</span>
                        <span>Cost ₹{item.costPrice.toLocaleString()}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteItem(item.id)}
                  className="border border-red-200 text-red-600 px-3 py-3 rounded-xl hover:bg-red-50"
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}

            {items.length === 0 && (
              <div className="py-20 text-center opacity-35 italic font-serif">The inventory atelier is still empty.</div>
            )}
          </div>
        </section>
      </div>

      {pendingDeleteIds.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] flex items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-[2rem] bg-white border border-black/5 shadow-2xl p-8 space-y-6">
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Delete Confirmation</p>
              <h3 className="text-3xl font-serif">Remove selected inventory pieces?</h3>
              <p className="text-sm opacity-65">
                {pendingDeleteIds.length === 1
                  ? 'This piece will be permanently removed from the boutique collection.'
                  : `${pendingDeleteIds.length} selected pieces will be permanently removed from the boutique collection.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => setPendingDeleteIds([])}
                disabled={saving}
                className="border border-black/10 px-5 py-3 text-[10px] uppercase tracking-[0.3em] font-bold hover:border-black disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-black text-white px-5 py-3 text-[10px] uppercase tracking-[0.3em] font-bold disabled:opacity-50"
              >
                <Trash2 size={14} />
                {saving
                  ? 'Deleting...'
                  : pendingDeleteIds.length === 1
                    ? 'Delete Piece'
                    : `Delete ${pendingDeleteIds.length} Pieces`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
};

export default AdminInventory;
