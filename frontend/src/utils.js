export const CATEGORIES = ['General', 'Contract', 'Invoice', 'Report', 'HR', 'Legal'];

export function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const TYPES = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  txt: 'text/plain', csv: 'text/csv',
};

export function guessType(filename = '') {
  return TYPES[filename.split('.').pop().toLowerCase()] || 'application/octet-stream';
}

// Errors arrive as a Blob when responseType is 'blob'. Read the JSON message from it.
export async function blobError(e) {
  const data = e.response?.data;
  if (data instanceof Blob) {
    try {
      const j = JSON.parse(await data.text());
      return j.message || Object.values(j.errors || {})[0]?.[0] || 'Error';
    } catch { /* not JSON */ }
  }
  if (!e.response) return 'Cannot reach the server';
  return e.response?.data?.message || 'Error';
}

// "2026-11-04" / "2026-11" / "2026"  ->  readable label in the current language
export function fmtKey(key, period, lang = 'en') {
  const loc = lang === 'km' ? 'km-KH' : 'en-GB';
  try {
    if (period === 'year') return String(key);
    if (period === 'month')
      return new Date(`${key}-01T00:00:00`).toLocaleDateString(loc, { month: 'short', year: 'numeric' });
    return new Date(`${key}T00:00:00`).toLocaleDateString(loc, { day: 'numeric', month: 'short' });
  } catch {
    return String(key);
  }
}

// Local date as YYYY-MM-DD (toISOString would shift the day)
export function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function downloadCsv(filename, header, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  saveBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), filename);
}
