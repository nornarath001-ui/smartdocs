import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Upload, Download, Eye, Pencil, Trash2, X, FileText } from 'lucide-react';
import { toast, confirmDanger, confirmAction } from '../alert';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { formatSize, saveBlob, guessType, blobError } from '../utils';
import { useCategories } from '../context/CategoryContext';
import UploadModal from '../components/UploadModal';
import OrgInput from '../components/OrgInput';
import Pagination from '../components/Pagination';

const errMsg = (e) =>
  e.response?.data?.message || Object.values(e.response?.data?.errors || {})[0]?.[0] || 'Error';

/* ---------- Upload / edit modal ---------- */
function FormModal({ doc, onClose, onSaved }) {
  const { t } = useLang();
  const { names: CATEGORIES, quickAdd } = useCategories();
  const [form, setForm] = useState({
    title: doc?.title || '', description: doc?.description || '',
    category: doc?.category || CATEGORIES[0] || '', status: doc?.status || 'published', organization: doc?.organization || '',
  });
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (doc && !(await confirmAction({
      title: t('confirmSave'), text: t('confirmSaveText'), confirmText: t('save'), cancelText: t('cancel'),
    }))) return;
    setBusy(true);
    try {
      if (doc) {
        await api.put(`/documents/${doc.id}`, form);
      } else {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => fd.append(k, v));
        fd.append('file', file);
        await api.post('/documents', fd, {
          onUploadProgress: (p) => setProgress(Math.round((p.loaded * 100) / (p.total || 1))),
        });
      }
      toast.success(t('saved'));
      onSaved();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="card w-full max-w-lg space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{doc ? t('edit') : t('upload')}</h2>
          <button type="button" onClick={onClose} className="icon-btn"><X size={18} /></button>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t('title')}</label>
          <input className="input" value={form.title} onChange={set('title')} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('description')}</label>
          <textarea className="input" rows={3} value={form.description} onChange={set('description')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">{t('category')}</label>
            <div className="flex gap-2">
              <select className="input" value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <button type="button" className="btn-ghost !px-2.5" title={t('newCategory')}
                onClick={async () => { const n = await quickAdd(t); if (n) setForm({ ...form, category: n }); }}><Plus size={16} /></button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('status')}</label>
            <select className="input" value={form.status} onChange={set('status')}>
              <option value="published">{t('published')}</option>
              <option value="draft">{t('draft')}</option>
            </select>
          </div>
        </div>

        <OrgInput value={form.organization} onChange={(v) => setForm({ ...form, organization: v })} />

        {!doc && (
          <div>
            <label className="mb-1 block text-sm font-medium">{t('file')}</label>
            <input type="file" required className="input" onChange={(e) => setFile(e.target.files[0])}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,.csv" />
            {busy && (
              <div className="mt-2 h-2 overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">{t('cancel')}</button>
          <button disabled={busy} className="btn-primary">{t('save')}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Preview modal ---------- */
function PreviewModal({ preview, onClose }) {
  const { t } = useLang();
  const { url, type, doc } = preview;
  const isPdf = type === 'application/pdf';
  const isImg = type.startsWith('image/');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card flex h-[90vh] w-full max-w-5xl flex-col">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="truncate text-lg font-semibold">{doc.title}</h2>
          <button onClick={onClose} className="icon-btn"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-slate-100 dark:bg-slate-900">
          {isPdf && <iframe src={url} title={doc.title} className="h-full w-full" />}
          {isImg && <img src={url} alt={doc.title} className="mx-auto max-h-full" />}
          {!isPdf && !isImg && (
            <div className="flex h-full items-center justify-center p-6 text-center text-slate-500">{t('noPreview')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function Documents() {
  const { t } = useLang();
  const { names: CATEGORIES, colorOf } = useCategories();
  const { canManage } = useAuth();
  const [params] = useSearchParams();
  const q = params.get('q') || '';

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(Number(localStorage.getItem('perPage')) || 10);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [organization, setOrganization] = useState('');
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { doc? }
  const [preview, setPreview] = useState(null);

  useEffect(() => setPage(1), [q]);

  const loadOrgs = useCallback(
    () => api.get('/public/filters').then((r) => setOrgs(r.data.organizations.map((o) => o.name))).catch(() => {}),
    []
  );
  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/documents', { params: { q, category, status, organization, page, per_page: perPage } });
      setRows(data.data);
      setMeta({
        current_page: data.current_page, last_page: data.last_page,
        total: data.total, from: data.from, to: data.to,
      });
      // e.g. the last item of the last page was deleted
      if (data.data.length === 0 && data.current_page > data.last_page && data.last_page > 0) {
        setPage(data.last_page);
      }
    } finally {
      setLoading(false);
    }
  }, [q, category, status, organization, page, perPage]);

  useEffect(() => { load(); }, [load]);

  const download = async (d) => {
    try {
      const res = await api.get(`/documents/${d.id}/download`, { responseType: 'blob' });
      saveBlob(res.data, d.original_name);
    } catch (e) { toast.error(await blobError(e)); }
  };

  const view = async (d) => {
    try {
      const res = await api.get(`/documents/${d.id}/preview`, { responseType: 'blob' });
      const type = (res.data.type && res.data.type !== 'application/octet-stream')
        ? res.data.type : guessType(d.original_name);
      const blob = new Blob([res.data], { type }); // force the right type for the viewer
      setPreview({ doc: d, url: URL.createObjectURL(blob), type });
    } catch (e) { toast.error(await blobError(e)); }
  };

  const closePreview = () => {
    URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const remove = async (d) => {
    if (!(await confirmDanger({ title: t('confirmDelete'), text: d.title, confirmText: t('delete'), cancelText: t('cancel') }))) return;
    try {
      await api.delete(`/documents/${d.id}`);
      toast.success(t('deleted'));
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">{t('documents')}</h1>

        <select className="input !w-auto" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">{t('category')}: {t('all')}</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>

        <select className="input !w-auto" value={organization} onChange={(e) => { setOrganization(e.target.value); setPage(1); }}>
          <option value="">{t('organization')}: {t('all')}</option>
          {orgs.map((o) => <option key={o}>{o}</option>)}
        </select>

        {canManage && (
          <>
            <select className="input !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">{t('status')}: {t('all')}</option>
              <option value="published">{t('published')}</option>
              <option value="draft">{t('draft')}</option>
            </select>
            <button onClick={() => setModal({})} className="btn-primary"><Upload size={16} /> {t('upload')}</button>
          </>
        )}
      </div>

      {q && <p className="text-sm text-slate-500 dark:text-slate-400">“{q}” — {meta.total}</p>}

      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">{t('title')}</th>
              <th className="px-4 py-3">{t('category')}</th>
              <th className="px-4 py-3">{t('organization')}</th>
              <th className="px-4 py-3">{t('size')}</th>
              <th className="px-4 py-3">{t('owner')}</th>
              <th className="px-4 py-3">{t('date')}</th>
              {canManage && <th className="px-4 py-3">{t('status')}</th>}
              <th className="px-4 py-3 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">{t('loading')}</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">{t('noData')}</td></tr>
            )}
            {!loading && rows.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="shrink-0 text-indigo-500" />
                    <div>
                      <div className="font-medium">{d.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{d.original_name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(d.category) }} />{d.category}</span></td>
                <td className="px-4 py-3">{d.organization || <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatSize(d.size)}</td>
                <td className="px-4 py-3">{d.uploader?.name}</td>
                <td className="px-4 py-3 whitespace-nowrap">{new Date(d.created_at).toLocaleDateString()}</td>
                {canManage && (
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      d.status === 'published'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                      {t(d.status)}
                    </span>
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button className="icon-btn" title={t('view')} onClick={() => view(d)}><Eye size={17} /></button>
                    <button className="icon-btn" title={t('download')} onClick={() => download(d)}><Download size={17} /></button>
                    {canManage && (
                      <>
                        <button className="icon-btn" title={t('edit')} onClick={() => setModal({ doc: d })}><Pencil size={17} /></button>
                        <button className="icon-btn !text-red-600" title={t('delete')} onClick={() => remove(d)}><Trash2 size={17} /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={meta.current_page}
        lastPage={meta.last_page}
        total={meta.total}
        from={meta.from}
        to={meta.to}
        perPage={perPage}
        onPage={(p) => { setPage(p); window.scrollTo?.({ top: 0 }); document.querySelector('main')?.scrollTo?.({ top: 0, behavior: 'smooth' }); }}
        onPerPage={(n) => { setPerPage(n); setPage(1); localStorage.setItem('perPage', n); }}
      />

      {modal?.doc && <FormModal doc={modal.doc} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); loadOrgs(); }} />}
      {modal && !modal.doc && <UploadModal onClose={() => setModal(null)} onRefresh={() => { load(); loadOrgs(); }} />}
      {preview && <PreviewModal preview={preview} onClose={closePreview} />}
    </div>
  );
}
