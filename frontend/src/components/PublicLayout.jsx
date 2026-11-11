import { Link, NavLink } from 'react-router-dom';
import { Languages, Moon, Sun, LogIn, LayoutDashboard, ArrowLeftRight, FileText } from 'lucide-react';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

export default function PublicLayout({ children }) {
  const { t, lang, toggleLang } = useLang();
  const { dark, toggleDark } = useTheme();
  const { user } = useAuth();
  const staffArea = user && ['admin', 'manager'].includes(user.role);

  const nav = ({ isActive }) =>
    `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-800/90">
        <div className="flex h-16 w-full items-center gap-3 px-4 sm:px-6 lg:px-10">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
            <span className="hidden text-lg font-bold sm:inline">{t('appName')}</span>
            <span className="hidden text-lg font-bold sm:inline text-yellow-600">{t('organName')}</span>

          </Link>

          <nav className="ml-2 flex items-center gap-1">
            <NavLink to="/" end className={nav}>
              <FileText size={16} /><span className="hidden sm:inline">{t('documents')}</span>
            </NavLink>
            <NavLink to="/convert" className={nav}>
              <ArrowLeftRight size={16} /><span>{t('convert')}</span>
            </NavLink>
            <NavLink to="/translate" className={nav}>
              <Languages size={16} /><span>{t('translate')}</span>
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button onClick={toggleDark} className="icon-btn" title={t('darkMode')} aria-label={t('darkMode')}>
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={toggleLang} className="btn-ghost !px-2.5" title={t('language')}>
              <Languages size={16} /> {lang === 'en' ? 'EN' : 'ខ្មែរ'}
            </button>

          </div>
        </div>
      </header>

      <main className="w-full flex-1 px-4 pb-14 pt-4 sm:px-6 lg:px-10">{children}</main>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 text-center text-xs text-slate-500 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-400">
        © {new Date().getFullYear()} {t('appName')}. {t('footer')}
      </footer>
    </div>
  );
}
