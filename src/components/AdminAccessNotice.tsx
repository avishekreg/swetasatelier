import { Link } from 'react-router-dom';

const AdminAccessNotice = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-20">
      <div className="bg-white border border-black/5 shadow-sm p-8 md:p-10 space-y-5">
        <p className="text-[10px] uppercase tracking-[0.35em] opacity-50">Admin Access Required</p>
        <h1 className="text-3xl font-serif">This workspace needs an assigned internal role first.</h1>
        <p className="text-sm opacity-70 leading-relaxed">
          Sign in through the dedicated admin login with an internal Supabase role
          (super admin, admin, or staff). Admin and super admin accounts can also provision staff seats from the team access hub.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/login" className="bg-black text-white px-5 py-3 text-[10px] uppercase tracking-[0.3em] font-bold">
            Go To Admin Login
          </Link>
          <Link to="/" className="border border-black/10 px-5 py-3 text-[10px] uppercase tracking-[0.3em] font-bold hover:border-black">
            Back To Storefront
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminAccessNotice;
