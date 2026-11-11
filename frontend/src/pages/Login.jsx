import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Languages, Moon, Sun } from 'lucide-react';
import { toast } from '../alert';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';

export default function Login() {
  const { user, login } = useAuth();
  const { t, lang, toggleLang } = useLang();
  const { dark, toggleDark } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@smartdocs.test');
  const [password, setPassword] = useState('Admin@12345');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/administrator" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      navigate('/administrator');
    } catch (err) {
      toast.error(err.response?.data?.errors?.email?.[0] || err.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-900">
      <div className="absolute right-4 top-4 flex gap-1">
        <button onClick={toggleLang} className="btn-ghost !px-2.5 dark:text-slate-200">
          <Languages size={16} /> {lang === 'en' ? 'EN' : 'ខ្មែរ'}
        </button>
        <button onClick={toggleDark} className="icon-btn">{dark ? <Sun size={20} /> : <Moon size={20} />}</button>
      </div>

      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="text-center">
          {/* <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">S</div>
           */}
           <img src="../images/organ.png" alt="" className='w-16 -h-16 m-auto' />
          <h1 className="text-xl font-bold dark:text-white">{t('appName')}</h1>
          <h2 className='text-xl text-yellow-500 font-bold mb-1'>{t('organTitleLogin')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('welcome')}</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium dark:text-slate-200">{t('email')}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium dark:text-slate-200">{t('password')}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" required />
        </div>
        <div className="flex items-center justify-between text-sm">
          <Link to="/" className="text-indigo-600 hover:underline dark:text-indigo-400">
            ← {t('portalTitle')}
          </Link>
          <Link to="/forgot-password" className="text-indigo-600 hover:underline dark:text-indigo-400">
            {t('forgotPassword')}
          </Link>
        </div>
        <button disabled={busy} className="btn-primary w-full justify-center">
          {busy ? t('loading') : t('login')}
        </button>
      </form>
    </div>
  );
}