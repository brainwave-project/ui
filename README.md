# Brainwave UI

Web client for the Brainwave microservices platform: documents workspace, authenticated via tokens issued through the API gateway (Kong) and identity stack (Keycloak).

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** (or compatible package manager)

A running backend is required for anything beyond the shell: Kong (or compatible gateway) serving **`/api`**, authentication, document and user services. Local dev assumes the gateway is reachable on port **8000** unless you override it (see below).

## Quick start

```bash
cd ui
npm install
npm run dev
```

The dev server listens on **`http://localhost:5173`**.

Sign in requires valid credentials handled by your auth stack (e.g. Keycloak realm user **username** and password exchanged through your AuthHub/`/auth/login` route).

## API and CORS

In development, **Vite proxies** requests from the browser:

- **`/api/*`** → `http://localhost:8000` (default)

That keeps the SPA on `5173` while API calls appear same-origin (`/api/...`), so you avoid browser CORS issues.

To point the proxy at another gateway URL (for example a remote or non-default Kong):

**Windows (PowerShell)**

```powershell
$env:VITE_API_URL = "http://localhost:8000"
npm run dev
```

**Unix**

```bash
VITE_API_URL=http://localhost:8000 npm run dev
```

In production deployments, the app is typically served from the **same origin** as Kong so `/api` resolves without this proxy.

## Scripts

| Command          | Description                                      |
|------------------|--------------------------------------------------|
| `npm run dev`    | Start Vite dev server with hot reload           |
| `npm run build`  | Typecheck (`tsc --noEmit`) and production build |
| `npm run preview`| Serve the built output locally                  |
| `npm run lint`   | Run ESLint on `.ts` / `.tsx`                    |

## Tech stack

- **React 18** + **TypeScript**
- **Vite 5**
- **React Router** (`createBrowserRouter`)
- **TanStack Query** for server state
- **Zustand** for client state (including auth/session)
- **Axios** with interceptors (Bearer token, refresh on 401)
- **React Hook Form** + **Zod** for forms and validation
- **Tailwind CSS** + **Radix UI**-based components

## App structure

| Area | Purpose |
|------|--------|
| `src/router/` | Routes: public `/login`, protected layout (dashboard, documents, upload, profile) |
| `src/api/` | HTTP clients (`auth`, `documents`, `users`; shared `client` with interceptors) |
| `src/features/` | Feature modules (auth login, documents, users) |
| `src/pages/` | Route-level page components |
| `src/components/` | Shared layout and UI primitives |
| `src/store/` | Zustand stores |
| `src/types/` | Shared TypeScript types |

## Routing (summary)

- **`/login`** — Public login.
- **`/dashboard`, `/documents`, `/documents/upload`, `/documents/:id`, `/profile`** — Behind `ProtectedRoute`; unauthenticated users are sent to **`/login`**.

Unknown paths redirect toward the main app (`/dashboard`).

## Authentication (high level)

- Login posts credentials (username and password; Keycloak-aligned **username** field) to **`/auth/login`** via the same `/api` base as other endpoints.
- Access tokens are attached to API requests; on **401**, the client attempts refresh and retries, or clears the session and redirects to **`/login`**.

Details live in `src/api/auth.api.ts`, `src/api/client.ts`, `src/store/auth.store.ts`, and `src/features/auth/`.
