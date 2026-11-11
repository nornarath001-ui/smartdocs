import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import { fire, toast } from '../alert';

const Ctx = createContext({ categories: [], names: [], colorOf: () => '#64748b', reload: () => {}, quickAdd: async () => null });

export function CategoryProvider({ children }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);

  const reload = useCallback(
    () => api.get('/categories').then((r) => setCategories(r.data)).catch(() => {}),
    []
  );

  useEffect(() => {
    if (user) reload();
    else setCategories([]);
  }, [user?.id, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => {
    const map = Object.fromEntries(categories.map((c) => [c.name, c.color]));

    // Small SweetAlert prompt used by the "+" button inside the document forms
    const quickAdd = async (t) => {
      const r = await fire({
        title: t('newCategory'),
        input: 'text',
        inputLabel: t('categoryName'),
        showCancelButton: true,
        confirmButtonText: t('save'),
        cancelButtonText: t('cancel'),
        inputValidator: (v) => !v.trim() && t('categoryName'),
      });
      if (!r.isConfirmed) return null;
      try {
        const { data } = await api.post('/categories', { name: r.value.trim(), color: '#6366f1' });
        await reload();
        toast.success(t('categorySaved'));
        return data.name;
      } catch (e) {
        fire({
          icon: 'error', title: t('newCategory'),
          text: Object.values(e.response?.data?.errors || {})[0]?.[0] || e.response?.data?.message || 'Error',
        });
        return null;
      }
    };

    return {
      categories,
      names: categories.map((c) => c.name),
      colorOf: (n) => map[n] || '#64748b',
      reload,
      quickAdd,
    };
  }, [categories, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCategories = () => useContext(Ctx);
