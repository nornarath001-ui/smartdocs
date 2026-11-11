import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck, ArrowLeft } from 'lucide-react';
import api from '../api/axios';
import AuthShell from '../components/AuthShell';
import { useLang } from '../context/LangContext';
import { toast } from '../alert';

export default function ForgotPassword() {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/forgot-password', { email });
      setSent(true);
    } catch (err) {
      toast.error(
        err.response?.status === 429
          ? 'Too many requests. Please wait a minute.'
          : err.response?.data?.errors?.email?.[0] || err.response?.data?.message || 'Error'
      );
    } finally {
      setBusy(false);
    }
  };

  const back = (
    <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400">
      <ArrowLeft size={15} /> {t('backToLogin')}
    </Link>
  );

  if (sent) {
    return (
      <AuthShell title={t('checkEmail')}>
        <div className="flex justify-center text-emerald-500"><MailCheck size={44} /></div>
        <p className="text-center text-sm text-slate-600 dark:text-slate-300">{t('checkEmailText')}</p>
        {back}
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('forgotTitle')} subtitle={t('forgotText')}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">{t('email')}</label>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <button disabled={busy} className="btn-primary w-full justify-center">
          {busy ? t('loading') : t('sendLink')}
        </button>
      </form>
      {back}
    </AuthShell>
  );
}
