import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useSearchParams } from 'react-router-dom';
import { ItemService, PromotionService, UserService } from '../services/storeService';
import { FashionItem, Promotion } from '../types';
import { Heart, Filter, ChevronDown, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import DesignImage from '../components/DesignImage';

const ProductList = () => {
  const [items, setItems] = useState<FashionItem[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const { profile, user, refreshProfile } = useAuth();
  const category = searchParams.get('cat');

  useEffect(() => {
    const fetchItems = async () => {
      const [itemData, promoData] = await Promise.all([
        ItemService.getAllItems(),
        PromotionService.getAllPromotions()
      ]);
      
      if (itemData) {
        if (category) {
          setItems(itemData.filter(i => i.category === category));
        } else {
          setItems(itemData);
        }
      }
      if (promoData) {
        setPromotions(promoData.filter(p => p.isActive));
      }
      setLoading(false);
    };
    fetchItems();
  }, [category]);

  const getEffectivePrice = (item: FashionItem) => {
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

  const toggleFavorite = async (id: string) => {
    if (user) {
      await UserService.toggleFavorite(user.uid, id);
      await refreshProfile();
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-serif italic text-lg">Loading Collection...</div>;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 py-12 space-y-12"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-black/10 pb-12">
        <div className="space-y-4">
          <h1 className="text-5xl font-serif tracking-tight">
            {category ? category : "The Full Gallery"}
          </h1>
          <p className="text-[10px] uppercase tracking-[0.3em] opacity-50">Browsing {items.length} Designs</p>
        </div>
        
        <div className="flex items-center space-x-6 text-[10px] uppercase tracking-widest font-bold">
          <div className="flex items-center space-x-2 cursor-pointer hover:text-[#D4AF37]">
            <span>Filter</span>
            <Filter size={14} />
          </div>
          <div className="flex items-center space-x-2 cursor-pointer hover:text-[#D4AF37]">
            <span>Sort By</span>
            <ChevronDown size={14} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 md:gap-x-8 gap-y-12 md:gap-y-16">
        {items.length > 0 ? items.map((item, i) => (
          <motion.div 
            key={item.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className="group relative"
          >
            <Link to={`/product/${item.id}`} className="block overflow-hidden bg-white aspect-[3/4.5] relative">
              <DesignImage
                src={item.renderedImageUrl || item.fabricImageUrl} 
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
                loading="lazy"
                containerClassName="h-full"
              />
              {!item.renderedImageUrl && (
                <div className="absolute top-2 left-2 md:top-4 md:left-4 bg-black text-white text-[6px] md:text-[8px] uppercase tracking-widest px-1.5 md:px-2 py-0.5 md:py-1 z-10">
                  Fabric Only
                </div>
              )}
              {item.isOneOfOne && (
                <div className="absolute top-2 left-2 md:top-4 md:left-4 bg-[#D4AF37] text-white text-[6px] md:text-[8px] uppercase tracking-widest px-1.5 md:px-2 py-0.5 md:py-1 z-10 flex items-center gap-1">
                  <Sparkles size={8} className="md:w-[10px] md:h-[10px]" /> 1:1 Exclusive
                </div>
              )}
              {item.stock <= 0 && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-20">
                  <span className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.4em] font-bold bg-white px-2 md:px-4 py-1 md:py-2 border border-black">Out of Stock</span>
                </div>
              )}
            </Link>
            
            <button 
              onClick={() => toggleFavorite(item.id)}
              className="absolute top-2 right-2 md:top-4 md:right-4 p-1.5 md:p-2 bg-white/80 rounded-full hover:bg-white transition-colors z-10"
            >
              <Heart size={14} className="md:w-4 md:h-4" fill={profile?.favorites?.includes(item.id) ? "#D4AF37" : "none"} color={profile?.favorites?.includes(item.id) ? "#D4AF37" : "black"} />
            </button>

            <div className="mt-3 md:mt-6 space-y-1 md:space-y-2">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-start gap-1">
                <Link to={`/product/${item.id}`} className="text-[10px] md:text-sm font-medium tracking-tight hover:underline line-clamp-1">{item.name}</Link>
                <div className="flex flex-row md:flex-col items-center md:items-end gap-2 md:gap-0">
                   {getEffectivePrice(item) < item.price ? (
                     <>
                        <span className="text-[10px] md:text-xs font-serif italic text-[#D4AF37]">₹{getEffectivePrice(item).toLocaleString()}</span>
                        <span className="text-[7px] md:text-[8px] line-through opacity-40">₹{item.price.toLocaleString()}</span>
                     </>
                   ) : (
                     <span className="text-[10px] md:text-xs font-serif italic text-[#D4AF37]">₹{item.price.toLocaleString()}</span>
                   )}
                </div>
              </div>
              <p className="text-[7px] md:text-[10px] uppercase tracking-widest opacity-40">{item.category}</p>
            </div>
          </motion.div>
        )) : (
          <div className="col-span-full py-24 text-center space-y-4 opacity-50">
            <p className="font-serif italic text-2xl">The gallery is currently being curated.</p>
            <p className="text-[10px] uppercase tracking-[0.4em]">Check back soon</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProductList;
