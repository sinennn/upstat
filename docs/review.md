# Documentation Review: All Mistakes, Bugs & Inconsistencies

After a thorough audit of all 17 documentation files, here is a comprehensive list of every issue found — organized by category with specific file references.

---

## 🔴 CRITICAL — Architecture / Design Contradictions

### 1. The storage strategy is contradictory across 4 documents
| File | Says | Implication |
|---|---|---|
| **architecture.md** Section 4 diagram | Events → **MongoDB** | Wrong — contradicts own expansion section |
| **architecture.md** Section 6.1 diagram | ClickHouse (telemetry) + MongoDB (control plane) | Outdated per X-5 |
| **data-model.md** Section 3 | Phase 1 events → **Postgres** partitioned tables | Correct per X-5 |
| **decisions.md** U-1 + X-5 | ClickHouse for telemetry, **Postgres** for control plane (Mongo→PG migration) | Source of truth |
| **data-model.md** Section 5 DDL sketch | **ClickHouse** tables | Correct (telemetry plane) |

**Bug**: architecture.md Section 4 "events layer" sequence diagram shows events landing in MongoDB — but the ratified X-5 decision and data-model.md Section 3 agree: Phase 1 events go to **Postgres**, then fold into **ClickHouse** at OBS-001. The diagram must be updated.

### 2. Target-state architecture diagram still shows MongoDB as the only store
**File**: architecture.md Section 2 target state mermaid diagram
**Problem**: The ingestion → MG[(MongoDB)] arrow and the entire diagram omit Postgres and ClickHouse. The ratified U-1 decision explicitly chose ClickHouse as the unified telemetry store and X-5 chose Aiven Postgres for the control plane. The target state diagram is architecturally wrong.

