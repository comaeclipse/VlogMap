# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js App Router pages and route handlers. UI entry in `page.tsx`, admin/login flows in `admin` and `login`, API endpoints in `api/markers`, `metadata`, `geocode`, and `auth`.
- `src/components`: shared UI. shadcn primitives under `components/ui`, map rendering in `map-canvas.tsx`, theming in `theme-provider.tsx`.
- `src/lib`: server utilities for database access (`db.ts`), auth guard (`auth.ts`), marker CRUD (`markers.ts`), and helpers (`utils.ts`); `src/types`: shared data shapes.
- `public`: static assets; `.env.example` documents required secrets.

## Build, Test, and Development Commands
- `npm run dev`: start the Next 16 dev server with hot reload.
- `npm run build`: production bundle; validates route handlers and TypeScript.
- `npm start`: run the built app; ensure env vars and Postgres are reachable.
- `npm run lint`: ESLint (Next core-web-vitals + TypeScript). Run before PRs.

## Coding Style & Naming Conventions
- TypeScript-first; strict mode enabled. Prefer `const` and typed function props.
- 2-space indentation, semicolon-free, Prettier/Next defaults; keep imports grouped by domain.
- Use the `@/...` path alias for intra-project imports; favor kebab-case for component filenames (`map-canvas.tsx`) and camelCase for variables/props.
- Tailwind v4 utility classes for styling; reuse shadcn UI pieces from `components/ui` instead of one-off styles.

## Testing Guidelines
- No automated suite yet; add coverage alongside features when possible.
- Place unit/component tests near code (`component.test.tsx`) or under `src/__tests__`; prefer Testing Library for React and Playwright for route/API smoke checks.
- Keep tests deterministic; mock network/DB calls via the abstractions in `src/lib`.

## Commit & Pull Request Guidelines
- Commits follow concise, imperative subjects (e.g., "Add creator autocomplete"); group related changes per commit.
- PRs should describe scope, linked issues, and any env/DB changes (`DATABASE_URL`, `ADMIN_SECRET`, `explorer_markers` schema). Attach screenshots for UI updates and note manual test steps (dev server, lint, API exercised).
- Avoid committing secrets; `.env.local` stays local and mirrors `.env.example`.

## Security & Configuration Tips
- Database credentials and `ADMIN_SECRET` are required for API routes; keep them out of logs and commit history.
- When adding new routes, reuse the auth helpers in `src/lib/auth.ts` and validation in `src/lib/markers.ts` to enforce the existing guard/validation pattern.
- Map tiles default to OpenStreetMap; update `src/components/map-canvas.tsx` if you switch providers and ensure licenses are respected.