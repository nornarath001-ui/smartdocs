import { Languages, Moon, Sun } from 'lucide-react';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';
import Logo from './Logo';

export default function AuthShell({ title, subtitle, children }) {
  const { t, lang, toggleLang } = useLang();
  const { dark, toggleDark } = useTheme();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-900">
      <div className="absolute right-4 top-4 flex gap-1">
        <button onClick={toggleLang} className="btn-ghost !px-2.5 dark:text-slate-200">
          <Languages size={16} /> {lang === 'en' ? 'EN' : 'ខ្មែរ'}
        </button>
        <button onClick={toggleDark} className="icon-btn" title={t('darkMode')}>
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <div className="card w-full max-w-sm space-y-4 p-6 text-slate-800 dark:text-slate-100">
        <div className="text-center">
          <Logo />
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
