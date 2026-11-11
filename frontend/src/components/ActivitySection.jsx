import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import Pagination from './Pagination';
import { ChartCard, PieCard } from './Charts';
import { toast } from '../alert';

const ACTIONS = ['login', 'logout', 'upload', 'download', 'update_document', 'delete_document',
  'create_user', 'update_user', 'delete_user', 'create_category', 'update_category', 'delete_category', 'change_password', 'update_profile', 'translate'];

const badge = (a) =>
  a.startsWith('delete') ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  : a === 'upload' || a === 'create_user' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
  : a === 'download' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';

export default function ActivitySection({ params }) {
  const { t } = useLang();
  const { user } = useAuth();
  const admin = user.role === 'admin';
  const qs = new URLSearchParams(params).toString();

  const [sum, setSum] = useState(null);
  const [users, setUsers] = useState([]);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/activities/summary', { params })
      .then((r) => setSum(r.data))
      .catch((e) => toast.error(e.response?.data?.message || t('rangeError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  useEffect(() => {
    if (admin) api.get('/users', { params: { per_page: 50 } }).then((r) => setUsers(r.data.data));
  }, [admin]);

  useEffect(() => { setPage(1); }, [qs]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/activities', {
        params: { ...params, page, per_page: perPage, user_id: userId, action },
      });
      setRows(data.data);
      setMeta({ current_page: data.current_page, last_page: data.last_page, total: data.total, from: data.from, to: data.to });
    } catch { /* invalid range already reported by the summary */ }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, page, perPage, userId, action]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {!admin && <p className="text-sm text-slate-500 dark:text-slate-400">{t('ownOnly')}</p>}

      {sum && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard id="activity" title={t('activityChart')} data={sum.series} period={sum.period.unit}
            className="lg:col-span-2" height="h-56" />
          <PieCard title={t('actionsBreakdown')} data={sum.by_action} nameFn={(n) => t(`act_${n}`)} height="h-56" />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {admin && (
          <select className="input !w-auto" value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1); }}>
            <option value="">{t('allUsers')}</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <select className="input !w-auto" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">{t('allActions')}</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{t(`act_${a}`)}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">{t('user')}</th>
              <th className="px-4 py-3">{t('action')}</th>
              <th className="px-4 py-3">{t('description')}</th>
              <th className="px-4 py-3">{t('time')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">{t('loading')}</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">{t('noActivity')}</td></tr>}
            {!loading && rows.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-2.5 font-medium">{a.user?.name || '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge(a.action)}`}>{t(`act_${a.action}`)}</span>
                </td>
                <td className="max-w-xs truncate px-4 py-2.5 text-slate-600 dark:text-slate-300">{a.description || '—'}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-500 dark:text-slate-400">{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={meta.current_page} lastPage={meta.last_page} total={meta.total} from={meta.from} to={meta.to}
        perPage={perPage} onPage={setPage} onPerPage={(n) => { setPerPage(n); setPage(1); }} />
    </div>
  );
}
