# Ideation: Transaction Capture — Assumption-Breaking & Reframing
**Date:** 2026-05-24
**Lens:** Assumption-breaking & Reframing
**Focus:** What is treated as fixed in capture/enrichment that is actually a choice? Reframe one level up or sideways.
**Run ID:** a3f1b8e2
**Companion doc:** 2026-05-23-transaction-capture-automation.md (Inversion lens — 8 survivors)

---

## Grounding Context

**Project shape:** Single-file SPA (index.html ~7300 lines), vanilla JS + Supabase, no build pipeline, 2 users (Daniel + Ama), Vercel + PWA. Google Apps Script backend (free, cron, reads Gmail, POSTs to Supabase REST).

**Current capture flow:** 6-field form (fecha, monto, categoria, responsabilidad, fuente, descripcion) — fully manual, user-initiated, synchronous. Categorization happens at entry time by the user.

**Key infrastructure:**
- `confirmarImport()` → `.insert(rows)` batch pattern reusable for any source
- `allTransac[]` loaded at login — full transaction history with descripcion+categoria pairs in memory
- `compras_cuotas` table — future multi-month commitments already modeled
- Supabase Edge Functions available, not yet deployed
- Vercel cron available via existing `vercel.json`
- Google Apps Script: free, cron-capable, reads Gmail natively
- PDF import subsystem removed May 2026 (dead code)
- Mercado Pago OAuth integration built (commit `fee4394`), then reverted
- Transaction schema: no `estado`, no `source`, no `merchant_normalized` column

