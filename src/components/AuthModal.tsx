import React, { useState } from 'react';
import { Lock, Mail, User, Building, Phone, ShieldCheck, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  onSuccess: (user: any) => void;
  lang: 'ar' | 'en';
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, lang }) => {
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/signin';
      const payload = isSignUp
        ? { email, password, fullName: name, companyName, phone }
        : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || (isSignUp ? 'Registration failed' : 'Sign in failed'));
      }

      if (isSignUp) {
        setSuccessMsg(
          lang === 'ar'
            ? 'تم إنشاء الحساب بنجاح! حسابك الآن قيد المراجعة من قبل الإدارة.'
            : 'Account created successfully! Your account is now pending admin approval.'
        );
        setTimeout(() => {
          setIsSignUp(false);
          setSuccessMsg(null);
        }, 3000);
      } else {
        onSuccess(data.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900/50 via-slate-900 to-slate-900 p-6 border-b border-slate-800 text-center relative">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">
            {isSignUp
              ? lang === 'ar'
                ? 'إنشاء حساب جديد في منصة فاتورة'
                : 'Create Fatoora SaaS Account'
              : lang === 'ar'
                ? 'تسجيل الدخول إلى منصة فاتورة'
                : 'Sign In to Fatoora SaaS'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {lang === 'ar'
              ? 'نظام الفوترة الإلكترونية (المرحلة الثانية) - هيئة الزكاة والضريبة والجمارك'
              : 'ZATCA Phase 2 E-Invoicing Compliance Platform'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/80 border border-red-800 rounded-lg text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-800 rounded-lg text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {isSignUp && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {lang === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={lang === 'ar' ? 'محمد العتيبي' : 'Mohammed Al-Otaibi'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 pl-10 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {lang === 'ar' ? 'اسم الشركة / المنشأة' : 'Company Name'}
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={lang === 'ar' ? 'مطعم اللهب السعودي' : 'Saudi Flame Grill'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 pl-10 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {lang === 'ar' ? 'رقم الجوال' : 'Phone'}
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+966500000000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 pl-10 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.sa"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 pl-10 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {lang === 'ar' ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 pl-10 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-sm transition shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>{lang === 'ar' ? 'جاري المعالجة...' : 'Processing...'}</span>
            ) : (
              <>
                <span>{isSignUp ? (lang === 'ar' ? 'إنشاء الحساب' : 'Sign Up') : (lang === 'ar' ? 'تسجيل الدخول' : 'Sign In')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-xs text-emerald-400 hover:text-emerald-300 underline"
            >
              {isSignUp
                ? lang === 'ar'
                  ? 'لديك حساب بالفعل؟ تسجيل الدخول'
                  : 'Already have an account? Sign In'
                : lang === 'ar'
                  ? 'ليس لديك حساب؟ تسجيل حساب جديد'
                  : "Don't have an account? Sign Up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
