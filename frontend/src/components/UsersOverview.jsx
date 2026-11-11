import { useEffect, useState } from 'react';
import { Users, UserCheck, UserPlus } from 'lucide-react';
import api from '../api/axios';
import { useLang } from '../context/LangContext';
import { ChartCard, PieCard, RankCard } from './Charts';
import { toast } from '../alert';

const ROLE_COLOR = { admin: '#e11d48', manager: '#6366f1', staff: '#64748b' };

function Mini({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${color}`}><Icon size={20} /></div>
      <div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      </div>
    </div>
  );
}

export default function UsersOverview({ params }) {
  const { t } = useLang();
  const [d, setD] = useState(null);
  const qs = new URLSearchParams(params).toString();

  useEffect(() => {
    api.get('/dashboard/users', { params })
      .then((r) => setD(r.data))
      .catch((e) => toast.error(e.response?.data?.message || t('rangeError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  if (!d) return <p className="text-sm text-slate-500">{t('loading')}</p>;

  const unit = d.period.unit;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Mini icon={Users} label={t('totalUsers')} value={d.total_users} color="bg-indigo-600" />
        <Mini icon={UserPlus} label={`${t('newUsers')} (${t('inPeriod')})`} value={d.new_in_range} color="bg-cyan-600" />
        <Mini icon={UserCheck} label={`${t('activeUsers')} (${t('inPeriod')})`} value={d.active_in_range} color="bg-emerald-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard id="new-users" title={t('newUsers')} data={d.new_users} period={unit} color="#06b6d4" />
        <ChartCard id="logins" title={t('loginsChart')} data={d.logins} period={unit} color="#8b5cf6" />
        <PieCard title={t('usersByRole')} data={d.by_role} nameFn={t} colorMap={ROLE_COLOR} />
        <div className="grid gap-4">
          <RankCard title={t('topUploaders')} data={d.top_uploaders} color="#10b981" height="h-40" />
          <RankCard title={t('topActive')} data={d.top_active} color="#f59e0b" height="h-40" />
        </div>
      </div>
    </div>
  );
}
