'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { IconAlertTriangle, IconCheckCircle, IconClose } from './Icons';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  variant: ToastVariant;
  title: string;
  message: string;
  durationMs: number;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'primary';
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ToastApi {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

interface FeedbackContextValue {
  toast: ToastApi;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const VARIANT_STYLES: Record<
  ToastVariant,
  {
    container: string;
    iconWrap: string;
    defaultTitle: string;
    accentBar: string;
  }
> = {
  success: {
    container:
      'border-emerald-200 dark:border-emerald-900/70 bg-elevated text-ink',
    iconWrap:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300',
    defaultTitle: 'Berhasil',
    accentBar: 'bg-emerald-600 dark:bg-emerald-400',
  },
  error: {
    container: 'border-rose-200 dark:border-rose-900/70 bg-elevated text-ink',
    iconWrap: 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300',
    defaultTitle: 'Gagal',
    accentBar: 'bg-rose-600 dark:bg-rose-400',
  },
  warning: {
    container:
      'border-amber-200 dark:border-amber-900/70 bg-elevated text-ink',
    iconWrap:
      'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300',
    defaultTitle: 'Perhatian',
    accentBar: 'bg-amber-600 dark:bg-amber-400',
  },
  info: {
    container: 'border-line bg-elevated text-ink',
    iconWrap: 'bg-accent-soft text-accent-ink',
    defaultTitle: 'Informasi',
    accentBar: 'bg-accent',
  },
};

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  const style = VARIANT_STYLES[item.variant];

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => {
      onDismiss(item.id);
    }, item.durationMs);
    return () => window.clearTimeout(timer);
  }, [item.id, item.durationMs, paused, onDismiss]);

  return (
    <div
      role={item.variant === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`pointer-events-auto relative overflow-hidden rounded-xl border shadow-lg transition-all duration-200 animate-modal ${style.container}`}
    >
      {/* State indicator bar matching active toast variant */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-0 bottom-0 w-1 ${style.accentBar}`}
      />
      <div className="flex items-start gap-3 p-3.5 pl-4">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.iconWrap}`}
        >
          {item.variant === 'success' || item.variant === 'info' ? (
            <IconCheckCircle className="h-4 w-4" />
          ) : (
            <IconAlertTriangle className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-ink leading-tight">{item.title}</p>
          <p className="mt-1 text-xs text-ink-secondary leading-relaxed break-words">
            {item.message}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          aria-label="Tutup notifikasi"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-subtle hover:text-ink"
        >
          <IconClose className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const nextIdRef = useRef(1);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (variant: ToastVariant, message: string, title?: string) => {
      const id = nextIdRef.current++;
      const durationMs = variant === 'error' || variant === 'warning' ? 6000 : 4200;
      const item: ToastItem = {
        id,
        variant,
        title: title || VARIANT_STYLES[variant].defaultTitle,
        message,
        durationMs,
      };
      setToasts((prev) => [...prev.slice(-3), item]);
    },
    []
  );

  const toast = useMemo<ToastApi>(
    () => ({
      success: (message, title) => pushToast('success', message, title),
      error: (message, title) => pushToast('error', message, title),
      warning: (message, title) => pushToast('warning', message, title),
      info: (message, title) => pushToast('info', message, title),
    }),
    [pushToast]
  );

  const resolveConfirm = useCallback(
    (accepted: boolean) => {
      if (!pendingConfirm) return;
      setPendingConfirm(null);
      pendingConfirm.resolve(accepted);
    },
    [pendingConfirm]
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPendingConfirm((prev) => {
        if (prev) prev.resolve(false);
        return { ...options, resolve };
      });
    });
  }, []);

  useEffect(() => {
    if (!pendingConfirm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resolveConfirm(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingConfirm, resolveConfirm]);

  const contextValue = useMemo<FeedbackContextValue>(
    () => ({ toast, confirm }),
    [toast, confirm]
  );

  const confirmButtonClass =
    pendingConfirm?.tone === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-500'
      : pendingConfirm?.tone === 'warning'
      ? 'bg-amber-600 text-white hover:bg-amber-500'
      : 'bg-accent text-accent-fg hover:bg-accent-hover';

  const confirmIconWrapClass =
    pendingConfirm?.tone === 'danger'
      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
      : pendingConfirm?.tone === 'warning'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
      : 'bg-accent-soft text-accent-ink';

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}

      {/* Custom Toast Stack */}
      <div
        aria-live="polite"
        aria-label="Notifikasi sistem"
        className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-[80] flex flex-col gap-2.5 pointer-events-none"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismissToast} />
        ))}
      </div>

      {/* Custom Confirmation Dialog */}
      {pendingConfirm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 animate-backdrop"
          onClick={() => resolveConfirm(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="nims-confirm-title"
            aria-describedby="nims-confirm-desc"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-line bg-elevated p-5 shadow-2xl animate-modal space-y-4 text-xs"
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${confirmIconWrapClass}`}
              >
                <IconAlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="nims-confirm-title" className="text-sm font-bold text-ink">
                  {pendingConfirm.title}
                </h3>
                <p
                  id="nims-confirm-desc"
                  className="mt-1.5 text-xs text-ink-secondary leading-relaxed"
                >
                  {pendingConfirm.message}
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup dialog"
                onClick={() => resolveConfirm(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <button
                type="button"
                onClick={() => resolveConfirm(false)}
                className="min-h-[38px] rounded-lg border border-line bg-surface px-4 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
              >
                {pendingConfirm.cancelLabel || 'Batal'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => resolveConfirm(true)}
                className={`min-h-[38px] rounded-lg px-4 py-1.5 text-xs font-semibold shadow-xs ${confirmButtonClass}`}
              >
                {pendingConfirm.confirmLabel || 'Ya, Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return ctx;
}
