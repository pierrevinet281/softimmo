import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

let idc = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((message, type = 'info') => {
    const id = ++idc;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => remove(id), 4500);
  }, [remove]);

  const value = {
    info: (m) => push(m, 'info'),
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
  };

  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info };

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts">
        {toasts.map((t) => {
          const I = Icon[t.type] || Info;
          const color = t.type === 'error' ? 'var(--color-danger)' : t.type === 'success' ? 'var(--color-success)' : 'var(--color-info)';
          return (
            <div key={t.id} className={`toast ${t.type}`}>
              <I size={18} style={{ color, flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>{t.message}</div>
              <button className="btn-ghost btn-icon btn-sm" onClick={() => remove(t.id)} style={{ height: 20, width: 20 }}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export default ToastProvider;
