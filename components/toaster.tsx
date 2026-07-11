"use client";
import React from "react";
import { registerToastListener, unregisterToastListener } from "@/lib/toast";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

type ToastMsg = { id: string; message: string; type?: "default" | "success" | "error" };

export function Toaster() {
  const [toasts, setToasts] = React.useState<ToastMsg[]>([]);

  React.useEffect(() => {
    registerToastListener(setToasts);
    return () => unregisterToastListener();
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[200] flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2.5 bg-foreground text-background px-4 py-2.5 rounded-lg text-sm shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          {t.type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />}
          {t.type === "error" && <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />}
          {(!t.type || t.type === "default") && <Info className="h-4 w-4 shrink-0 text-sky-400" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}
