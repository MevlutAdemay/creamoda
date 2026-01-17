'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export type Toast = {
  id: string;
  title?: string;
  message?: string;
  kind?: ToastKind;
  durationMs?: number;
};

export type ToastInput = Omit<Toast, 'id'>;

export type ToastFn = (t: ToastInput) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback<ToastFn>((t) => {
    setToasts((prev) => [{ id: crypto.randomUUID(), durationMs: 6000, kind: 'info', ...t }, ...prev]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}

      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex max-h-[calc(100svh-2rem)] w-full max-w-sm flex-col-reverse gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const { title, message, kind = 'info', durationMs = 6000 } = toast;

  React.useEffect(() => {
    const t = setTimeout(onDone, durationMs);
    return () => clearTimeout(t);
  }, [durationMs, onDone]);

  const tone =
    kind === 'success'
      ? 'border-emerald-400/50 bg-emerald-50 text-emerald-900 dark:border-emerald-300/30 dark:bg-emerald-900/20 dark:text-emerald-100'
      : kind === 'warning'
      ? 'border-amber-400/50 bg-amber-50 text-amber-900 dark:border-amber-300/30 dark:bg-amber-900/20 dark:text-amber-100'
      : kind === 'error'
      ? 'border-rose-400/50 bg-rose-50 text-rose-900 dark:border-rose-300/30 dark:bg-rose-900/20 dark:text-rose-100'
      : 'border-slate-300/60 bg-white/80 text-slate-900 dark:border-slate-300/20 dark:bg-slate-900/70 dark:text-slate-100';

  return (
    <div className="pointer-events-auto">
      <div
        role="status"
        aria-live="polite"
        className={`group relative w-full overflow-hidden rounded-xl border shadow-lg backdrop-blur-sm ${tone}`}
      >
        <div className="flex items-start gap-3 p-3">
          <div className="mt-[2px] h-2.5 w-2.5 shrink-0 rounded-full bg-current/70" />
          <div className="min-w-0 flex-1">
            {title && <div className="truncate text-sm font-semibold">{title}</div>}
            {message && <div className="mt-0.5 text-sm leading-snug opacity-90">{message}</div>}
          </div>
          <button
            onClick={onDone}
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-xs/none opacity-60 ring-1 ring-current/15 transition hover:opacity-100"
            aria-label="Kapat"
            title="Kapat"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
