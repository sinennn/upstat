# Demo Script

A 6–8 minute walkthrough of Upstat on the real backend, plus setup and
likely questions.

## Before you present

**The day before**

1. The stack uses ports `2000` (API), `2001` (insight service), `2002`
   (Envoy), `2003` (web) and, for desktop Google sign-in, `2004`. These are
   chosen to stay clear of the usual 3000/8080 range other projects use.
2. From the repo root: `make demo`. This builds and starts everything, mints
   the insight service's token, and loads the demo account.
3. Optional, makes the AI insight richer: put a Groq key in `.env` as
   `GROQ_API_KEY=…`, then `docker compose up -d api-observability`.
   Without one, the insight service still scores risk; it just uses its
   built-in wording instead of an LLM narrative.

**30 minutes before**

1. `make demo-reset`: rebuilds the demo data so the history ends "now".
2. Open two browser windows:
   - `http://localhost:2003` (landing page)
   - `http://localhost:2003/status/demo` (public status page)
3. Wait about two minutes. *Legacy API* is unreachable on purpose; after 3
   failed checks (30s apart) it goes down and an incident opens by itself.

**Demo account:** `demo@upstat.app` / `upstat-demo`

## The walkthrough

| # | Show | Say |
| --- | --- | --- |
| 1 | Landing page hero | "Upstat watches your websites and APIs. When one fails it opens an incident, and when it recovers it closes it. Your users see the status on a public page." |
| 2 | Scroll to **How it's built** | "The browser speaks gRPC-Web through Envoy to a Go API. A Go worker runs the checks, MongoDB stores every result, and a Python service does the risk analysis." |
| 3 | Sign in with email | "Google or email sign-in. Sessions are signed JWTs, and every monitor is private to its owner." |
| 4 | Dashboard | Point at the **Live** indicator, the four tiles, the sparklines and the red banner. "This refreshes every 10 seconds. Legacy API went down before we started; the incident opened automatically." |
| 5 | Click **Legacy API** | Show the 90-day strip, response-time chart, recent checks, the open incident with the real DNS error, and the AI insight (CRITICAL). |
| 6 | **The live moment:** open **Edge API** → Edit, change the URL to `https://broken.example.invalid`, set *Check every* to `10`, Save, go back to Monitors | "I've just broken it. Watch." In about 30–40s a **"Edge API is down"** toast appears, the banner updates, and the tab title shows "(2 down)". |
| 7 | Edit Edge API back to `https://www.cloudflare.com/cdn-cgi/trace` | Within ~10s: **"Edge API recovered — Down for 34s."** "Nobody closed that incident. The next successful check did." |
| 8 | **Incidents** page | The full history: open and resolved, with durations. |
| 9 | Switch to the status page window | "This is what customers see. It updates on its own and never exposes our URLs or error details." |
| 10 | **Settings** | Profile, password, delete account, and the link to the account's public page. |

## Desktop app (bonus)

Upstat also ships as a native desktop app (Tauri). Build it once
beforehand with `cd web && npm run desktop:build`, then open
`web/src-tauri/target/release/bundle/macos/Upstat.app` (or install the
`.dmg`).

| Show | Say |
| --- | --- |
| Launch the app, sign in with email | "The same frontend, packaged as a native app with Tauri: a Rust shell around the system webview. The app is 11 MB and the installer about 4 MB, versus 150 MB or more for an Electron app." |
| Repeat the live moment (break Edge API), then switch to another window | A **macOS notification** appears: "Edge API is down". "It alerts you even when the app is in the background." |
| Sign out, then **Continue with Google** | Your browser opens Google; after you pick an account the app comes back to the front, signed in. "Native apps can't use web redirects, so the app runs a one-shot listener on localhost — the standard OAuth pattern for native apps (RFC 8252); the Google Cloud CLI signs in the same way." |
| Settings → status page link | It opens in your browser. "The desktop app only has the native permissions it needs: open links and send notifications." |

## If something goes wrong

- **The live moment is slow:** the check interval is the lower bound. With
  10s checks and 3 strikes it takes about 30–40s. Talk through the incident
  page while you wait.
- **The network is down at the venue:** every monitor will fail, which is
  itself a demo of the down path. For a fully offline backup, run
  `cd web && NEXT_PUBLIC_TEST_MODE=1 npm run dev` and sign in with
  `ibukun@cuesoft.io` / `upstat-test`. That runs the whole UI against an
  in-browser copy of the backend.
- **Data looks stale:** `make demo-reset`.

## Likely questions

**How do you avoid checking the same monitor twice if you run several
workers?**
Each worker leases a monitor atomically in MongoDB (`lockedBy` /
`lockedUntil`) before checking it, so only one worker checks a monitor per
tick ([monitor-service.md](monitor-service.md)).

**Why gRPC instead of REST?**
One typed contract (`user.proto`) is shared by the Go API, the Python
insight service and the browser. A field mismatch shows up as a compile or
test failure, not a runtime surprise.

**What stops one user from reading or deleting another user's data?**
Every monitor query is scoped to the caller's user ID taken from the JWT.
Account updates and deletes are only allowed on your own ID; that check has
unit tests.

**How is uptime calculated?**
From the stored check results: successful checks ÷ total checks per day
for the 90-day strip, and over the last 24 hours for the status page
headline.

**Why retry before counting a failure?**
A single dropped packet shouldn't page anyone. Each check makes up to 3
attempts, 500ms apart, and the monitor only goes down after N consecutive
failed checks.

**How is the code tested?**
Go unit and repository tests (against a real temporary MongoDB), web unit
tests, and Playwright end-to-end tests. The end-to-end tests run against an
in-memory copy of the backend that follows the same rules as the Go
services, and that copy has its own tests.

## Email alerts (EmailJS)

When an incident opens or resolves, the notification worker emails the monitor's owner through EmailJS. Muted monitors are skipped. A failed send stays in the outbox and is retried with backoff (5 s → 80 s, 5 attempts).

1. In the EmailJS dashboard, create an email service and a template. The template body is in [emailjs-template.html](emailjs-template.html). Set Subject to `{{subject}}` and To Email to `{{to_email}}`.
2. Under Account → Security, enable **Allow EmailJS API for non-browser applications**.
3. Fill `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY` and `EMAILJS_PRIVATE_KEY` in `.env`, then run `docker compose up -d api-common`.

The api-common log prints `notifications: emailing via EmailJS` when it's active. To test it, edit a monitor's URL to something that can't resolve, wait for it to go down, then put the URL back.
