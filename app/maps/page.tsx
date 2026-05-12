"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useConnection } from "@/hooks/use-connection";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Map, Plus, Archive, ArchiveRestore,
  Loader2, Lightbulb, Bug, ChevronDown, Sun, Moon,
  Home as HomeIcon, FilePlus,
} from "lucide-react";

interface SavedView {
  id: string;
  name: string;
  state_json: { layers: any[]; basemap?: string };
  is_public: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}


export default function MapsPage() {
  const { connectionId } = useConnection();
  const [views, setViews] = React.useState<SavedView[]>([]);
  const [loadingViews, setLoadingViews] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();
  const { theme, setTheme } = useTheme();


  React.useEffect(() => {
    if (!connectionId) { setViews([]); return; }
    fetchViews();
  }, [connectionId, showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchViews() {
    if (!connectionId) return;
    setLoadingViews(true);
    setError(null);
    try {
      const res = await fetch(`/api/pg/saved-views?connectionId=${encodeURIComponent(connectionId)}&archived=${showArchived}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load maps");
      setViews(data.views ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingViews(false);
    }
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
              <a href="/maps" className="flex items-center gap-2">
                <HomeIcon className="h-3.5 w-3.5" /> Home
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/map" className="flex items-center gap-2">
                <FilePlus className="h-3.5 w-3.5" /> New map
              </a>
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
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="https://github.com/nogurtMon/postgis-frontend" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
                Visit GitHub
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="flex-1 text-base font-semibold text-center">PostGIS Frontend</span>

        <div className="w-7 shrink-0" />
      </header>

      {/* Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {/* Title row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">Your Maps</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
              {showArchived ? "Hide archived" : "Archived"}
            </Button>
            <Button
              size="sm" className="h-7 text-xs gap-1"
              onClick={() => router.push("/map")}
            >
              <Plus className="h-3 w-3" /> New map
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive mb-4 rounded border border-destructive/30 bg-destructive/10 px-3 py-2">{error}</p>
        )}

        {/* Loading */}
        {connectionId && loadingViews && (
          <div className="text-center py-24">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty */}
        {!loadingViews && views.length === 0 && (
          <div className="text-center py-24">
            <Map className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              {showArchived ? "No archived maps." : "No saved maps yet."}
            </p>
            {!showArchived && (
              <Button size="sm" onClick={() => router.push("/map")}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Create your first map
              </Button>
            )}
          </div>
        )}

        {/* Map list */}
        {views.length > 0 && (
          <div className="flex flex-col divide-y border rounded-lg overflow-hidden">
            {views.map((v) => (
              <div
                key={v.id}
                className="group flex items-center px-4 py-2 bg-card hover:bg-muted/40 transition-colors cursor-pointer"
                onClick={() => router.push(`/map?view=${v.id}`)}
              >
                <span className="flex-1 text-sm truncate">{v.name}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); archiveView(v.id, !v.archived); }}
                  title={v.archived ? "Unarchive" : "Archive"}
                >
                  {v.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

    </div>
  );
}
