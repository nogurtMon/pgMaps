"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useConnection } from "@/hooks/use-connection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { NewMapDialog } from "@/components/new-map-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Map, Plus, Archive, ArchiveRestore, Folder, FolderOpen,
  Loader2, Lightbulb, Bug, ChevronDown, ChevronRight, Sun, Moon,
  Home as HomeIcon, FilePlus, Copy, Pencil, Trash2, FolderInput, FolderMinus, Check, X, GripVertical,
  LayoutTemplate, Star,
} from "lucide-react";
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter, DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SavedView {
  id: string;
  connection_id: string;
  name: string;
  state_json: { layers: any[]; basemap?: string };
  is_public: boolean;
  archived: boolean;
  is_template: boolean;
  folder_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface MapFolder {
  id: string;
  name: string;
  map_count: number;
  sort_order: number;
  created_at: string;
}

// ── SortableFolderRow ──────────────────────────────────────────────────────────

interface SortableFolderRowProps {
  f: MapFolder;
  isOverWithMap: boolean;
  renamingId: string | null;
  renameValue: string;
  onSetRenamingId: (id: string | null) => void;
  onSetRenameValue: (v: string) => void;
  onRenameSubmit: (id: string) => void;
  onDelete: (f: MapFolder) => void;
  onNavigate: (id: string) => void;
}

function SortableFolderRow({
  f, isOverWithMap, renamingId, renameValue,
  onSetRenamingId, onSetRenameValue, onRenameSubmit, onDelete, onNavigate,
}: SortableFolderRowProps) {
  const isRenaming = renamingId === f.id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: f.id,
    data: { type: "folder" },
    disabled: isRenaming,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group flex items-center px-2 py-2 bg-card transition-colors ${
        isRenaming ? "" : "cursor-pointer"
      } ${
        isOverWithMap
          ? "bg-primary/10 ring-1 ring-inset ring-primary/40"
          : "hover:bg-muted/40"
      }`}
    >
      <div className="shrink-0 p-1 opacity-0 group-hover:opacity-100 text-muted-foreground cursor-grab active:cursor-grabbing">
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {isRenaming ? (
        <form
          className="flex items-center gap-2 flex-1 min-w-0"
          onSubmit={(e) => { e.preventDefault(); onRenameSubmit(f.id); }}
        >
          <Folder className="h-4 w-4 text-primary shrink-0" />
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => onSetRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") onSetRenamingId(null); }}
            className="flex-1 text-sm bg-transparent border-b border-primary outline-none"
          />
          <button type="submit" className="p-0.5 text-primary"><Check className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => onSetRenamingId(null)} className="p-0.5 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      ) : (
        <>
          <button
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left pl-0.5"
            onClick={() => onNavigate(f.id)}
          >
            <Folder className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm truncate">{f.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {Number(f.map_count) === 1 ? "1 map" : `${f.map_count} maps`}
            </span>
          </button>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
            <button
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Rename folder"
              onClick={() => { onSetRenamingId(f.id); onSetRenameValue(f.name); }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
              title="Delete folder"
              onClick={() => onDelete(f)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── TemplateRow ────────────────────────────────────────────────────────────────

interface TemplateRowProps {
  t: SavedView;
  creating: boolean;
  onNavigate: (id: string) => void;
  onCreate: (t: SavedView) => void;
  onRemove: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}

function TemplateRow({ t, creating, onNavigate, onCreate, onRemove, onDelete }: TemplateRowProps) {
  return (
    <div
      className="group flex items-center px-4 py-2 bg-card hover:bg-muted/40 transition-colors cursor-pointer"
      onClick={() => onNavigate(t.id)}
    >
      <LayoutTemplate className="h-3.5 w-3.5 text-primary shrink-0 mr-2.5" />
      <span className="flex-1 text-sm truncate">{t.name}</span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
        <button
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
          onClick={(e) => { e.stopPropagation(); onCreate(t); }}
          disabled={creating}
          title="Create new map from this template"
        >
          {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Use
        </button>
        <button
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); onRemove(t.id); }}
          title="Remove from templates"
        >
          <Star className="h-3.5 w-3.5 fill-current text-amber-400" />
        </button>
        <button
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(t.id, t.name); }}
          title="Delete template permanently"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── SortableMapRow ─────────────────────────────────────────────────────────────

interface SortableMapRowProps {
  v: SavedView;
  folders: MapFolder[];
  duplicating: string | null;
  showArchived: boolean;
  onNavigate: (id: string) => void;
  onDuplicate: (v: SavedView) => void;
  onMoveToFolder: (viewId: string, folderId: string | null) => void;
  onSaveAsTemplate: (v: SavedView) => void;
  onArchive: (id: string, archive: boolean) => void;
  onDelete: (id: string, name: string) => void;
}

function SortableMapRow({
  v, folders, duplicating, showArchived,
  onNavigate, onDuplicate, onMoveToFolder, onSaveAsTemplate, onArchive, onDelete,
}: SortableMapRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: v.id,
    data: { type: "map" },
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group flex items-center px-2 py-2 bg-card hover:bg-muted/40 transition-colors cursor-pointer"
      onClick={() => onNavigate(v.id)}
    >
      <div className="shrink-0 p-1 opacity-0 group-hover:opacity-100 text-muted-foreground cursor-grab active:cursor-grabbing">
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      <span className="flex-1 text-sm truncate pl-0.5">{v.name}</span>

      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
        {!v.archived && (
          <button
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onDuplicate(v); }}
            title="Duplicate map"
            disabled={duplicating === v.id}
          >
            {duplicating === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}

        {!showArchived && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Move to folder"
                onClick={(e) => e.stopPropagation()}
              >
                <FolderInput className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {folders.length === 0 && (
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">No folders yet</DropdownMenuItem>
              )}
              {folders.map((f) => (
                <DropdownMenuItem
                  key={f.id}
                  disabled={v.folder_id === f.id}
                  onClick={() => onMoveToFolder(v.id, f.id)}
                  className="flex items-center gap-2 text-xs"
                >
                  <Folder className="h-3.5 w-3.5 text-primary" />
                  {f.name}
                  {v.folder_id === f.id && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
              ))}
              {v.folder_id && (
                <>
                  {folders.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={() => onMoveToFolder(v.id, null)}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <FolderMinus className="h-3.5 w-3.5" /> Remove from folder
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {!v.archived && (
          <button
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-amber-400"
            onClick={(e) => { e.stopPropagation(); onSaveAsTemplate(v); }}
            title="Save as template"
          >
            <Star className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); onArchive(v.id, !v.archived); }}
          title={v.archived ? "Unarchive" : "Archive"}
        >
          {v.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
        </button>

        {v.archived && (
          <button
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(v.id, v.name); }}
            title="Delete permanently"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── MapsPage ───────────────────────────────────────────────────────────────────

export default function MapsPage() {
  const { connectionId } = useConnection();
  const [views, setViews] = React.useState<SavedView[]>([]);
  const [templates, setTemplates] = React.useState<SavedView[]>([]);
  const [newMapDialogOpen, setNewMapDialogOpen] = React.useState(false);
  const [creatingFromTemplate, setCreatingFromTemplate] = React.useState(false);
  const [useTemplateSource, setUseTemplateSource] = React.useState<SavedView | null>(null);
  const [useTemplateName, setUseTemplateName] = React.useState("");
  const [useTemplateFolderId, setUseTemplateFolderId] = React.useState<string | null>(null);
  const [folders, setFolders] = React.useState<MapFolder[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [duplicating, setDuplicating] = React.useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(null);

  const [creatingFolder, setCreatingFolder] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState("");
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");

  // Confirm dialog state
  const [confirmState, setConfirmState] = React.useState<{
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({ open: false, title: "", onConfirm: () => {} });

  function openConfirm(opts: { title: string; description?: string; confirmLabel?: string; onConfirm: () => void }) {
    setConfirmState({ open: true, ...opts });
  }

  // DnD state
  const [dragActive, setDragActive] = React.useState<
    { type: "folder"; item: MapFolder } | { type: "map"; item: SavedView } | null
  >(null);
  const [dragOverFolderId, setDragOverFolderId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const router = useRouter();
  const { theme, setTheme } = useTheme();

  React.useEffect(() => {
    loadAll();
  }, [showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open folder from ?folder= query param (e.g. breadcrumb link from map editor)
  React.useEffect(() => {
    const folderId = new URLSearchParams(window.location.search).get("folder");
    if (folderId) setCurrentFolderId(folderId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [viewsRes, foldersRes] = await Promise.all([
        fetch(`/api/pg/saved-views?archived=${showArchived}`),
        fetch("/api/pg/folders"),
      ]);
      const [viewsData, foldersData] = await Promise.all([viewsRes.json(), foldersRes.json()]);
      if (!viewsRes.ok) throw new Error(viewsData.error ?? "Failed to load maps");
      const allViews = viewsData.views ?? [];
      const regularViews = allViews.filter((v: any) => !v.is_template);
      const templateViews = allViews.filter((v: any) => v.is_template);
      setViews(regularViews.map((v: any, i: number) => ({
        ...v, sort_order: Number(v.sort_order) > 0 ? Number(v.sort_order) : i + 1,
      })));
      setTemplates(templateViews);
      setFolders((foldersData.folders ?? []).map((f: any, i: number) => ({
        ...f, sort_order: Number(f.sort_order) > 0 ? Number(f.sort_order) : i + 1,
      })));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function persistReorder(type: "folders" | "maps", ids: string[]) {
    try {
      await fetch("/api/pg/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ids }),
      });
    } catch {}
  }

  function deleteView(id: string, name: string) {
    openConfirm({
      title: `Delete "${name}"?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          await fetch(`/api/pg/saved-views/${id}`, { method: "DELETE" });
          setViews((prev) => prev.filter((v) => v.id !== id));
        } catch { setError("Failed to delete map"); }
      },
    });
  }

  // Template naming dialog state
  const [templateSource, setTemplateSource] = React.useState<SavedView | null>(null);
  const [templateNameInput, setTemplateNameInput] = React.useState("");
  const [savingTemplate, setSavingTemplate] = React.useState(false);

  function openSaveAsTemplateDialog(source: SavedView) {
    setTemplateSource(source);
    setTemplateNameInput(source.name);
  }

  async function confirmSaveAsTemplate() {
    if (!templateSource) return;
    const name = templateNameInput.trim();
    if (!name) return;
    setSavingTemplate(true);
    try {
      const newId = crypto.randomUUID();
      const res = await fetch("/api/pg/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: templateSource.connection_id,
          id: newId,
          name,
          state: templateSource.state_json,
        }),
      });
      if (!res.ok) throw new Error();
      await fetch(`/api/pg/saved-views/${newId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_template: true }),
      });
      setTemplates(prev => [...prev, {
        ...templateSource,
        id: newId,
        name,
        is_template: true,
        folder_id: null,
        sort_order: prev.length + 1,
      }]);
      setTemplateSource(null);
    } catch { setError("Failed to save as template"); }
    finally { setSavingTemplate(false); }
  }

  async function removeFromTemplate(id: string) {
    openConfirm({
      title: "Remove template?",
      description: "The original map will remain unchanged.",
      confirmLabel: "Remove",
      onConfirm: async () => {
        try {
          await fetch(`/api/pg/saved-views/${id}`, { method: "DELETE" });
          setTemplates(prev => prev.filter(t => t.id !== id));
        } catch { setError("Failed to remove template"); }
      },
    });
  }

  function openUseTemplateDialog(t: SavedView) {
    setUseTemplateSource(t);
    setUseTemplateName(t.name);
    setUseTemplateFolderId(null);
  }

  async function confirmCreateFromTemplate() {
    if (!useTemplateSource) return;
    const name = useTemplateName.trim();
    if (!name) return;
    setCreatingFromTemplate(true);
    try {
      const newId = crypto.randomUUID();
      const res = await fetch("/api/pg/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: useTemplateSource.connection_id,
          id: newId,
          name,
          state: useTemplateSource.state_json,
          folder_id: useTemplateFolderId,
        }),
      });
      if (!res.ok) throw new Error();
      router.push(`/map?view=${newId}`);
    } catch {
      setError("Failed to create map from template");
      setCreatingFromTemplate(false);
    }
  }

  function deleteTemplate(id: string, name: string) {
    openConfirm({
      title: `Delete template "${name}"?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          await fetch(`/api/pg/saved-views/${id}`, { method: "DELETE" });
          setTemplates(prev => prev.filter(t => t.id !== id));
        } catch { setError("Failed to delete template"); }
      },
    });
  }

  async function archiveView(id: string, archive: boolean) {
    try {
      await fetch(`/api/pg/saved-views/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: archive }),
      });
      setViews((prev) => prev.filter((v) => v.id !== id));
    } catch {}
  }

  async function moveToFolder(viewId: string, folderId: string | null) {
    try {
      await fetch(`/api/pg/saved-views/${viewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: folderId }),
      });
      setViews((prev) => prev.map((v) => v.id === viewId ? { ...v, folder_id: folderId } : v));
      setFolders((prev) => prev.map((f) => {
        const wasIn = views.find(v => v.id === viewId)?.folder_id === f.id;
        const goesIn = folderId === f.id;
        if (wasIn && !goesIn) return { ...f, map_count: Math.max(0, Number(f.map_count) - 1) };
        if (!wasIn && goesIn) return { ...f, map_count: Number(f.map_count) + 1 };
        return f;
      }));
    } catch {}
  }

  async function duplicateView(v: SavedView) {
    setDuplicating(v.id);
    try {
      const newId = crypto.randomUUID();
      const res = await fetch("/api/pg/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: v.connection_id, id: newId, name: `Copy of ${v.name}`, state: v.state_json }),
      });
      if (!res.ok) throw new Error();
      router.push(`/map?view=${newId}`);
    } catch {
      setError("Failed to duplicate map");
    } finally {
      setDuplicating(null);
    }
  }

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) { setCreatingFolder(false); return; }
    const id = crypto.randomUUID();
    try {
      await fetch("/api/pg/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      });
      setFolders((prev) => {
        const next = [...prev, { id, name, map_count: 0, sort_order: prev.length + 1, created_at: new Date().toISOString() }];
        return next.sort((a, b) => a.sort_order - b.sort_order);
      });
    } catch { setError("Failed to create folder"); }
    setCreatingFolder(false);
    setNewFolderName("");
  }

  async function renameFolder(id: string) {
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    try {
      await fetch(`/api/pg/folders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setFolders((prev) => prev.map((f) => f.id === id ? { ...f, name } : f));
    } catch { setError("Failed to rename folder"); }
    setRenamingId(null);
  }

  function deleteFolder(f: MapFolder) {
    openConfirm({
      title: `Delete folder "${f.name}"?`,
      description: "Maps inside will become unfiled.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          await fetch(`/api/pg/folders/${f.id}`, { method: "DELETE" });
          setFolders((prev) => prev.filter((x) => x.id !== f.id));
          setViews((prev) => prev.map((v) => v.folder_id === f.id ? { ...v, folder_id: null } : v));
          if (currentFolderId === f.id) setCurrentFolderId(null);
        } catch { setError("Failed to delete folder"); }
      },
    });
  }

  // ── DnD handlers ────────────────────────────────────────────────────────────

  function handleDragStart({ active }: DragStartEvent) {
    const type = active.data.current?.type as "folder" | "map" | undefined;
    if (type === "folder") {
      const item = folders.find(f => f.id === active.id);
      if (item) setDragActive({ type: "folder", item });
    } else if (type === "map") {
      const item = views.find(v => v.id === active.id);
      if (item) setDragActive({ type: "map", item });
    }
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) { setDragOverFolderId(null); return; }
    if (active.data.current?.type === "map") {
      const isFolder = folders.some(f => f.id === over.id);
      setDragOverFolderId(isFolder ? String(over.id) : null);
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragActive(null);
    setDragOverFolderId(null);
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type as "folder" | "map" | undefined;
    const overId = String(over.id);

    if (activeType === "folder") {
      const oldIdx = sortedFolders.findIndex(f => f.id === active.id);
      const newIdx = sortedFolders.findIndex(f => f.id === overId);
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        const newOrder = arrayMove(sortedFolders, oldIdx, newIdx).map((f, i) => ({ ...f, sort_order: i + 1 }));
        setFolders(newOrder);
        persistReorder("folders", newOrder.map(f => f.id));
      }
    } else if (activeType === "map") {
      const droppedOnFolder = folders.find(f => f.id === overId);
      if (droppedOnFolder) {
        // Drop map onto folder row → move into folder
        moveToFolder(String(active.id), overId);
      } else {
        // Reorder maps within the visible list
        const oldIdx = visibleViews.findIndex(v => v.id === active.id);
        const newIdx = visibleViews.findIndex(v => v.id === overId);
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const newOrder = arrayMove(visibleViews, oldIdx, newIdx);
          const newSortOrders: Record<string, number> = {};
          newOrder.forEach((v, i) => { newSortOrders[v.id] = i + 1; });
          setViews(prev => prev.map(v =>
            newSortOrders[v.id] !== undefined ? { ...v, sort_order: newSortOrders[v.id] } : v
          ));
          persistReorder("maps", newOrder.map(v => v.id));
        }
      }
    }
  }

  function handleDragCancel() {
    setDragActive(null);
    setDragOverFolderId(null);
  }

  // ── Derived lists ────────────────────────────────────────────────────────────

  const sortedFolders = React.useMemo(
    () => [...folders].sort((a, b) => a.sort_order - b.sort_order),
    [folders]
  );

  const visibleViews = React.useMemo(() => {
    const filtered = currentFolderId
      ? views.filter(v => v.folder_id === currentFolderId)
      : views.filter(v => v.folder_id === null);
    return [...filtered].sort((a, b) => a.sort_order - b.sort_order);
  }, [views, currentFolderId]);

  const currentFolder = folders.find((f) => f.id === currentFolderId) ?? null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-background border-b px-3 py-1.5 flex items-center gap-3 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="shrink-0 flex items-center gap-0.5 rounded-md p-1 hover:bg-muted transition-colors" title="Menu">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Postgresql_elephant.png" alt="PostGIS" className="w-6 h-6" />
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem asChild>
              <a href="/maps" className="flex items-center gap-2"><HomeIcon className="h-3.5 w-3.5" /> Home</a>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setNewMapDialogOpen(true)} className="flex items-center gap-2">
              <FilePlus className="h-3.5 w-3.5" /> New map
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="flex items-center gap-2">
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="https://github.com/nogurtMon/postgis-frontend/issues/new?template=feature_request.md" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <Lightbulb className="h-3.5 w-3.5" /> Request a feature
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="https://github.com/nogurtMon/postgis-frontend/issues/new?template=bug_report.md" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <Bug className="h-3.5 w-3.5" /> Report a bug
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="https://github.com/nogurtMon/postgis-frontend" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
                Visit GitHub
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-7 shrink-0" />
      </header>

      {/* Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">

        {/* Title row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {currentFolder ? (
              <>
                <button
                  onClick={() => setCurrentFolderId(null)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Your Maps
                </button>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold flex items-center gap-1.5">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  {currentFolder.name}
                </span>
              </>
            ) : (
              <h1 className="text-xl font-semibold">Your Maps</h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? <HomeIcon className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
              {showArchived ? "Home" : "Archived"}
            </Button>
            {!currentFolder && (
              <Button
                size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => { setCreatingFolder(true); setNewFolderName(""); }}
              >
                <Folder className="h-3 w-3" /> New folder
              </Button>
            )}
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setNewMapDialogOpen(true)}>
              <Plus className="h-3 w-3" /> New map
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive mb-4 rounded border border-destructive/30 bg-destructive/10 px-3 py-2">{error}</p>
        )}

        {loading && (
          <div className="text-center py-24">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="space-y-6">
              {/* Templates section — only at root, not when viewing archived */}
              {!currentFolder && !showArchived && templates.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Templates</p>
                  <div className="flex flex-col divide-y border rounded-lg overflow-hidden">
                    {templates.map((t) => (
                      <TemplateRow
                        key={t.id}
                        t={t}
                        creating={creatingFromTemplate && useTemplateSource?.id === t.id}
                        onNavigate={(id) => router.push(`/map?view=${id}`)}
                        onCreate={openUseTemplateDialog}
                        onRemove={removeFromTemplate}
                        onDelete={deleteTemplate}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Folders section — only at root, not when viewing archived */}
              {!currentFolder && !showArchived && (sortedFolders.length > 0 || creatingFolder) && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Folders</p>
                  <div className="flex flex-col divide-y border rounded-lg overflow-hidden">
                    <SortableContext items={sortedFolders.map(f => f.id)} strategy={verticalListSortingStrategy}>
                      {sortedFolders.map((f) => (
                        <SortableFolderRow
                          key={f.id}
                          f={f}
                          isOverWithMap={dragOverFolderId === f.id}
                          renamingId={renamingId}
                          renameValue={renameValue}
                          onSetRenamingId={setRenamingId}
                          onSetRenameValue={setRenameValue}
                          onRenameSubmit={renameFolder}
                          onDelete={deleteFolder}
                          onNavigate={setCurrentFolderId}
                        />
                      ))}
                    </SortableContext>

                    {creatingFolder && (
                      <form
                        className="flex items-center gap-2.5 px-4 py-2 bg-card"
                        onSubmit={(e) => { e.preventDefault(); createFolder(); }}
                      >
                        <div className="w-5 shrink-0" />
                        <Folder className="h-4 w-4 text-primary shrink-0" />
                        <input
                          autoFocus
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); } }}
                          placeholder="Folder name"
                          className="flex-1 text-sm bg-transparent border-b border-primary outline-none placeholder:text-muted-foreground/50"
                        />
                        <button type="submit" className="p-0.5 text-primary"><Check className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => { setCreatingFolder(false); setNewFolderName(""); }} className="p-0.5 text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}

              {/* Maps list */}
              <div>
                {!currentFolder && !showArchived && (sortedFolders.length > 0 || creatingFolder) && visibleViews.length > 0 && (
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    Unfiled maps
                  </p>
                )}

                {visibleViews.length === 0 && (showArchived || currentFolder) && (
                  <div className="text-center py-16">
                    <Map className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-4">
                      {showArchived ? "No archived maps." : "No maps in this folder."}
                    </p>
                  </div>
                )}

                {visibleViews.length === 0 && !showArchived && !currentFolder && sortedFolders.length === 0 && templates.length === 0 && !creatingFolder && (
                  <div className="text-center py-16">
                    <Map className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-4">
                      No maps yet. Create your first map to get started.
                    </p>
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setNewMapDialogOpen(true)}>
                      <Plus className="h-3 w-3" /> New map
                    </Button>
                  </div>
                )}

                {visibleViews.length > 0 && (
                  <div className="flex flex-col divide-y border rounded-lg overflow-hidden">
                    <SortableContext items={visibleViews.map(v => v.id)} strategy={verticalListSortingStrategy}>
                      {visibleViews.map((v) => (
                        <SortableMapRow
                          key={v.id}
                          v={v}
                          folders={sortedFolders}
                          duplicating={duplicating}
                          showArchived={showArchived}
                          onNavigate={(id) => router.push(`/map?view=${id}`)}
                          onDuplicate={duplicateView}
                          onMoveToFolder={moveToFolder}
                          onSaveAsTemplate={openSaveAsTemplateDialog}
                          onArchive={archiveView}
                          onDelete={deleteView}
                        />
                      ))}
                    </SortableContext>
                  </div>
                )}
              </div>
            </div>

            {/* Drag overlay — floating ghost while dragging */}
            <DragOverlay dropAnimation={null}>
              {dragActive?.type === "folder" && (
                <div className="flex items-center gap-2.5 px-4 py-2 bg-card border rounded-lg shadow-lg opacity-95 text-sm">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  <Folder className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">{dragActive.item.name}</span>
                </div>
              )}
              {dragActive?.type === "map" && (
                <div className="flex items-center gap-2.5 px-4 py-2 bg-card border rounded-lg shadow-lg opacity-95 text-sm">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{dragActive.item.name}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      <NewMapDialog open={newMapDialogOpen} onOpenChange={setNewMapDialogOpen} />

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={confirmState.onConfirm}
      />

      {/* Save as template dialog */}
      <Dialog open={!!templateSource} onOpenChange={(open) => { if (!open) setTemplateSource(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A copy of this map will be saved as a template. The original map stays unchanged.
          </p>
          <Input
            value={templateNameInput}
            onChange={(e) => setTemplateNameInput(e.target.value)}
            placeholder="Template name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmSaveAsTemplate();
              if (e.key === "Escape") setTemplateSource(null);
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateSource(null)} disabled={savingTemplate}>
              Cancel
            </Button>
            <Button onClick={confirmSaveAsTemplate} disabled={savingTemplate || !templateNameInput.trim()}>
              {savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Use template dialog */}
      <Dialog open={!!useTemplateSource} onOpenChange={(open) => { if (!open && !creatingFromTemplate) setUseTemplateSource(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create map from template</DialogTitle>
            <DialogDescription>Name your new map and optionally place it in a folder.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Map name</label>
              <Input
                value={useTemplateName}
                onChange={(e) => setUseTemplateName(e.target.value)}
                placeholder="Map name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmCreateFromTemplate();
                  if (e.key === "Escape" && !creatingFromTemplate) setUseTemplateSource(null);
                }}
              />
            </div>
            {folders.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Folder (optional)</label>
                <Select
                  value={useTemplateFolderId ?? "none"}
                  onValueChange={(v) => setUseTemplateFolderId(v === "none" ? null : v)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="No folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No folder</SelectItem>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUseTemplateSource(null)} disabled={creatingFromTemplate}>
              Cancel
            </Button>
            <Button onClick={confirmCreateFromTemplate} disabled={creatingFromTemplate || !useTemplateName.trim()}>
              {creatingFromTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Create map
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
