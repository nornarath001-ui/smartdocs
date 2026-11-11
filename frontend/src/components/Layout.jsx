import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

export default function Layout() {
  const [open, setOpen] = useState(window.innerWidth >= 768);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <Sidebar open={open} setOpen={setOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onToggle={() => setOpen((o) => !o)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
