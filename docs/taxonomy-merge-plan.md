# Implementation Plan: Location Merge + Link-to-Existing Place

> Status: **planned, not implemented**. Created 2026-06-17.
> Goal: make the Foursquare-style check-in taxonomy real — multiple video visits
> nesting under one shared city/landmark — by adding the two primitives the app is
> currently missing.

## Background / why

VlogMap's `locations` table is meant to hold real-world **places** (city or
landmark) that exist independently of any video; each `explorer_markers` row is a
**check-in** pointing at a place via `location_id`. Multiple creators visiting the
same place should nest under one shared node.

Current reality (as of 2026-06-17): effectively **1 marker : 1 landmark : 1 city**
(147 markers, 148 landmarks, 145 cities; **zero** landmarks shared by >1 marker).
The city tier nests correctly (same city name collapses). The landmark tier never
shares because `assignLocationToMarker()` always mints a new `"{City} N"` landmark
unless another marker is within 200m.

Two capabilities are missing and block the vision:

1. **Merge** — fold duplicate places into one, keeping all check-ins. No endpoint
   does this today (`DELETE /api/locations/[id]` only *unlinks* markers and refuses
   if the place has children).
2. **Link-to-existing place** — when adding/editing a stop, attach it to an existing
   place instead of auto-minting a duplicate.

Known duplicate examples in data: Tashkent (`Hotel Uzbekistan` + `Location 1`),
Kyiv (`Kyiv Railway Station` + `Location 1`), Nairobi (3 named + `Location 1`),
Alamogordo (`Location 1/2/3`).

No DB schema changes are required — `location_id`, `parent_location_id`, and
`type` already exist.

---

## Phase 1 — Merge primitive (highest value; ships first)

Lets the Taxonomy Manager collapse duplicate places while preserving every check-in.

### 1a. Core logic — `src/lib/location-matching.ts`

Add `mergeLocations(targetId, sourceIds)`:

```
mergeLocations(targetId: string, sourceIds: string[]): Promise<{
  movedMarkers: number; movedChildren: number; deleted: number;
}>
```

Rules (run inside a single transaction via `query("BEGIN")` / COMMIT / ROLLBACK):
1. Validate: `targetId` exists; every `sourceId` exists; `targetId` ∉ `sourceIds`;
   `sourceIds` de-duped and non-empty.
