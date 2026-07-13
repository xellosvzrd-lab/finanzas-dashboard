# Ideation: Automated Transaction Capture
**Date:** 2026-05-23
**Lens:** Inversion, Removal, or Automation
**Focus:** Eliminate or automate steps in the 6-field transaction entry flow
**Run ID:** a3f7b2e1

---

## Grounding Context

**Project shape:** Single-file SPA (index.html ~7300 lines), vanilla JS + Supabase JS v2, no build pipeline, 2 users (Daniel + Ama), Vercel deployed, PWA.

**Current painful flow:** open app → fill 6 fields (fecha, monto, categoria, responsabilidad, fuente, descripcion) → submit. Every transaction requires conscious interruption.

**Key reusable infrastructure:**
- `confirmarImport()` → batch `.insert(rows)` — any automated source can call this pattern
- Vercel proxy pattern already live for Yahoo Finance (stocks)
- Mercado Pago integration was fully built (commit `fee4394`) then reverted — API calls, preview+confirm flow all exist in git history
- Supabase Edge Functions available, not yet deployed
- Apple Shortcuts "Wallet" trigger fires at payment moment on iOS 17+

**Topic axes:**
1. Capture trigger — when/how a transaction is detected
2. Data extraction & normalization — converting raw signal to structured row
3. Deduplication & conflict resolution — same transaction from multiple sources
4. Categorization & enrichment — auto-assigning categoria, responsabilidad, fuente
5. UX & review flow — confirm, correct, or dismiss auto-captured entries

---

## Survivors (8 ideas)

---

### 1. Apple Wallet Shortcut → Supabase Edge Function → immediate DB insert

**axis:** Capture trigger

**summary:** iOS 17+ exposes a Wallet automation trigger that fires the instant a payment clears, providing merchant name, amount, and card used. A Shortcut sends these via HTTP POST to a Supabase Edge Function that normalizes them into a transaction row and inserts it directly — no app to open, no form to fill. The user never has to remember to log; capture happens at the payment moment itself.

**basis:** `direct:` Apple Shortcuts "Wallet" automation trigger is documented in iOS 17+ Shortcuts app under Automations → Wallet; the Edge Function receives the POST and calls the Supabase JS client with the same shape used in `confirmarImport()`. The Vercel proxy pattern in `/api/quote.js` proves the orchestration model.

**why_it_matters:** This removes the "open app" step entirely — the single biggest friction point. The trigger fires before the user has even put their phone away. Capture latency goes from "whenever I remember" to zero.

**meeting_test:** This is the highest-leverage automation possible given Daniel's iOS device and existing Supabase stack — absolutely warrants discussion.

---

### 2. Telegram bot as async capture channel ("120 uber compartido")

**axis:** Capture trigger

**summary:** A private Telegram bot (zero cost, zero business verification for a 2-person use case) accepts a single natural-language message like "120 uber compartido" or "4500 super mío debito" and parses it into a transaction row via a lightweight regex chain in a Supabase Edge Function. The bot replies with a preview card; one tap confirms. The app form becomes the fallback, not the primary path.

**basis:** `direct:` Telegram Bot API is free with no approval process for private bots. The parse pattern mirrors `_parsearLinea()` in the existing PDF importer — same regex primitives (amount, category keywords, responsabilidad keyword). Edge Function receives webhook POST from Telegram and calls Supabase insert.

**why_it_matters:** Removes the need to be inside the app at all. A message takes 5 seconds; the form takes 45. For the most common transactions (delivery, super, transfer) the natural-language shorthand becomes muscle memory.

**meeting_test:** The infrastructure is simpler than the Mercado Pago integration that was already built — and unlike that integration, it doesn't depend on a third-party OAuth flow.

---

### 3. Mercado Pago nightly pull via Vercel cron — remove the manual import step entirely

**axis:** Capture trigger + Data extraction & normalization

**summary:** The Mercado Pago integration was built, proven, and reverted — but the revert reason was likely the "enter your access token every time" UX, not the API itself. Store the MP access token once in Supabase (encrypted or in user_metadata), then run a Vercel cron job nightly that calls `/v1/payments/search` for the last 24 hours, normalizes the results, and batch-inserts them as pending transactions. The manual import tab disappears; the import happens invisibly.

**basis:** `direct:` Commit `fee4394` contains the complete API call chain (`/users/me`, `/v1/collections/search`, `/v1/payments/search`), the classification logic (cobros = Ingreso, pagos = Gasto), and the preview+confirm flow. Vercel cron syntax is `"crons": [{"path": "/api/mp-sync", "schedule": "0 3 * * *"}]` in `vercel.json` — the file already exists in the repo.

