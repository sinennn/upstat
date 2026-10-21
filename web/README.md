# Upstat Web (`web`)

Next.js 16 (App Router, React 19, TypeScript, Tailwind) front-end: landing
page at `/`, the dashboard at `/dashboard` (monitors, incidents, settings),
sign-in at `/signin` (Google or email), and public status pages at
`/status/<slug>`. It talks to the Go backend over gRPC-Web through Envoy.

## Run

From the repo root (recommended): `make demo` → http://localhost:2003
(demo account `demo@upstat.app` / `upstat-demo`).

Dev server:

```bash
npm install
npm run dev
```

No backend? `NEXT_PUBLIC_TEST_MODE=1 npm run dev` runs the whole UI against
an in-browser copy of the backend (sign in as `ibukun@cuesoft.io` /
`upstat-test`).

`NEXT_PUBLIC_*` values (Envoy URL, Google client id) are inlined at build
time — set them in the root `.env` (see `.env.example`). Node version: see
`.nvmrc`.

## Desktop app (Tauri)

`src-tauri/` wraps the same frontend in a native window. It loads a static
export of the app (`npm run build:desktop` → `out/`) and adds native OS
notifications when a monitor goes down or recovers; links that leave the
app open in the system browser.

Requires the Rust toolchain (`rustup`), and the backend running (`make
demo`) for the app to connect to.

```bash
npm run desktop:build   # → src-tauri/target/release/bundle/{macos,dmg}/
npm run desktop:dev     # live-reloading desktop window (port 2005)
```

Desktop differences: there is no landing page (it opens on the dashboard).
Google sign-in opens your system browser and returns to the app through a
loopback listener on `http://localhost:2004/callback` (`src-tauri/src/oauth.rs`)
— Google won't redirect to the app's `tauri://` origin, and it blocks
sign-in inside embedded webviews. Register that URI on the same Google
client as the web app. `NEXT_PUBLIC_*` values (Envoy URL, Google client id)
are baked in at build time; the root `.env` is read automatically.
