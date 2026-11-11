import { useLang } from '../context/LangContext';

export default function Footer() {
  const { t } = useLang();
  return (
    <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
      © {new Date().getFullYear()} {t('appName')}. {t('footer')}
    </footer>
  );
}
