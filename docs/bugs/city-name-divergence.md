# Bug: marker `city` diverges from its location node's `city`/`name`

**Status:** open
**Severity:** high (user-visible: timeline and city page show different names for the same place)
**Surfaces:** video timeline (`marker.city`) vs location page / city link (`location.city` / `location.name`)
**First reported via:** `/video/ZQQNqbPK1_Q` timeline #2 showing "Sazan Island, Albania" while the linked city page (`/location/city-36cnthcx`) shows "Vlora, Albania".

## Symptom

For 24 markers, `explorer_markers.city` does not match the `city` of the
`locations` row it points at. The timeline renders the marker's own `city`
column; the location page and the city link render the location node's
`city`/`name`. They disagree, e.g.:

| marker.city | location.city | country |
|---|---|---|
| Yantai | Yan Tai Shi | China |
| Chengdu | Cheng Du Shi | China |
| Alexandroupoli | Αλεξανδρούπολη | Greece |
| Sazan Island | Vlora | Albania |
| Cairo | Qasr El Nil | Egypt |

## Evidence (all 24 share one fingerprint)

A single audit query showed, for the 24 divergent markers:

- only `city` drifted (district **and** country still match): **24 / 24**
- marker sits exactly at its location's coordinates (gap < 0.0005°): **24 / 24**
- solo landmark (exactly one marker in the location): **24 / 24**

This is the signature of: at creation, `city`/`district`/`country` were written
identically to both the marker and its new location node; later **only the
marker's `city` was hand-edited** (cleanup of a messy geocoder string), and
because the pin never moved, location reassignment never ran, so the location
node kept the stale value.

## Root cause

Every marker write path updates `explorer_markers.city` directly, but only
(re)assigns / touches the location node when coordinates move > ~200 m
(`0.002°`). The location's `city`/`name` is effectively **write-once at
creation**. Editing the city text without moving the pin updates the marker and
leaves the location node stale.

### Where

- `src/app/api/markers/[id]/route.ts` (PUT): writes `city` unconditionally
  (~L128); location reassignment gated on `coordinatesChanged` (L98-100, L142);
  the `else` branch (L161-168) only recomputes the centroid — never city/name.
- `src/app/api/markers/batch/route.ts`: writes `city` via `setIfPresent`
  (L168); reassignment gated on `coordinatesChanged` (L183-206). This is the
  path the admin video editor uses.
- `src/lib/location-matching.ts` — why the location is "write-once":
  - `findNearbyLocation` (L26-50) matches on lat/lng only; never compares city.
  - `assignLocationToMarker` (L209-235) on a proximity hit only sets
    `location_id` + recomputes centroid; never updates the matched location's
    `city`.
  - `findOrCreateCity` (L55-102) reuses an existing city node by exact
    `city = $1` match; only backfills null country/district, never rewrites
    `city`.
  - `updateLocationCentroid` (L169-203) updates lat/lng only.

### Source of the messy strings (related)

`src/app/api/geocode/route.ts:42-47` — `city` falls back to
`administrative_area_level_2` when there is no `locality`/`postal_town`, so
Chinese prefectures arrive as "Yan Tai Shi", Indonesia as "Kabupaten Gresik",
Egyptian districts as "Qasr El Nil", etc. Admins then clean the marker's copy
but not the location node's.

## Fix plan

1. **Stop new divergence (code).** When a marker's `city`/`district`/`country`
   is edited and that marker defines its location node (e.g. solo landmark, or
   the node's centroid owner), propagate the change to the location node
   regardless of `coordinatesChanged`. Apply in both `markers/[id]` (PUT) and
   `markers/batch`. Alternative (bigger): stop storing the place name redundantly
   on the location and derive the label from the marker.
2. **Backfill existing 24 rows.** Decide per row which side is canonical
   (generally the cleaned `marker.city`) and update the location node's
   `city`/`name`. Produce a before/after preview for approval first.
3. **Clean the geocode (addresses the messy-string source / Issue #2).** Prefer
   `locality`/`postal_town`; strip trailing " Shi"/"-si"/"Merkez"; map known
   admin-unit forms. Does not by itself fix divergence, but prevents the messy
   values that prompt manual cleanup.

## Related

- Issue #2: ~12 public city nodes display raw geocoder output ("Yan Tai Shi",
  "Αλεξανδρούπολη", "Đống Đa", "Paju-si", "Kabupaten Gresik"). Same root source.
- Landmark auto-name "Location N" comes from `src/app/edit/[videoId]/page.tsx:691`.
