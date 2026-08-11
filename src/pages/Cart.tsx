import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { getAccessToken } from '../lib/supabase';
import { Trash2, CreditCard, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import DesignImage from '../components/DesignImage';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const Cart = () => {
  const { cart, removeFromCart, total, clearCart } = useCart();
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);

  const handleCheckout = async () => {
    if (!user) {
      await signInWithGoogle();
      return;
    }

    setProcessing(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Please sign in again to checkout.');
      }

      const createResponse = await fetch('/api/create-razorpay-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          totalAmount: total,
          items: cart.map((i) => ({
            itemId: i.id,
            quantity: i.quantity,
            type: i.type,
            measurements: i.measurements,
            unitPrice: i.price,
          })),
        }),
      });

      const created = await createResponse.json();
      if (!createResponse.ok) {
        throw new Error(created.error || 'Unable to create payment order.');
      }

      const options = {
        key: created.keyId,
        amount: created.amount,
        currency: created.currency || 'INR',
        name: "Sweta's Atelier",
        description: `Order #${String(created.orderId).slice(-6)}`,
        order_id: created.razorpayOrderId,
        handler: function () {
          clearCart();
          navigate('/orders');
        },
        prefill: {
          name: user.displayName || 'Customer',
          email: user.email,
        },
        theme: {
          color: '#1a1a1a',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Payment initiation failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center space-y-8 px-4 text-center">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center border border-black/5 mb-4">
          <ShoppingBag size={40} className="text-[#D4AF37]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-serif">Your shopping gallery is empty.</h1>
          <p className="text-[10px] uppercase tracking-[0.4em] opacity-50">Discovery awaits your presence</p>
        </div>
        <Link to="/collections" className="bg-black text-white px-12 py-5 uppercase text-[10px] tracking-widest font-bold">Start Exploring</Link>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 py-12 lg:py-24"
    >
      <h1 className="text-5xl font-serif mb-16">The Assemble <span className="italic">Collection</span></h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
        {/* Cart List */}
        <div className="lg:col-span-2 space-y-12">
          <div className="space-y-8">
            {cart.map((item) => (
              <motion.div 
                key={`${item.id}-${item.type}`}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-8 group pb-8 border-b border-black/5"
              >
                <DesignImage
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  containerClassName="w-24 h-32 md:w-32 md:h-44 bg-white"
                  watermarkClassName="bottom-2 right-2 sm:bottom-3 sm:right-3"
                  loading="lazy"
                />
                <div className="flex-1 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-serif">{item.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[8px] uppercase tracking-widest font-bold bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded-full">
                          {item.type}
                        </span>
                        {item.type === 'stitched' && (
                          <span className="text-[8px] uppercase tracking-widest opacity-40 italic">Custom Measurements Provided</span>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.id, item.type)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 text-red-500 rounded-full"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center pt-4">
                    <div className="flex items-center space-x-4 border border-black/10 px-3 py-1">
                      <span className="text-xs">Qty: {item.quantity}</span>
                    </div>
                    <p className="font-serif italic text-lg">₹{(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-8">
          <div className="bg-white p-8 space-y-8 border border-black/5 shadow-sm sticky top-32">
            <h3 className="text-xs uppercase tracking-widest font-bold opacity-60">Order Summary</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between text-xs uppercase tracking-widest font-light">
                <span className="opacity-60">Subtotal</span>
                <span>₹{total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs uppercase tracking-widest font-light">
                <span className="opacity-60">Shipping</span>
                <span className="text-green-600 font-bold">Complimentary</span>
              </div>
              <div className="border-t border-black/10 pt-4 flex justify-between">
                <span className="text-xs uppercase tracking-widest font-bold">Total</span>
                <span className="text-2xl font-serif italic">₹{total.toLocaleString()}</span>
              </div>
            </div>

            <button 
              onClick={handleCheckout}
              disabled={processing}
              className="w-full bg-[#1a1a1a] text-white py-5 flex items-center justify-center gap-3 uppercase text-[10px] tracking-widest font-bold hover:bg-black transition-all disabled:opacity-50"
            >
              {processing ? (
                "Initiating Secure Gateway..."
              ) : (
                <>
                  <CreditCard size={16} />
                  Complete Purchase
                </>
              )}
            </button>

            <div className="space-y-4 pt-4">
               <div className="flex items-center gap-3 text-[8px] uppercase tracking-widest opacity-50">
                  <ShieldCheck size={14} />
                  <span>Secure 256-bit SSL Encryption</span>
               </div>
               <div className="flex items-center gap-3 text-[8px] uppercase tracking-widest opacity-50">
                  <CreditCard size={14} />
                  <span>Powered by Razorpay</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ShoppingBag = ({ size, className }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);

export default Cart;
