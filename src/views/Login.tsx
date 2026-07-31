import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useBranding } from '../settings/BrandingContext';

export default function Login() {
  const { login, signup } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';
  const mode: 'login' | 'signup' = location.pathname === '/register' ? 'signup' : 'login';
  const schoolName = branding?.schoolName || 'POPIN School';
  const schoolMotto = branding?.schoolMotto || 'Connected school operations';
  const logoUrl = branding?.logoUrl;
  const isLogin = mode === 'login';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result =
        mode === 'login'
          ? await login(email, password)
          : await (async () => {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
            return signup(email, password, name);
          })();
      const fallbackRoute = result.role === 'PARENT' ? '/parent-portal' : '/';
      navigate(from !== '/' ? from : fallbackRoute, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-slate-950">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
                ) : (
                  <GraduationCap className="h-6 w-6" />
                )}
              </div>
              <div>
                <p className="font-heading text-lg font-bold">{schoolName}</p>
                <p className="text-xs text-white/50">{schoolMotto}</p>
              </div>
            </div>

            <div className="mt-20 max-w-md">
              <p className="text-sm font-semibold uppercase text-sky-200">Welcome back</p>
              <h1 className="mt-3 font-heading text-4xl font-bold leading-tight">
                Everything your school team needs, one sign-in away.
              </h1>
              <p className="mt-4 text-sm leading-6 text-white/60">
                Pick up admissions, support tickets, stock, portals and settings from the same
                workspace.
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <p className="text-xs text-white/50">Today</p>
                  <p className="mt-1 text-sm font-semibold">Operations snapshot</p>
                </div>
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  ['156', 'Applications'],
                  ['23', 'Tickets'],
                  ['5', 'Alerts'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-lg bg-white/10 p-3">
                    <p className="font-heading text-2xl font-bold">{value}</p>
                    <p className="mt-1 text-xs text-white/50">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-8 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="w-full max-w-[27rem]"
          >
            <div className="lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-950 text-white">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="h-9 w-9 rounded-md object-cover" />
                  ) : (
                    <GraduationCap className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <p className="font-heading text-lg font-bold text-slate-950">{schoolName}</p>
                  <p className="text-xs text-slate-500">{schoolMotto}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 lg:mt-0">
              <p className="text-sm font-semibold text-blue-600">{isLogin ? 'Sign in' : 'Create account'}</p>
              <h2 className="mt-2 font-heading text-3xl font-bold text-slate-950">
                {isLogin ? 'Welcome back' : 'Set up your profile'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {isLogin
                  ? 'Use your school account to continue to the dashboard.'
                  : 'Create a local account for this school workspace.'}
              </p>
            </div>

            <div className="mt-7 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
              <Link
                to="/login"
                className={`rounded-md px-3 py-2 text-center text-sm font-semibold transition ${
                  mode === 'login' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className={`rounded-md px-3 py-2 text-center text-sm font-semibold transition ${
                  mode === 'signup' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sign up
              </Link>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === 'signup' && (
                <div>
                  <label htmlFor="login-name" className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Full name
                  </label>
                  <input
                    id="login-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    placeholder="Sarah Khumalo"
                  />
                </div>
              )}

              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    placeholder="name@school.org"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-12 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label htmlFor="register-confirm-password" className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Confirm password
                  </label>
                  <input
                    id="register-confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    placeholder="Repeat your password"
                    required
                  />
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{loading ? 'Please wait...' : isLogin ? 'Sign in' : 'Create account'}</span>
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Use the accounts provisioned for your school workspace. Registration stays available
              for local onboarding if enabled by your administrator.
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
