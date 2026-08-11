import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const Home = () => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-24"
    >
      {/* Hero Section */}
      <section className="relative h-[95vh] flex items-center justify-start overflow-hidden bg-white px-6 md:px-12 lg:px-24">
        {/* Background Image - Hand embroidery atelier detail */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/images/hero-embroidery-optimized.jpg"
            alt="Artisan hand-embroidering gold threadwork on emerald fabric"
            className="w-full h-full object-cover object-center opacity-100 scale-100 transition-transform duration-[40s] ease-out"
            loading="eager"
            fetchPriority="high"
          />
          {/* Warm overlays for readability without losing the embroidery detail */}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,10,7,0.72)_0%,rgba(15,10,7,0.38)_34%,rgba(15,10,7,0.08)_62%,rgba(15,10,7,0.18)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),transparent_42%)]" />
        </div>

        <div className="relative z-10 text-left space-y-6 md:space-y-8 max-w-4xl pt-12">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1 }}
            className="space-y-4"
          >
            <div className="flex items-center space-x-4 md:space-x-6 mb-2 md:mb-4">
               <div className="w-8 md:w-12 h-[1px] bg-[#D4AF37]" />
               <span className="text-[#D4AF37] text-[8px] md:text-xs uppercase tracking-[0.4em] md:tracking-[0.6em] font-light">Custom Hand-Embroidery</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-serif font-light tracking-tighter text-white leading-tight">
              Sweta's <br />
              <span className="italic block ml-8 md:ml-32 text-[#D4AF37]">Atelier</span>
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 1.2 }}
            className="space-y-4 md:space-y-6 pl-1 md:pl-32"
          >
            <p className="text-xs md:text-lg uppercase tracking-[0.2em] md:tracking-[0.25em] font-light text-white/70 max-w-xs md:max-w-xl leading-relaxed">
              Bespoke Indian Heritage <br />
              & Modern Indo-Western Soul.
            </p>
            
            <div className="h-[1px] w-16 md:w-24 bg-[#D4AF37]/50" />
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="pt-4 md:pt-6 pl-1 md:pl-32"
          >
            <Link 
              to="/collections" 
              className="group relative inline-flex items-center space-x-6 md:space-x-10 bg-white text-black px-8 md:px-12 py-4 md:py-5 uppercase text-[8px] md:text-[10px] tracking-[0.3em] md:tracking-[0.4em] font-bold transition-all duration-700 hover:bg-[#D4AF37] hover:text-white"
            >
              <span className="relative z-10">Explore the Studio</span>
              <ArrowRight size={16} className="relative z-10 group-hover:translate-x-2 md:group-hover:translate-x-3 transition-transform duration-700" />
            </Link>
          </motion.div>
        </div>

        {/* Cinematic Scroll Accent */}
        <div className="absolute right-8 md:right-24 bottom-12 hidden lg:flex flex-col items-center space-y-12">
          <p className="text-[10px] text-white/30 uppercase tracking-[1em] rotate-90 origin-center whitespace-nowrap">Scroll for Elegance</p>
          <div className="w-[1px] h-32 bg-gradient-to-t from-[#D4AF37] to-transparent" />
        </div>
      </section>

      {/* Featured Categories */}
      <section className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { title: "The Royal Lehenga", img: "https://images.unsplash.com/photo-1594463750939-ebb6d2a40fb1?auto=format&fit=crop&q=80&w=1200" },
          { title: "Modern Salwar", img: "https://images.unsplash.com/photo-1585487000160-0672e811c009?auto=format&fit=crop&q=80&w=1200" },
          { title: "Ethnic Suits", img: "https://images.unsplash.com/photo-1589243023531-1e969d7a224f?auto=format&fit=crop&q=80&w=1200" }
        ].map((cat, i) => (
          <motion.div 
            key={i}
            initial={{ y: 40, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group cursor-pointer relative overflow-hidden aspect-[3/4]"
          >
            <img 
              src={cat.img} 
              alt={cat.title} 
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
            />
            <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/60 to-transparent">
              <h3 className="text-white font-serif text-2xl lowercase italic">{cat.title}</h3>
              <p className="text-white/60 text-[10px] uppercase tracking-widest mt-2">View More</p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* About Section */}
      <section className="max-w-4xl mx-auto px-4 text-center space-y-8 py-24 border-y border-black/5">
        <h2 className="text-3xl font-serif">A Legacy of Craftsmanship</h2>
        <p className="text-sm opacity-60 leading-relaxed font-light italic">
          "Sweta's Atelier is born from a passion for detail. We believe every dress tells a story of tradition, woven with contemporary threads. Our collection is a tribute to the craftsmanship of Indian artisans."
        </p>
        <div className="w-12 h-[1px] bg-[#D4AF37] mx-auto" />
      </section>
    </motion.div>
  );
};

export default Home;
