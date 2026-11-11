import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: { Accept: 'application/json' },
});

const PUBLIC_PATHS = ['/portal', '/translate', '/login', '/forgot-password', '/reset-password'];

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && !url.includes('/login')) {
      localStorage.removeItem('token');
      const path = window.location.pathname;
      const onPublic = path === '/' || PUBLIC_PATHS.some((p) => path.startsWith(p));
      if (!onPublic) window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
