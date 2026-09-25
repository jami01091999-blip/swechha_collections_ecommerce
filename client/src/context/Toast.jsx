import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);
  const timer = useRef();
  const show = useCallback((text) => {
    setMsg(text);
    setVisible(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 2400);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Toast pill — same markup as the Stitch export */}
      <div
        role="status"
        aria-live="polite"
        className={`fixed top-14 left-1/2 -translate-x-1/2 z-[70] bg-primary text-white text-xs px-4 py-2 rounded-full shadow-lg transition-all duration-300 max-w-[90vw] text-center ${
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {msg}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
