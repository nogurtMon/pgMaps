# Quality Control Checklist

Check each item before tagging a release. Each item should be verified manually in a clean browser session against the Docker deployment.

---

## Geometry Types

- [ ] **Points** — import, render, style, click, edit, delete
- [ ] **Lines** — import, render, style, click, edit, delete
- [ ] **Polygons** — import, render, style, click, edit, delete
- [ ] **Mixed / General geometry** — table with `geometry` column (not typed) renders correctly

---

## Imports

- [ ] **GeoJSON** — file import completes, row count matches, geometries appear on map
- [ ] **Shapefile (.zip)** — file import completes, projection is handled, geometries appear
- [ ] **CSV with lat/lon** — import creates point layer, coordinates correct
- [ ] **ArcGIS Feature Service** — URL import streams features, progress bar updates, resume works after interruption
- [ ] **Large file (> 10 MB)** — progress bar visible, cancel works mid-import, resume works after page refresh
- [ ] **Duplicate table name** — app shows clear error, does not corrupt existing table
- [ ] **Import into non-default schema** — rows land in the correct schema

---

## Visualization

- [ ] **Color by attribute** — categorical and numeric columns both work
- [ ] **Opacity slider** — updates map in real time
- [ ] **Radius / line width controls** — updates rendering correctly for point and line layers
- [ ] **Layer ordering** — drag to reorder layers, map reflects new order
- [ ] **Toggle layer visibility** — eye icon shows / hides layer
- [ ] **Legend** — reflects current style, updates on style change, can be hidden
- [ ] **Filters panel** — filter by attribute narrows features on map and in attribute table
- [ ] **Zoom to layer** — fits map to layer extent

---

## Data (CRUD)

- [ ] **View attributes** — click feature opens popup with correct values
- [ ] **Edit attribute via popup** — change value, commit, reload confirms change in DB
- [ ] **Edit attribute via table** — inline edit in attribute table, commit saves
- [ ] **Delete feature via popup** — feature removed from map and DB after commit
- [ ] **Delete feature via table** — row removed after commit
- [ ] **Edit geometry via map** — drag vertex, commit, geometry persists
- [ ] **Draw & insert point** — new feature appears in DB after commit
- [ ] **Draw & insert line** — new feature appears in DB after commit
- [ ] **Draw & insert polygon** — new feature appears in DB after commit
- [ ] **Commit / discard** — uncommitted changes shown as pending; discard reverts all

---

## Connections

- [ ] **Built-in database** — auto-connected on first load, PostGIS enabled, tables listed
- [ ] **Add connection** — fill fields, test passes, save, tables appear in sidebar
- [ ] **Edit connection** — change credentials, save, reconnects with new DSN
- [ ] **Delete connection** — removed from list; layers from that connection removed from active maps
- [ ] **Multiple connections simultaneously** — tables from two different DBs both listed; same table name in two DBs shows correct "already added" state per connection
- [ ] **Bad credentials** — test shows clear error message, app does not crash

---

## Maps

- [ ] **Create map** — named map saved, appears in /maps list
- [ ] **Open map** — layers, styles, and filters restored from saved state
- [ ] **Rename map** — new name persists after reload
- [ ] **Duplicate map** — copy has same layers and styles, independent of original
- [ ] **Delete map** — removed from /maps list
- [ ] **Multiple maps** — switching between maps loads correct state each time

---

## Sharing

- [ ] **Create share link** — link opens in incognito, map renders read-only
- [ ] **Share preserves styles** — colors, opacity, layer order match the saved map
- [ ] **Filters on share page** — viewer can filter; changes are local only
- [ ] **Password-protected share** — wrong password blocked, correct password grants access
- [ ] **Embed code** — `<iframe>` snippet renders the map in a plain HTML file
- [ ] **Revoke share** — link returns 404 after deletion

---

## Security

- [ ] **Connection strings not exposed** — no raw DSN in any API response or browser network tab
- [ ] **Share link scoping** — share token only returns data for its own map; guessing another token returns 404
- [ ] **SQL injection surface** — table and schema names passed through UI do not allow arbitrary query execution

---

## Performance

- [ ] **Tile response** — zoom 10 tile for a 100k-row table loads in < 500 ms
- [ ] **Large attribute table** — 10k-row table opens without hanging the browser
- [ ] **Cold Docker start** — `docker compose up` → app ready in < 60 s on a standard machine

---

## Pre-Release

- [ ] `docker compose up --build` from scratch passes all of the above
- [ ] No TypeScript errors (`npm run build` exits 0)
- [ ] No console errors on page load in Chrome and Firefox
- [ ] README reflects current Docker setup and env vars