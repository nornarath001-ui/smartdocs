import { Languages as TranslateIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, Settings, Tags, LogOut } from 'lucide-react';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { toast, confirmAction } from '../alert';
import Logo from './Logo';

export default function Sidebar({ open, setOpen }) {
  const { t } = useLang();
  const { logout, user } = useAuth();

  const items = [
    { to: '/administrator', label: t('dashboard'), icon: LayoutDashboard, end: true },
    { to: '/administrator/documents', label: t('documents'), icon: FileText },
  ];
  if (user?.role === 'admin') items.push({ to: '/administrator/users', label: t('users'), icon: Users });

  if (['admin', 'manager'].includes(user?.role)) items.push({ to: '/administrator/categories', label: t('categories'), icon: Tags });
  items.push({ to: '/administrator/translate', label: t('translate'), icon: TranslateIcon });
  items.push({ to: '/administrator/settings', label: t('settings'), icon: Settings });

  const doLogout = async () => {
    const ok = await confirmAction({
      title: t('confirmLogout'), text: t('confirmLogoutText'),
      confirmText: t('logout'), cancelText: t('cancel'),
    });
    if (!ok) return;
    await logout();
    toast.success(t('loggedOut'));
  };

  const link = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
      isActive
        ? 'bg-indigo-600 text-white'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
    } ${open ? '' : 'md:justify-center'}`;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-700 dark:bg-slate-800 md:static ${
          open ? 'w-64 translate-x-0' : '-translate-x-full md:w-20 md:translate-x-0'
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-700 m-auto">
          <Logo />
          {open && <span className="text-lg font-bold">{t('appName')}</span>}
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={link} title={label}
              onClick={() => window.innerWidth < 768 && setOpen(false)}>
              <Icon size={20} className="shrink-0" />
              {open && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3 dark:border-slate-700">
          <button onClick={doLogout} title={t('logout')}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 ${open ? '' : 'md:justify-center'}`}>
            <LogOut size={20} className="shrink-0" />
            {open && <span>{t('logout')}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
