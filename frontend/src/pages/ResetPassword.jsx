import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/axios';
import AuthShell from '../components/AuthShell';
import PasswordField from '../components/PasswordField';
import { useLang } from '../context/LangContext';
import { fire } from '../alert';

export default function ResetPassword() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const email = params.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const back = (
    <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400">
      <ArrowLeft size={15} /> {t('backToLogin')}
    </Link>
  );

  if (!token || !email) {
    return (
      <AuthShell title={t('resetTitle')}>
        <p className="text-center text-sm text-red-600">{t('invalidLink')}</p>
        <Link to="/forgot-password" className="btn-primary w-full justify-center">{t('sendLink')}</Link>
        {back}
      </AuthShell>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      return fire({ icon: 'error', title: t('passwordMismatch') });
    }
    setBusy(true);
    try {
      await api.post('/reset-password', { token, email, password, password_confirmation: confirm });
      await fire({ icon: 'success', title: t('resetDone'), text: t('resetDoneText'), confirmButtonText: t('login') });
      navigate('/login', { replace: true });
    } catch (err) {
      const d = err.response?.data;
      fire({ icon: 'error', title: t('resetButton'), text: Object.values(d?.errors || {})[0]?.[0] || d?.message || 'Error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t('resetTitle')} subtitle={`${t('resetText')} (${email})`}>
      <form onSubmit={submit} className="space-y-4">
        <PasswordField label={t('newPassword')} value={password} onChange={setPassword}
          autoComplete="new-password" showStrength />
        <PasswordField label={t('confirmPassword')} value={confirm} onChange={setConfirm}
          autoComplete="new-password" />
        <button disabled={busy} className="btn-primary w-full justify-center">
          {busy ? t('loading') : t('resetButton')}
        </button>
      </form>
      {back}
    </AuthShell>
  );
}
