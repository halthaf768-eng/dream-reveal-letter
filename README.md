# Dream Reveal Letter

Dream Reveal Letter is a full-stack web application for creating personalized reveal pages.

## Features

- Frontend built with HTML, CSS, and JavaScript
- Admin panel for creating personalized entries
- Dynamic recipient pages with unique shareable links
- Node.js backend for requests and routing
- Supabase PostgreSQL database for persistent reveal data
- Upload support for scratch reveal images and background music
- Mobile-first romantic reveal flow with countdown, music, scratch card, and final message

## Routes

- `/admin` opens the admin panel.
- `/` opens the default public reveal experience.
- `/reveal/{slug}` opens a saved recipient reveal page without the admin form.

The admin UI lives in `admin.html` and `admin.js`. The public reveal UI lives in `index.html` and `script.js`, so recipient links never render the admin form or upload controls.

## Supabase Setup

1. Create a Supabase project.
2. Open **SQL Editor** in Supabase.
3. Paste and run the SQL from [supabase-schema.sql](./supabase-schema.sql).
4. Go to **Project Settings > API**.
5. Copy:
   - `Project URL` into `SUPABASE_URL`
   - `service_role` key into `SUPABASE_SERVICE_ROLE_KEY`

The service role key is used only in [server.mjs](./server.mjs). Never put it in frontend code.

## Environment Variables

Create a `.env` locally or set these in Render:

```text
PORT=4173
HOST=0.0.0.0
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## How It Works

1. Open `/admin`.
2. Paste the full dream letter message.
3. Upload a dream photo for the scratch reveal, or keep the default.
4. Upload custom background music, or keep the default.
5. Add the final reveal message or instructions.
6. Click **Generate Link**.
7. Share the generated `/reveal/{slug}` link.

Each generated link loads saved data from Supabase PostgreSQL, so entries persist across Render deploys and restarts.

## Backend API

- `POST /api/reveals` inserts a new reveal record.
- `GET /api/reveals` lists reveal records for admin/backend use.
- `GET /api/reveals/:slug` fetches one reveal by slug.
- `PUT /api/reveals/:slug` or `PATCH /api/reveals/:slug` updates one reveal.
- `DELETE /api/reveals/:slug` deletes one reveal.

## Run Locally

```bash
npm install
npm start
```

Then open:

```text
http://127.0.0.1:4173/admin
```

For local-only binding:

```bash
HOST=127.0.0.1 PORT=4173 npm start
```

## Render Deployment

Use these settings:

```text
Build command: npm install
Start command: npm start
Node version: 20+
```

Add these Render environment variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Render provides `PORT` automatically. Keep `HOST=0.0.0.0` or omit it.
