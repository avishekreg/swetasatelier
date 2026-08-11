import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ItemService, PromotionService } from '../services/storeService';
import { FashionItem, Measurements, Promotion } from '../types';
import { useCart } from '../contexts/CartContext';
import { Heart, ChevronRight, Ruler, Sparkles, AlertTriangle, Wand2, User as UserIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { simulateVirtualTryOn } from '../services/geminiService';
import DesignImage from '../components/DesignImage';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user, profile } = useAuth();
  const [item, setItem] = useState<FashionItem | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingMode, setBuyingMode] = useState<'material' | 'stitched'>('material');
  const [measurements, setMeasurements] = useState<Measurements>({
    neck: '', bust: '', waist: '', hips: '', length: '', sleeveLength: ''
  });

  // AI Try-On States
  const [isTryOnLoading, setIsTryOnLoading] = useState(false);
  const [tryOnImage, setTryOnImage] = useState<string | null>(null);
  const [tryOnAttireType, setTryOnAttireType] = useState('Saree');
  const [tryOnModelType, setTryOnModelType] = useState('Classic');
  const [tryOnFabricUrl, setTryOnFabricUrl] = useState<string | null>(null);
  const [allFabrics, setAllFabrics] = useState<{name: string, url: string}[]>([]);

  const modelOptions = [
    { id: 'Classic', label: 'Classic Elegance', prompt: 'A graceful Indian model in a poised standing position' },
    { id: 'Studio', label: 'Studio Portrait', prompt: 'A close-up studio portrait focus on the intricate details of the outfit' },
    { id: 'Modern', label: 'Modern Silhouette', prompt: 'A modern fashion model in a stylish indoor setting' },
    { id: 'Runway', label: 'Atelier Runway', prompt: 'A fashion model walking on a luxury studio floor with dramatic lighting' }
  ];

  const attireOptions = ['Saree', 'Lehenga', 'Indo-Western Suit', 'Anarkali', 'Ghangra Choli'];

  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        const [itemData, promoData, allItems] = await Promise.all([
          ItemService.getItemById(id),
          PromotionService.getAllPromotions(),
          ItemService.getAllItems()
        ]);
        setItem(itemData || null);
        if (itemData) setTryOnFabricUrl(itemData.fabricImageUrl);
        if (promoData) setPromotions(promoData.filter(p => p.isActive));
        
        if (allItems) {
          // Get unique fabrics from items
          const fabrics = allItems
            .filter(i => i.fabricImageUrl)
            .map(i => ({ name: i.name, url: i.fabricImageUrl }));
          setAllFabrics(fabrics.slice(0, 6)); // Limit to 6 for UI
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const getEffectivePrice = () => {
    if (!item) return 0;
    const applicablePromo = promotions.find(p => 
      p.applicableCategories.length === 0 || p.applicableCategories.includes(item.category)
    );

    if (applicablePromo) {
      if (applicablePromo.discountType === 'percentage') {
        return item.price * (1 - applicablePromo.discountValue / 100);
      }
      return Math.max(0, item.price - applicablePromo.discountValue);
    }
    return item.salePrice || item.price;
  };

  const handleAddToCart = () => {
    if (!item) return;
    addToCart({
      id: item.id,
      itemId: item.id,
      name: item.name,
      price: getEffectivePrice(),
      image: item.renderedImageUrl || item.fabricImageUrl,
      quantity: 1,
      type: buyingMode,
      measurements:
        buyingMode === 'stitched'
          ? (Object.fromEntries(
              Object.entries(measurements).filter(([, value]) => Boolean(value))
            ) as Record<string, string>)
          : undefined
    });
    navigate('/cart');
  };

  const handleAITryOn = async () => {
    if (!tryOnFabricUrl) return;
    setIsTryOnLoading(true);
    setTryOnImage(null);

    try {
      const imageResponse = await fetch(tryOnFabricUrl);
      const imageBlob = await imageResponse.blob();
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(imageBlob);
      });

      const attireLabel = `${tryOnAttireType} (${tryOnModelType})`;
      const result = await simulateVirtualTryOn(
        base64Data,
        attireLabel,
        imageBlob.type || 'image/jpeg'
      );

      if (result.generatedImageUrl) {
        setTryOnImage(result.generatedImageUrl);
      }
    } catch (error) {
      console.error('AI Try-On failed:', error);
      alert('The atelier is busy at the moment. Please try again shortly.');
    } finally {
      setIsTryOnLoading(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-serif italic">Revealing Design...</div>;
  if (!item) return <div className="h-screen flex items-center justify-center">Design not found.</div>;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 py-12 lg:py-24"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Images */}
        <div className="space-y-8">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="aspect-[3/4.5] bg-white overflow-hidden relative"
          >
            <DesignImage
              src={item.renderedImageUrl || item.fabricImageUrl} 
              alt={item.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              containerClassName="h-full"
            />
            {item.isOneOfOne && (
              <div className="absolute top-6 left-6 bg-[#D4AF37] text-white text-[10px] uppercase tracking-[0.3em] px-4 py-2 flex items-center gap-2 shadow-2xl">
                <Sparkles size={14} /> One of One Exclusive
              </div>
            )}
            {item.stock <= 0 && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-10">
                <div className="text-center space-y-2">
                  <p className="text-[14px] uppercase tracking-[0.5em] font-bold text-black px-8 py-3 border-2 border-black">Out of Stock</p>
                  <p className="text-[10px] uppercase tracking-widest opacity-60">Curating the next masterpiece</p>
                </div>
              </div>
            )}
          </motion.div>
          {item.renderedImageUrl && item.fabricImageUrl && (
            <div className="grid grid-cols-2 gap-4">
               <div className="aspect-square bg-white border border-black/5 overflow-hidden group hover:border-[#D4AF37] transition-colors relative">
                <DesignImage
                  src={item.fabricImageUrl} 
                  alt="Fabric texture" 
                  className="w-full h-full object-cover opacity-80" 
                  referrerPolicy="no-referrer"
                  containerClassName="h-full"
                  watermarkClassName="bottom-2 right-2"
                />
                <p className="absolute bottom-4 left-0 right-0 py-2 text-[8px] uppercase tracking-widest text-center bg-white/60">Raw Material</p>
               </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="space-y-12">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-[10px] uppercase tracking-widest opacity-40">
              <span>Collection</span>
              <ChevronRight size={10} />
              <span>{item.category}</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-serif leading-tight">{item.name}</h1>
            <div className="flex items-center gap-3 md:gap-4">
               {getEffectivePrice() < item.price ? (
                 <>
                   <p className="text-2xl md:text-3xl font-serif italic text-[#D4AF37]">₹{getEffectivePrice().toLocaleString()}</p>
                   <p className="text-lg md:text-xl line-through opacity-30">₹{item.price.toLocaleString()}</p>
                   <span className="text-[8px] md:text-[10px] uppercase tracking-widest bg-red-50 text-red-600 px-2 py-1 font-bold">Offer</span>
                 </>
               ) : (
                 <p className="text-2xl md:text-3xl font-serif italic text-[#D4AF37]">₹{item.price.toLocaleString()}</p>
               )}
            </div>
            {item.stock > 0 && item.stock < 5 && (
              <p className="text-xs text-orange-600 font-bold uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle size={14} /> Rare Find: Only {item.stock} Pieces Remaining
              </p>
            )}
          </div>

          <p className="text-sm font-light leading-relaxed opacity-70 border-l border-[#D4AF37] pl-6 italic">
            {item.description}
          </p>

          <div className="space-y-8">
            <div className="flex border-b border-black/10">
              <button 
                onClick={() => setBuyingMode('material')}
                className={cn(
                  "flex-1 py-4 text-[10px] uppercase tracking-[0.3em] font-bold transition-all",
                  buyingMode === 'material' ? "border-b-2 border-black" : "opacity-40"
                )}
              >
                Dress Material
              </button>
              <button 
                onClick={() => setBuyingMode('stitched')}
                className={cn(
                  "flex-1 py-4 text-[10px] uppercase tracking-[0.3em] font-bold transition-all",
                  buyingMode === 'stitched' ? "border-b-2 border-black" : "opacity-40"
                )}
              >
                Custom Stitching
              </button>
            </div>

            <AnimatePresence mode="wait">
              {buyingMode === 'stitched' ? (
                <motion.div 
                  key="stitched"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 bg-white/40 p-6 backdrop-blur-sm shadow-sm"
                >
                  <div className="flex items-center space-x-2 text-[#D4AF37]">
                    <Ruler size={16} />
                    <h3 className="text-[10px] uppercase tracking-widest font-bold">Personal Measurements (Inches)</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.keys(measurements).map(key => (
                      <div key={key} className="space-y-1">
                        <label className="text-[8px] uppercase tracking-widest opacity-60 ml-2">{key}</label>
                        <input 
                          type="text" 
                          placeholder="00.0"
                          value={measurements[key as keyof Measurements]}
                          onChange={(e) => setMeasurements(prev => ({ ...prev, [key]: e.target.value }))}
                          className="w-full bg-transparent border border-black/10 px-4 py-2 text-xs outline-none focus:border-black transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[8px] opacity-40 uppercase tracking-widest text-center mt-4 italic">* Our master tailors will craft this design specifically for your silhouette.</p>
                </motion.div>
              ) : (
                <motion.div 
                   key="material"
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -10 }}
                   className="p-6 border border-dashed border-black/10 text-center"
                >
                  <p className="text-xs font-light opacity-60">You are purchasing the raw unstitched fabric (includes main material and trimmings as per design).</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex space-x-4">
              <button 
                onClick={handleAddToCart}
                disabled={item.stock <= 0}
                className="flex-1 bg-black text-white px-8 py-5 uppercase text-[10px] tracking-widest hover:bg-[#1a1a1a] transition-all font-bold disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {item.stock <= 0 ? 'Currently Unavailable' : 'Assemble for Purchase'}
              </button>
              <button className="p-5 border border-black/10 hover:border-black transition-all">
                <Heart size={20} />
              </button>
            </div>
          </div>

          <div className="pt-12 border-t border-black/5 flex items-center justify-between opacity-60 text-[10px] uppercase tracking-tighter">
            <div className="flex flex-col items-center">
              <span className="font-bold">Shipping</span>
              <span>Across India</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold">Support</span>
              <span>24/7 Concierge</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold">Fabric</span>
              <span>100% Authentic</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Try-On Section */}
      <section className="mt-24 pt-24 border-t border-black/10">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-serif">Studio <span className="italic">Visualizer</span></h2>
            <p className="text-[10px] uppercase tracking-[0.4em] opacity-50">AI-Powered Virtual Try-On</p>
            <div className="h-px w-24 bg-[#D4AF37] mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-60 flex items-center gap-2">
                  <Sparkles size={12} /> Choose Fabric swatch
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {allFabrics.map((fabric, idx) => (
                    <button
                      key={idx}
                      onClick={() => setTryOnFabricUrl(fabric.url)}
                      className={cn(
                        "aspect-square border-2 transition-all overflow-hidden relative",
                        tryOnFabricUrl === fabric.url ? "border-[#D4AF37]" : "border-black/5"
                      )}
                    >
                      <img src={fabric.url} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                      {tryOnFabricUrl === fabric.url && (
                        <div className="absolute inset-0 bg-[#D4AF37]/20 flex items-center justify-center">
                          <CheckCircle2 size={16} className="text-[#D4AF37]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-60 flex items-center gap-2">
                  <UserIcon size={12} /> Select Your Model Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {modelOptions.map(model => (
                    <button
                      key={model.id}
                      onClick={() => setTryOnModelType(model.id)}
                      className={cn(
                        "p-4 text-[10px] uppercase tracking-widest border transition-all text-left",
                        tryOnModelType === model.id 
                          ? "bg-black text-white border-black" 
                          : "border-black/10 hover:border-black/40"
                      )}
                    >
                      {model.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-60 flex items-center gap-2">
                  <Sparkles size={12} /> Envisioned Attire
                </label>
                <div className="flex flex-wrap gap-2">
                  {attireOptions.map(option => (
                    <button
                      key={option}
                      onClick={() => setTryOnAttireType(option)}
                      className={cn(
                        "px-4 py-2 text-[10px] border transition-all uppercase tracking-widest",
                        tryOnAttireType === option 
                          ? "bg-[#D4AF37] text-white border-[#D4AF37]" 
                          : "border-black/10 hover:border-black/40"
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleAITryOn}
                disabled={isTryOnLoading}
                className="w-full bg-black text-white py-6 uppercase text-[10px] tracking-[0.4em] font-bold hover:bg-[#D4AF37] transition-all flex items-center justify-center gap-4 group"
              >
                {isTryOnLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Sewing Your Dream Look...</span>
                  </>
                ) : (
                  <>
                    <Wand2 size={16} className="group-hover:rotate-12 transition-transform" />
                    <span>Visualize This Fabric</span>
                  </>
                )}
              </button>
              
              <p className="text-[9px] uppercase tracking-widest opacity-40 text-center italic">
                Powered by Gemini • Experience the Bespoke Vision
              </p>
            </div>

            <div className="aspect-[3/4.5] bg-white border border-black/5 overflow-hidden flex items-center justify-center relative shadow-2xl">
              {tryOnImage ? (
                <motion.img 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  src={tryOnImage} 
                  alt="AI Try-On Result" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-center p-12 space-y-4 opacity-20">
                  <Wand2 size={48} className="mx-auto" />
                  <p className="text-xs uppercase tracking-[0.3em] font-light">Select your preferences to generate high-fashion visualizer</p>
                </div>
              )}
              {isTryOnLoading && (
                <div className="absolute inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center">
                  <div className="text-center space-y-4">
                     <div className="w-16 h-16 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
                     <p className="text-[10px] uppercase tracking-[0.2em] font-bold">Bridging Fabric and Form...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
};

export default ProductDetail;
