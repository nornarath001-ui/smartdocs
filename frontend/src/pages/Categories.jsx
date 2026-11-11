import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Tags } from 'lucide-react';
import api from '../api/axios';
import { useLang } from '../context/LangContext';
import { useCategories } from '../context/CategoryContext';
import { toast, fire, confirmDanger, confirmAction } from '../alert';

const PRESETS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

const errMsg = (e) =>
  Object.values(e.response?.data?.errors || {})[0]?.[0] || e.response?.data?.message || 'Error';

function CategoryForm({ category, onClose, onSaved }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: category?.name || '',
    color: category?.color || '#6366f1',
    description: category?.description || '',
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    if (category) {
      const ok = await confirmAction({
        title: t('confirmSave'), text: t('confirmSaveText'),
        confirmText: t('save'), cancelText: t('cancel'),
      });
      if (!ok) return;
    }

    setBusy(true);
    try {
      if (category) await api.put(`/categories/${category.id}`, form);
      else await api.post('/categories', form);
      toast.success(t('categorySaved'));
      onSaved();
    } catch (err) {
      fire({ icon: 'error', title: category ? t('editCategory') : t('newCategory'), text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="card w-full max-w-md space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{category ? t('editCategory') : t('newCategory')}</h2>
          <button type="button" onClick={onClose} className="icon-btn"><X size={18} /></button>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t('categoryName')}</label>
          <input className="input" value={form.name} maxLength={100} required autoFocus
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t('color')}</label>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((c) => (
              <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                className={`h-7 w-7 cursor-pointer rounded-full border-2 transition ${
                  form.color.toLowerCase() === c ? 'scale-110 border-slate-800 dark:border-white' : 'border-transparent'}`}
                style={{ background: c }} aria-label={c} />
            ))}
            <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-transparent dark:border-slate-600" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t('description')}</label>
          <textarea className="input" rows={2} maxLength={255} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">{t('cancel')}</button>
          <button disabled={busy} className="btn-primary">{busy ? t('loading') : t('save')}</button>
        </div>
      </form>
    </div>
  );
}

export default function Categories() {
  const { t } = useLang();
  const { categories, reload } = useCategories();
  const [modal, setModal] = useState(null); // {} = new, { category } = edit

  const remove = async (c) => {
    let moveTo = '';

    if (c.documents_count > 0) {
      const others = categories.filter((x) => x.id !== c.id);
      if (!others.length) return fire({ icon: 'error', title: t('delete'), text: t('lastCategory') });

      const r = await fire({
        icon: 'warning',
        title: t('confirmDeleteCategory'),
        text: `${c.name} — ${t('categoryInUse')}: ${c.documents_count}`,
        input: 'select',
        inputOptions: Object.fromEntries(others.map((o) => [o.name, o.name])),
        inputPlaceholder: t('chooseCategory'),
        showCancelButton: true,
        confirmButtonText: t('delete'),
        cancelButtonText: t('cancel'),
        confirmButtonColor: '#dc2626',
        inputValidator: (v) => !v && t('chooseCategory'),
      });
      if (!r.isConfirmed) return;
      moveTo = r.value;
    } else {
      const ok = await confirmDanger({
        title: t('confirmDeleteCategory'), text: c.name,
        confirmText: t('delete'), cancelText: t('cancel'),
      });
      if (!ok) return;
    }

    try {
      await api.delete(`/categories/${c.id}`, { params: moveTo ? { move_to: moveTo } : {} });
      toast.success(t('categoryDeleted'));
      reload();
    } catch (e) {
      fire({ icon: 'error', title: t('delete'), text: errMsg(e) });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">{t('categories')}</h1>
        <button onClick={() => setModal({})} className="btn-primary"><Plus size={16} /> {t('newCategory')}</button>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">{t('categoryName')}</th>
              <th className="px-4 py-3">{t('description')}</th>
              <th className="px-4 py-3">{t('docsCount')}</th>
              <th className="px-4 py-3 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {categories.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">{t('noCategories')}</td></tr>
            )}
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: c.color }}>
                      <Tags size={16} />
                    </span>
                    <span className="font-medium">{c.name}</span>
                  </div>
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-600 dark:text-slate-300">{c.description || '—'}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium dark:bg-slate-700">{c.documents_count}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button className="icon-btn" title={t('edit')} onClick={() => setModal({ category: c })}><Pencil size={17} /></button>
                    <button className="icon-btn !text-red-600" title={t('delete')} onClick={() => remove(c)}><Trash2 size={17} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <CategoryForm category={modal.category} onClose={() => setModal(null)}
          onSaved={() => { setModal(null); reload(); }} />
      )}
    </div>
  );
}
