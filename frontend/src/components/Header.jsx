import { Globe } from 'lucide-react';
import { Link as TLink } from 'react-router-dom';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Search, Sun, Moon, Languages } from 'lucide-react';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function Header({ onToggle }) {
  const { t, lang, toggleLang } = useLang();
  const { dark, toggleDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const submit = (e) => {
    e.preventDefault();
    navigate(`/administrator/documents${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-800">
      <button onClick={onToggle} className="icon-btn" title={t('toggleMenu')} aria-label={t('toggleMenu')}>
        <Menu size={20} />
      </button>

      <form onSubmit={submit} className="relative max-w-md flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')}
          className="input pl-9" />
      </form>

      <div className="ml-auto flex items-center gap-1">
        <TLink to="/administrator/translate" className="btn-ghost !px-2.5" title={t('translate')}>
          <Globe size={16} /><span className="hidden md:inline">{t('translate')}</span>
        </TLink>
        <button onClick={toggleLang} className="btn-ghost !px-2.5" title={t('language')}>
          <Languages size={16} />
          <span>{lang === 'en' ? 'EN' : 'ខ្មែរ'}</span>
        </button>

        <button onClick={toggleDark} className="icon-btn" title={t('darkMode')} aria-label={t('darkMode')}>
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <Link to="/administrator/settings" title="Settings" className="ml-2 hidden items-center gap-2 rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700 sm:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium">{user?.name}</div>
            <div className="text-xs capitalize text-slate-500 dark:text-slate-400">{user?.role}</div>
          </div>
        </Link>
      </div>
    </header>
  );
}
