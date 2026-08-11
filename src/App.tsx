import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ShoppingBag, User, Heart, LogOut, Menu, X } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import Home from './pages/Home';
import ProductList from './pages/ProductList';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import AdminDashboard from './pages/Admin/Dashboard';
import AdminInventory from './pages/Admin/Inventory';
import AdminAccounts from './pages/Admin/Accounts';
import AdminOrders from './pages/Admin/Orders';
import AdminPromotions from './pages/Admin/Promotions';
import AdminLogin from './pages/Admin/Login';
import AdminStaff from './pages/Admin/Staff';
import OrderTracking from './pages/OrderTracking';
import Favorites from './pages/Favorites';
import { getPostLoginRoute } from './lib/auth';

const Navbar = () => {
  const { user, role, signOut } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const userHomeHref = getPostLoginRoute(role);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#f5f2ed]/90 backdrop-blur-md border-b border-black/10">
      <div className="max-w-7xl mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3 md:space-x-5 group">
          <div className="relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center">
            <div className="absolute inset-0 border border-black/10 group-hover:border-[#D4AF37]/50 rounded-full transition-colors duration-700" />
            <div className="absolute inset-[1px] md:inset-[2px] border border-black group-hover:rotate-180 transition-transform duration-1000" />
            <div className="absolute inset-[3px] md:inset-[4px] rounded-full overflow-hidden bg-[#faf4ea] shadow-[inset_0_0_0_1px_rgba(183,145,79,0.22)]">
              <img
                src="/images/swetas-studio-mark-header.png"
                alt="Sweta's Atelier mark"
                className="w-full h-full object-cover rounded-full scale-[1.16] brightness-[1.03] contrast-[1.06]"
              />
            </div>
          </div>
          <div className="flex flex-col h-8 md:h-10 justify-center">
            <span className="text-base md:text-xl font-serif tracking-[0.15em] md:tracking-[0.2em] uppercase text-[#1a1a1a] leading-none mb-0.5 md:mb-1">
              Sweta's
            </span>
            <span className="text-[7px] md:text-[9px] font-sans tracking-[0.3em] md:tracking-[0.4em] uppercase text-[#D4AF37] leading-none font-bold">
              Studio
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center space-x-8 text-xs uppercase tracking-widest font-medium">
          <Link to="/collections" className="hover:text-[#D4AF37] transition-colors">Collections</Link>
          <div className="flex items-center space-x-6 ml-8">
            <Link to="/favorites" className="relative group">
              <Heart size={20} />
              <span className="absolute -top-2 -right-2 bg-[#D4AF37] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">!</span>
            </Link>
            <Link to="/cart" className="relative">
              <ShoppingBag size={20} />
            </Link>
            {user ? (
              <div className="flex items-center space-x-4">
                <Link to={userHomeHref}><User size={20} /></Link>
                <button onClick={signOut} className="hover:text-red-500 transition-colors">
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <Link to="/login" className="border border-black px-4 py-1.5 hover:bg-black hover:text-white transition-all">
                Login
              </Link>
            )}
          </div>
        </div>

        <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-[#f5f2ed] border-b border-black/10 p-4 flex flex-col space-y-4 text-sm tracking-widest uppercase text-center"
          >
            <Link to="/collections" onClick={() => setIsOpen(false)}>Collections</Link>
            <Link to="/favorites" onClick={() => setIsOpen(false)}>Favorites</Link>
            <Link to="/cart" onClick={() => setIsOpen(false)}>Cart</Link>
            {user ? (
              <button onClick={() => { void signOut(); setIsOpen(false); }} className="text-red-500">Logout</button>
            ) : (
              <Link to="/login" onClick={() => setIsOpen(false)}>Login</Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/collections" element={<ProductList />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/orders" element={<OrderTracking />} />
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/inventory" element={<AdminInventory />} />
        <Route path="/admin/accounts" element={<AdminAccounts />} />
        <Route path="/admin/orders" element={<AdminOrders />} />
        <Route path="/admin/promotions" element={<AdminPromotions />} />
        <Route path="/admin/staff" element={<AdminStaff />} />
      </Routes>
    </AnimatePresence>
  );
};

export default function App() {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        alert('Screenshots are discouraged to protect our artisans\' original designs.');
        navigator.clipboard.writeText('');
      }

      if (
        (e.ctrlKey && (e.key === 's' || e.key === 'p' || e.key === 'u')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'j' || e.key === 'c')) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <div className="min-h-screen bg-[#f5f2ed] text-[#1a1a1a] font-sans">
            <Navbar />
            <main className="pt-16 pb-20">
              <AnimatedRoutes />
            </main>
            <footer className="bg-[#1a1a1a] text-[#f5f2ed] py-12 px-4">
              <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
                <div>
                  <h3 className="text-xl font-serif mb-4 uppercase tracking-widest">Sweta's Atelier</h3>
                  <p className="text-sm opacity-60 font-light leading-relaxed">
                    Crafting elegance through every thread. Discover the finest Indian ethnic wear curated for the modern silhouette.
                  </p>
                </div>
                <div className="flex flex-col space-y-2 uppercase tracking-widest text-[10px] font-medium">
                  <Link to="/collections">New Arrivals</Link>
                  <Link to="/collections?cat=Lehenga">Lehengas</Link>
                  <Link to="/collections?cat=Suit">Suits</Link>
                  <Link to="/collections?cat=Saree">Sarees</Link>
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-widest mb-4">Newsletter</h4>
                  <div className="flex border-b border-white/20 pb-2">
                    <input type="email" placeholder="JOIN THE CIRCLE" className="bg-transparent text-[10px] flex-1 outline-none uppercase tracking-widest" />
                    <button className="text-[10px] ml-4 font-bold">JOIN</button>
                  </div>
                </div>
              </div>
              <div className="mt-12 pt-8 border-t border-white/10 text-center text-[10px] opacity-40 uppercase tracking-widest">
                © 2026 Sweta's Atelier. All rights reserved.
              </div>
            </footer>
          </div>
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}
