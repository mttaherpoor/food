# PI Food frontend

The frontend is a Persian, right-to-left React PWA built with Vite and TypeScript.

## Local development

1. Create the external shared network once with `docker network create shared_net`.
2. Start Django, PostgreSQL, and the Nginx frontend with `docker compose up --build` from the repository root.
3. In this directory, run `pnpm install` once and then `pnpm dev`.
4. Open `http://localhost:5173`. Vite proxies `/api` through the frontend service to Django.

The frontend container builds the app and serves it with Nginx on port 8000.
Nginx proxies API and admin requests to Django and falls back to `index.html`
for client routes. The service worker is exposed at `/sw.js`. The backend and
frontend share the external `shared_net`; PostgreSQL is only on the internal
`backend` network, which the backend also joins.

## Authentication

The app checks `/api/v1/auth/session` before showing protected pages. An anonymous
visitor is sent to `/login`; after signing in, the requested page is restored.
Accounts flagged for an initial password change must update their password before
using reservations, history, reports, or catalog management. Session cookies and
Django CSRF protection are used on the same origin.
