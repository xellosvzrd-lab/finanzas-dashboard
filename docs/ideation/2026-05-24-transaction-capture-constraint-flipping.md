# Ideation: Transaction Capture — Constraint-Flipping
**Date:** 2026-05-24
**Lens:** Constraint-flipping — invert the obvious constraint to its opposite or extreme
**Focus:** NET-NEW ideas only; excluded prior: Wallet Shortcut, Telegram bot, MP cron, Edge Function ingest, idempotency dedup, pending review strip
**Run ID:** a7f3c291
**Companion docs:**
- `2026-05-23-transaction-capture-automation.md` (Inversion lens — 8 survivors)
- `2026-05-24-transaction-capture-assumption-breaking.md` (Assumption-breaking lens — 7 survivors)

---

## Grounding Context

**Project shape:** Single-file SPA ~7300 lines, vanilla JS + Supabase JS v2, 2 users (Daniel + Ama), Vercel + PWA. No build pipeline.

**Key infrastructure:**
- `confirmarImport()` → `.insert(rows)` batch pattern — any automated source can call this
- `allTransac[]` in memory at login — full history with descripcion, categoria, fuente, responsabilidad
- `compras_cuotas` table: future installments modeled as real rows (future spend IS in DB)
- `crypto.randomUUID()` used for IDs — idempotency not yet implemented
- `_pendingDelete` pattern: optimistic UI with 5-second undo
- Modo Ráfaga: existing bulk-entry mode (`abrirRafaga()`)
- No `estado`, `source`, `merchant_normalized`, or `idempotency_key` column yet
- Supabase Edge Functions available, not yet deployed
- Vercel cron: already configured in `vercel.json`
- Google Apps Script backend: free, cron, reads Gmail, POSTs to Supabase REST
- PWA service worker already registered (`sw.js`)
- Web Push API available via service worker

**Constraints flipped (per user request):**
1. "Bank APIs are closed" → automation doesn't need bank APIs
2. "Categorization requires human judgment" → zero categorization step ever
3. "Deduplication requires server logic" → client-side dedup, no server
4. "App shows past data only" → predicts future spend, warns before it happens
5. "Must log transactions individually" → log everything as one bulk end-of-day act
6. "The app is the interface" → the interface is something you already use all day

**Topic axes:**
1. Capture trigger — when/how detected
2. Data extraction & normalization — raw signal to structured row
3. Deduplication & conflict resolution — multi-source same transaction
4. Categorization & enrichment — auto-assigning categoria, responsabilidad, fuente
5. UX & review flow — confirm, correct, dismiss

---

## Survivors (8 ideas)

---

### 1. "allTransac IS the model" — client-side dedup by fingerprint, zero server involvement

**axis:** Deduplication & conflict resolution

**summary:** The constraint "deduplication requires server logic" flips to: the client already has the full transaction history in memory (`allTransac[]`), so dedup can happen entirely in the browser before any insert. When any automated source (email parse, Shortcut webhook response, CSV paste) produces a candidate row, a fingerprint — `sha(fecha + monto.toFixed(2) + fuente)` — is computed in JS and checked against fingerprints of all transactions in `allTransac[]` from the same 3-day window. If it matches, the row is silently dropped. No server round-trip, no new column, no migration needed. The check runs in `confirmarImport()` before the `.insert()` call.

**basis:** `reasoned:` `allTransac[]` is populated on every login and contains the complete transaction history — already the source of truth the app reasons against for budget calculations, charts, and Compartidos balance. A fingerprint over `(fecha, monto, fuente)` is collision-resistant for a 2-user household (hundreds of transactions/month). `crypto.subtle.digest()` is available in all modern browsers. The `confirmarImport()` pre-insert map step already exists — the dedup filter slots in as: `rows.filter(r => !_isDuplicate(r))`.

