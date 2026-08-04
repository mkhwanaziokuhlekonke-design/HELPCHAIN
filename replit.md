# HelpChain

A community help and donation mobile app built with Expo, backed by Firebase Auth + Firestore for real-time data sync.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- **Firebase Auth** — email/password sign-in. `ADMIN_EMAILS` list in `AuthContext.tsx` controls which emails get `isAdmin: true` on signup.
- **Firestore collections**: `users`, `requests`, `donations`, `chat` — all with `onSnapshot` listeners for real-time updates. No AsyncStorage for app data.
- **`getAuth(app)` (not `initializeAuth`)** — Firebase v12 removed `getReactNativePersistence` from the standard bundle. `getAuth` uses IndexedDB on web and in-memory on native. If native session persistence across restarts is needed later, add a custom persistence adapter.
- **`EXPO_PUBLIC_` prefix required** — Expo's Metro bundler only inlines env vars prefixed with `EXPO_PUBLIC_` into the client bundle. Firebase config uses `EXPO_PUBLIC_FIREBASE_*` secrets.

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
