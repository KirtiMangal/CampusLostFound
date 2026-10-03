import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((type, message) => {
    const id = Date.now();
    setToast({ id, type, message });
    window.setTimeout(() => setToast((current) => current?.id === id ? null : current), 3500);
  }, []);
  const notify = useCallback((message) => show('success', message), [show]);
  notify.error = useCallback((message) => show('error', message), [show]);

  useEffect(() => {
    const onApiFeedback = (event) => notify.error(event.detail);
    window.addEventListener('campus-api-feedback', onApiFeedback);
    return () => window.removeEventListener('campus-api-feedback', onApiFeedback);
  }, [notify]);

  return <ToastContext.Provider value={notify}>
    {children}
    {toast && <div className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <span className="toast-icon">{toast.type === 'success' ? <Check size={16} /> : <X size={16} />}</span>{toast.message}
    </div>}
  </ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider.');
  return context;
}