**Galicia/BBVA pattern:** Both banks send a structured email for every transaction — merchant name, amount, date, card in subject line. Consistent format. Google Apps Script can read these from Gmail natively (no IMAP, no credentials, no OAuth setup beyond the Script's own auth).

**Topic axes:**
1. Capture trigger — when/how detected
2. Data extraction & normalization — raw signal to structured row
3. Deduplication & conflict resolution — same transaction from multiple sources
4. Categorization & enrichment — auto-assigning categoria, responsabilidad, fuente
5. UX & review flow — confirm, correct, dismiss auto-captured entries

---

## Survivors (7 ideas)

---

### 1. Categorization happens after capture, not during it — "inbox" model

**axis:** Categorization & enrichment

**summary:** The assumption is that categorization is part of the capture act — you fill in categoria before saving. Flip it: capture stores the raw signal (merchant name + amount + date) immediately with categoria left null, and a separate "inbox" step handles categorization later in bulk. The form still exists for deliberate entry, but auto-captured rows (from Wallet Shortcut, email parse, etc.) land uncategorized. A weekly "sort your inbox" session of 10-15 taps replaces 15 interrupted moments of filling a 6-field form mid-purchase. Categorization becomes batch and calm rather than real-time and interruptive.

**basis:** `reasoned:` Email clients, task managers (Todoist Inbox, Things Today), and read-later apps (Pocket, Instapaper) all use this model — capture is cheap and contextless; triage is deliberate and batched. The assumption that categorization must happen at the moment of transaction is a form-UX habit, not a functional requirement. The `allTransac[]` array already supports null/empty categoria without crashing (categoria defaults to empty string in several places); `_normalizarCategorias()` would need to handle null gracefully but that is a 2-line change.

**why_it_matters:** Real-time categorization is the primary reason the form feels like an interruption rather than a logging tool. Separating capture from triage removes the cognitive load at the most disruptive moment (mid-transaction) and moves it to a calm context (end of day, commute). It also unlocks every other automation idea — auto-captured rows no longer need to guess a category correctly at insert time.

**meeting_test:** This reframes the entire product interaction model from "fill a form when you spend" to "sort your week's spending on Sunday." Warrants explicit discussion because it changes the implied contract with the user.

---

### 2. The bank email IS the transaction record — Google Apps Script as the capture layer

**axis:** Capture trigger + Data extraction & normalization

**summary:** The assumption is that the user is the system's input device. Flip it: the bank is. Galicia and BBVA send a structured email for every transaction — the email subject contains merchant name, amount, date, and card. Google Apps Script (already used as the backend) can poll Gmail every 15 minutes, parse these emails, and POST matching rows to Supabase via the same REST API it already calls for other actions. The user never opens a form; the bank's notification system becomes the capture trigger. Zero new infrastructure — Apps Script + Gmail is already the backend stack.

**basis:** `direct:` The CLAUDE.md documents "Galicia/BBVA send email for EVERY transaction — structured, consistent format with merchant, amount, date in subject line" and "Google Apps Script: free, cron, reads Gmail, POSTs to Supabase REST API" as existing, documented capabilities. The `doGet`/`doPost` pattern in the Apps Script backend is already live. A Gmail label filter + `GmailApp.search("from:alertas@galicia.com.ar after:yesterday")` in Apps Script is 10 lines of code. The n8n+LLM pattern documented in the grounding ("LLM outperforms regex because bank templates vary") is the normalization complement.

**why_it_matters:** This is the highest-coverage, lowest-friction capture path possible for Argentine banking — no app to open, no Shortcut to configure, no OAuth to maintain. The bank's own notification system does the triggering. For Daniel's Galicia card, this would auto-capture 100% of card transactions with no user action beyond the initial Apps Script setup.

**meeting_test:** The infrastructure is already live (Apps Script + Gmail). The question is whether to trust it as the primary capture path vs. a supplementary one — a product decision with real UX implications.

---

### 3. "Responsibility" is assigned by the payer, not inferred from the transaction type — flip the ownership model

**axis:** Categorization & enrichment

**summary:** The assumption is that responsabilidad is a field the user consciously chooses at entry time by selecting "Mío / Compartido / De Ama." Flip it: responsibility is inferred from *who paid* (which card/account was used) rather than declared. If Daniel pays with his personal Débito card, it's "Mío." If he pays with the shared Galicia VISA, it's "Compartido." If Ama's card is on file and the email comes from her bank alert, it's "De Ama." The fuente (source account) already encodes the payment instrument — responsibility becomes derivable from fuente rather than a separate field the user must fill.

**basis:** `reasoned:` The transaction schema stores both `fuente` and `responsabilidad` as separate fields, but they are highly correlated in practice — Daniel paying with a shared card almost always means Compartido; paying with his personal account almost always means Mío. The `categFuentes` list in the codebase maps to actual payment instruments (Débito, Crédito Galicia, etc.). A lookup table from fuente → default_responsabilidad would auto-fill correctly for the vast majority of transactions, reducing a 5-option select to a confirmation.

**why_it_matters:** Responsabilidad is the field most likely to be left wrong when users are in a hurry — it affects the Compartidos balance calculation and both users' Mi mes KPIs. Making it derivable (with the user only intervening for exceptions) removes a frequent error source while also cutting form time.

**meeting_test:** This requires agreeing on the fuente→responsabilidad mapping, which is a shared convention between Daniel and Ama. Worth a 5-minute conversation before implementing.

---

### 4. The review moment is now, the data arrives later — "pre-register then reconcile" for credit card purchases

**axis:** UX & review flow

**summary:** The assumption is that a transaction is known and entered after it occurs. Flip it for credit card purchases: register the *intent* at the moment of purchase (tap "I just spent ~$X at restaurant" with minimal fields — just amount and a one-word tag), then reconcile with the actual bank email when it arrives. The intent entry is frictionless (30 seconds on the bus); the reconciliation is automatic (Apps Script email parse updates the pending row's merchant name and exact amount). The user experiences the capture as immediate while the structured data completes itself asynchronously.

**basis:** `external:` Copilot Money and Lunch Money both use a "pending transaction" model where approximate entries are later matched to bank-confirmed transactions. The `compras_cuotas` table already models the concept of a transaction committed now that spans future periods — the schema precedent for "a record that will be completed later" exists in the codebase.

**why_it_matters:** The hardest moment to open an app is right after paying. The easiest moment is 5 seconds after, while putting the wallet away. A "quick stamp" flow (just amount + tag, everything else defaults or fills later) removes the form-completion burden from the worst possible moment while still capturing intent before memory fades.

**meeting_test:** This inverts the current linear flow (bank confirms → user enters) into a parallel flow (user stamps intent → bank email reconciles). It's a UX model change that needs agreement, not just implementation.

---

### 5. The budget view already knows what's missing — let it ask, not the user

**axis:** UX & review flow

**summary:** The assumption is that the user must initiate transaction entry by navigating to the form. Flip it: the budget view (Mi mes) detects anomalies — categories that historically have transactions by mid-month but show nothing this month — and surfaces a prompt inline. "Alquiler usually appears by the 10th — log it?" with one tap to open a pre-filled form. The system becomes the initiator of capture for predictable recurring expenses; the user becomes the confirmer rather than the author.

**basis:** `reasoned:` `allTransac[]` is loaded at login with full history. A GROUP BY (categoria, day_of_month) query on the last 3 months would yield reliable "expected by day X" signals for recurring categories (Alquiler, Sueldo, gym subscription). The `cargarPresupuesto()` function already iterates over budget categories — adding a "missing this month?" check is additive, not architectural. The prompt renders naturally in the existing KPI card layout.

**why_it_matters:** The failure mode for the current system is not that users refuse to log — it's that they forget. A system that says "you usually log this by now" reduces forgetting without requiring any new capture infrastructure. It works even without email parsing or Shortcuts.

**meeting_test:** This changes the dashboard from a passive display to an active reminder system. The tone and frequency of prompts is a UX judgment call worth discussing before building.

---

### 6. Categorization is a personal label applied post-hoc to a shared merchant signal — extract the signal layer

**axis:** Data extraction & normalization

**summary:** The assumption is that a "transaction" is the atomic unit — one form submission = one categorized record. Reframe one level up: the atomic unit is a *merchant signal* (Rappi charged Daniel ARS 4800 on May 24), and the categorized transaction is a *view* of that signal filtered through Daniel's personal category system. This means the raw signal can be stored once and re-labeled without deleting and re-inserting (the current update workaround). It also means that when Ama sees the same Rappi charge from her perspective, she's applying her own label to the same underlying event — the coordination problem (idea #8 from the prior doc) becomes a labeling problem, not a data-duplication problem.

**basis:** `reasoned:` The current schema conflates the payment event (what happened in the world) with the personal classification (what it means to me). This is the same conflation that makes `updateTransaccion` impossible without delete+add — because there is no event layer to update, only the classified row. Separating `raw_signal` from `classified_transaction` is standard in double-entry bookkeeping systems (Beancount, Ledger) and in bank data aggregators (Plaid's transaction object vs. user's category). The `descripcion` field currently carries both merchant identity and user notes mixed together.

**why_it_matters:** This is the foundational reframe that makes multiple capture sources, shared visibility, and re-categorization all tractable without architectural hacks. It doesn't require immediate implementation — but naming it changes how every other automation idea is designed. It's a mental model shift, not just a feature.

**meeting_test:** This is architecture, not a feature — it warrants discussion specifically about whether the current single-table model is a short-term convenience or a long-term constraint.

---

### 7. End-of-day email digest → one-tap batch confirmation replaces per-transaction review

**axis:** UX & review flow + Deduplication & conflict resolution

**summary:** The assumption is that each auto-captured transaction requires individual review at the moment of capture. Flip it: auto-captured transactions accumulate silently all day, and at 9pm a summary email (or push notification via the PWA's existing notification infrastructure) arrives: "5 transactions captured today — $12,400 total. Confirm all, or open app to review." One tap confirms the batch; everything else is already in Supabase as `estado: "pendiente"`. The review is daily and ambient, not per-transaction and interruptive.

**basis:** `external:` Monarch Money and YNAB both offer daily/weekly email digests of auto-imported transactions. The pattern of "capture eagerly, review calmly" is well-validated in personal finance apps that have successfully moved users away from manual entry. The PWA infrastructure in this project (service worker, push registration already built per the Sprint Apr 26-27 memory) provides the notification delivery path without requiring email infrastructure.

**why_it_matters:** Per-transaction review is the UX friction that makes automation feel like more work than manual entry. Batch review at a fixed daily moment (like checking email) converts unpredictable interruptions into a predictable 2-minute ritual. It also naturally surfaces deduplication issues — seeing "Rappi $4800" appear twice in the daily digest is more legible than discovering it weeks later in the budget.

**meeting_test:** Daily ritual design (when, what format, what the default action is) is a shared UX decision between Daniel and Ama with different preferences (Daniel dark/active, Ama light/calm). Worth discussing before building.

---

## Rejected candidates

| Candidate | Reason |
|---|---|
| "What if there were no categories at all — just amounts and descriptions?" | Appealing as a constraint flip but violates the subject's identity: the budget view (Mi mes) is entirely category-driven. Removing categories removes the product's core value, not just a constraint. |
| "What if Ama and Daniel used a shared account instead of separate Supabase users?" | Subject-replacement move — changes the multi-user architecture that the whole product is built on. Out of scope. |
| "What if the budget percentage were set by the app, not the user?" | Interesting but this is a categorization/budgeting idea, not a capture/enrichment idea. Scope mismatch for this axis set. |
| "What if 'responsabilidad' were replaced by a cost-split percentage?" | Better fit for a Compartidos redesign brainstorm. Not assumption-breaking on the capture flow. |

---

## How this complements the Inversion lens doc (May 23)

The May 23 doc asks: *what steps can be removed or automated?* This doc asks: *what assumptions make those steps feel necessary in the first place?*

Key complementary pairs:
- **May 23 #7 (pendiente strip)** + **this doc #1 (inbox model)**: the strip is the UX surface; the inbox model is the mental model that makes it feel natural rather than alarming.
- **May 23 #3 (MP nightly pull)** + **this doc #2 (bank email as source)**: MP pull requires OAuth maintenance; email parse requires none. Different capture paths with different reliability/trust tradeoffs.
- **May 23 #6 (dedup fingerprint)** + **this doc #7 (batch digest)**: dedup prevents silent corruption; the digest makes collisions legible to the user before they affect the budget.
- **This doc #6 (signal vs. label layer)** is the architectural prerequisite that would make May 23's ideas composable rather than each requiring its own normalization logic.

## Recommended sequence (assumption-breaking order)

1. **Start with #3 (fuente → responsabilidad inference)** — no new infrastructure, immediate friction reduction on the existing form, validates the mapping before applying it to automated sources.
2. **Then #1 (inbox/categorization-after-capture)** — unlocks all automated capture sources by removing the requirement that auto-captured rows arrive pre-categorized.
3. **Then #2 (bank email via Apps Script)** — the capture trigger that feeds the inbox. Zero new infrastructure.
4. **Then #7 (daily digest)** — the review ritual that makes the whole automated pipeline trustworthy.
5. **#4, #5, #6** are longer-horizon: #4 requires reconciliation logic; #5 requires historical pattern mining; #6 is an architectural rethink for a future version.