**why_it_matters:** Every automated capture source will eventually create duplicates — Wallet Shortcut fires, then the user logs manually, then the email parser runs. Without a dedup gate, the app fills with doubles. Building client-side means it works for every source simultaneously with zero backend infrastructure and is testable in minutes.

**meeting_test:** This is the prerequisite safety net for any multi-source capture system — worth discussing before enabling more than one automated source.

---

### 2. Gmail label as the only interface — the app never opens to capture

**axis:** Capture trigger

**summary:** The constraint "the app is the interface" flips to: Gmail's label system is the interface. When Daniel receives a Galicia or BBVA transaction email, he applies a Gmail label ("finanzas/registrar") — a 2-tap gesture in Gmail mobile. A Google Apps Script time-trigger (every 15 min, free) polls for emails with that label, parses the subject line for merchant + amount + date, POSTs to Supabase, and removes the label. The app never opens. The user's intent signal is the label tap, not the app open.

**basis:** `direct:` CLAUDE.md documents "Google Apps Script: free, cron, reads Gmail, POSTs to Supabase REST" as existing live infrastructure. `GmailApp.getUserLabelByName("finanzas/registrar").getThreads()` is standard Apps Script with no OAuth beyond the Script's own auth. Argentine banks (Galicia, BBVA, Santander) send structured email notifications for every card transaction — the assumption-breaking ideation doc (2026-05-24) confirmed this pattern. The Gmail label is the novel element: it provides a manual intent gate that avoids false positives from promotional email noise.

**why_it_matters:** Gmail is already open on Daniel's phone dozens of times per day. The capture gesture becomes: open notification → label → done. It removes the "open a different app" step entirely while keeping a manual intent signal (the label tap) that filters out non-tracked purchases.

**meeting_test:** This is a 2-hour implementation on top of already-live Apps Script infrastructure. Worth discussing whether the Gmail label gesture is natural for both users and whether both use Gmail as their bank notification client.

---

### 3. End-of-day voice note → structured batch — one act logs everything

**axis:** UX & review flow

**summary:** The constraint "must log transactions individually" flips to: log everything as one end-of-day voice act. Daniel records a 30-second voice note at night: "Hoy gasté 4500 en el super compartido, 800 en café mío, y 12000 en la farmacia de Ama." A Shortcut (iOS) transcribes it via on-device speech recognition (no API cost, works offline), sends the transcript as a single HTTP POST to a Supabase Edge Function that splits it into rows using regex (amount + category keywords from `categGasto` + responsabilidad keywords). All rows land in one batch insert via `confirmarImport()`.

**basis:** `reasoned:` iOS 17+ includes on-device speech recognition accessible from Apple Shortcuts via the "Transcribe audio" action — no third-party API required. The transcript format maps directly to the existing schema: amounts are numeric, category keywords ("super", "farmacia", "café") are matchable against `categGasto`, and responsabilidad keywords ("compartido", "mío", "de Ama") are already the canonical values. Modo Ráfaga already solves "multiple transactions in one session" — voice is a different front-end for the same batch-insert backend.

