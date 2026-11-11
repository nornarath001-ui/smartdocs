import { useEffect, useMemo, useState } from 'react';
import {
  Search, Eye, Download, X, FileText, FileImage, FileSpreadsheet, FilterX, Loader2,
  Building2, SlidersHorizontal, ChevronDown,
} from 'lucide-react';
import api from '../api/axios';
import { useLang } from '../context/LangContext';
import { formatSize, saveBlob, blobError } from '../utils';
import PublicLayout from '../components/PublicLayout';
import Pagination from '../components/Pagination';
import { toast } from '../alert';

const extOf = (n = '') => n.split('.').pop().toLowerCase();
const IMG = ['png', 'jpg', 'jpeg'];
const EMPTY = { category: '', file_type: '', organization: '', year: '', month: '', from: '', to: '', sort: 'newest' };
const cancelled = (e) => e?.code === 'ERR_CANCELED';

function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

function FileIcon({ name }) {
  const e = extOf(name);
  if (IMG.includes(e)) return <FileImage size={20} className="shrink-0 text-pink-500" />;
  if (['xls', 'xlsx', 'csv'].includes(e)) return <FileSpreadsheet size={20} className="shrink-0 text-emerald-500" />;
  return <FileText size={20} className="shrink-0 text-indigo-500" />;
}

function SkeletonRows() {
  return Array.from({ length: 5 }).map((_, i) => (
    <tr key={i} className="animate-pulse">
      <td className="px-3 py-3"><div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" /></td>
      <td className="hidden px-3 py-3 md:table-cell"><div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" /></td>
      <td className="hidden px-3 py-3 sm:table-cell"><div className="h-4 w-14 rounded bg-slate-200 dark:bg-slate-700" /></td>
      <td className="hidden px-3 py-3 sm:table-cell"><div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" /></td>
      <td className="px-3 py-3"><div className="ml-auto h-4 w-12 rounded bg-slate-200 dark:bg-slate-700" /></td>
    </tr>
  ));
}

