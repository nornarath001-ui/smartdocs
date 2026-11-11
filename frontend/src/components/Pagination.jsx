import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useLang } from '../context/LangContext';

export const PER_PAGE_OPTIONS = [5, 6, 7, 8, 9, 10, 20, 30, 50];

// 1 … 4 5 6 … 14
function buildPages(current, last) {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);

  const pages = new Set([1, last, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= last - 2) [last - 1, last - 2, last - 3].forEach((p) => pages.add(p));

  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

export default function Pagination({ page, lastPage, total, from, to, perPage, onPage, onPerPage }) {
  const { t } = useLang();
  if (total === 0) return null;

  const go = (p) => onPage(Math.min(Math.max(p, 1), lastPage));

  const nav =
    'inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-medium transition ' +
    'disabled:cursor-not-allowed disabled:opacity-40';
  const idle = 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700';
  const active = 'bg-indigo-600 text-white shadow-sm';

  return (
    <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
      {/* Left: summary + rows per page */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <span>
          {t('showing')} <b className="text-slate-800 dark:text-slate-100">{from ?? 0}–{to ?? 0}</b> {t('of')}{' '}
          <b className="text-slate-800 dark:text-slate-100">{total}</b>
        </span>
        <label className="flex items-center gap-2">
          <span>{t('perPage')}</span>
          <select
            className="input !w-auto !py-1"
            value={perPage}
            onChange={(e) => onPerPage(Number(e.target.value))}
          >
            {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      {/* Right: buttons */}
      {lastPage > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button className={`${nav} ${idle}`} onClick={() => go(1)} disabled={page <= 1}
            title={t('firstPage')} aria-label={t('firstPage')}><ChevronsLeft size={18} /></button>
          <button className={`${nav} ${idle}`} onClick={() => go(page - 1)} disabled={page <= 1}
            title={t('previous')} aria-label={t('previous')}><ChevronLeft size={18} /></button>

          {/* Phones: compact indicator */}
          <span className="px-3 text-sm font-medium sm:hidden">{page} / {lastPage}</span>

          {/* Tablet and up: numbered pages */}
          <div className="hidden items-center gap-1 sm:flex">
            {buildPages(page, lastPage).map((p) =>
              typeof p === 'string' ? (
                <span key={p} className="px-1 text-slate-400 select-none">…</span>
              ) : (
                <button key={p} onClick={() => go(p)}
                  aria-current={p === page ? 'page' : undefined}
                  className={`${nav} ${p === page ? active : idle}`}>
                  {p}
                </button>
              )
            )}
          </div>

          <button className={`${nav} ${idle}`} onClick={() => go(page + 1)} disabled={page >= lastPage}
            title={t('next')} aria-label={t('next')}><ChevronRight size={18} /></button>
          <button className={`${nav} ${idle}`} onClick={() => go(lastPage)} disabled={page >= lastPage}
            title={t('lastPage')} aria-label={t('lastPage')}><ChevronsRight size={18} /></button>
        </nav>
      )}
    </div>
  );
}
