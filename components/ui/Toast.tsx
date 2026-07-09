"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (t: {
    title: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
  }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const config: Record<
  ToastVariant,
  { icon: React.ElementType; accent: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle2,
    accent: "border-l-success",
    iconColor: "text-success",
  },
  error: {
    icon: AlertCircle,
    accent: "border-l-red-500",
    iconColor: "text-red-500",
  },
  info: {
    icon: Info,
    accent: "border-l-cool-blue",
    iconColor: "text-cool-blue",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    ({ title, description, variant = "info", duration = 4000 }) => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-2">
            {toasts.map((t) => {
              const { icon: Icon, accent, iconColor } = config[t.variant];
              return (
                <div
                  key={t.id}
                  className={cn(
                    "pointer-events-auto flex animate-toast-in items-start gap-3 rounded-xl border border-l-4 border-gray-100 bg-white p-4 shadow-soft",
                    accent,
                  )}
                >
                  <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconColor)} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-dark-base">
                      {t.title}
                    </p>
                    {t.description && (
                      <p className="mt-0.5 text-sm text-gray-500">
                        {t.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss"
                    className="rounded p-0.5 text-gray-400 transition-colors hover:text-dark-base"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