function PreviewModal({ doc, onClose, onDownload }) {
  const { t } = useLang();
  const e = extOf(doc.original_name);
  const isPdf = e === 'pdf';
  const isImg = IMG.includes(e);
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const onKey = (ev) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!isPdf && !isImg) return undefined;
    let alive = true;
    let obj = null;
    api.get(`/public/documents/${doc.id}/preview`, { responseType: 'blob' })
      .then((res) => {
        if (!alive) return;
        obj = URL.createObjectURL(new Blob([res.data], { type: isPdf ? 'application/pdf' : res.data.type }));
        setUrl(obj);
      })
      .catch(async (er) => { if (alive) setErr(await blobError(er)); });
    return () => { alive = false; if (obj) URL.revokeObjectURL(obj); };
  }, [doc.id, isPdf, isImg]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card flex h-[90vh] w-full max-w-5xl flex-col" onClick={(ev) => ev.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{doc.title}</h2>
          <button onClick={() => onDownload(doc)} className="btn-primary"><Download size={16} /> {t('download')}</button>
          <button onClick={onClose} className="icon-btn" aria-label={t('close')}><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-slate-100 dark:bg-slate-900">
          {err ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-red-600">{err}</div>
          ) : !isPdf && !isImg ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-slate-500">{t('viewOnlyPdf')}</div>
          ) : !url ? (
            <div className="flex h-full items-center justify-center text-slate-500"><Loader2 className="animate-spin" /></div>
          ) : isPdf ? (
            <iframe src={url} title={doc.title} className="h-full w-full" />
          ) : (
            <img src={url} alt={doc.title} className="mx-auto max-h-full" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function Portal() {
  const { t, lang } = useLang();
  const loc = lang === 'km' ? 'km-KH' : 'en-GB';

  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [f, setF] = useState(EMPTY);
  const [perPage, setPerPage] = useState(Number(localStorage.getItem('portal-per-page')) || 10);
  const [showFilters, setShowFilters] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const [opts, setOpts] = useState({ categories: [], organizations: [], file_types: [], years: [] });
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // filters that affect the summary (everything except sort)
  const filterParams = useMemo(
    () => Object.fromEntries(Object.entries({ q, ...f, sort: undefined }).filter(([, v]) => v)), [q, f]);
  const fKey = JSON.stringify(filterParams);
  const lKey = `${fKey}|${f.sort}|${perPage}`;

  // The page number belongs to one set of filters: when they change, it is page 1 again
  const [pg, setPg] = useState({ key: '', n: 1 });
  const page = pg.key === lKey ? pg.n : 1;
  const setPage = (n) => setPg({ key: lKey, n });

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(loc, { month: 'long' })), [loc]);
  const fmtDate = (v) => new Date(v).toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  // Browsers may try to "anchor" the scroll while rows change: turn it off for this page
  useEffect(() => {
    const prev = document.documentElement.style.overflowAnchor;
    document.documentElement.style.overflowAnchor = 'none';
    return () => { document.documentElement.style.overflowAnchor = prev; };
  }, []);

  useEffect(() => { api.get('/public/filters').then((r) => setOpts(r.data)).catch(() => {}); }, []);

  // List: older requests are cancelled so they can never overwrite newer results
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    api.get('/public/documents', {
      params: { ...filterParams, sort: f.sort, page, per_page: perPage }, signal: ctrl.signal,
    })
      .then(({ data }) => {
        setRows(data.data);
        setMeta({ current_page: data.current_page, last_page: data.last_page, total: data.total, from: data.from, to: data.to });
        if (data.data.length === 0 && data.last_page > 0 && data.current_page > data.last_page) setPage(data.last_page);
        setLoading(false);
      })
      .catch((e) => { if (!cancelled(e)) { toast.error(t('noData')); setLoading(false); } });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lKey, page]);

  const download = async (d) => {
    setBusyId(d.id);
    try {
      const res = await api.get(`/public/documents/${d.id}/download`, { responseType: 'blob' });
      saveBlob(res.data, d.original_name);
    } catch (e) {
      toast.error(await blobError(e));
    } finally {
      setBusyId(null);
    }
  };

  const colorOf = (n) => opts.categories.find((c) => c.name === n)?.color || '#64748b';

  // Removable chips for active filters
  const chips = [
    q && { k: 'q', label: `“${q}”` },
    f.category && { k: 'category', label: f.category },
    f.file_type && { k: 'file_type', label: t(`ft_${f.file_type}`) },
    f.organization && { k: 'organization', label: f.organization },
    f.year && { k: 'year', label: f.year },
    f.month && { k: 'month', label: months[Number(f.month) - 1] },
    f.from && { k: 'from', label: `${t('from')} ${f.from}` },
    f.to && { k: 'to', label: `${t('to')} ${f.to}` },
  ].filter(Boolean);

  const removeChip = (k) => (k === 'q' ? setSearch('') : setF((x) => ({ ...x, [k]: '' })));
  const clear = () => { setSearch(''); setF((x) => ({ ...EMPTY, sort: x.sort })); };

  return (
    <PublicLayout>
      <div className="space-y-3">
        {/* Header + search */}
        <section className="space-y-1">
          <div>
            {/* <h1 className="text-2xl font-bold md:text-3xl">{t('portalTitle')}</h1> */}
            {/* <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('portalSubtitle')}</p> */}
          </div>
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-11 pr-10 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800" />
            {search && (
              <button onClick={() => setSearch('')} aria-label={t('close')}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            )}
          </div>
        </section>

        {/* Filters */}
        <section className="card !p-0">
          <button type="button" onClick={() => setShowFilters((x) => !x)}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left lg:hidden">
            <SlidersHorizontal size={18} className="text-indigo-500" />
            <span className="font-semibold">{t('filters')}</span>
            {chips.length > 0 && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">{chips.length}</span>
            )}
            <ChevronDown size={18} className={`ml-auto text-slate-400 transition ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          <div className={`${showFilters ? 'block' : 'hidden'} space-y-3 p-3 lg:block`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['category', t('category'), t('allCats'),
                  opts.categories.map((c) => [c.name, `${c.name} (${c.documents_count})`])],
                ['file_type', t('fileType'), t('allTypes'),
                  opts.file_types.map((x) => [x.name, `${t(`ft_${x.name}`)} (${x.value})`])],
                ['organization', t('organization'), t('allOrgs'),
                  opts.organizations.map((o) => [o.name, `${o.name} (${o.value})`])],
              ].map(([key, label, all, list]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
                  <select className="input !py-1.5" value={f[key]} onChange={set(key)}>
                    <option value="">{all}</option>
                    {list.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
              ))}

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('sortBy')}</span>
                <select className="input" value={f.sort} onChange={set('sort')}>
                  <option value="newest">{t('sortNewest')}</option>
                  <option value="oldest">{t('sortOldest')}</option>
                  <option value="title">{t('sortTitle')}</option>
                  <option value="size">{t('sortSize')}</option>
                </select>
              </label>
            </div>

            {showMore && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('year')}</span>
                  <select className="input" value={f.year} onChange={set('year')}>
                    <option value="">{t('allYears')}</option>
                    {opts.years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('month')}</span>
                  <select className="input" value={f.month} onChange={set('month')}>
                    <option value="">{t('allMonths')}</option>
                    {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('from')}</span>
                  <input type="date" className="input" value={f.from} max={f.to || undefined} onChange={set('from')} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('to')}</span>
                  <input type="date" className="input" value={f.to} min={f.from || undefined} onChange={set('to')} />
                </label>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setShowMore((x) => !x)}
                className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                <ChevronDown size={16} className={`transition ${showMore ? 'rotate-180' : ''}`} />
                {showMore ? t('lessFilters') : t('moreFilters')}
              </button>

              {chips.map((c) => (
                <button key={c.k} onClick={() => removeChip(c.k)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-200">
                  {c.label} <X size={12} />
                </button>
              ))}

              {chips.length > 0 && (
                <button onClick={clear} className="btn-ghost ml-auto !py-1"><FilterX size={15} /> {t('clearFilters')}</button>
              )}
            </div>
          </div>
        </section>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          <b className="text-slate-800 dark:text-slate-100">{meta.total}</b> {t('resultsFound')}
        </p>

        {/* Table */}
        <div className="card overflow-x-auto !p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2">{t('title')}</th>
                <th className="hidden px-3 py-2 md:table-cell">{t('category')}</th>
                <th className="hidden px-3 py-2 sm:table-cell">{t('size')}</th>
                <th className="hidden px-3 py-2 sm:table-cell">{t('date')}</th>
                <th className="px-3 py-2 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-200 transition-opacity dark:divide-slate-700 ${loading && rows.length ? 'opacity-50' : ''}`}>
              {loading && rows.length === 0 && <SkeletonRows />}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                    <p>{chips.length ? t('portalEmpty') : t('noData')}</p>
                    {chips.length > 0 && (
                      <button onClick={clear} className="btn-ghost mx-auto mt-3"><FilterX size={16} /> {t('clearFilters')}</button>
                    )}
                  </td>
                </tr>
              )}

              {rows.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-3">
                      <FileIcon name={d.original_name} />
                      <div className="min-w-0">
                        <div className="font-medium">{d.title}</div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium uppercase dark:bg-slate-700">{extOf(d.original_name)}</span>
                          {d.organization && <span className="inline-flex items-center gap-1"><Building2 size={12} />{d.organization}</span>}
                          {/* shown under the title on small screens */}
                          <span className="md:hidden">{d.category}</span>
                          <span className="sm:hidden">{formatSize(d.size)} · {fmtDate(d.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-1.5 md:table-cell">
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(d.category) }} />{d.category}
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-1.5 sm:table-cell">{formatSize(d.size)}</td>
                  <td className="hidden whitespace-nowrap px-3 py-1.5 sm:table-cell">{fmtDate(d.created_at)}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex justify-end gap-1">
                      <button className="icon-btn !h-8 !w-8" title={t('view')} onClick={() => setPreview(d)}><Eye size={17} /></button>
                      <button className="icon-btn !h-8 !w-8" title={t('download')} disabled={busyId === d.id} onClick={() => download(d)}>
                        {busyId === d.id ? <Loader2 size={18} className="animate-spin" /> : <Download size={17} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={meta.current_page} lastPage={meta.last_page} total={meta.total} from={meta.from} to={meta.to}
          perPage={perPage}
          onPage={(p) => setPage(p)}
          onPerPage={(n) => { setPerPage(n); localStorage.setItem('portal-per-page', n); }} />
      </div>

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} onDownload={download} />}
    </PublicLayout>
  );
}