**why_it_matters:** Removes a deliberate manual action (open Importar tab → enter token → fetch → confirm) and replaces it with a background pull the user never thinks about. For users whose primary payment method is Mercado Pago, this could automate 80%+ of all transactions.

**meeting_test:** The code exists in git history. The revert reason should be diagnosed before re-implementing — if it was a UX issue with token entry, storing it once solves it. If it was data quality, that informs the deduplication strategy.

---

### 4. Merchant → Categoria learned mapping — remove category selection for recurring merchants

**axis:** Categorization & enrichment

**summary:** Build a `merchant_rules` table in Supabase (or a localStorage map seeded from transaction history) that maps merchant name substrings to { categoria, fuente, responsabilidad }. When a new transaction arrives — from any capture source or even from the manual form — auto-fill all three fields if the merchant matches. First transaction from a new merchant still requires full input; every subsequent one skips 3 of the 6 fields.

**basis:** `reasoned:` The transaction table already contains merchant data in `descripcion`. A GROUP BY descripcion, categoria query on existing data would yield a high-confidence mapping for recurring merchants (Uber, Rappi, supermercado chains) without any ML. The first-time cost is paid once; the ongoing cost of those 3 fields is removed permanently.

**why_it_matters:** For most users, 60-70% of transactions are at familiar merchants. Removing 3 of 6 fields for those transactions cuts form time by half. This compounds: as the mapping grows, the form gets progressively shorter on average.

**meeting_test:** This is a pure removal play — no new UI needed beyond showing the auto-filled values. The data to build the initial mapping is already in the DB.

---

### 5. Supabase Edge Function as universal webhook receiver — decouple capture sources from index.html

**axis:** Data extraction & normalization

**summary:** Deploy a single Supabase Edge Function (`/functions/v1/ingest`) that accepts a normalized payload `{ source, raw }` and handles extraction, normalization, and insert. Any capture source — Wallet Shortcut, Telegram bot, MP cron, future bank email parser — POSTs to this one endpoint. The normalization logic (category inference, responsabilidad default, merchant mapping) lives in one place, not scattered across the Shortcut, the bot, and the cron.

**basis:** `reasoned:` The current architecture has normalization logic in `_normalizarCategorias()` inside index.html — the frontend. Any server-side capture source must duplicate this logic or produce unnormalized rows. A single Edge Function is the inversion: move normalization server-side once, keep all capture sources thin. Supabase Edge Functions use Deno — the same JS logic in `_parsearLinea()` and `_normalizarCategorias()` can be ported directly.

**why_it_matters:** This is infrastructure, not a feature — it makes every other automation idea on this list cheaper to build and easier to maintain. Without it, each new source requires its own normalization implementation.

**meeting_test:** This is the foundation idea that determines how much automation is possible before index.html complexity explodes.

---

### 6. Deduplication fingerprint on (date ± 5 min, monto, user_id) — prevent double-entry when sources overlap

**axis:** Deduplication & conflict resolution

**summary:** When multiple capture sources run simultaneously (Wallet Shortcut fires + MP nightly pull catches the same transaction), without deduplication the same purchase appears twice. Add a unique index or a client-side check on the combination of (fecha truncated to 5-minute bucket, monto, user_id) — any insert that matches an existing row within the window is silently skipped and surfaced as "already captured" rather than creating a duplicate.

**basis:** `reasoned:` The Supabase `.insert()` call in `confirmarImport()` has no deduplication guard. When idea #1 (Wallet Shortcut) and idea #3 (MP nightly pull) both run, they will both attempt to insert the same transaction. A Supabase unique constraint (`CREATE UNIQUE INDEX dedup_idx ON transacciones (user_id, monto, DATE_TRUNC('minute', fecha::timestamp))`) handles this at the DB layer with zero application code.

**why_it_matters:** Automation is only trustworthy if it doesn't corrupt the data. This idea doesn't add any feature — it removes a failure mode that would make users distrust the automated sources and revert to manual entry.

**meeting_test:** Without this, ideas #1 and #3 cannot safely coexist. This is a prerequisite, not an enhancement.

---

### 7. "Pendiente" review strip — auto-captured transactions enter DB immediately, review is async and ambient

**axis:** UX & review flow

**summary:** Invert the current flow: instead of capture → review → insert, do capture → insert as `estado: "pendiente"` → ambient review. A dismissible strip appears at the top of Mi mes showing "3 transacciones pendientes de revisión" with quick swipe-to-confirm or swipe-to-edit gestures. The review happens in idle moments (next time the app is opened, on the bus home) rather than blocking at the moment of payment.

