import { CalendarRange } from 'lucide-react';
import { useLang } from '../context/LangContext';
import { ymd } from '../utils';

export const PRESETS = { day: [7, 14, 30, 90], month: [3, 6, 12, 24], year: [3, 5, 10] };
export const DEFAULT_LAST = { day: 30, month: 12, year: 5 };

// value = { period, last: number | 'custom', from, to }  ->  API params
export function toParams(v) {
  if (v.last === 'custom' && v.from && v.to) return { period: v.period, from: v.from, to: v.to };
  return { period: v.period, last: v.last === 'custom' ? DEFAULT_LAST[v.period] : v.last };
}

export default function PeriodBar({ value, onChange }) {
  const { t } = useLang();
  const { period, last, from, to } = value;
  const custom = last === 'custom';

  const setPeriod = (p) => onChange({ ...value, period: p, last: DEFAULT_LAST[p] });
  const setLast = (v) => {
    if (v !== 'custom') return onChange({ ...value, last: Number(v) });
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    onChange({ ...value, last: 'custom', from: from || ymd(start), to: to || ymd(end) });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarRange size={18} className="text-slate-400" />

      <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
        {['day', 'month', 'year'].map((u) => (
          <button key={u} type="button" onClick={() => setPeriod(u)}
            className={`cursor-pointer px-3 py-1.5 text-sm font-medium transition ${
              period === u
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
            {t(`p_${u}`)}
          </button>
        ))}
      </div>

      <select className="input !w-auto !py-1.5" value={last} onChange={(e) => setLast(e.target.value)}>
        {PRESETS[period].map((n) => (
          <option key={n} value={n}>{t('last')} {n} {t(`u_${period}`)}</option>
        ))}
        <option value="custom">{t('custom')}</option>
      </select>

      {custom && (
        <>
          <label className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            {t('from')}
            <input type="date" className="input !w-auto !py-1.5" value={from || ''} max={to || undefined}
              onChange={(e) => onChange({ ...value, from: e.target.value })} />
          </label>
          <label className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            {t('to')}
            <input type="date" className="input !w-auto !py-1.5" value={to || ''} min={from || undefined}
              onChange={(e) => onChange({ ...value, to: e.target.value })} />
          </label>
        </>
      )}
    </div>
  );
}
