import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Pencil, Trash2, X, Eye, EyeOff, Wand2, Search } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import Pagination from '../components/Pagination';
import { toast, fire, confirmDanger, escapeHtml } from '../alert';

const ROLES = ['admin', 'manager', 'staff'];
const BADGE = {
  admin: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  manager: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  staff: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

const errMsg = (e) =>
  Object.values(e.response?.data?.errors || {})[0]?.[0] || e.response?.data?.message || 'Error';

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const pick = (set) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
  let pw = pick('ABCDEFGHJKLMNPQRSTUVWXYZ') + pick('abcdefghijkmnpqrstuvwxyz') + pick('23456789') + pick('@#$%!');
  for (let i = 0; i < 8; i++) pw += pick(chars);
  return pw.split('').sort(() => crypto.getRandomValues(new Uint32Array(1))[0] % 2 - 0.5).join('');
}

/* ---------- Create / edit form ---------- */
function UserForm({ user, onClose, onSaved }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: user?.name || '', email: user?.email || '', role: user?.role || 'staff', password: '',
  });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form };
      if (user && !payload.password) delete payload.password;

      if (user) {
        await api.put(`/users/${user.id}`, payload);
        toast.success(t('userSaved'));
      } else {
        await api.post('/users', payload);
        await fire({
          icon: 'success',
          title: t('accountCreated'),
          html: `<p style="margin-bottom:10px">${t('shareCreds')}</p>
            <div style="text-align:left;font-size:14px;background:rgba(100,116,139,.15);padding:12px;border-radius:10px;line-height:1.8">
              <b>Email:</b> ${escapeHtml(form.email)}<br>
              <b>${t('password')}:</b> <code>${escapeHtml(form.password)}</code><br>
              <b>${t('role')}:</b> ${t(form.role)}
            </div>`,
          confirmButtonText: 'OK',
        });
      }
      onSaved();
    } catch (err) {
      fire({ icon: 'error', title: t('save'), text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="card w-full max-w-md space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{user ? t('editUser') : t('newUser')}</h2>
          <button type="button" onClick={onClose} className="icon-btn"><X size={18} /></button>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t('name')}</label>
          <input className="input" value={form.name} onChange={set('name')} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('email')}</label>
          <input type="email" className="input" value={form.email} onChange={set('email')} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('role')}</label>
          <select className="input" value={form.role} onChange={set('role')}>
            {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('password')}</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={show ? 'text' : 'password'} className="input pr-10" value={form.password}
                onChange={set('password')} required={!user} autoComplete="new-password"
                placeholder={user ? t('leaveBlank') : ''}
              />
              <button type="button" onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600">
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <button type="button" className="btn-ghost" title={t('generate')}
              onClick={() => { setForm({ ...form, password: generatePassword() }); setShow(true); }}>
              <Wand2 size={16} /> {t('generate')}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('passwordRule')}</p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">{t('cancel')}</button>
          <button disabled={busy} className="btn-primary">{busy ? t('loading') : t('save')}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Page ---------- */
export default function Users() {
  const { t } = useLang();
  const { user: me } = useAuth();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // {} = new, { user } = edit

  useEffect(() => {
    const id = setTimeout(() => { setQ(search); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users', { params: { q, role, page, per_page: perPage } });
      setRows(data.data);
      setMeta({
        current_page: data.current_page, last_page: data.last_page,
        total: data.total, from: data.from, to: data.to,
      });
      if (data.data.length === 0 && data.last_page > 0 && data.current_page > data.last_page) setPage(data.last_page);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [q, role, page, perPage]);

  useEffect(() => { load(); }, [load]);

  const remove = async (u) => {
    const ok = await confirmDanger({
      title: t('confirmDeleteUser'), text: `${u.name} (${u.email})`,
      confirmText: t('delete'), cancelText: t('cancel'),
    });
    if (!ok) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success(t('userDeleted'));
      load();
    } catch (e) {
      fire({ icon: 'error', title: t('delete'), text: errMsg(e) });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">{t('users')}</h1>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input !w-64 pl-9" placeholder={t('searchUsers')}
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input !w-auto" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">{t('allRoles')}</option>
          {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
        </select>
        <button onClick={() => setModal({})} className="btn-primary"><UserPlus size={16} /> {t('newUser')}</button>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">{t('name')}</th>
              <th className="px-4 py-3">{t('email')}</th>
              <th className="px-4 py-3">{t('role')}</th>
              <th className="px-4 py-3">{t('joined')}</th>
              <th className="px-4 py-3 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">{t('loading')}</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">{t('noUsers')}</td></tr>
            )}
            {!loading && rows.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
                      {u.name?.[0]?.toUpperCase()}
                    </div>
                    <span className="font-medium">{u.name}</span>
                    {u.id === me.id && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        {t('you')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[u.role]}`}>{t(u.role)}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button className="icon-btn" title={t('edit')} onClick={() => setModal({ user: u })}><Pencil size={17} /></button>
                    <button className="icon-btn !text-red-600 disabled:opacity-30" title={t('delete')}
                      disabled={u.id === me.id} onClick={() => remove(u)}><Trash2 size={17} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={meta.current_page} lastPage={meta.last_page} total={meta.total}
        from={meta.from} to={meta.to} perPage={perPage}
        onPage={setPage} onPerPage={(n) => { setPerPage(n); setPage(1); }}
      />

      {modal && (
        <UserForm user={modal.user} onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}