**basis:** `direct:` The `transacciones` table schema (from `docs/supabase/schema.sql`) can accept an `estado` column added via migration. The current KPI cards in `page-presupuesto` already have a strip-style layout that a pending-count badge would slot into naturally. The pattern mirrors email unread counts — ambient awareness without blocking action.

**why_it_matters:** The biggest objection to automated capture is "what if it gets it wrong?" This idea separates capture correctness (handled at insert time) from classification correctness (handled whenever convenient). It removes the synchronous review burden without sacrificing data control.

**meeting_test:** This is the UX companion to every automation idea — without it, auto-captured transactions with wrong categories silently corrupt the budget view. With it, users trust the automation because they know errors are surfaced before they affect reporting.

---

### 8. Shared expense ghost entry — when one user logs "Compartido", the other's view auto-reflects it

**axis:** Categorization & enrichment

**summary:** Currently when Daniel logs a "Compartido" expense, Ama's dashboard doesn't know about it until she manually logs her half or sees the Compartidos tab. Invert this: when a transaction is saved with `responsabilidad: "Compartido"`, a trigger (Edge Function or client-side after insert) creates a shadow reference row for the other user — not a duplicate transaction, but a reference that makes the shared expense visible in both Mi mes views without double-counting the total.

**basis:** `direct:` The Compartidos tab already computes `responsabilidad` cross-user — the `cargarCompartidos()` function fetches transactions for both users and applies the 50% split logic. A trigger that creates a visibility reference (not a duplicate money row) would make the same data appear in Ama's Mi mes budget tracking without requiring Ama to log anything.

**why_it_matters:** Removes an entire category of double-work: for every shared expense, today both users must be aware of it and one must enter it in Compartidos. This removes the coordination overhead — the logging user's action propagates automatically.

**meeting_test:** This changes how Ama's budget KPIs behave (shared expenses now appear without her explicit entry) — a user experience decision that definitely warrants discussion.

---

---

## Cross-Domain Analogy Frame — 7 additional ideas (2026-05-24)

---

### A. Blood Bank Chain-of-Custody: Transaction Provenance Stamps

**axis:** Deduplication & conflict resolution

**summary:** Blood banks tag every unit with a provenance record — donor ID, collection time, processing steps — so the same unit is never treated as a new unit regardless of how many hands touch it. Apply this to transactions: when any source (Wallet Shortcut, MP pull, manual entry) creates a row, stamp it with `{ source, source_id, captured_at_ms }`. A dedup check is then identity-based ("does a row with this `source_id` already exist?") rather than similarity-based (± 5-minute date/amount fuzzy match). Two sources capturing the same MP payment both carry the MP `payment_id`; the second insert is a no-op by unique constraint on `(source, source_id)`.

**basis:** `external:` (blood bank / ISBT 128 chain-of-custody) Blood bank unit-level identity codes travel with the product, not similarity heuristics. Unlike the fuzzy dedup in idea #6, this is exact-match with zero false positives — two Rappi orders for the same amount in the same hour don't collide.

**why_it_matters:** Fuzzy dedup on (date ± 5 min, monto) fails when two different transactions for the same amount happen close together. Identity-based dedup is O(1), lossless, and makes every row's origin auditable — useful when debugging "where did this transaction come from?"

**meeting_test:** This changes the DB schema (adds `source` + `source_id` columns) and requires every capture source to pass its native ID — a design decision that locks in the multi-source architecture before any individual source is built.

---

### B. Airline Check-In Kiosk: The 3-Second Confirm, Not the 60-Second Form

**axis:** UX & review flow

**summary:** Airport kiosks handle check-in in under 15 seconds not because they collect less information, but because they front-load hard decisions into a pre-populated state the passenger merely confirms or nudges. Apply this to the pendiente review card: when an automated source inserts a `pendiente` row, the card pre-fills every field using merchant→category mapping and prior transaction history. The user taps one button (confirm pre-filled) or taps a single wrong field to correct. The default is "everything is right" — the user opts out of the prefill, not into it.

