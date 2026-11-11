import { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Download } from 'lucide-react';
import { useLang } from '../context/LangContext';
import { fmtKey, downloadCsv } from '../utils';

export const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6'];
const AXIS = { stroke: '#94a3b8', fontSize: 12 };
const same = (v) => v;

/* ---------- Time series: bar / line / area ---------- */
export function ChartCard({ id, title, data, period, color = '#6366f1', format = same, className = '', height = 'h-64' }) {
  const { t, lang } = useLang();
  const [type, setType] = useState(() => localStorage.getItem(`chart-${id}`) || 'bar');
  const pick = (v) => { setType(v); localStorage.setItem(`chart-${id}`, v); };

  const rows = (data || []).map((d) => ({ ...d, label: fmtKey(d.key, period, lang) }));
  const total = rows.reduce((s, r) => s + r.total, 0);
  const avg = rows.length ? total / rows.length : 0;

  const axes = [
    <CartesianGrid key="g" strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.3} />,
    <XAxis key="x" dataKey="label" minTickGap={24} {...AXIS} />,
    <YAxis key="y" allowDecimals={false} width={format === same ? 40 : 64} tickFormatter={format} {...AXIS} />,
    <Tooltip key="t" formatter={(v) => [format(v), title]} contentStyle={{ borderRadius: 8 }} />,
  ];

  const exportCsv = () =>
    downloadCsv(`${id}-${period}.csv`, [t('date'), title], (data || []).map((d) => [d.key, d.total]));

  return (
    <div className={`card ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('totalInRange')}: <b className="text-slate-800 dark:text-slate-100">{format(Math.round(total))}</b>
            {' · '}{t('average')}: <b className="text-slate-800 dark:text-slate-100">{format(Math.round(avg))}</b>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-xs dark:border-slate-600">
            {['bar', 'line', 'area'].map((k) => (
              <button key={k} type="button" onClick={() => pick(k)}
                className={`cursor-pointer px-2.5 py-1 transition ${
                  type === k ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                {t(`chart_${k}`)}
              </button>
            ))}
          </div>
          <button type="button" className="icon-btn !h-7 !w-7" title={t('exportCsv')} onClick={exportCsv}>
            <Download size={15} />
          </button>
        </div>
      </div>

      <div className={height}>
        <ResponsiveContainer>
          {type === 'line' ? (
            <LineChart data={rows}>{axes}
              <Line type="monotone" dataKey="total" stroke={color} strokeWidth={2.5} dot={rows.length <= 31} />
            </LineChart>
          ) : type === 'area' ? (
            <AreaChart data={rows}>
              <defs>
                <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              {axes}
              <Area type="monotone" dataKey="total" stroke={color} strokeWidth={2} fill={`url(#grad-${id})`} />
            </AreaChart>
          ) : (
            <BarChart data={rows}>{axes}
              <Bar dataKey="total" fill={color} radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------- Pie / donut ---------- */
export function PieCard({ title, data, nameFn = same, colorMap = {}, className = '', height = 'h-64' }) {
  const rows = (data || []).map((d) => ({ ...d, label: nameFn(d.name), value: Number(d.value) }));

  return (
    <div className={`card ${className}`}>
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className={height}>
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">—</div>
        ) : (
          <ResponsiveContainer>
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="label" innerRadius={45} outerRadius={75}>
                {rows.map((r, i) => <Cell key={r.name} fill={colorMap[r.name] || COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/* ---------- Horizontal ranking ---------- */
export function RankCard({ title, data, color = '#10b981', className = '', height = 'h-56' }) {
  return (
    <div className={`card ${className}`}>
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className={height}>
        {!data || data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">—</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.3} />
              <XAxis type="number" allowDecimals={false} {...AXIS} />
              <YAxis type="category" dataKey="name" width={100} {...AXIS} />
              <Tooltip />
              <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
