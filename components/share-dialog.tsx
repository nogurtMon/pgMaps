"use client";
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Loader2, Lock, Globe, EyeOff, RefreshCw } from "lucide-react";
import type { MapLayer } from "@/lib/types";
import type { MapView } from "@/components/maplibre-map";

export interface ShareState {
  name?: string;
  layers: Array<{
    id: string;
    table: MapLayer["table"];
    connectionId: string;
    visible: boolean;
    style: MapLayer["style"];
    controls: MapLayer["controls"];
    geomTypeOverride?: string | null;
  }>;
  basemap: string;
  view?: { longitude: number; latitude: number; zoom: number };
}

type Visibility = "public" | "password";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  layers: MapLayer[];
  basemap: string;
  view?: MapView;
  mapName?: string | null;
  markdown?: string;
  activeViewId?: string | null;
  shareId: string | null;
  onShareIdChange: (id: string | null) => void;
}

function shareUrl(id: string) {
  return `${window.location.origin}/share/${id}`;
}

function embedCode(id: string) {
  const url = shareUrl(id);
  return `<iframe src="${url}" width="100%" height="500" style="border:none;border-radius:8px;" allowfullscreen></iframe>`;
}

export function ShareDialog({ open, onOpenChange, layers, basemap, view, mapName, markdown, activeViewId, shareId, onShareIdChange }: Props) {
  const [phase, setPhase] = React.useState<"idle" | "saving" | "done" | "error">("idle");
  const [visibility, setVisibility] = React.useState<Visibility>("public");
  const [password, setPassword] = React.useState("");
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedEmbed, setCopiedEmbed] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");

  // Reopen to the right phase — if a link exists, go straight to done
  React.useEffect(() => {
    if (open) {
      setPhase(shareId ? "done" : "idle");
      setErrorMsg("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function buildPayload() {
    return {
      layers: layers.map((l) => ({
        id: l.id,
        table: l.table,
        connectionId: l.connectionId,
        visible: l.visible,
        style: l.style,
        controls: l.controls,
        geomTypeOverride: l.geomTypeOverride ?? null,
      })),
      basemap,
      view: view ? { longitude: view.longitude, latitude: view.latitude, zoom: view.zoom } : undefined,
      name: mapName ?? "Untitled Map",
      password: visibility === "password" ? password : undefined,
      markdown: markdown || undefined,
    };
  }

  async function generateShare() {
    setPhase("saving");
    setErrorMsg("");
    try {
      let id: string;
      if (activeViewId) {
        // Reuse the existing view row — just make it public
        const res = await fetch(`/api/share/${activeViewId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
        id = activeViewId;
      } else {
        const res = await fetch("/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
        id = data.id;
      }
      onShareIdChange(id);
      setPhase("done");
    } catch (e: any) {
      setErrorMsg(e.message ?? "Unknown error");
      setPhase("error");
    }
  }

  async function updateShare() {
    if (!shareId) return;
    setPhase("saving");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/share/${shareId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
      setPhase("done");
    } catch (e: any) {
      setErrorMsg(e.message ?? "Unknown error");
      setPhase("error");
    }
  }

  async function makePrivate() {
    if (!shareId) return;
    try { await fetch(`/api/share/${shareId}`, { method: "DELETE" }); } catch {}
    onShareIdChange(null);
    setPassword("");
    setVisibility("public");
    setPhase("idle");
  }

  async function copy(text: string, which: "link" | "embed") {
    await navigator.clipboard.writeText(text);
    if (which === "link") { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }
    else { setCopiedEmbed(true); setTimeout(() => setCopiedEmbed(false), 2000); }
  }

  const url = shareId ? shareUrl(shareId) : "";
  const embed = shareId ? embedCode(shareId) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          <DialogDescription>
            Generate a public read-only link. Anyone with the link can view the map — no login required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {phase === "idle" && (
            <>
              <div className="bg-muted/40 rounded px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{layers.length} {layers.length === 1 ? "layer" : "layers"}</span>
                {" · "}{basemap} basemap
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium">Link access</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVisibility("public")}
                    className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-md border text-sm transition-colors ${visibility === "public" ? "border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:border-border"}`}
                  >
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    <div className="text-left">
                      <p className="text-xs font-medium leading-tight">Public</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Anyone with the link</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setVisibility("password")}
                    className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-md border text-sm transition-colors ${visibility === "password" ? "border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:border-border"}`}
                  >
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    <div className="text-left">
                      <p className="text-xs font-medium leading-tight">Password</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Requires a password</p>
                    </div>
                  </button>
                </div>
                {visibility === "password" && (
                  <Input
                    type="password"
                    placeholder="Set a password…"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="text-sm h-8"
                    autoFocus
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button
                  onClick={generateShare}
                  disabled={layers.length === 0 || (visibility === "password" && !password.trim())}
                >
                  Generate link
                </Button>
              </div>
            </>
          )}

          {phase === "saving" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Generating…
            </div>
          )}

          {phase === "error" && (
            <>
              <p className="text-sm text-destructive">{errorMsg}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                <Button onClick={generateShare}>Retry</Button>
              </div>
            </>
          )}

          {phase === "done" && shareId && (
            <>
              {visibility === "password" && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Lock className="h-2.5 w-2.5" /> Password protected
                </span>
              )}

              <div className="space-y-1.5">
                <p className="text-xs font-medium">Share link</p>
                <div className="flex gap-2">
                  <Input value={url} readOnly className="text-xs flex-1" onClick={(e) => (e.target as HTMLInputElement).select()} />
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => copy(url, "link")}>
                    {copiedLink ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium">Embed code</p>
                <div className="flex gap-2">
                  <Input value={embed} readOnly className="text-xs flex-1" onClick={(e) => (e.target as HTMLInputElement).select()} />
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => copy(embed, "embed")}>
                    {copiedEmbed ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Paste into any webpage to embed this map.</p>
              </div>

              <div className="flex items-center justify-between pt-1 border-t">
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive h-7 text-xs gap-1" onClick={makePrivate}>
                  <EyeOff className="h-3 w-3" /> Make private
                </Button>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={updateShare}>
                    <RefreshCw className="h-3 w-3" /> Update
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenChange(false)}>Done</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
