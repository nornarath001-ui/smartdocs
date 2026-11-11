import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useLang } from '../context/LangContext';

export function strengthOf(p = '') {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
}

const LABELS = ['', 'weak', 'fair', 'good', 'strong'];
const COLORS = ['bg-slate-300', 'bg-red-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500'];

export default function PasswordField({ label, value, onChange, autoComplete, showStrength, required = true }) {
  const { t } = useLang();
  const [show, setShow] = useState(false);
  const score = strengthOf(value);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium dark:text-slate-200">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'} className="input pr-10" value={value}
          onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required={required}
        />
        <button type="button" onClick={() => setShow((v) => !v)} tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600">
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>

      {showStrength && value && (
        <div className="mt-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className={`h-1.5 flex-1 rounded ${n <= score ? COLORS[score] : 'bg-slate-200 dark:bg-slate-700'}`} />
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t(LABELS[score] || 'weak')} · {t('passwordRule')}
          </p>
        </div>
      )}
    </div>
  );
}
