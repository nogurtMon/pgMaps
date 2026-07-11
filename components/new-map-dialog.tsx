"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { FilePlus, LayoutTemplate, Loader2, Plus, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface SavedView {
  id: string;
  connection_id: string;
  name: string;
  state_json: any;
  is_template: boolean;
}

interface MapFolder {
  id: string;
  name: string;
}

type Step = "pick" | "blank-name" | "templates" | "template-name";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewMapDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("pick");
  const [templates, setTemplates] = React.useState<SavedView[]>([]);
  const [folders, setFolders] = React.useState<MapFolder[]>([]);
  const [loadingData, setLoadingData] = React.useState(false);
  const [selectedTemplate, setSelectedTemplate] = React.useState<SavedView | null>(null);
  const [mapName, setMapName] = React.useState("");
  const [folderId, setFolderId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setStep("pick");
      setSelectedTemplate(null);
      setMapName("");
      setFolderId(null);
      setCreating(false);
    }
  }, [open]);

  async function openBlankName() {
    setLoadingData(true);
    setStep("blank-name");
    try {
      const res = await fetch("/api/pg/folders");
      const data = await res.json();
      setFolders(data.folders ?? []);
    } catch {}
    finally { setLoadingData(false); }
  }

  async function openTemplates() {
    setLoadingData(true);
    setStep("templates");
    try {
      const [tRes, fRes] = await Promise.all([
        fetch("/api/pg/saved-views?archived=false"),
        fetch("/api/pg/folders"),
      ]);
      const [tData, fData] = await Promise.all([tRes.json(), fRes.json()]);
      setTemplates((tData.views ?? []).filter((v: SavedView) => v.is_template));
      setFolders(fData.folders ?? []);
    } catch {}
    finally { setLoadingData(false); }
  }

  function goBlank() {
    const params = new URLSearchParams();
    if (mapName.trim()) params.set("name", mapName.trim());
    if (folderId) params.set("folder", folderId);
    onOpenChange(false);
    router.push(`/map${params.size ? `?${params}` : ""}`);
  }

  function selectTemplate(t: SavedView) {
    setSelectedTemplate(t);
    setMapName(t.name);
    setFolderId(null);
    setStep("template-name");
  }

  async function createFromTemplate() {
    if (!selectedTemplate || !mapName.trim()) return;
    setCreating(true);
    try {
      const newId = crypto.randomUUID();
      const res = await fetch("/api/pg/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: selectedTemplate.connection_id,
          id: newId,
          name: mapName.trim(),
          state: selectedTemplate.state_json,
          folder_id: folderId,
        }),
      });
      if (!res.ok) throw new Error();
      onOpenChange(false);
      router.push(`/map?view=${newId}`);
    } catch { setCreating(false); }
  }

  const title =
    step === "pick"          ? "New map" :
    step === "blank-name"    ? "Name your map" :
    step === "templates"     ? "Choose a template" :
                               "Name your map";

  const backStep: Step | null =
    step === "blank-name"    ? "pick" :
    step === "templates"     ? "pick" :
    step === "template-name" ? "templates" :
    null;

  const FolderPicker = () => folders.length === 0 ? null : (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">Folder (optional)</label>
      <Select value={folderId ?? "none"} onValueChange={v => setFolderId(v === "none" ? null : v)}>
        <SelectTrigger className="text-sm"><SelectValue placeholder="No folder" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No folder</SelectItem>
          {folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {backStep && (
              <button
                onClick={() => setStep(backStep)}
                className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Step: pick */}
        {step === "pick" && (
          <div className="grid grid-cols-2 gap-3 py-1">
            <button
              onClick={openBlankName}
              className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-muted/40 transition-colors text-center group"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                <FilePlus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-sm font-medium">Blank map</p>
                <p className="text-xs text-muted-foreground mt-0.5">Start from scratch</p>
              </div>
            </button>
            <button
              onClick={openTemplates}
              className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-muted/40 transition-colors text-center group"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                <LayoutTemplate className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-sm font-medium">From template</p>
                <p className="text-xs text-muted-foreground mt-0.5">Use a saved template</p>
              </div>
            </button>
          </div>
        )}

        {/* Step: blank name + folder */}
        {step === "blank-name" && (
          <>
            <div className="flex flex-col gap-3 py-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Map name</label>
                {loadingData ? (
                  <div className="h-9 rounded-md border bg-muted/40 animate-pulse" />
                ) : (
                  <Input
                    value={mapName}
                    onChange={e => setMapName(e.target.value)}
                    placeholder="Untitled map"
                    autoFocus
                    onKeyDown={e => { if (e.key === "Enter") goBlank(); }}
                  />
                )}
              </div>
              {!loadingData && <FolderPicker />}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("pick")}>Back</Button>
              <Button onClick={goBlank}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Create map
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step: template list */}
        {step === "templates" && (
          <div className="min-h-[160px]">
            {loadingData ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                <LayoutTemplate className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No templates yet</p>
                <p className="text-xs text-muted-foreground/70">Save a map as a template from the maps page.</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/40 transition-colors text-left"
                  >
                    <LayoutTemplate className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-sm truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: template name + folder */}
        {step === "template-name" && (
          <>
            <div className="flex flex-col gap-3 py-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Map name</label>
                <Input
                  value={mapName}
                  onChange={e => setMapName(e.target.value)}
                  placeholder="Map name"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") createFromTemplate(); }}
                />
              </div>
              <FolderPicker />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("templates")} disabled={creating}>Back</Button>
              <Button onClick={createFromTemplate} disabled={creating || !mapName.trim()}>
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                Create map
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
