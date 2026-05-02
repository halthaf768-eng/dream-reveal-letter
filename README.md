# Dream Reveal Letter

Dream Reveal Letter is a full-stack web application for creating personalized reveal pages.

## Features

- Frontend built with HTML, CSS, and JavaScript
- Admin panel for creating personalized entries
- Dynamic user pages with unique shareable links
- Node.js backend for requests, routing, and persistence
- JSON database for storing reveal data
- Upload support for scratch reveal images and background music
- Mobile-first romantic reveal flow with countdown, music, scratch card, and final message

## How It Works

1. Open the admin panel.
2. Paste the full dream letter message.
3. Upload a dream photo for the scratch reveal, or keep the default.
4. Upload custom background music, or keep the default.
5. Add the final reveal message or instructions.
6. Click **Generate Link**.
7. Share the generated `/r/{id}` link.

Each generated link loads its saved data from `database/reveals.json`, so entries persist across server restarts.

## Run Locally

```bash
npm start
```

Then open:

```text
http://127.0.0.1:4173/
```

If port `4173` is busy, run with a custom port:

```bash
PORT=4174 npm start
```

For local-only binding:

```bash
HOST=127.0.0.1 PORT=4173 npm start
```

## Deployment

This app is ready for Node.js cloud platforms that support a persistent filesystem or mounted storage. The server reads `PORT` from the hosting provider and binds to `HOST=0.0.0.0` by default.

Common deployment settings:

```text
Build command: npm install
Start command: npm start
Node version: 20+
```

For serverless-only platforms, replace the JSON file database with a hosted database such as MongoDB, PostgreSQL, Supabase, Firebase, or DynamoDB.
