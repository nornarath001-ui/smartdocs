import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Settings from './pages/Settings';
import Categories from './pages/Categories';
import Users from './pages/Users';
import Portal from './pages/Portal';
import PublicTranslate from './pages/PublicTranslate';
import Translate from './pages/Translate';
import Convert from './pages/Convert';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

const MANAGE = ['admin', 'manager'];

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-slate-500">Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

// Pages limited to some roles. Others go back to the dashboard (never the public page).
function Only({ roles, children }) {
  const { user } = useAuth();
  return roles.includes(user?.role) ? children : <Navigate to="/administrator" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Portal />} />
      <Route path="/portal" element={<Navigate to="/" replace />} />
      <Route path="/convert" element={<Convert />} />
      <Route path="/translate" element={<PublicTranslate />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Admin dashboard: every signed-in role (admin, manager, staff) */}
      <Route path="/administrator" element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="documents" element={<Documents />} />
        <Route path="settings" element={<Settings />} />
        <Route path="translate" element={<Translate />} />
        <Route path="categories" element={<Only roles={MANAGE}><Categories /></Only>} />
        <Route path="users" element={<Only roles={['admin']}><Users /></Only>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