### 3. Internal worker architecture: text vs diagram conflict
**File**: architecture.md Section 1.3
The text says *"the Go backend contains an internal monitor worker"* (implying it's in-process), but the diagram shows `MonitorWorker` as a separate block alongside `GoServer`, and the service breakdown mermaid diagram also shows them as separate. Which is it?

### 4. Three conflicting retention policies
| Source | Raw events | Hourly rollups | Daily rollups | Logs | Traces |
|---|---|---|---|---|---|
| **data-model.md** Section 4 | 90d | 90d | 13mo | — | — |
| **decisions.md** U-6 (ratified) | **15d** | **90d (1m avg)** | **13mo (1h avg)** | **15d** | **7d** |
| **data-model.md** Section 5 DDL | — | — | — | 15d | 7d |

**Bug**: data-model.md Section 4 was never updated to reflect the ratified U-6 rollup ladder. The retention table in data-model.md is stale and contradicts the ratified decision.

### 5. SERVICE_TOKEN still has `password_hash` field in USER
**File**: data-model.md Section 1 entity diagram
**File**: data-model.md Section 1 `SERVICE_TOKEN` entity has `token_hash`
**But**: decisions.md X-1 says Google-only sign-in, "no username/password signup or login, product-wide" and "backends reject non-Google-provider tokens". Yet the USER entity still shows `password_hash`. If Google-only is ratified, this field should be marked deprecated/gone.

### 6. Entity design: VISIT_ROLLUP has ObjectID PK
**File**: data-model.md Section 2
`VISIT_ROLLUP` has `objectid _id PK` — but rollup entities are naturally keyed on `(property_id, period, bucket)`. Giving them a synthetic ObjectID PK contradicts the rollup semantics. Additionally, in the Postgres/ClickHouse world, ObjectID is a MongoDB type — it doesn't exist.

### 7. Deployment runtime contract assumes Postgres, but codebase is on MongoDB
**File**: deployment.md Section 1 — says api/common uses "Postgres advisory-lock lease" for the monitor worker
**File**: setup.md — says MONGO_URI is the config
**Bug**: The deployment doc describes a Postgres architecture that hasn't been migrated to yet, while the setup/current codebase still uses MongoDB. The docs are describing a future state as if it's the current deployment contract.

---

## 🟡 MAJOR — Cross-Document Inconsistencies

### 8. PRD says "no APM/tracing/logs" then Section 9 says "superseded" — confusion persists
**File**: prd.md Section 4 (non-goals) — says APM/tracing/logs explicitly excluded
**File**: prd.md Section 9 — says Section 9 supersedes Section 4
**But**: architecture.md Section 6.6 still carries the *superseded* guardrail text without clear "superseded — kept for audit" labeling. A reader could easily miss Section 9 and believe APM/tracing is still excluded. The supersession note should be AT the top of the guarded sections, not buried in Section 9.

### 9. Resend vs Brevo email provider — only decisions.md knows
- **decisions.md** U-4: "ratified — email provider REVISED by X-7: Brevo REST API (was Resend)"
- **design.md** Section 8.2: Still says email/webhook for alert channels, no provider specified
- **engineering.md**: No mention of Brevo or Resend
- **architecture.md**: No mention of email provider
- **prd.md**: Still references "Resend" in U-4 description

**Bug**: The email provider change (Resend → Brevo) is ONLY documented in decisions.md. Every other doc that mentions alerting or email either has the old info or is silent. This is a documentation drift bomb — the next person implementing email won't know to use Brevo.

### 10. Event storage: three contradictory sources
| Source | Events go to |
|---|---|
| **architecture.md** Section 4 sequence diagram | MongoDB |
| **data-model.md** Section 3 | Postgres (Phase 1), then ClickHouse (later) |
| **architecture.md** Section 6.1 | ClickHouse via ingestion gateway |

These three different answers mean any developer reading the docs cannot determine where events actually get stored.

### 11. X-5 migration scope is unclear: Phase 1 or OBS-006?
- **features.md** U1-0: "Postgres control-plane provisioning" in Phase 1
- **features.md** U2-7: "Control-plane Postgres migration" in Phase 2 (Mongo→PG)
- **decisions.md** X-5: "migrating from Mongo with the monitors-v2/OBS work"
- OBS-006 is monitors-v2 (pages.md feature register)

**Problem**: Three different phases claim the Postgres migration. Is it Phase 1 (U1-0), Phase 2 (U2-7), or OBS-006? These are different things — U1-0 provisions Postgres, U2-7 migrates data, and X-5 ties it to monitors-v2 which is OBS-006 (much later). This needs reconciliation.

### 12. Phase numbering chaos: four different schemes
- **prd.md** / **roadmap.md**: Phase 0, 1, 2, 3, 4, 5, 6, 7
- **features.md**: U0-x … U7-x (maps to phases) + UX-x (cross-cutting)
- **pages.md feature register**: OBS-001 … OBS-012 (different numbering)
- **roadmap.md revision**: Phase 3 (Ingestion+Metrics), Phase 4 (Logs), etc.

**Bug**: The U* IDs (U1-0 through U7-3) and OBS* IDs (OBS-001 through OBS-012) have no mapping table. A developer reading features.md won't know which OBS* items correspond to which U* items. Example: features.md Phase 3 = OBS-001/002/005 — but there's no cross-reference table.

### 13. setup.md still describes `JWT_SECRET` and local JWT auth
**File**: setup.md section for api/common lists `JWT_SECRET` as required config
**But**: decisions.md X-1 says Firebase Authentication only, Google sign-in only. The Go backend should be validating Firebase ID tokens, not issuing or verifying its own JWTs. If JWT_SECRET still exists in the codebase, it's legacy tech debt that should be marked as deprecated/removed in the docs.

---

## 🟠 MODERATE — Design & Feature Inconsistencies

### 14. Brand: "Datadog feel" vs "NOT Datadog's purple" — confusingly worded
**File**: prd.md Section 9: "Look and feel: datadoghq.com"
**File**: design.md Section 1: "Reference feel: datadoghq.com — dense, data-first observability UI with a confident purple identity"
**File**: design.md Section 2: "NOT Datadog's purple" — brand is teal #00E09E

**Bug**: The docs initially say "Datadog look and feel" which implies purple, then immediately say "not purple." This is correct in intent (teal brand, Datadog's UX patterns) but the prose actively misleads. Every new designer/engineer will have a moment of confusion here. Should say: "UX patterns inspired by Datadog (density, pillar nav, synced graphs); brand is teal (not purple)."

### 15. Figma file quality is called out in prd.md but never resolved
**File**: prd.md: "its frames are unnamed, so a light design-hygiene pass is recommended before handoff"
**File**: design.md Section 7: "the Style Guide page is being refreshed to match the collection"
**File**: design.md Section 7: "the legacy Variable collection... quarantined as pending cleanup: whether and when to delete them is an owner decision, deliberately not scheduled here"

**Problem**: The docs admit the Figma file has unresolved quality issues (unnamed frames, stale legacy collection, unquarantined deprecated content), but there's no owner decision, timeline, or plan to fix this. It's passed as "owner decision, deliberately not scheduled" — this is a process smell.

### 16. 2026-07-16 vs 2026-07-18/19/20 directive dates — temporal drift
Multiple sections were added/revised on different dates (2026-07-16 expansion, 2026-07-18 design directive, 2026-07-19/20 as-builts). The docs are becoming a patchwork of dated directives. For example:
- **pages.md** has content marked with `[Decided 2026-07-20]`, `[Directive 2026-07-19]`, `[Ratified 2026-07-19]`
- **design.md** has similar date stamps throughout
- **web-implementation.md** has extensive "as-built" notes from 2026-07-19/20

While dated decisions are good, the docs are becoming hard to read as the *current* state vs *historical* decisions blur together. This is a documentation quality issue.

### 17. Features dropdown settled but confusion persists
**File**: design.md Section 8.2b MarketingNav: Platform dropdown vs Features dropdown
**File**: pages.md A1: "Features (anchors the A11 feature-highlights band, `/#features` — differentiated from Platform 2026-07-19)"
**File**: web-implementation.md Section 2: "A1 Features pillar-map dropdown" adjudicated as supplement

The navigation link semantics were revised multiple times (Features vs Platform, dropdown vs no dropdown). The final state is correct but the trail of revisions makes it very hard to determine the current canonical state without reading every dated note.

---

## 🔵 MINOR — Specific Mistakes

### 18. on-brand hex values are implementation noise in a design spec
**File**: design.md Section 2 — `on-crit` description includes specific AA contrast ratios (4.98, 3.03, 6.26) and pixel-level reasoning
These belong in engineering.md, not the design language spec. Design docs should describe the token and its purpose, not the accessibility math.

### 19. design.md Section 8.1 Stage 2 says SettingsRow — wrong stage
**File**: design.md Section 8.1 "Stage 2 Molecules" includes SettingsRow
But SettingsRow includes "control slot: text / select / toggle" and is listed as part of "panes of the route-backed settings tabs" — Settings tabs are B12 in Stage 4 (Screen templates). SettingsRow should be Stage 3 or Stage 4, not Stage 2.

### 20. overview.md says "JWTs issued by Go backend" — contradicts X-1
**File**: overview.md: "Google sign-in (GOOGLE_CLIENT_ID) plus JWTs issued by the Go backend"
**Decisions**: X-1 says Firebase Auth only, Google sign-in only
**Bug**: If using Firebase Auth, the Go backend validates Firebase ID tokens — it does NOT issue its own JWTs. The overview gives an outdated auth model.

### 21. deployment.md doesn't mention the web frontend domain
**Bug**: deployment.md lists `api.upstat.cuesoft.io` and `ingest.upstat.cuesoft.io` but never says what domain the web app runs on. web-implementation.md Section 10 sets `metadataBase = https://upstat.cuesoft.io` — but there's no deployment contract specifying how `upstat.cuesoft.io` routes to Firebase App Hosting.

### 22. data-model.md ObjectID references in Postgres era
**File**: data-model.md throughout — uses `objectid _id PK` everywhere
**Problem**: Per X-5, the control plane migrates to Aiven Postgres. In Postgres, the standard PK type would be UUID or serial, not ObjectID. The data model still uses MongoDB notation throughout.

### 23. features.md Phase 0 U0-1 "Design tokens package" — already done?
**File**: features.md U0-1: "Design tokens package — upstat/tokens (#00E09E) → CSS vars/Tailwind; dark-first"
**File**: design.md Section 7: says `upstat/tokens` collection exists in Figma
**File**: web-implementation.md Section 2: says W0 delivered tokens.css
**File**: web-implementation.md Section 3: says "as built in tokens.css"

If W0 is done and tokens exist in both Figma and code, U0-1 should be marked complete. It's listed as if it's still to be done.

---

## 🔴 CRITICAL — Architectural Issues

### 24. The "current architecture is all wrong" — root cause analysis
The user stated this, and they are correct. Here's why:

1. **All architecture diagrams** still show MongoDB as the primary/only store — but the ratified decisions chose Aiven Postgres (X-5) + ClickHouse (U-1).

2. **The monitoring worker architecture** is described inconsistently — is it in-process, a separate service, or both?

3. **The events layer** is shown going to MongoDB in diagrams but to Postgres in data-model.md Section 3 and to ClickHouse in architecture.md Section 6.1 — three contradictory storage targets.

4. **The observability platform expansion** (architecture.md Section 6) adds OTLP ingestion, ClickHouse, and a query layer — but the "current state" and "target state" diagrams in sections 1-2 don't reflect this at all. They show the old architecture.

5. **The Postgres migration** is claimed by three different phases (U1-0, U2-7, OBS-006) with no clarity on which is the real schedule.

6. **Setup.md** describes `JWT_SECRET` and `MONGO_URI` but the ratified auth model is Firebase-only and the future state is Postgres.

### 25. No single document describes the true current-vs-planned architecture
Five documents (architecture.md, data-model.md, decisions.md, deployment.md, overview.md) all describe different slices of the architecture. No single diagram or table shows:
- What runs where (current vs planned)
- What data goes to which store (events, monitors, users, rollups, telemetry)
- What the migration path is (Mongo → Postgres → ClickHouse timeline)

This is the core architectural documentation failure.