"use client";
import React from "react";

export type TaskPhase = "importing" | "cancelling" | "cancelled" | "interrupted" | "done" | "error";

export interface ImportTask {
  id: string;
  type: "arcgis" | "file";
  label: string;
  schema: string;
  table: string;
  connectionId: string;
  phase: TaskPhase;
  done: number;
  total: number;
  error?: string;
  startedAt: number;
  resumeOffset?: number;
}

interface Ctx {
  tasks: ImportTask[];
  addTask(task: ImportTask): void;
  updateTask(id: string, patch: Partial<ImportTask>): void;
  removeTask(id: string): void;
  registerCancel(id: string, fn: () => void): void;
  cancelTask(id: string): void;
  registerResume(id: string, fn: () => void): void;
  resumeTask(id: string): void;
}

const ImportTasksContext = React.createContext<Ctx | null>(null);

export function ImportTasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = React.useState<ImportTask[]>([]);
  const cancelFns = React.useRef<Map<string, () => void>>(new Map());
  const resumeFns = React.useRef<Map<string, () => void>>(new Map());

  const addTask = React.useCallback((task: ImportTask) => {
    setTasks((prev) => [task, ...prev]);
  }, []);

  const updateTask = React.useCallback((id: string, patch: Partial<ImportTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const removeTask = React.useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    cancelFns.current.delete(id);
    resumeFns.current.delete(id);
  }, []);

  const registerCancel = React.useCallback((id: string, fn: () => void) => {
    cancelFns.current.set(id, fn);
  }, []);

  const cancelTask = React.useCallback((id: string) => {
    cancelFns.current.get(id)?.();
  }, []);

  const registerResume = React.useCallback((id: string, fn: () => void) => {
    resumeFns.current.set(id, fn);
  }, []);

  const resumeTask = React.useCallback((id: string) => {
    resumeFns.current.get(id)?.();
  }, []);

  return (
    <ImportTasksContext.Provider value={{ tasks, addTask, updateTask, removeTask, registerCancel, cancelTask, registerResume, resumeTask }}>
      {children}
    </ImportTasksContext.Provider>
  );
}

export function useImportTasks(): Ctx {
  const ctx = React.useContext(ImportTasksContext);
  if (!ctx) throw new Error("useImportTasks must be used within ImportTasksProvider");
  return ctx;
}
