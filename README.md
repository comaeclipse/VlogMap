## VlogMap

Sleek Next.js + shadcn UI map that highlights where YouTubers have filmed around the world. Uses Postgres for storage and a password-protected backend for CRUD.

### Stack
- Next.js (App Router, TypeScript, Tailwind v4)
- shadcn/ui components + lucide icons
- Leaflet with OpenStreetMap tiles for the base map
- Postgres via `pg`, request validation via `zod`

### Setup
1) Create a `.env.local` (gitignored) and set secrets:
```
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
# or POSTGRES_URL / POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING (Neon/Vercel)
ADMIN_SECRET=<choose-a-strong-secret>
```

2) Install deps and run:
```bash
npm install
npm run dev
# or npm run build && npm start
```

### Database
The API will auto-create a table named `explorer_markers` on first use:
```sql
CREATE TABLE IF NOT EXISTS explorer_markers (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  creator TEXT NOT NULL,
  channel_url TEXT,
  video_url TEXT,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### API
- `GET /api/markers` — public feed of all markers.
- `POST /api/markers` — create (requires header `x-admin-secret: <ADMIN_SECRET>` or `Authorization: Bearer <ADMIN_SECRET>`).
- `PUT /api/markers/:id` — update (auth required).
- `DELETE /api/markers/:id` — remove (auth required).

Body schema for create/update:
```json
{
  "title": "Old Town Night Walk",
  "creator": "CityExplorer",
  "channelUrl": "https://youtube.com/@channel",
  "videoUrl": "https://youtu.be/demo",
  "description": "Neon markets and skyline drone footage.",
  "latitude": 48.8566,
  "longitude": 2.3522
}
```

### Admin UI
- Open “Manage markers” in the header, enter the admin password, and use the form to add or update markers.
- Each card in the feed has “Quick edit” to load data into the admin form.

### Notes
- Map tiles come from OpenStreetMap; replace the tile URL in `src/components/map-canvas.tsx` if you need a different provider.
- The UI defaults to dark mode; `ThemeProvider` enables light/dark toggling if you extend it later.