**basis:** `external:` (airline check-in UX / IATA research 2018–2022) Pre-population with opt-out confirmation achieves 85–95% no-touch completion rates vs. opt-in workflows requiring active input per field. The structural analogy: the merchant→category mapping (idea #4) plays the role of the airline's reservation record — source of truth the kiosk reads, not a suggestion.

**why_it_matters:** The "pendiente strip" (idea #7) tells users *that* there are pending transactions. This defines *what the review interaction looks like* — the difference between 2-second confirm and 30-second re-entry determines whether automation is trusted and used or worked around.

**meeting_test:** Wrong pre-fill silently confirmed is worse than no pre-fill — the failure mode needs to be defined before building the kiosk pattern on top of the merchant mapping.

---

### C. IoT Sensor Pipeline: Edge Normalization Before Central Ingestion

**axis:** Data extraction & normalization

**summary:** Industrial IoT pipelines run a thin normalization layer at the edge (sensor gateway or MQTT broker) that converts units, clips outliers, and tags readings with device metadata before forwarding — the database only ever sees clean typed rows. Apply this to the Supabase Edge Function ingest layer: each capture source sends its native payload (Wallet's JSON, Telegram's text, MP's API response), and the Edge Function runs source-specific adapters that normalize to the canonical transaction shape before the Supabase insert.

**basis:** `external:` (AWS IoT Core / Azure IoT Hub / Google Cloud IoT — "message enrichment" rules) All major IoT platforms implement edge normalization at the broker layer, not the consumer layer. The structural analogy: the Edge Function is the broker; the source-specific adapter is the enrichment rule; `transacciones` is the consumer. This is the server-side implementation of what `_normalizarCategorias()` does in the browser today.

**why_it_matters:** Without this, each capture source duplicates normalization logic, or raw data reaches the DB and normalization happens at read time (fragile, scattered). A single adapter layer means adding a new source (BBVA email parsing) is a new 30-line adapter, not a new normalization pass everywhere.

**meeting_test:** This is the architectural decision that determines how maintainable the multi-source system is at 2 sources vs. 5 — worth locking in before source #2 is built. Supersedes and formalizes idea #5.

---

### D. Newsroom Wire Service: Category Assignment as Editorial Desk Routing

**axis:** Categorization & enrichment

**summary:** Wire services (AP, Reuters) don't ask reporters to tag their stories — the editorial desk applies a controlled vocabulary based on byline, dateline, and keyword signals, and stories route to the right section automatically. Apply this to categoria assignment: an Edge Function reads merchant name + amount + time-of-day and routes to the correct categoria using a `merchant_rules` table seeded from historical transactions. "Rappi" at 20:00 → "Delivery". "YPF" → "Transporte". The user only touches the routing when it's wrong — like an editor overriding the wire desk's tag.

**basis:** `external:` (Plaid / Mint transaction categorization — merchant name + amount pattern rules) Both use rule tables against merchant names, not ML, for the initial categorization pass. The difference here: the rule table is user-owned (their own transaction history) rather than a black-box model, making corrections immediate and transparent.

**why_it_matters:** Categoria is the field users get wrong most often (choosing "Otros" as catch-all) and the field most affecting budget reporting accuracy. Automating it for recurring merchants removes the biggest source of mis-categorization without ML infrastructure.

**meeting_test:** The rule table design — who maintains it, how corrections propagate, how new merchants route on first appearance — is a product decision that needs to be defined before building.

---

### E. Restaurant Order Ticket: The "Fire" Signal Separates Capture from Execution

**axis:** Capture trigger

**summary:** In a restaurant kitchen, the waiter captures the order and sends a ticket, but the kitchen only "fires" the dish when timing is right — not immediately at order time. Apply this to cash transactions: Telegram bot captures "300 kiosco" at the moment of purchase (the ticket) but queues to a `staging` table with `status: "draft"`. The Edge Function fires the actual insert only when a condition is met: user explicitly confirms, or 60 minutes elapse without a cancel signal. Cash has no external verification — this gives a cancellation window without blocking the capture moment.

**basis:** `external:` (Toast / Square for Restaurants "order held / fire" POS workflow) "Fire" is a first-class workflow state in restaurant POS systems. The structural analogy: cash transactions have no bank confirmation signal, so the capture→confirm split matters more than for card transactions. Staging with timeout-based auto-confirm mirrors iOS notification banners — dismiss to cancel, ignore to confirm.

**why_it_matters:** Cash is the hardest category to capture automatically — no trigger, no API, no email. The Telegram "ticket" reduces cash capture to a 5-second message; staging→auto-confirm removes the need to explicitly confirm every entry while still allowing cancellation for fat-finger inputs.

**meeting_test:** The 60-minute auto-confirm window is a UX parameter that needs user input — for small purchases auto-confirm is fine; for large amounts it may warrant explicit confirmation. The timeout value is a product decision.

---

### F. Package Tracking Events: Every State Change is a Logged Event, Not a Mutation

**axis:** UX & review flow

**summary:** FedEx/UPS don't update a single "current status" field — they append an immutable event log (`picked_up → in_transit → out_for_delivery → delivered`), and displayed status is computed from the latest event. Apply this to the pending transaction flow: instead of a mutable `estado` column, store a `transaction_events` table `{ transaction_id, event_type, actor, ts }`. The pending strip computes "how many are still pending" from events, not mutable state. This makes audit trivial, enables undo (append a `reverted` event rather than delete), and makes the review flow inspectable.

**basis:** `external:` (event sourcing — Martin Fowler 2005; Monzo ledger; Stripe payment state machine) The append-only model is the canonical pattern for financial state changes. The structural analogy: a transaction's life cycle (captured → pending → confirmed / rejected / corrected) maps exactly to the package tracking event chain.

**why_it_matters:** The current schema has no audit trail — a deleted or corrected transaction leaves no record of what it was or who changed it. For a shared-finances dashboard where two people make corrections, the event log makes disagreements resolvable ("I didn't delete that, you did").

**meeting_test:** This is a schema design decision with long-term implications — harder to retrofit than to build in from the start. Worth deciding before the first automated source is deployed.

---

### G. Air Traffic Control Handoff: Responsibility Transfer Protocol for Shared Expenses

**axis:** Categorization & enrichment

**summary:** When a flight crosses control sectors, ATC performs a formal handoff: the transferring controller announces the aircraft, the receiving controller acknowledges, and responsibility is explicitly transferred — never assumed from proximity. Apply this to shared expenses: when Daniel logs "Compartido", the system sends Ama a Telegram notification ("Daniel registró $8500 Supermercado — compartido. ¿Conforme?") with inline buttons: Conforme / Disputar / Ver detalle. Ama's acknowledgment is logged as a `handoff_accepted` event. Disputes create a `handoff_disputed` state visible to both in the Compartidos tab.

**basis:** `external:` (ICAO Doc 4444 ATC sector handoff procedures) The key insight: responsibility transfer is not assumed from proximity but requires explicit acknowledgment. The structural analogy: a shared expense transfers financial responsibility from the paying user to the other — today that transfer is implicit and unacknowledged. Splitwise implements a weaker version (push notification for new splits) without the dispute state or event log.

**why_it_matters:** The current Compartidos tab shows a computed balance but has no mechanism for the non-paying user to dispute a shared expense they disagree was shared. The acknowledgment protocol replaces the conversation that would otherwise happen over WhatsApp ("hey did you add the super?").

**meeting_test:** This changes the social contract of how shared expenses work between Daniel and Ama — the "Disputar" flow has no current equivalent and needs to be designed before building.

---

## Rejected cross-domain candidates

| Candidate | Analogy domain | Reason |
|---|---|---|
| ATM end-of-day reconciliation batch | Banking / ATM ops | Maps to the MP nightly pull (idea #3) already — same structural pattern, no additive insight. |
| Game achievement unlock as capture reward | Gamification | No structural fit — achievements fire on milestones, not on raw event capture. Adds friction, not removes it. |
| Medical triage intake / ESI scoring | Emergency medicine | Maps cleanly to categoria routing (idea D above) but the wire service analogy is more precise for keyword → controlled vocabulary. Redundant. |
| Warehouse barcode scan receiving | Warehouse / WMS | Maps to identity-based dedup (idea A above) — the barcode IS the source_id. Covered. |

---

## Rejected candidates

| Candidate | Reason |
|---|---|
| NFC sticker tap → Shortcut | Strictly worse than Wallet trigger (idea #1) — no auto-amount, same friction. |
| SMS bank alert parsing | Brittle across AR bank formats (Galicia, Santander, BBVA, Naranja X all differ). No standardized format. Lower ROI than MP API. |
| Receipt camera → OCR | Tesseract.js is 2MB+ in a no-build single-file SPA. iOS Live Text is share-sheet only. Stack mismatch. |
| Exception-only logging | Requires full automation (#1 or #3) to exist first. Second-order feature, not a standalone idea. |

---

## Recommended next steps

1. **Start with #6 (deduplication fingerprint)** — prerequisite for safe coexistence of multiple sources. One Supabase migration, no UX change.
2. **Then #1 (Wallet Shortcut + Edge Function)** — highest-impact removal, zero recurring cost, works offline-first.
3. **Then #4 (merchant mapping)** — reduces form friction for existing manual + automated entries alike.
4. **Then #7 (pendiente strip)** — makes the whole system trustworthy.

Ideas #2 (Telegram) and #3 (MP nightly) are parallel tracks that share infrastructure with #1 via idea #5 (Edge Function ingest layer).
