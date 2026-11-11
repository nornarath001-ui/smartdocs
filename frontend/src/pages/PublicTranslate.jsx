import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight, Copy, Download, FileText, Loader2, ShieldCheck, Trash2, UploadCloud,
  CheckCircle2, AlertCircle, RotateCcw, Type, Files, Globe,
} from 'lucide-react';
import api from '../api/axios';
import { useLang } from '../context/LangContext';
import { formatSize, saveBlob, blobError } from '../utils';
import PublicLayout from '../components/PublicLayout';
import { toast } from '../alert';

const ALLOWED = ['txt', 'docx', 'pdf'];
const MAX = 10 * 1024 * 1024;
const extOf = (n) => n.split('.').pop().toLowerCase();
const baseName = (n) => n.replace(/\.[^.]+$/, '');
const errMsg = (e) =>
  Object.values(e.response?.data?.errors || {})[0]?.[0] || e.response?.data?.message || 'Error';

export default function PublicTranslate() {
  const { t, lang } = useLang();
  const fileRef = useRef(null);
  const txtRef = useRef(null);

  const [cfg, setCfg] = useState(null);
  const [tab, setTab] = useState('text');
  const [source, setSource] = useState('km');
  const [target, setTarget] = useState('en');

  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const [items, setItems] = useState([]); // pending | working | done | error
  const [drag, setDrag] = useState(false);
  const [running, setRunning] = useState(false);

  const load = () => api.get('/public/translate/config').then((r) => setCfg(r.data)).catch(() => {});
  useEffect(() => {
    load();
    const id = setInterval(() => { if (!cfg?.ready) load(); }, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.ready]);

  const names = useMemo(() => {
    try { return new Intl.DisplayNames([lang === 'km' ? 'km' : 'en'], { type: 'language' }); } catch { return null; }
  }, [lang]);
  const label = (l) => { try { return names?.of(l.code) || l.name; } catch { return l.name; } };
  const langs = cfg?.languages || [];
  const max = cfg?.max_chars || 5000;
  const off = cfg && !cfg.enabled;
  const loading = cfg && cfg.enabled && !cfg.ready;

  const swap = () => { setSource(target); setTarget(source); setText(result || text); setResult(''); };

  /* ---- text ---- */
  const runText = async () => {
    if (!text.trim()) return toast.error(t('nothingToTranslate'));
    setBusy(true);
    try {
      const { data } = await api.post('/public/translate', { text, source, target }, { timeout: 150000 });
      setResult(data.translation);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const openTxt = (f) => {
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => setText(String(rd.result).slice(0, max));
    rd.readAsText(f, 'UTF-8');
  };

  /* ---- files ---- */
  const patch = (id, d) => setItems((l) => l.map((i) => (i.id === id ? { ...i, ...d } : i)));

  const addFiles = (list) => {
    const bad = []; const fresh = [];
    Array.from(list || []).forEach((file) => {
      const id = `${file.name}-${file.size}-${file.lastModified}`;
      if (!ALLOWED.includes(extOf(file.name))) return bad.push(`${file.name}: ${t('wrongType')}`);
      if (file.size > MAX) return bad.push(`${file.name}: ${t('tooBigTr')}`);
      if (items.some((i) => i.id === id) || fresh.some((i) => i.id === id)) return;
      fresh.push({ id, file, state: 'pending', blob: null, error: '' });
    });
    if (bad.length) toast.error(bad.slice(0, 2).join(' · '));
    if (fresh.length) setItems((l) => [...l, ...fresh]);
  };

  const outName = (i) => `${baseName(i.file.name)}.${target}.${extOf(i.file.name) === 'txt' ? 'txt' : 'docx'}`;

  const translateOne = async (item) => {
    patch(item.id, { state: 'working', error: '' });
    const fd = new FormData();
    fd.append('file', item.file); fd.append('source', source); fd.append('target', target);
    try {
      const res = await api.post('/public/translate/file', fd, { responseType: 'blob', timeout: 300000 });
      patch(item.id, { state: 'done', blob: res.data });
    } catch (e) {
      patch(item.id, { state: 'error', error: e.response?.status === 429 ? t('tooMany') : await blobError(e) });
    }
  };

  const runAll = async () => {
    const queue = items.filter((i) => i.state === 'pending' || i.state === 'error');
    if (!queue.length) return;
    setRunning(true);
    for (const it of queue) await translateOne(it); // one at a time keeps the server light
    setRunning(false);
  };

  const waiting = items.filter((i) => i.state === 'pending' || i.state === 'error').length;
  const tabBtn = (id) =>
    `flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
      tab === id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`;

  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><Globe className="text-indigo-500" /> {t('translateTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('translateSubtitle')}</p>
        </div>

        {off && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">{t('translatorOff')}</div>}
        {loading && (
          <div className="flex items-center gap-2 rounded-lg bg-indigo-50 p-3 text-sm dark:bg-indigo-900/30">
            <Loader2 size={16} className="animate-spin" /> {t('translatorLoading')}
          </div>
        )}

        <div className="card flex gap-1 !p-1">
          <button className={tabBtn('text')} onClick={() => setTab('text')}><Type size={16} /> {t('tabText')}</button>
          <button className={tabBtn('file')} onClick={() => setTab('file')}><Files size={16} /> {t('tabFile')}</button>
        </div>

        <div className="card space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-40 flex-1">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('sourceLang')}</span>
              <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
                {langs.map((l) => <option key={l.code} value={l.code}>{label(l)}</option>)}
              </select>
            </label>
            <button type="button" onClick={swap} className="icon-btn mb-0.5" title={t('swapLang')} aria-label={t('swapLang')}>
              <ArrowLeftRight size={18} />
            </button>
            <label className="min-w-40 flex-1">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('targetLang')}</span>
              <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
                {langs.filter((l) => l.code !== source).map((l) => <option key={l.code} value={l.code}>{label(l)}</option>)}
              </select>
            </label>
          </div>

          {tab === 'text' ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <textarea className="input h-64 resize-y" value={text} maxLength={max} placeholder={t('typeHere')}
                    onChange={(e) => setText(e.target.value)} />
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{text.length} / {max}</span>
                    <button type="button" className="ml-auto inline-flex cursor-pointer items-center gap-1 hover:text-indigo-600"
                      onClick={() => txtRef.current?.click()}><FileText size={14} /> {t('loadTxt')}</button>
                    <button type="button" className="inline-flex cursor-pointer items-center gap-1 hover:text-red-600"
                      onClick={() => { setText(''); setResult(''); }}><Trash2 size={14} /> {t('clearText')}</button>
                    <input ref={txtRef} type="file" accept=".txt,text/plain" hidden
                      onChange={(e) => { openTxt(e.target.files[0]); e.target.value = ''; }} />
                  </div>
                </div>
                <div>
                  <div className="input h-64 overflow-auto whitespace-pre-wrap bg-slate-50 dark:bg-slate-900/40">
                    {busy ? <span className="flex items-center gap-2 text-slate-500"><Loader2 size={16} className="animate-spin" /> {t('translating')}</span>
                      : result || <span className="text-slate-400">{t('translationResult')}</span>}
                  </div>
                  <div className="mt-1 flex gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <button type="button" disabled={!result} className="inline-flex cursor-pointer items-center gap-1 hover:text-indigo-600 disabled:opacity-40"
                      onClick={async () => { await navigator.clipboard.writeText(result); toast.success(t('copied')); }}><Copy size={14} /> {t('copy')}</button>
                    <button type="button" disabled={!result} className="inline-flex cursor-pointer items-center gap-1 hover:text-indigo-600 disabled:opacity-40"
                      onClick={() => saveBlob(new Blob(['\ufeff' + result], { type: 'text/plain;charset=utf-8' }), `translation-${target}.txt`)}>
                      <Download size={14} /> {t('downloadTxt')}</button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={runText} disabled={busy || off || loading || !text.trim()} className="btn-primary">
                  {busy ? <><Loader2 size={16} className="animate-spin" /> {t('translating')}</> : t('translateBtn')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
                  drag ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-300 hover:border-indigo-400 dark:border-slate-600'}`}
              >
                <UploadCloud size={38} className="mb-2 text-indigo-500" />
                <p className="font-medium">{t('dropTranslate')}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('orBrowse')}</p>
                <p className="mt-1 text-xs text-slate-400">{t('allowedTypes')}: {t('fileTypesNote')}</p>
                <input ref={fileRef} type="file" multiple hidden accept=".txt,.docx,.pdf"
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              </div>

              {items.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-auto text-sm font-medium">{items.length} {t('filesSelected')}</span>
                    <button onClick={() => setItems([])} disabled={running} className="btn-ghost !text-red-600 disabled:opacity-50">
                      <Trash2 size={16} /> {t('clearAll')}
                    </button>
                    <button onClick={runAll} disabled={running || off || loading || waiting === 0} className="btn-primary">
                      {running ? <><Loader2 size={16} className="animate-spin" /> {t('translating')}</>
                        : <>{t('translateAll')}{waiting > 0 && ` (${waiting})`}</>}
                    </button>
                  </div>

                  <ul className="space-y-2">
                    {items.map((i) => (
                      <li key={i.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <FileText size={22} className="shrink-0 text-indigo-500" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{i.file.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {formatSize(i.file.size)}
                              {i.state === 'done' && <> · {t('translatedAs')}: <b>{outName(i)}</b></>}
                            </div>
                          </div>
                          {i.state === 'working' && <Loader2 size={20} className="shrink-0 animate-spin text-indigo-500" />}
                          {i.state === 'done' && <CheckCircle2 size={20} className="shrink-0 text-emerald-500" />}
                          {i.state === 'error' && <AlertCircle size={20} className="shrink-0 text-red-500" />}
                          {i.state === 'done' && (
                            <button onClick={() => saveBlob(i.blob, outName(i))} className="btn-primary !px-3 !py-1.5">
                              <Download size={15} /> {t('download')}
                            </button>
                          )}
                          {i.state === 'error' && (
                            <button onClick={() => translateOne(i)} disabled={running} className="btn-ghost !px-3 !py-1.5">
                              <RotateCcw size={15} /> {t('retry')}
                            </button>
                          )}
                          {i.state !== 'working' && (
                            <button onClick={() => setItems((l) => l.filter((x) => x.id !== i.id))} className="icon-btn !h-8 !w-8" aria-label={t('delete')}>
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        {i.state === 'working' && (
                          <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                            <div className="h-full w-full animate-pulse bg-indigo-600" />
                          </div>
                        )}
                        {i.state === 'error' && <p className="mt-2 text-xs text-red-600">{i.error}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400">ℹ️ {t('translateFileTip')} {t('translateLimits')}</p>
            </>
          )}

          <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck size={15} className="shrink-0 text-emerald-500" /> {t('translatePrivacy')}
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
