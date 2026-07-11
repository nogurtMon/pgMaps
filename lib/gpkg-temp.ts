import { tmpdir } from "os";
import { join } from "path";
import { existsSync, unlinkSync } from "fs";

export function tempGpkgPath(id: string): string {
  return join(tmpdir(), `postgis-frontend-gpkg-${id}.gpkg`);
}

export function deleteTempGpkg(id: string): void {
  const p = tempGpkgPath(id);
  if (existsSync(p)) {
    try { unlinkSync(p); } catch {}
  }
}
