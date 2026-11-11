import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useBranding } from '../settings/BrandingContext';
import { apiRequest } from '../lib/api';

export default function Login() {
  const { login, signup, user } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(new URLSearchParams(location.search).get('email') || '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const resetToken = new URLSearchParams(location.search).get('reset');
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
  useEffect(() => { if (user && new URLSearchParams(location.search).get('sso') === 'complete') navigate(user.role === 'PARENT' ? '/parent-portal' : user.role === 'TEACHER' ? '/teacher-portal' : '/', { replace: true }); }, [user, location.search, navigate]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (resetToken) {
        const result = await apiRequest<{ message: string }>('/auth/recovery', { method: 'POST', auth: false, body: JSON.stringify({ email: new URLSearchParams(location.search).get('email'), token: resetToken, password }) });
        setError(result.message);
        navigate('/login', { replace: true });
        return;
      }
      const result = mode === 'login'
        ? await login(email, password, code)
        : await (async () => {
          if (password !== confirmPassword) throw new Error('Passwords do not match.');
          return signup(email, password, name);
        })();
      const fallbackRoute =
        result.role === 'PARENT' ? '/parent-portal' : result.role === 'STUDENT' ? '/student-portal' : '/';
      navigate(from !== '/' ? from : fallbackRoute, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(37,99,235,0.38),transparent_25%),radial-gradient(circle_at_88%_82%,rgba(14,165,233,0.2),transparent_27%),linear-gradient(135deg,#071226_0%,#101f40_52%,#071226_100%)]" />
      <div className="pointer-events-none absolute -left-20 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-16 top-16 h-56 w-56 rounded-full border border-white/10" />
      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-5xl items-center justify-center sm:min-h-[calc(100vh-4rem)]">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/15 bg-white shadow-2xl shadow-slate-950/40 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-950 p-10 text-white lg:flex lg:min-h-[42rem] lg:flex-col">
            <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:20px_20px]" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
                {logoUrl ? <img src={logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover" /> : <GraduationCap className="h-6 w-6" />}
              </div>
              <div>
                <p className="font-heading text-lg font-bold tracking-tight">{schoolName}</p>
                <p className="text-xs text-blue-100">{schoolMotto}</p>
              </div>
            </div>
            <div className="relative my-auto pt-16">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" /> Your school, connected
              </div>
              <h1 className="max-w-sm font-heading text-4xl font-bold leading-tight tracking-tight">Everything your school needs, in one place.</h1>
              <p className="mt-5 max-w-sm text-sm leading-6 text-blue-100">A secure workspace for school operations, learning, and family communication.</p>
            </div>
            <div className="relative flex items-center gap-3 rounded-2xl border border-white/15 bg-slate-950/15 p-4 backdrop-blur-sm">
              <ShieldCheck className="h-5 w-5 shrink-0 text-blue-100" />
              <p className="text-xs leading-5 text-blue-50">Your account and school information are protected with secure access controls.</p>
            </div>
          </aside>
          <section className="flex items-center justify-center bg-white px-5 py-8 sm:px-10 sm:py-10 lg:px-14">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="w-full max-w-[28rem]"
          >
            <div className="lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-600/25">
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

            <div className="mt-9 lg:mt-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">{isLogin ? 'Welcome back' : 'Get started'}</p>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-slate-950">
                {isLogin ? 'Welcome back' : 'Set up your profile'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {isLogin ? 'Use your school account to continue to the dashboard.' : 'Create a local account for this school workspace.'}
              </p>
            </div>

            <div className="mt-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1.5">
              <Link to="/login" className={`rounded-lg px-3 py-2.5 text-center text-sm font-semibold transition ${isLogin ? 'bg-white text-slate-950 shadow-sm shadow-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>Sign in</Link>
              <Link to="/register" className={`rounded-lg px-3 py-2.5 text-center text-sm font-semibold transition ${!isLogin ? 'bg-white text-slate-950 shadow-sm shadow-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>Sign up</Link>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {resetToken && <p>Enter your email and a new password of at least 12 characters.</p>}
              {!isLogin && (
                <div>
                  <label htmlFor="login-name" className="mb-1.5 block text-xs font-semibold text-slate-600">Full name</label>
                  <input id="login-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" placeholder="Sarah Khumalo" required />
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
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
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
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-12 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
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

              {!isLogin && (
                <div>
                  <label htmlFor="register-confirm-password" className="mb-1.5 block text-xs font-semibold text-slate-600">Confirm password</label>
                  <input id="register-confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" placeholder="Repeat your password" required />
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {error}
                </div>
              )}
              {isLogin && <label className="block text-xs font-semibold text-slate-600">Sign-in code <span className="font-normal text-slate-400">(only if requested)</span><input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm tracking-[0.2em] text-slate-950 outline-none transition placeholder:tracking-normal hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" /></label>}
              {isLogin && !resetToken && <button type="button" disabled={loading} className="text-sm text-blue-600" onClick={async () => {
                if (!email) { setError('Enter your email address first.'); return; }
                setLoading(true);
                try { const response = await apiRequest<{ message: string }>('/auth/recovery', { method: 'POST', auth: false, body: JSON.stringify({ email }) }); setError(response.message); }
                catch (error: any) { setError(error.message); }
                finally { setLoading(false); }
              }}>Forgot password?</button>}

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-600/25 focus:outline-none focus:ring-4 focus:ring-blue-500/25 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{loading ? 'Please wait...' : resetToken ? 'Set new password' : isLogin ? 'Sign in' : 'Create account'}</span>
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
            <div className="mt-5 flex gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs leading-5 text-slate-600">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <p>Use the account provisioned for your school workspace. Registration remains available when enabled by your administrator.</p>
            </div>
          </motion.div>
          </section>
        </div>
      </div>
      <p className="relative mt-4 text-center text-xs text-slate-400">Powered by Popinsolutions</p>
    </div>
  );
}
