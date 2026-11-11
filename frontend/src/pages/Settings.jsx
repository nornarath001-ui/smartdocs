import { useState } from 'react';
import { User, Lock, SlidersHorizontal, Sun, Moon } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';
import PasswordField from '../components/PasswordField';
import { PER_PAGE_OPTIONS } from '../components/Pagination';
import { toast, fire } from '../alert';

const errMsg = (e) =>
  Object.values(e.response?.data?.errors || {})[0]?.[0] || e.response?.data?.message || 'Error';

function ProfileTab() {
  const { t } = useLang();
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user.name, email: user.email });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put('/me', form);
      setUser(data);
      toast.success(t('profileSaved'));
    } catch (err) {
      fire({ icon: 'error', title: t('profile'), text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
          {form.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <div className="font-semibold">{user.name}</div>
          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium capitalize text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            {t(user.role)}
          </span>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t('name')}</label>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t('email')}</label>
        <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      </div>
      <button disabled={busy} className="btn-primary">{busy ? t('loading') : t('saveChanges')}</button>
    </form>
  );
}

function SecurityTab() {
  const { t } = useLang();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [conf, setConf] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pw !== conf) return fire({ icon: 'error', title: t('passwordMismatch') });
    setBusy(true);
    try {
      await api.put('/me/password', { current_password: cur, password: pw, password_confirmation: conf });
      setCur(''); setPw(''); setConf('');
      fire({ icon: 'success', title: t('security'), text: t('passwordChanged') });
    } catch (err) {
      fire({ icon: 'error', title: t('security'), text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <PasswordField label={t('currentPassword')} value={cur} onChange={setCur} autoComplete="current-password" />
      <PasswordField label={t('newPassword')} value={pw} onChange={setPw} autoComplete="new-password" showStrength />
      <PasswordField label={t('confirmPassword')} value={conf} onChange={setConf} autoComplete="new-password" />
      <button disabled={busy} className="btn-primary">{busy ? t('loading') : t('saveChanges')}</button>
    </form>
  );
}

function PreferencesTab() {
  const { t, lang, toggleLang } = useLang();
  const { dark, toggleDark } = useTheme();
  const [rows, setRows] = useState(Number(localStorage.getItem('perPage')) || 10);

  const choice = (active) =>
    `flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
      active
        ? 'border-indigo-600 bg-indigo-600 text-white'
        : 'border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700'}`;

  return (
    <div className="max-w-md space-y-6">
      <div>
        <div className="mb-2 text-sm font-medium">{t('language')}</div>
        <div className="flex gap-2">
          <button className={choice(lang === 'en')} onClick={() => lang !== 'en' && toggleLang()}>English</button>
          <button className={choice(lang === 'km')} onClick={() => lang !== 'km' && toggleLang()}>ខ្មែរ</button>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">{t('appearance')}</div>
        <div className="flex gap-2">
          <button className={choice(!dark)} onClick={() => dark && toggleDark()}><Sun size={16} /> {t('lightMode')}</button>
          <button className={choice(dark)} onClick={() => !dark && toggleDark()}><Moon size={16} /> {t('darkTheme')}</button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">{t('defaultRows')}</label>
        <select className="input !w-32" value={rows}
          onChange={(e) => { setRows(Number(e.target.value)); localStorage.setItem('perPage', e.target.value); }}>
          {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  );
}

export default function Settings() {
  const { t } = useLang();
  const [tab, setTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: t('profile'), icon: User },
    { id: 'security', label: t('security'), icon: Lock },
    { id: 'preferences', label: t('preferences'), icon: SlidersHorizontal },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('settings')}</h1>

      <div className="card !p-0">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 dark:border-slate-700">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex cursor-pointer items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                tab === id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === 'profile' && <ProfileTab />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'preferences' && <PreferencesTab />}
        </div>
      </div>
    </div>
  );
}
