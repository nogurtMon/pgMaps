export interface UserBasemap {
  id: string;
  name: string;
  styleUrl: string;
}

export const DEFAULT_BASEMAP = "liberty";

export const BLANK_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [],
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
};

// Swatches for the known built-in IDs — custom basemaps get a neutral gray.
const BUILTIN_COLORS: Record<string, string> = {
  liberty:  "#e8d5b0",
  bright:   "#b8d8c8",
  positron: "#f0f0f0",
  dark:     "#1a1a2e",
  fiord:    "#2a3a50",
};

export function getBasemapColor(id: string): string {
  return BUILTIN_COLORS[id] ?? "#6b7280";
}

export function getBasemapLabel(id: string, basemaps: UserBasemap[]): string {
  return basemaps.find((b) => b.id === id)?.name ?? "Basemap";
}

export function resolveBasemapUrl(id: string, basemaps: UserBasemap[]): string | null {
  return basemaps.find((b) => b.id === id)?.styleUrl ?? null;
}
