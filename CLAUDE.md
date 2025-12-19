# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Using Serena MCP

**CRITICAL: Always use Serena MCP for code navigation and editing tasks.** Serena is configured and running in this project—use it extensively.

### When to Use Serena

- **Symbol-level operations**: Use `find_symbol` instead of grepping for code
- **Finding references**: Use `find_referencing_symbols` to locate where symbols are used
- **Code editing**: Use `insert_after_symbol`, `replace_symbol_body` instead of file-based edits when appropriate
- **Project exploration**: Use `get_symbols_overview` to understand file structure

### Planning Mode Workflow

Before implementing complex changes:

1. **Activate the project**: Ensure Serena has activated this project (should happen automatically)
2. **Use symbol navigation**: Leverage `find_symbol` and `find_referencing_symbols` to understand the codebase structure
3. **Create a plan**: Use Serena's semantic understanding to map out changes at the symbol level
4. **Verify with memories**: Check `.serena/memories/` for project-specific context from onboarding

### Best Practices with Serena

- **Start from clean git state**: Makes it easier to review changes and use `git diff` for verification
- **Prefer semantic tools over file tools**: Use Serena's symbol-based tools rather than reading entire files
- **Trust the index**: Serena automatically updates its index when files change
- **Use project memories**: Serena's onboarding process creates memories that improve navigation

For more details, see [Serena documentation](https://oraios.github.io/serena/).

## Project Overview

VlogMap is a Next.js application that displays an interactive map of locations where YouTubers have filmed their videos. The frontend uses Leaflet for map rendering, and the backend uses PostgreSQL for data persistence with a password-protected admin interface.

## Technology Stack

- **Framework**: Next.js 16 (App Router, TypeScript, React 19)
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Database**: PostgreSQL via `pg` driver (no ORM)
- **Map**: Leaflet + react-leaflet with OpenStreetMap tiles
- **Data Fetching**: SWR for client-side caching
- **Validation**: Zod schemas
- **Icons**: lucide-react

## Development Commands

```bash
npm run dev      # Start Next.js dev server with hot reload
npm run build    # Production build (validates routes and TypeScript)
npm start        # Run production build
npm run lint     # Run ESLint (Next.js + TypeScript rules)
```

## Architecture

### Directory Structure

- **`src/app/`**: Next.js App Router
  - `page.tsx`: Main map view (client component)
  - `admin/page.tsx`: Admin interface for managing markers
  - `login/page.tsx`: Admin login page
  - `api/markers/`: CRUD endpoints for marker data
  - `api/auth/`: Session-based authentication endpoints
  - `api/geocode/`: City lookup from coordinates
  - `api/metadata/`: YouTube video metadata fetching

- **`src/components/`**: Shared React components
  - `map-canvas.tsx`: Leaflet map with marker rendering
  - `ui/`: shadcn/ui primitives (button, dialog, card, etc.)

- **`src/lib/`**: Server-side utilities
  - `db.ts`: PostgreSQL connection pool and query wrapper
  - `auth.ts`: Admin authentication guard
  - `markers.ts`: Zod validation schema for marker payloads
  - `utils.ts`: General helpers (cn for className merging)

- **`src/types/`**: TypeScript type definitions
  - `markers.ts`: Shared Marker type

### Database Layer

The app uses a singleton PostgreSQL connection pool (`src/lib/db.ts`) with automatic schema initialization:
- Table `explorer_markers` is created on first query
- Schema migrations happen via `ALTER TABLE IF NOT EXISTS` on startup
- Row-to-object mapping via `mapMarkerRow()` converts snake_case to camelCase

**Schema columns**: `id`, `title`, `creator`, `channel_url`, `video_url`, `description`, `latitude`, `longitude`, `city`, `video_published_at`, `created_at`

### Authentication

Admin routes use session-based auth (`src/lib/auth.ts`):
- `requireAdmin()` checks `x-admin-secret` header, `Authorization: Bearer` header, or `vlogmap-session` cookie
- Session cookie is set via `POST /api/auth/login` and cleared via `/api/auth/logout`
- All mutating API routes (POST/PUT/DELETE) require admin auth

### API Routes

- `GET /api/markers?videoUrl=...`: Fetch all markers (or filter by video URL)
- `POST /api/markers`: Create marker (admin only)
- `PUT /api/markers/[id]`: Update marker (admin only)
- `DELETE /api/markers/[id]`: Delete marker (admin only)
- `POST /api/auth/login`: Set session cookie
- `GET /api/auth/check`: Verify session validity
- `POST /api/auth/logout`: Clear session
- `GET /api/geocode?lat=...&lng=...`: Reverse geocode to city name
- `GET /api/metadata?videoId=...`: Fetch YouTube video title and publish date

### Client-Side Data Flow

1. Main page (`src/app/page.tsx`) fetches markers via SWR with 15s polling
2. Dynamic import of `MapCanvas` (client-only component due to Leaflet's DOM dependency)
3. Selected marker state managed in parent, passed down to map
4. Admin form in `/admin` uses session cookie for authenticated requests

## Environment Variables

Required in `.env.local` (never commit this file):

```bash
DATABASE_URL=postgresql://user:password@host:port/db
# Alternative: POSTGRES_URL, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING
ADMIN_SECRET=your-strong-password
```

## Coding Conventions

- **Imports**: Use `@/...` path alias for all intra-project imports
- **File naming**: kebab-case for components (`map-canvas.tsx`)
- **Variable naming**: camelCase for JS/TS, snake_case for SQL columns
- **TypeScript**: Strict mode enabled; prefer explicit types for API payloads
- **Styling**: Tailwind utility classes; reuse shadcn/ui components
- **Indentation**: 2 spaces, no semicolons (Prettier/Next defaults)

## Database Schema Changes

When modifying the `explorer_markers` table:
1. Add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `src/lib/db.ts` → `ensureSchema()`
2. Update `MarkerRow` type in `db.ts`
3. Update `markerSchema` in `src/lib/markers.ts`
4. Update `mapMarkerRow()` mapping function
5. Update `Marker` type in `src/types/markers.ts` (client-facing)

## Map Tile Configuration

Map tiles default to OpenStreetMap via `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` in `src/components/map-canvas.tsx`. Update the `<TileLayer>` URL to switch providers (ensure license compliance).

## Common Patterns

### Adding a new API route

1. Create route file: `src/app/api/<name>/route.ts`
2. Import `requireAdmin` from `@/lib/auth` for protected routes
3. Use `query()` from `@/lib/db` for database operations
4. Validate request bodies with Zod schemas
5. Return `NextResponse.json()` with appropriate status codes

### Adding a new marker field

Follow the "Database Schema Changes" process above. Example for adding a `tags` field:
```typescript
// 1. db.ts ensureSchema()
await getPool().query(`ALTER TABLE explorer_markers ADD COLUMN IF NOT EXISTS tags TEXT[]`)

// 2. db.ts MarkerRow type
tags: string[] | null

// 3. markers.ts schema
tags: z.array(z.string()).optional()

// 4. db.ts mapMarkerRow()
tags: row.tags

// 5. types/markers.ts
tags?: string[]
```

## Testing

No automated test suite currently exists. When adding tests:
- Place component tests next to source files (`component.test.tsx`)
- Use `src/__tests__/` for integration tests
- Mock database via `src/lib/db.ts` exports
- Use React Testing Library for components
- Use Playwright for API/E2E tests
