import { useEffect, useRef, useState } from 'react';
import { Plus, X, UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, Trash2, CopyX } from 'lucide-react';
import { toast, fire } from '../alert';
import api from '../api/axios';
import { useLang } from '../context/LangContext';
import { formatSize } from '../utils';
import OrgInput from './OrgInput';
import { useCategories } from '../context/CategoryContext';

const ALLOWED = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'txt', 'csv'];
const MAX_SIZE = 100 * 1024 * 1024;
const CONCURRENCY = 3;

const baseName = (n) => n.replace(/\.[^.]+$/, '');
const errMsg = (e) =>
  Object.values(e.response?.data?.errors || {})[0]?.[0] || e.response?.data?.message || 'Upload failed';

async function sha256(file) {
  if (!window.crypto?.subtle) return null; // server still checks
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function UploadModal({ onClose, onRefresh }) {
  const { t } = useLang();
  const { names: CATEGORIES, quickAdd } = useCategories();
  const inputRef = useRef(null);
  const itemsRef = useRef([]);
  const [items, setItems] = useState([]); // state: checking | pending | duplicate | uploading | done | error
  const [shared, setShared] = useState({ description: '', category: '', organization: '', status: 'published' });
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { itemsRef.current = items; }, [items]);

  const patch = (id, data) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...data } : i)));

  const addFiles = async (fileList) => {
    const incoming = Array.from(fileList || []);
    const rejected = [];
    const fresh = [];
    const known = new Set(itemsRef.current.map((i) => i.id));

    incoming.forEach((file) => {
      const ext = file.name.split('.').pop().toLowerCase();
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (!ALLOWED.includes(ext) || file.size > MAX_SIZE) return rejected.push(file.name);
      if (known.has(key)) return;
      known.add(key);
      fresh.push({ id: key, file, title: baseName(file.name), progress: 0, state: 'checking', error: '', hash: null });
    });

    if (rejected.length) {
      toast.error(`${t('rejected')}: ${rejected.slice(0, 3).join(', ')}${rejected.length > 3 ? '…' : ''}`);
    }
    if (!fresh.length) return;

    const freshIds = new Set(fresh.map((i) => i.id));
    setItems((list) => [...list, ...fresh]);

    // 1) hash each file, kept in a separate map (never mutate list items)
    const hashOf = {};
    for (const item of fresh) hashOf[item.id] = await sha256(item.file).catch(() => null);

    // 2) ask the server which hashes already exist (not deleted)
    let existing = {};
    const hashes = [...new Set(Object.values(hashOf).filter(Boolean))];
    if (hashes.length) {
      try {
        const { data } = await api.post('/documents/check-duplicates', { hashes });
        existing = Array.isArray(data.duplicates) ? {} : (data.duplicates || {});
      } catch { /* the server re-checks on upload */ }
    }

    // 3) compare only with files that were in the list BEFORE this selection
    const seen = new Set(
      itemsRef.current
        .filter((i) => !freshIds.has(i.id) && i.hash && i.state !== 'duplicate')
        .map((i) => i.hash)
    );
    const dupNames = [];

    fresh.forEach((item) => {
      const hash = hashOf[item.id];
      let state = 'pending';
      let error = '';

      if (hash && Object.prototype.hasOwnProperty.call(existing, hash)) {
        state = 'duplicate';
        error = `${t('dupExists')} "${existing[hash]}"`;
      } else if (hash && seen.has(hash)) {
        state = 'duplicate';
        error = t('dupInBatch');
      } else if (hash) {
        seen.add(hash); // first copy stays, later copies are duplicates
      }

      if (state === 'duplicate') dupNames.push(`${item.file.name} — ${error}`);
      patch(item.id, { hash, state, error });
    });

    if (dupNames.length) {
      fire({
        icon: 'warning',
        title: t('dupTitle'),
        html: `<p style="margin-bottom:8px">${t('dupText')}</p><ul style="text-align:left;font-size:14px;max-height:200px;overflow:auto">${
          dupNames.map((n) => `<li>• ${n.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`).join('')
        }</ul>`,
      });
    }
  };

  const uploadOne = async (item) => {
    patch(item.id, { state: 'uploading', progress: 0, error: '' });
    const fd = new FormData();
    fd.append('title', item.title.trim() || baseName(item.file.name));
    fd.append('description', shared.description);
    fd.append('category', shared.category || CATEGORIES[0] || '');
    fd.append('status', shared.status);
    if (shared.organization) fd.append('organization', shared.organization);
    fd.append('file', item.file);

    try {
      await api.post('/documents', fd, {
        onUploadProgress: (p) =>
          patch(item.id, { progress: Math.round((p.loaded * 100) / (p.total || item.file.size || 1)) }),
      });
      patch(item.id, { state: 'done', progress: 100 });
      return true;
    } catch (err) {
      if (err.response?.status === 409) {
        patch(item.id, { state: 'duplicate', error: errMsg(err), progress: 0 });
      } else {
        patch(item.id, { state: 'error', error: errMsg(err) });
      }
      return false;
    }
  };

  const startUpload = async () => {
    const queue = items.filter((i) => i.state === 'pending' || i.state === 'error');
    if (!queue.length) return;

    setBusy(true);
    let index = 0;
    let ok = 0;
    const worker = async () => {
      while (index < queue.length) {
        const item = queue[index++];
        if (await uploadOne(item)) ok++;
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    setBusy(false);

    if (ok > 0) onRefresh();

    const left = itemsRef.current.filter((i) => i.state === 'duplicate' || i.state === 'error').length;
    if (ok === queue.length && left === 0) {
      toast.success(`${t('saved')} (${ok})`);
      onClose();
    } else if (ok < queue.length) {
      toast.error(`${queue.length - ok} ${t('failedFiles')}`);
    } else if (ok > 0) {
      toast.success(`${t('saved')} (${ok})`);
    }
  };

  const remove = (id) => setItems((list) => list.filter((i) => i.id !== id));
  const clearAll = () => setItems((list) => list.filter((i) => i.state === 'uploading'));
  const removeDuplicates = () => setItems((list) => list.filter((i) => i.state !== 'duplicate'));

  const hasFailed = items.some((i) => i.state === 'error');
  const checking = items.some((i) => i.state === 'checking');
  const dupCount = items.filter((i) => i.state === 'duplicate').length;
  const waiting = items.filter((i) => i.state === 'pending' || i.state === 'error').length;
  const totalSize = items.reduce((s, i) => s + i.file.size, 0);
  const setField = (k) => (e) => setShared({ ...shared, [k]: e.target.value });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card flex max-h-[92vh] w-full max-w-2xl flex-col">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('upload')}</h2>
          <button type="button" onClick={onClose} disabled={busy} className="icon-btn"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
              drag
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                : 'border-slate-300 hover:border-indigo-400 dark:border-slate-600'
            }`}
          >
            <UploadCloud size={36} className="mb-2 text-indigo-500" />
            <p className="font-medium">{t('dropHere')}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('orBrowse')}</p>
            <p className="mt-1 text-xs text-slate-400">PDF, Word, Excel, PowerPoint, JPG, PNG, TXT, CSV · max 100 MB</p>
            <input
              ref={inputRef} type="file" multiple hidden
              accept={ALLOWED.map((e) => `.${e}`).join(',')}
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{t('category')}</label>
              <div className="flex gap-2">
                <select className="input" value={shared.category || CATEGORIES[0] || ''} onChange={setField('category')} disabled={busy}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <button type="button" className="btn-ghost !px-2.5" disabled={busy} title={t('newCategory')}
                  onClick={async () => { const n = await quickAdd(t); if (n) setShared({ ...shared, category: n }); }}><Plus size={16} /></button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('status')}</label>
              <select className="input" value={shared.status} onChange={setField('status')} disabled={busy}>
                <option value="published">{t('published')}</option>
                <option value="draft">{t('draft')}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('description')}</label>
            <textarea className="input" rows={2} value={shared.description}
              onChange={setField('description')} disabled={busy} />
          </div>

          <OrgInput value={shared.organization} disabled={busy}
            onChange={(v) => setShared({ ...shared, organization: v })} />

          {items.length > 0 && (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">
                  {items.length} {t('filesSelected')} · {formatSize(totalSize)}
                </span>
                <span className="flex gap-3">
                  {dupCount > 0 && (
                    <button type="button" onClick={removeDuplicates} disabled={busy}
                      className="cursor-pointer text-amber-600 hover:underline disabled:opacity-50">
                      {t('delete')} {t('duplicate')} ({dupCount})
                    </button>
                  )}
                  <button type="button" onClick={clearAll} disabled={busy}
                    className="cursor-pointer text-red-600 hover:underline disabled:opacity-50">
                    {t('clearAll')}
                  </button>
                </span>
              </div>

              <ul className="space-y-2">
                {items.map((i) => (
                  <li key={i.id} className={`rounded-lg border p-2 ${
                    i.state === 'duplicate'
                      ? 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30'
                      : 'border-slate-200 dark:border-slate-700'}`}>
                    <div className="flex items-center gap-2">
                      <FileText size={18} className="shrink-0 text-indigo-500" />
                      <input
                        className="input !py-1" value={i.title}
                        onChange={(e) => patch(i.id, { title: e.target.value })}
                        disabled={busy || i.state === 'done' || i.state === 'duplicate'}
                      />
                      <span className="hidden shrink-0 text-xs text-slate-500 sm:block">{formatSize(i.file.size)}</span>
                      {(i.state === 'uploading' || i.state === 'checking') && <Loader2 size={18} className="shrink-0 animate-spin text-indigo-500" />}
                      {i.state === 'done' && <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />}
                      {i.state === 'error' && <AlertCircle size={18} className="shrink-0 text-red-500" />}
                      {i.state === 'duplicate' && <CopyX size={18} className="shrink-0 text-amber-600" />}
                      {['pending', 'error', 'duplicate'].includes(i.state) && (
                        <button type="button" className="icon-btn !h-8 !w-8" disabled={busy}
                          onClick={() => remove(i.id)}><Trash2 size={16} /></button>
                      )}
                    </div>
                    <div className="mt-1 truncate pl-7 text-xs text-slate-500 dark:text-slate-400">
                      {i.file.name}{i.state === 'checking' && ` · ${t('checking')}`}
                    </div>

                    {(i.state === 'uploading' || i.state === 'done') && (
                      <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                        <div className={`h-full transition-all ${i.state === 'done' ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                          style={{ width: `${i.progress}%` }} />
                      </div>
                    )}
                    {i.state === 'duplicate' && (
                      <p className="mt-1 pl-7 text-xs font-medium text-amber-700 dark:text-amber-400">
                        {t('duplicate')}: {i.error}
                      </p>
                    )}
                    {i.state === 'error' && <p className="mt-1 pl-7 text-xs text-red-600">{i.error}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">{t('cancel')}</button>
          <button type="button" onClick={startUpload}
            disabled={busy || checking || waiting === 0} className="btn-primary">
            {busy
              ? <><Loader2 size={16} className="animate-spin" /> {t('uploading')}</>
              : checking
                ? <><Loader2 size={16} className="animate-spin" /> {t('checking')}</>
                : <><UploadCloud size={16} /> {hasFailed ? t('retryFailed') : t('uploadAll')}{waiting > 0 && ` (${waiting})`}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
