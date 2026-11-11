import { useRef, useState } from 'react';
import {
  UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, Download, Trash2,
  ArrowRight, ShieldCheck, RotateCcw,
} from 'lucide-react';
import api from '../api/axios';
import { useLang } from '../context/LangContext';
import { formatSize, saveBlob, blobError } from '../utils';
import { toast } from '../alert';

const MODES = {
  'word-pdf': { url: '/convert/word-to-pdf', exts: ['doc', 'docx', 'odt', 'rtf'], out: 'pdf', from: 'Word', to: 'PDF', drop: 'dropWord' },
  'pdf-word': { url: '/convert/pdf-to-word', exts: ['pdf'], out: 'docx', from: 'PDF', to: 'Word', drop: 'dropPdf' },
};
const MAX = 20 * 1024 * 1024;
const baseName = (n) => n.replace(/\.[^.]+$/, '');
const extOf = (n) => n.split('.').pop().toLowerCase();

export default function ConverterPanel({ initialMode = 'word-pdf', embedded = false }) {
  const { t } = useLang();
  const inputRef = useRef(null);
  const [mode, setMode] = useState(MODES[initialMode] ? initialMode : 'word-pdf');
  const [items, setItems] = useState([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const cfg = MODES[mode];

  const patch = (id, data) => setItems((l) => l.map((i) => (i.id === id ? { ...i, ...data } : i)));

  const switchMode = (m) => {
    if (busy || m === mode) return;
    setMode(m);
    setItems([]);
  };

  const addFiles = (list) => {
    const bad = [];
    const fresh = [];
    Array.from(list || []).forEach((file) => {
      const id = `${file.name}-${file.size}-${file.lastModified}`;
      if (!cfg.exts.includes(extOf(file.name))) return bad.push(`${file.name}: ${t('wrongType')}`);
      if (file.size > MAX) return bad.push(`${file.name}: ${t('fileTooBig')}`);
      if (items.some((i) => i.id === id) || fresh.some((i) => i.id === id)) return;
      fresh.push({ id, file, state: 'pending', progress: 0, blob: null, error: '', outName: `${baseName(file.name)}.${cfg.out}` });
    });
    if (bad.length) toast.error(bad.slice(0, 2).join(' · '));
    if (fresh.length) setItems((l) => [...l, ...fresh]);
  };

  const convertOne = async (item) => {
    patch(item.id, { state: 'converting', progress: 0, error: '' });
    const fd = new FormData();
    fd.append('file', item.file);
    try {
      const res = await api.post(cfg.url, fd, {
        responseType: 'blob',
        timeout: 300000,
        onUploadProgress: (p) => patch(item.id, { progress: Math.round((p.loaded * 100) / (p.total || item.file.size || 1)) }),
      });
      patch(item.id, { state: 'done', progress: 100, blob: res.data });
    } catch (e) {
      const msg = e.response?.status === 429 ? t('tooMany') : await blobError(e);
      patch(item.id, { state: 'error', error: msg });
    }
  };

  const convertAll = async () => {
    const queue = items.filter((i) => i.state === 'pending' || i.state === 'error');
    if (!queue.length) return;
    setBusy(true);
    for (const item of queue) await convertOne(item);
    setBusy(false);
  };

  const downloadAll = () =>
    items.filter((i) => i.state === 'done').forEach((i, n) => setTimeout(() => saveBlob(i.blob, i.outName), n * 300));

  const remove = (id) => setItems((l) => l.filter((i) => i.id !== id));
  const waiting = items.filter((i) => i.state === 'pending' || i.state === 'error').length;
  const done = items.filter((i) => i.state === 'done').length;

  const tab = (m) =>
    `flex-1 cursor-pointer rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
      mode === m ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`;

  return (
    <div className="space-y-4">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{t('convertTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('convertSubtitle')}</p>
        </div>
      )}

      <div className="card flex gap-1 !p-1">
        <button className={tab('word-pdf')} onClick={() => switchMode('word-pdf')}>{t('wordToPdf')}</button>
        <button className={tab('pdf-word')} onClick={() => switchMode('pdf-word')}>{t('pdfToWord')}</button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-4 py-10 text-center transition dark:bg-slate-800 ${
          drag ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-300 hover:border-indigo-400 dark:border-slate-600'}`}
      >
        <UploadCloud size={40} className="mb-2 text-indigo-500" />
        <p className="font-medium">{t(cfg.drop)}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('orBrowse')}</p>
        <p className="mt-1 text-xs text-slate-400">
          {t('allowedTypes')}: {cfg.exts.map((e) => `.${e}`).join(' ')} · {t('maxSize')}
        </p>
        <input
          ref={inputRef} type="file" multiple hidden
          accept={cfg.exts.map((e) => `.${e}`).join(',')}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {items.length > 0 && (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto flex items-center gap-2 text-sm font-medium">
              {cfg.from} <ArrowRight size={15} className="text-slate-400" /> {cfg.to}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-700">{items.length}</span>
            </span>
            {done > 1 && (
              <button onClick={downloadAll} className="btn-ghost"><Download size={16} /> {t('downloadAll')}</button>
            )}
            <button onClick={() => setItems([])} disabled={busy} className="btn-ghost !text-red-600 disabled:opacity-50">
              <Trash2 size={16} /> {t('clearAll')}
            </button>
            <button onClick={convertAll} disabled={busy || waiting === 0} className="btn-primary">
              {busy
                ? <><Loader2 size={16} className="animate-spin" /> {t('converting')}</>
                : <>{t('convertAll')}{waiting > 0 && ` (${waiting})`}</>}
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
                      {i.state === 'done' && <> · {t('convertedAs')} <b>{i.outName}</b> ({formatSize(i.blob.size)})</>}
                    </div>
                  </div>

                  {i.state === 'converting' && <Loader2 size={20} className="shrink-0 animate-spin text-indigo-500" />}
                  {i.state === 'done' && <CheckCircle2 size={20} className="shrink-0 text-emerald-500" />}
                  {i.state === 'error' && <AlertCircle size={20} className="shrink-0 text-red-500" />}

                  {i.state === 'done' && (
                    <button onClick={() => saveBlob(i.blob, i.outName)} className="btn-primary !px-3 !py-1.5">
                      <Download size={15} /> {t('download')}
                    </button>
                  )}
                  {i.state === 'error' && (
                    <button onClick={() => convertOne(i)} disabled={busy} className="btn-ghost !px-3 !py-1.5">
                      <RotateCcw size={15} /> {t('retry')}
                    </button>
                  )}
                  {i.state !== 'converting' && (
                    <button onClick={() => remove(i.id)} className="icon-btn !h-8 !w-8" aria-label={t('delete')}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {i.state === 'converting' && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                    <div className={`h-full bg-indigo-600 transition-all ${i.progress >= 100 ? 'animate-pulse' : ''}`}
                      style={{ width: `${i.progress}%` }} />
                  </div>
                )}
                {i.state === 'error' && <p className="mt-2 text-xs text-red-600">{i.error}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
        <p className="flex items-center gap-2"><ShieldCheck size={15} className="shrink-0 text-emerald-500" /> {t('convertPrivacy')}</p>
        {mode === 'pdf-word' && <p>ℹ️ {t('convertTip')}</p>}
      </div>
    </div>
  );
}
