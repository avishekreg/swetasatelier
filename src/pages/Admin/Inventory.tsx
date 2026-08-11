import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus, Trash2, Upload, Wand2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ItemService } from '../../services/storeService';
import { analyzeFabric, simulateVirtualTryOn } from '../../services/geminiService';
import type { FashionItem } from '../../types';
import AdminAccessNotice from '../../components/AdminAccessNotice';
import AdminShell from '../../components/AdminShell';
import RoleBadge from '../../components/RoleBadge';

const emptyItem: Omit<FashionItem, 'id' | 'createdAt'> = {
  name: '',
  description: '',
  price: 0,
  category: 'Suit',
  fabricImageUrl: '',
  renderedImageUrl: '',
  stock: 1,
  isOneOfOne: false,
  styles: [],
};


const previewFallbackStyles = ['Bridal Couture', 'Reception Gown', 'Festive Lehenga'];

function parseImageData(dataUrl: string) {
  const [metadata, base64Data = ''] = dataUrl.split(',');
  const mimeType = metadata.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
  return { base64Data, mimeType };
}

const AdminInventory = () => {
  const { canAccessInventory, role } = useAuth();
  const [items, setItems] = useState<FashionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [aiResult, setAiResult] = useState<{ description?: string; suggestedStyles?: string[] } | null>(null);
  const [previewDescription, setPreviewDescription] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [newItem, setNewItem] = useState<Omit<FashionItem, 'id' | 'createdAt'>>(emptyItem);

  const categories = useMemo(
    () => Array.from(new Set(['Suit', 'Lehenga', 'Saree', 'Ghangra', 'Indo-Western', ...items.map((item) => item.category)])),
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setNewItem((current) => ({ ...current, fabricImageUrl: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const runAiAnalysis = async () => {
    if (!newItem.fabricImageUrl) return;
    setSaving(true);
    setError('');
    try {
      const { base64Data, mimeType } = parseImageData(newItem.fabricImageUrl);
      const result = await analyzeFabric(base64Data, mimeType);
      setAiResult(result);
      setNewItem((current) => ({
        ...current,
        description: result.description ?? current.description,
        styles: (result.suggestedStyles && result.suggestedStyles.length > 0 ? result.suggestedStyles : previewFallbackStyles) ?? current.styles,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The AI atelier could not analyse this fabric just now.');
    } finally {
      setSaving(false);
    }
  };

  const runTryOn = async (style: string) => {
    if (!newItem.fabricImageUrl) return;
    setSaving(true);
    setError('');
    try {
      const { base64Data, mimeType } = parseImageData(newItem.fabricImageUrl);
      const result = await simulateVirtualTryOn(base64Data, style, mimeType);
      setNewItem((current) => ({
        ...current,
        renderedImageUrl: result.generatedImageUrl || current.renderedImageUrl || current.fabricImageUrl,
        description: result.detailedDescription || current.description,
      }));
      setPreviewDescription(result.detailedDescription || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The AI preview could not be generated.');
    } finally {
      setSaving(false);
    }
  };

  const saveItem = async () => {
    setSaving(true);
    setError('');
    try {
      await ItemService.addItem(newItem);
      setNewItem(emptyItem);
      setAiResult(null);
      setPreviewDescription('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the design concept.');
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
      setError(err instanceof Error ? err.message : 'Unable to remove the design concept.');
    } finally {
      setSaving(false);
    }
  };

  if (!canAccessInventory) return <AdminAccessNotice />;
  if (loading) return <div className="h-screen flex items-center justify-center font-serif italic">Preparing the atelier...</div>;

  return (
    <AdminShell
      title={<><span>Inventory & </span><span className="italic">AI Atelier</span></>}
      subtitle="Curate luxury collections, generate descriptions, and organise boutique stock"
    >
      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-8">
        <section className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Design Intake</p>
              <h2 className="text-2xl font-serif mt-2">Add a new couture concept</h2>
            </div>
            <RoleBadge role={role ?? 'customer'} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Design Name</span>
              <input value={newItem.name} onChange={(e) => setNewItem((c) => ({ ...c, name: e.target.value }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Category</span>
              <select value={newItem.category} onChange={(e) => setNewItem((c) => ({ ...c, category: e.target.value }))} className="w-full border border-black/10 px-4 py-3 bg-white outline-none focus:border-[#D4AF37]">
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Price (INR)</span>
              <input type="number" value={newItem.price} onChange={(e) => setNewItem((c) => ({ ...c, price: Number(e.target.value) }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Stock</span>
              <input type="number" value={newItem.stock} onChange={(e) => setNewItem((c) => ({ ...c, stock: Number(e.target.value) }))} className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" />
            </label>
          </div>

          <label className="space-y-2 block">
            <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Boutique Description</span>
            <textarea value={newItem.description} onChange={(e) => setNewItem((c) => ({ ...c, description: e.target.value }))} className="w-full min-h-[120px] border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]" />
          </label>

          <div className="border border-dashed border-black/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Fabric Upload</p>
                <p className="text-sm opacity-60 mt-2">Upload the raw fabric or embroidery shot used for this concept.</p>
              </div>
              <label className="inline-flex items-center gap-2 border border-black/10 px-4 py-3 text-[10px] uppercase tracking-[0.3em] font-bold cursor-pointer hover:border-black">
                <Upload size={14} />
                Choose Image
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>

            {newItem.fabricImageUrl && (
              <img src={newItem.fabricImageUrl} alt="Fabric upload" className="w-full max-h-72 object-cover rounded-2xl" />
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void runAiAnalysis()} disabled={saving || !newItem.fabricImageUrl} className="inline-flex items-center gap-2 border border-black/10 px-4 py-3 text-[10px] uppercase tracking-[0.3em] font-bold hover:border-black disabled:opacity-50">
              <Wand2 size={14} />
              Analyse Fabric
            </button>
            {(newItem.styles.length > 0 ? newItem.styles : previewFallbackStyles).map((style) => (
              <button key={style} type="button" onClick={() => void runTryOn(style)} disabled={saving || !newItem.fabricImageUrl} className="border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3 text-[10px] uppercase tracking-[0.3em] font-bold text-[#a17f1a] disabled:opacity-50">
                Preview {style}
              </button>
            ))}
            <button type="button" onClick={() => void saveItem()} disabled={saving || !newItem.name || !newItem.fabricImageUrl} className="inline-flex items-center gap-2 bg-black text-white px-5 py-3 text-[10px] uppercase tracking-[0.3em] font-bold disabled:opacity-50">
              <CheckCircle2 size={14} />
              Save Design
            </button>
          </div>


          {newItem.renderedImageUrl && (
            <div className="rounded-2xl border border-black/5 bg-[#fcfaf5] p-5 space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">AI Couture Preview</p>
                <h3 className="font-serif text-xl mt-2">Boutique look on model</h3>
              </div>
              <img src={newItem.renderedImageUrl} alt="AI couture preview" className="w-full max-h-[32rem] object-cover rounded-2xl" />
              {previewDescription && <p className="text-sm opacity-70">{previewDescription}</p>}
            </div>
          )}

          {aiResult && (
            <div className="rounded-2xl bg-[#f8f4ea] border border-black/5 p-5 space-y-3">
              <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">AI Atelier Notes</p>
              <p className="text-sm opacity-70">{aiResult.description}</p>
              {aiResult.suggestedStyles?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {aiResult.suggestedStyles.map((style) => (
                    <span key={style} className="px-3 py-1 rounded-full border border-black/10 text-[10px] uppercase tracking-[0.25em] font-bold">{style}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Current Collection</p>
              <h2 className="text-2xl font-serif mt-2">Active designs</h2>
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
              <article key={item.id} className="grid grid-cols-[auto_92px_1fr_auto] gap-4 items-center border border-black/5 rounded-2xl p-4">
                <label className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectedItemIds.includes(item.id)}
                    onChange={() => toggleSelection(item.id)}
                    className="h-4 w-4 accent-black"
                    aria-label={`Select ${item.name}`}
                  />
                </label>
                <img src={item.renderedImageUrl || item.fabricImageUrl} alt={item.name} className="w-[92px] h-[92px] object-cover rounded-2xl" />
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-lg">{item.name}</h3>
                    {item.isOneOfOne && <span className="text-[10px] uppercase tracking-[0.25em] bg-black text-white px-2 py-1">1 of 1</span>}
                  </div>
                  <p className="text-sm opacity-60 line-clamp-2">{item.description}</p>
                  <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.25em] opacity-50">
                    <span>{item.category}</span>
                    <span>•</span>
                    <span>{item.stock} in stock</span>
                    <span>•</span>
                    <span>₹{item.price.toLocaleString()}</span>
                  </div>
                </div>
                <button type="button" onClick={() => void deleteItem(item.id)} className="border border-red-200 text-red-600 px-3 py-3 rounded-xl hover:bg-red-50">
                  <Trash2 size={16} />
                </button>
              </article>
            ))}

            {items.length === 0 && <div className="py-20 text-center opacity-35 italic font-serif">The inventory atelier is still empty.</div>}
          </div>
        </section>
      </div>

      {pendingDeleteIds.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] flex items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-[2rem] bg-white border border-black/5 shadow-2xl p-8 space-y-6">
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Delete Confirmation</p>
              <h3 className="text-3xl font-serif">Remove selected couture designs?</h3>
              <p className="text-sm opacity-65">
                {pendingDeleteIds.length === 1
                  ? 'This design will be permanently removed from the boutique collection.'
                  : `${pendingDeleteIds.length} selected designs will be permanently removed from the boutique collection.`}
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
                {saving ? 'Deleting...' : pendingDeleteIds.length === 1 ? 'Delete Design' : `Delete ${pendingDeleteIds.length} Designs`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
};

export default AdminInventory;
