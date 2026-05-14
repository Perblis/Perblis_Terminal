"use client";

import * as Toast from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  tone?: "neutral" | "success" | "danger";
};

type Ctx = { push: (t: Omit<ToastItem, "id">) => void };

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToasterProvider>");
  return ctx;
}

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, "id">) => {
    setItems((prev) => [...prev, { ...t, id: Date.now() + Math.random() }]);
  }, []);

  return (
    <Toast.Provider swipeDirection="right" duration={4000}>
      <ToastCtx.Provider value={{ push }}>{children}</ToastCtx.Provider>
      {items.map((t) => (
        <Toast.Root
          key={t.id}
          onOpenChange={(open) =>
            !open && setItems((prev) => prev.filter((x) => x.id !== t.id))
          }
          className={cn(
            "rounded-card border p-3 bg-surface-elevated grid gap-1 grid-cols-[1fr_auto] items-start",
            t.tone === "success" && "border-l-[3px] border-l-clear",
            t.tone === "danger" && "border-l-[3px] border-l-alert",
            (!t.tone || t.tone === "neutral") && "border-border",
          )}
        >
          <div>
            <Toast.Title className="text-[14px] font-medium">{t.title}</Toast.Title>
            {t.description ? (
              <Toast.Description className="text-[12px] text-text-secondary">
                {t.description}
              </Toast.Description>
            ) : null}
          </div>
          <Toast.Close
            className="text-text-tertiary hover:text-text-primary"
            aria-label="Dismiss"
          >
            <X size={14} strokeWidth={1.5} />
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-[320px] max-w-[calc(100vw-2.5rem)] outline-none" />
    </Toast.Provider>
  );
}
