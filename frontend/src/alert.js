import Swal from 'sweetalert2';

const dark = () => document.documentElement.classList.contains('dark');

// Themed copy of SweetAlert, created on every call so it follows dark mode
const themed = (extra = {}) =>
  Swal.mixin({
    background: dark() ? '#1e293b' : '#ffffff',
    color: dark() ? '#f1f5f9' : '#1e293b',
    confirmButtonColor: '#4f46e5',
    cancelButtonColor: '#64748b',
    reverseButtons: true,
    customClass: {
      popup: '!rounded-2xl !shadow-2xl',
      confirmButton: '!rounded-lg !px-5 !py-2 !text-sm !font-medium',
      cancelButton: '!rounded-lg !px-5 !py-2 !text-sm !font-medium',
    },
    ...extra,
  });

export const fire = (opts) => themed().fire(opts);

const Toast = () =>
  themed({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    showCloseButton: true,
    timer: 3000,
    timerProgressBar: true,
    reverseButtons: false,
    didOpen: (el) => {
      el.onmouseenter = Swal.stopTimer;
      el.onmouseleave = Swal.resumeTimer;
    },
  });

// Same API as react-hot-toast, so existing code keeps working
export const toast = {
  success: (msg) => Toast().fire({ icon: 'success', title: msg }),
  error: (msg) => Toast().fire({ icon: 'error', title: msg, timer: 4500 }),
  info: (msg) => Toast().fire({ icon: 'info', title: msg }),
};

export const confirmDanger = async ({ title, text, confirmText, cancelText }) => {
  const r = await themed().fire({
    icon: 'warning',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: '#dc2626',
  });
  return r.isConfirmed;
};

export const escapeHtml = (v = '') =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const confirmAction = async ({ title, text, confirmText, cancelText, icon = 'question' }) => {
  const r = await themed().fire({
    icon,
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
  });
  return r.isConfirmed;
};