2. **Type guard** — only merge like-into-like by default:
   - landmark → landmark (recommended primary use), or
   - city → city.
   Reject city↔landmark mixes with a 400 (avoids accidentally turning a city into a
   landmark's child). Target keeps its own `type`, `name`, `parent_location_id`,
   and coords.
3. Re-point check-ins: `UPDATE explorer_markers SET location_id = target WHERE location_id = ANY(sources)`.
4. Re-point children (only relevant when merging cities):
   `UPDATE locations SET parent_location_id = target WHERE parent_location_id = ANY(sources)`.
   - Guard against cycles: never set a location's parent to itself.
5. Delete the source locations: `DELETE FROM locations WHERE id = ANY(sources)`.
6. Recalculate target centroid via existing `updateLocationCentroid(targetId)`
   (averages marker coords; harmless for cities whose coords are nominal).
7. Return counts.

Reuse existing helpers; do not duplicate centroid math.

### 1b. API — `src/app/api/locations/merge/route.ts` (new)

`POST /api/locations/merge`
- `requireAdmin(request)` guard (match existing route style).
- Zod body: `{ targetId: string, sourceIds: string[] (min 1) }`.
- Call `mergeLocations`, return `{ success, ...counts }`.
- Map known errors to 400 (type mismatch, target in sources, not found); 500 otherwise.

### 1c. UI — `src/app/admin/locations/page.tsx` (Taxonomy Manager)

The page already has multi-select (`selectedLocationIds`) and a bulk-action toolbar.
Add a **"Merge…"** action that appears when `selectedLocationIds.size >= 2`:
1. Button opens a dialog listing the selected places.
2. User picks which one is the **target** (keep) via radio; the rest are sources.
   - Default target = the one with a real name (not matching `/^Location \d+$/` or
     `/^<city> \d+$/`), else the one with the most markers.
3. Show a confirm summary: "Move N check-ins into <target> and delete M places."
4. `POST /api/locations/merge`, then `mutate()` + toast with counts.

Edge UX: disable merge if the selection mixes cities and landmarks (tooltip explains).

### 1d. Tests / verification
- Manual: merge `Location 1` into `Hotel Uzbekistan` (Tashkent) → Hotel Uzbekistan
  shows 2 markers, `Location 1` gone, both videos still resolve.
- SQL spot-check: `SELECT location_id, COUNT(*) ... GROUP BY` shows the shared node.
- Confirm `/location/[id]` page still renders the merged node with all check-ins.

---

## Phase 2 — Link-to-existing place from the stop editor

Stops the bleeding: new check-ins attach to an existing place instead of duplicating.

### 2a. Search endpoint
`GET /api/locations` already returns all locations with counts and supports
`?type=` and `?parentId=`. Add an optional `?search=` (ILIKE on name/city/country)
and `?limit=` for typeahead. Keep it backward compatible.

### 2b. Schema/validation — allow explicit `locationId`
- `src/lib/markers.ts`: add optional `locationId: z.string().nullable().optional()`
  to `markerSchema` and to the per-update object in `batchUpdateSchema`.
- `POST /api/markers` (`src/app/api/markers/route.ts`): if `locationId` is provided,
  set it explicitly and **skip** `assignLocationToMarker` auto-match; then
  `updateLocationCentroid(locationId)`. If absent, keep current auto behavior.
- `POST /api/markers/batch` (`src/app/api/markers/batch/route.ts`): if an update
  carries an explicit `locationId` that differs from the marker's current one,
  re-point it and recalc both old + new centroids; this takes precedence over the
  coordinate-drift reassignment branch.

### 2c. UI — place picker on `/edit/[videoId]/page.tsx`
Per location, add a **Place** combobox (shadcn `Command`/`Popover` pattern) that:
- Searches existing places (`/api/locations?search=`), shows `name · city, country`
  with a city/landmark badge.
- "Link" sets `locationId` on that location edit row (replaces the free-text
  "Location Name" rename for the reuse case).
- Offers "➕ Create new landmark here" (keeps today's auto-create path) when no match.
- Show current linked place + a small "unlink / relink" affordance.

Optionally surface the same combobox in `BatchEditDialog` and the `/admin` flow
later; not required for v1.

### 2d. Auto-suggest (optional, Phase 2.5)
On save of a new stop, query for an existing place within ~200m OR same name in the
same city and, if found, prompt "Link to existing <place>?" instead of silently
creating. Cheap win once 2a/2b exist.

---

## Phase 3 — Data cleanup pass (manual, after Phase 1)

Use the new merge tool to collapse the known generic-name duplicates. Candidate
finder query (same parent city, a named landmark coexisting with `Location N`):

```sql
SELECT pl.name AS city,
       STRING_AGG(l.name, ' | ' ORDER BY l.name) AS landmarks
FROM locations l JOIN locations pl ON l.parent_location_id = pl.id
WHERE l.type='landmark'
GROUP BY pl.name HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;
```
Review each city, merge true duplicates, rename survivors. This is human-judgment
work — do not auto-merge by name/proximity without confirmation.

---

## File touch list (summary)

| File | Phase | Change |
|------|-------|--------|
| `src/lib/location-matching.ts` | 1 | add `mergeLocations()` |
| `src/app/api/locations/merge/route.ts` | 1 | new `POST` endpoint |
| `src/app/admin/locations/page.tsx` | 1 | "Merge…" dialog + bulk action |
| `src/app/api/locations/route.ts` | 2 | add `?search=` / `?limit=` |
| `src/lib/markers.ts` | 2 | allow `locationId` in schemas |
| `src/app/api/markers/route.ts` | 2 | honor explicit `locationId` |
| `src/app/api/markers/batch/route.ts` | 2 | honor explicit `locationId` |
| `src/app/edit/[videoId]/page.tsx` | 2 | place picker combobox |
| `src/types/markers.ts` | 2 | types if needed |

## Decisions still open
- Build order: recommend **Phase 1 first** (it's the missing primitive and unblocks
  cleanup), then Phase 2.
- Whether to also expose the place picker in `/admin` `VideoCard` (deferred).
- Whether merge should ever allow city↔landmark (default: no).

## Reference
- Neon project: `vlogmap` = project id `quiet-hill-98016369` (db `neondb`).
- No `ARCHITECTURE.md` exists despite being referenced by `fix-orphans/route.ts`;
  this doc is the current source of truth for the taxonomy plan.
