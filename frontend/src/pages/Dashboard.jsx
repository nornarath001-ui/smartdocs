import { useEffect, useMemo, useState } from 'react';
import { Files, CheckCircle2, Download, HardDrive, Users, Activity } from 'lucide-react';
import api from '../api/axios';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { formatSize } from '../utils';
import { toast } from '../alert';
import Collapsible from '../components/Collapsible';
import UsersOverview from '../components/UsersOverview';
import ActivitySection from '../components/ActivitySection';
import PeriodBar, { toParams } from '../components/PeriodBar';
import { ChartCard, PieCard, RankCard } from '../components/Charts';

function Stat({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white ${color}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
        {sub && <div className="truncate text-xs font-medium text-indigo-600 dark:text-indigo-400">{sub}</div>}
      </div>
    </div>
  );
}

const STATUS_COLOR = { published: '#10b981', draft: '#f59e0b' };
const DEFAULT_PERIOD = { period: 'month', last: 12, from: '', to: '' };

export default function Dashboard() {
  const { t } = useLang();
  const { user } = useAuth();
  const manage = ['admin', 'manager'].includes(user.role);

  const [pf, setPf] = useState(() => {
    try { return { ...DEFAULT_PERIOD, ...JSON.parse(localStorage.getItem('dash-period')) }; }
    catch { return DEFAULT_PERIOD; }
  });
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);

  const params = useMemo(() => toParams(pf), [pf]);
  const qs = new URLSearchParams(params).toString();

  useEffect(() => { localStorage.setItem('dash-period', JSON.stringify(pf)); }, [pf]);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    api.get('/dashboard/stats', { params })
      .then((r) => alive && setS(r.data))
      .catch((e) => toast.error(e.response?.data?.message || t('rangeError')))
      .finally(() => alive && setBusy(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  if (!s) return <p className="text-slate-500">{t('loading')}</p>;

  const c = s.cards;
  const unit = s.period.unit;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('welcome')}, {user.name}</h1>
        <PeriodBar value={pf} onChange={setPf} />
      </div>

      <div className={`space-y-6 transition-opacity ${busy ? 'opacity-60' : ''}`}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Files} label={t('totalDocs')} value={c.total} color="bg-indigo-600"
            sub={`+${c.uploads_in_range} ${t('inPeriod')}`} />
          <Stat icon={CheckCircle2} label={t('published')} value={c.published} color="bg-emerald-600"
            sub={manage ? `${t('draft')}: ${c.draft}` : null} />
          <Stat icon={Download} label={t('downloads')} value={c.downloads} color="bg-amber-500"
            sub={`+${c.downloads_in_range} ${t('inPeriod')}`} />
          <Stat icon={HardDrive} label={t('storage')} value={formatSize(c.storage)} color="bg-cyan-600"
            sub={`+${formatSize(c.storage_in_range)} ${t('inPeriod')}`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard id="uploads" title={t('uploadsChart')} data={s.uploads} period={unit}
            className="lg:col-span-2" />
          <PieCard title={t('byCategory')} data={s.by_category} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard id="downloads" title={t('downloadsChart')} data={s.downloads} period={unit}
            color="#f59e0b" />
          <ChartCard id="storage" title={t('storageAdded')} data={s.storage_added} period={unit}
            color="#06b6d4" format={formatSize} />
          {manage
            ? <PieCard title={t('statusChart')} data={s.by_status} nameFn={t} colorMap={STATUS_COLOR} />
            : <RankCard title={t('topDownloaded')} high data={s.top_downloaded.map((d) => ({ name: d.title, value: d.download_count }))} height="h-64" />}
        </div>

        {manage && s.top_downloaded.length > 0 && (
          <RankCard title={t('topDownloaded')} color="#f59e0b" height="h-56"
            data={s.top_downloaded.map((d) => ({ name: d.title, value: d.download_count }))} />
        )}

        <div className="card">
          <h2 className="mb-3 font-semibold">{t('recent')}</h2>
          {s.recent.length === 0 ? (
            <p className="text-sm text-slate-500">{t('noData')}</p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {s.recent.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="font-medium">{d.title}</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {d.category} · {formatSize(d.size)} · {new Date(d.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Drop-down bars follow the same period */}
      <div className="space-y-3">
        {user.role === 'admin' && (
          <Collapsible id="users" title={t('usersOverview')} icon={Users}>
            <UsersOverview params={params} />
          </Collapsible>
        )}
        <Collapsible id="activity" title={t('activityLog')} icon={Activity}>
          <ActivitySection params={params} />
        </Collapsible>
      </div>
    </div>
  );
}
