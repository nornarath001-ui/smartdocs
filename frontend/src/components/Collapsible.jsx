import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Drop-down bar. Remembers open/closed in localStorage. Content mounts only when opened.
export default function Collapsible({ id, title, icon: Icon, badge, defaultOpen = false, children }) {
  const key = `section-${id}`;
  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem(key);
    return saved === null ? defaultOpen : saved === '1';
  });

  const toggle = () => {
    setOpen((o) => {
      localStorage.setItem(key, o ? '0' : '1');
      return !o;
    });
  };

  return (
    <div className="card !p-0 overflow-hidden">
      <button type="button" onClick={toggle} aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700/40">
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300">
            <Icon size={18} />
          </span>
        )}
        <span className="font-semibold">{title}</span>
        {badge && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">{badge}</span>}
        <ChevronDown size={20} className={`ml-auto text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-slate-200 p-4 dark:border-slate-700">{children}</div>
      )}
    </div>
  );
}
