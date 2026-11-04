import { createContext, useContext, useState, useCallback, useEffect } from "react";

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, type = "info") => addToast(message, type),
    [addToast]
  );
  toast.success = (msg) => addToast(msg, "success");
  toast.error = (msg) => addToast(msg, "error");
  toast.info = (msg) => addToast(msg, "info");

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container in bottom right */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            onDismiss={() => removeToast(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const typeConfig = {
    success: {
      border: "border-emerald-500/30",
      bg: "bg-surface",
      icon: (
        <span className="text-emerald-500 font-bold shrink-0">✓</span>
      ),
    },
    error: {
      border: "border-red-500/30",
      bg: "bg-surface",
      icon: (
        <span className="text-red-500 font-bold shrink-0">✕</span>
      ),
    },
    info: {
      border: "border-line",
      bg: "bg-surface",
      icon: (
        <span className="text-sky-500 font-bold shrink-0">ℹ</span>
      ),
    },
  }[toast.type] || {
    border: "border-line",
    bg: "bg-surface",
    icon: null,
  };

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border ${typeConfig.border} ${typeConfig.bg} shadow-lg text-xs text-fg transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 select-none`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {typeConfig.icon}
        <span className="leading-snug break-words">{toast.message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-muted hover:text-fg transition p-0.5 rounded cursor-pointer shrink-0"
        aria-label="Dismiss notification"
      >
        <span className="text-sm leading-none">&times;</span>
      </button>
    </div>
  );
}

export default ToastProvider;