**why_it_matters:** The friction of individual logging disappears. The "settle the day" ritual is a well-established behavior pattern in personal finance (YNAB's daily approach, journaling apps). Voice input takes 30 seconds vs. 5 minutes for 5 individual form entries. Speaking the day's spending also naturally prompts recall of everything spent.

**meeting_test:** The iOS Shortcut + Edge Function combination is new territory for this project — worth discussing whether both users have consistent iOS access and whether the on-device transcription accuracy is sufficient for Argentine Spanish.

---

### 4. Spend prediction from `compras_cuotas` + recurring patterns — warn before money leaves

**axis:** Capture trigger (inverted: proactive + future-facing)

**summary:** The constraint "the app shows past data only" flips to: the app warns you before the spend happens. `compras_cuotas` already stores future installment rows with exact dates and amounts. A client-side scan at login additionally detects recurring patterns in `allTransac[]` (same merchant + similar amount, same day-of-month for 3+ months). These two signals combine into a "this week's expected spend" widget on Mi mes — specific upcoming outflows with categories already assigned. No new data required; it's already in the database.

**basis:** `direct:` The `compras_cuotas` table exists and is queried in `cargarCuotas()`. Its rows have `fecha_vencimiento` and `monto_cuota` with future dates as real rows. `allTransac[]` contains full history; a recurring-detection function (group by normalized `descripcion`, check same-week-of-month pattern for 3+ occurrences) is feasible in vanilla JS in-memory. `cargarPresupuesto()` already runs at Mi mes load — a "próximos 7 días" section appends to the same cycle.

**why_it_matters:** The dashboard currently tells you what you already spent. Predicting what you're about to spend changes it from a ledger to a planning tool. Knowing cuota #3/12 of the TV hits next Thursday, plus the gym subscription, lets Daniel decide whether to hold a cash buffer before the money is gone.

**meeting_test:** Uses only data already in the system — zero new infrastructure, zero new tables. The question is presentation: where on Mi mes does this widget live without cluttering the existing KPI grid?

---

### 5. Description-cluster auto-categorizer — zero categorization step for known merchants

**axis:** Categorization & enrichment

**summary:** The constraint "categorization requires human judgment" flips to: for 80% of transactions, the `descripcion` field already encodes the category — because `allTransac[]` contains history where Daniel already made that judgment. A one-time client-side scan at `_renderApp()` builds a `Map<normalized_merchant → categoria>` from all past transactions. When a new transaction arrives with a known merchant name in the description, `categoria` is assigned automatically from the map — no select required. The user only sees the category picker for truly new merchants.

**basis:** `direct:` `allTransac[]` is loaded in full at login and includes both `descripcion` and `categoria` for every historical transaction. Merchant normalization (lowercase, strip accents, strip common suffixes like "S.A.", "SRL") is a ~10-line JS function. The map construction runs once and costs <5ms on a 1000-transaction history. `_normalizarCategorias()` already demonstrates the pattern (backward lookup from canonical lists) — the merchant map is the forward-lookup complement.

**why_it_matters:** Category selection is the field most often skipped or left wrong in bulk-entry scenarios. Eliminating it for known merchants reduces the form to 3 fields (monto, responsabilidad, fecha) for 80%+ of transactions. It also makes Modo Ráfaga dramatically faster — type amounts, it fills in everything else.

**meeting_test:** Zero server changes, zero migration, zero new API — just JS added to the existing `_renderApp()` flow. Unusually low cost for a significant UX improvement.

---

### 6. WhatsApp receipt photo → structured row via vision-parse Edge Function

**axis:** Data extraction & normalization

**summary:** The constraint "the app is the interface" flips to: WhatsApp camera is the interface. Daniel photographs a physical receipt or supermarket ticket and sends it to a private WhatsApp number backed by a Supabase Edge Function via the WhatsApp Business Cloud API (free, up to 1,000 conversations/month). The Edge Function calls a vision model (Claude Haiku or GPT-4o-mini) to extract merchant, total, date, and line items, maps them to the transaction schema, and inserts or queues the result. A 2-person household never approaches the free tier limit.

**basis:** `external:` WhatsApp Business Cloud API (Meta Developers) is free for 1,000 conversations/month per number — a 2-person household generates ~50-100 messages/month. Vision-based receipt parsing via small LLMs achieves 90%+ accuracy on standard printed receipts (per 2024 comparative benchmarks on Google Cloud Vision vs. LLM parsing). The Supabase Edge Function receives the webhook, calls the vision API, and inserts via the same `.insert(rows)` pattern already in `confirmarImport()`.

**why_it_matters:** Physical receipts are the one category no digital trigger captures — cash purchases, small merchants, street markets. In Argentina, cash and Mercado Pago QR payments are common and generate no email notification. WhatsApp photo capture closes this gap without requiring any finance app to be open.

**meeting_test:** Requires a WhatsApp Business number (free via Meta) and a vision API key — two new external dependencies. Worth discussing whether receipt-photo friction is lower than form-entry friction for the household's actual cash spending patterns.

---

### 7. pg_cron "spend velocity" monitor — push notification before budget is blown

**axis:** UX & review flow (inverted: proactive, future-facing)

**summary:** The constraint "app shows past data only" flips to: the database warns you, not the app. A pg_cron job runs daily at 8am, calculates the daily spend rate (total spent ÷ days elapsed), projects to month-end, and compares against the budget. If projected spend exceeds budget by >10% in any category, it POSTs to a Vercel Edge Function that sends a Web Push notification to the PWA — no app needs to be open. The service worker is already registered. The warning arrives like a text: "Vas a pasarte $8,000 en Delivery este mes al ritmo actual."

**basis:** `direct:` The app is already a PWA with a registered service worker (`sw.js`). Web Push requires a VAPID key pair and a push subscription endpoint storable in Supabase `user_metadata`. Supabase pg_cron runs arbitrary SQL on a schedule; `net.http_post()` calls a Vercel Edge Function that holds the VAPID private key and sends the push. `cargarPresupuesto()` already computes this exact projection client-side — the pg_cron job replicates that logic server-side.

**why_it_matters:** Budget overruns are only visible when you open the app and look. A proactive push notification — arriving while there's still time to adjust — turns the dashboard from a rearview mirror into a windshield alert. The behavior change opportunity is at the moment of the next purchase decision, not after the month is over.

**meeting_test:** The PWA service worker already exists. Missing pieces are VAPID key setup and the pg_cron SQL — both small and self-contained. Worth discussing what cadence and threshold both users want to be notified at before implementing.

---

### 8. Web Share Target — "one note all day, one tap at night"

**axis:** UX & review flow

**summary:** The constraint "must log transactions individually" flips to: log the whole day as a single act from wherever you already are. The iOS share sheet (or Android's share intent) exposes a custom action "Registrar en Finanzas" that accepts plain text from any app — Notes, Messages, Safari. Daniel jots transactions in Apple Notes all day ("4500 super, 800 café, 12k farmacia Ama") without opening the finance app. At night, Share → "Registrar en Finanzas" opens the app directly to the import textarea with the note pre-filled. One review, one confirm tap.

**basis:** `direct:` The app already has a textarea-based import flow (`#imp-textarea`) with parse-and-preview and `confirmarImport()` batch insert. The PWA manifest's `share_target` field accepts `text/plain` and maps it to a URL parameter — a 10-line addition to `manifest.json`. A `_handleShareTarget()` function reads `?text=` on `DOMContentLoaded` and pre-fills the import textarea. Zero backend change, zero new infrastructure.

**basis (additional):** `reasoned:` The "jot in Notes all day, log once at night" workflow is documented behavior among personal finance users who resist real-time apps (YNAB community, r/personalfinance). The share action removes the app-open friction from the end-of-day step — the user is already in Notes; one share sends the batch.

**why_it_matters:** Exploits existing user behavior (jotting in Notes) rather than fighting it with a new habit. The parse-and-preview step already exists — the only new element is pre-filling it from the share payload. Closes the "I noted it somewhere but never logged it" gap.

**meeting_test:** The Web Share Target API support should be verified on Daniel's iOS version. If supported, this is a 2-hour implementation that requires no new external services.

---

## Rejected (not surfaced)

- "Zero-click categorization via ML model trained on allTransac": requires model hosting infrastructure that doesn't exist and would need retraining — too heavy for a vanilla JS no-build-pipeline project. Idea #5 (description-cluster map) achieves 80% of the benefit at 1% of the cost.
- "Argentine Open Finance / Decreto 353/2025 direct API pull": the law exists but no bank has published an API yet — no basis to ground the implementation.
- "Server-side dedup via Postgres unique constraint on fingerprint": valid but already in the excluded list (idempotency key = same idea). The client-side version (#1) is the net-new flip.
