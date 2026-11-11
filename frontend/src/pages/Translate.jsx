import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Copy, Download, FileText, Loader2, ShieldCheck, Trash2, Languages } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { saveBlob } from '../utils';
import { toast } from '../alert';

const errMsg = (e) =>
  Object.values(e.response?.data?.errors || {})[0]?.[0] || e.response?.data?.message || 'Error';

export default function Translate() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const fileRef = useRef(null);

  const [cfg, setCfg] = useState(null);
  const [source, setSource] = useState('km');
  const [target, setTarget] = useState('en');
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [adm, setAdm] = useState({ enabled: true, max_chars: 5000 });

  const load = () =>
    api.get('/translate/config').then((r) => {
      setCfg(r.data);
      setAdm({ enabled: r.data.enabled, max_chars: r.data.max_chars });
    }).catch(() => {});

  useEffect(() => {
    load();
    const id = setInterval(() => { if (!cfg?.ready) load(); }, 8000); // wait for the model to load
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.ready]);

  const names = useMemo(() => {
    try { return new Intl.DisplayNames([lang === 'km' ? 'km' : 'en'], { type: 'language' }); } catch { return null; }
  }, [lang]);
  const label = (l) => { try { return names?.of(l.code) || l.name; } catch { return l.name; } };
  const langs = cfg?.languages || [];
  const max = cfg?.max_chars || 5000;

  const swap = () => { setSource(target); setTarget(source); setText(result || text); setResult(''); };

  const run = async () => {
    if (!text.trim()) return toast.error(t('nothingToTranslate'));
    setBusy(true);
    try {
      const { data } = await api.post('/translate', { text, source, target }, { timeout: 150000 });
      setResult(data.translation);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const openFile = (f) => {
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => setText(String(rd.result).slice(0, max));
    rd.readAsText(f, 'UTF-8');
  };

  const copy = async () => { await navigator.clipboard.writeText(result); toast.success(t('copied')); };
  const saveAdmin = async () => {
    try { await api.put('/translate/settings', adm); toast.success(t('settingsSaved')); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const off = cfg && !cfg.enabled;
  const loading = cfg && cfg.enabled && !cfg.ready;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Languages className="text-indigo-500" /> {t('translateTitle')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('translateSubtitle')}</p>
      </div>

      {off && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">{t('translatorOff')}</div>}
      {loading && (
        <div className="flex items-center gap-2 rounded-lg bg-indigo-50 p-3 text-sm dark:bg-indigo-900/30">
          <Loader2 size={16} className="animate-spin" /> {t('translatorLoading')}
        </div>
      )}

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

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <textarea className="input h-64 resize-y" value={text} maxLength={max} placeholder={t('typeHere')}
              onChange={(e) => setText(e.target.value)} />
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{text.length} / {max}</span>
              <button type="button" className="ml-auto inline-flex cursor-pointer items-center gap-1 hover:text-indigo-600"
                onClick={() => fileRef.current?.click()}><FileText size={14} /> {t('loadTxt')}</button>
              <button type="button" className="inline-flex cursor-pointer items-center gap-1 hover:text-red-600"
                onClick={() => { setText(''); setResult(''); }}><Trash2 size={14} /> {t('clearText')}</button>
              <input ref={fileRef} type="file" accept=".txt,text/plain" hidden
                onChange={(e) => { openFile(e.target.files[0]); e.target.value = ''; }} />
            </div>
          </div>

          <div>
            <div className="input h-64 overflow-auto whitespace-pre-wrap bg-slate-50 dark:bg-slate-900/40">
              {busy ? <span className="flex items-center gap-2 text-slate-500"><Loader2 size={16} className="animate-spin" /> {t('translating')}</span>
                : result || <span className="text-slate-400">{t('translationResult')}</span>}
            </div>
            <div className="mt-1 flex gap-3 text-xs text-slate-500 dark:text-slate-400">
              <button type="button" disabled={!result} onClick={copy}
                className="inline-flex cursor-pointer items-center gap-1 hover:text-indigo-600 disabled:opacity-40"><Copy size={14} /> {t('copy')}</button>
              <button type="button" disabled={!result}
                onClick={() => saveBlob(new Blob(['\ufeff' + result], { type: 'text/plain;charset=utf-8' }), `translation-${target}.txt`)}
                className="inline-flex cursor-pointer items-center gap-1 hover:text-indigo-600 disabled:opacity-40"><Download size={14} /> {t('downloadTxt')}</button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <p className="flex flex-1 items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck size={15} className="shrink-0 text-emerald-500" /> {t('translatePrivacy')}
          </p>
          <button onClick={run} disabled={busy || off || loading || !text.trim()} className="btn-primary">
            {busy ? <><Loader2 size={16} className="animate-spin" /> {t('translating')}</> : t('translateBtn')}
          </button>
        </div>
      </div>

      {user.role === 'admin' && (
        <div className="card space-y-3">
          <h2 className="font-semibold">{t('translateSettings')}</h2>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={adm.enabled} onChange={(e) => setAdm({ ...adm, enabled: e.target.checked })} />
              {t('enableTranslate')}
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">{t('maxChars')}</span>
              <input type="number" min={200} max={20000} step={100} className="input !w-32" value={adm.max_chars}
                onChange={(e) => setAdm({ ...adm, max_chars: Number(e.target.value) })} />
            </label>
            <button onClick={saveAdmin} className="btn-primary">{t('save')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
