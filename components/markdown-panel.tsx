"use client";
import React from "react";
import { X } from "lucide-react";
import { marked } from "marked";

marked.setOptions({ breaks: true });

interface Props {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  readOnly?: boolean;
}

const MIN_W = 200;
const MAX_W = 700;

export function MarkdownPanel({ value, onChange, onClose, readOnly }: Props) {
  const [tab, setTab] = React.useState<"edit" | "preview">("edit");
  const effectiveTab = readOnly ? "preview" : tab;
  const [width, setWidth] = React.useState(320);
  const dragRef = React.useRef<{ startX: number; startW: number } | null>(null);
  const preview = React.useMemo(() => marked.parse(value || "") as string, [value]);

  function onDragMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: width };
    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - ev.clientX;
      setWidth(Math.min(MAX_W, Math.max(MIN_W, dragRef.current.startW + delta)));
    }
    function onUp() {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className="shrink-0 border-l bg-background flex flex-col overflow-hidden relative" style={{ width }}>
      {/* Drag handle */}
      <div
        onMouseDown={onDragMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-10"
      />
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b shrink-0 bg-muted/20">
        <span className="text-xs font-semibold">Map Description</span>
        <div className="flex items-center gap-1">
          {!readOnly && (
            <div className="flex rounded border overflow-hidden text-[11px]">
              <button
                className={`px-2.5 py-1 transition-colors ${tab === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setTab("edit")}
              >Edit</button>
              <button
                className={`px-2.5 py-1 border-l transition-colors ${tab === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setTab("preview")}
              >Preview</button>
            </div>
          )}
          <button
            onClick={onClose}
            className="ml-1 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {effectiveTab === "edit" ? (
        <textarea
          className="flex-1 resize-none px-3 py-3 text-sm font-mono bg-background outline-none"
          placeholder={"# About this map\n\nDescribe what this map shows, data sources, methodology...\n\n- Key finding\n- Data source: ..."}
          value={value}
          onChange={e => onChange(e.target.value)}
          spellCheck={false}
          autoFocus
        />
      ) : (
        <div
          className="flex-1 overflow-y-auto px-4 py-3 prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: preview || "<p style=\"color:var(--muted-foreground);font-size:.8rem\">Nothing to preview.</p>" }}
        />
      )}
    </div>
  );
}
