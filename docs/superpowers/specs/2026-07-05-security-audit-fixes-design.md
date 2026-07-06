# Design — Security Audit Fixes (Julio 2026)

**Date:** 2026-07-05
**Branch:** `fix/security-audit-julio` (off `main`)
**Scope:** 5 pre-specified security fixes from a completed audit, applied to `index.html` only.

## Overview

A completed security audit of the finanzas dashboard identified five issues in the single-file
vanilla HTML/CSS/JS app (`index.html`, ~10,423 lines). This document specifies each fix precisely.
The fixes are already fully determined by the audit — this design captures the verified current
state of the code, the exact change per fix, and the global constraints. There is no open design
space; the value of this doc is accuracy of the change specification and the constraints that keep
the work minimal and safe.

The five issues:

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | HIGH | XSS in import preview table (5 unescaped fields) | `parsearImport()` ~8297–8398 |
| 2 | HIGH | XSS via unescaped category name at 9 render sites | multiple render fns |
| 3 | MEDIUM | CSV export formula injection | `exportarCSV()` 5502–5546 |
| 4 | MEDIUM | Missing SRI on 4 CDN `<script>` tags | lines 20–22, 2504 |
| 5 | MEDIUM-HIGH | Financial data left in localStorage after logout | `volverConfig()` 4252–4260 |

## Global Constraints

These apply to **every** task in the implementation plan. A task that violates any of these is wrong.

1. **Only `index.html` may be modified.** Do NOT touch `src/js/*`, `src/index.template.html`, or run
   `build.sh`. That scaffold has been stale/abandoned since commit `324b294`; every change for months
   (redesigns, features, prior security fixes) has gone directly into `index.html`, which is the
   actual deployed file. Reconciling the `src/` scaffold is a separate decision the human will make
   later and is explicitly out of scope here.
2. **Use the existing `escapeHtml()` function** (defined at `index.html:4017-4024`). Do NOT redefine it
   or create a second escaping helper. Its verified behavior escapes `&`, `<`, `>`, `"`, and `'` —
   sufficient for both HTML text content and quoted-attribute contexts.
3. **Minimal diff.** Change only the exact tokens each fix requires. Do not reformat surrounding code,
   rename variables, adjust className strings, or "clean up" adjacent lines.
4. **Verify line numbers before editing.** The audit's line numbers are approximate and shift as edits
   are applied. Each task greps for the current exact content before editing rather than trusting a
   line number.
5. **Syntax check + commit per task.** Every task ends by (a) running the established syntax check that
   parses each inline `<script>` block with `new Function(src)` and (b) committing with a message in
   this repo's convention (`fix(security): ...` — see commit log; the repo already uses
   `fix(security): ...` e.g. `508ff11`, `53bc067`).

## Verified Current State (2026-07-05)

All locations below were confirmed by grep/read against the working tree on branch
`fix/security-audit-julio`.

- `escapeHtml(s)` — defined at line **4017**. Escapes `& < > " '`.
- `parsearImport()` — starts at line **8297**. Preview row template literal at lines **8382-8394**.
  The `<tr>` interpolates, in order: `idx+1` (safe), `fechaRaw`, `tipoNorm` (whitelist `Gasto|Ingreso`,
  safe), `categoria`, `montoRaw`/`fmtMoneda(...)` (numeric, safe), `descripcion`, `respVal`, `fuente`,
  `monBadge` (fixed markup, safe), and an error badge. **Five fields need escaping:** `fechaRaw`,
  `categoria`, `descripcion`, `respVal`, `fuente`.
- `exportarCSV()` — starts at line **5502**. `esc` helper at line **5532**:
  `const esc = v => \`"${String(v ?? "").replace(/"/g,'""')}"\`;`. BOM-prefixed Blob at line 5539.
- `volverConfig()` — starts at line **4252**; `supabaseSession = null;` at line **4254**.
- `CACHE_TRANSAC_KEY = "fp_transac_cache"` at line **4106**; `CACHE_CATEG_KEY = "fp_categ_cache"` at
  line **4107**.
- CDN scripts: line **20** Chart.js 4.4.1 (pinned); line **21** `@supabase/supabase-js@2`
  (**floating**, must be pinned); line **22** canvas-confetti 1.9.3 (pinned); line **2504**
  lucide 0.468.0 (pinned). None have `integrity`/`crossorigin`.

### Fix 2 — the 9 category render sites (verified line numbers)

| Line | Snippet (interpolation to wrap) |
|------|----------------------------------|
| 4977 | `...ama-chip-label">${cat}</span>...` → escape `cat` |
| 5110 | `${getCatEmoji(cat,'📌')}</span>${cat}${presTag}` → escape the second `cat` (text); `getCatEmoji` arg unchanged |
| 6384 | `...>${_catEmo}</span>${r.cat}</span>...` → escape `r.cat` |
| 6470 | `...>${_re}</span>${cat}</span></td>` → escape `cat` |
| 6929 | `<td>${cat}</td>` → escape `cat` |
| 6946 | `<td>${cat}</td>` → escape `cat` (distinct site from 6929) |
| 7499 | `<span class="tendencia-chip ${cls}">${icon} ${a.cat} ${pctStr}</span>` → escape `a.cat` only |
| 7671 | `...<span>${cat}</span></span>${pacingHtml}</td>` → escape `cat`; leave `pacingHtml`/`catEmoji` block |
| 7675 | `<input ... data-cat="${cat}" ...` → escape `cat` (attribute context; `escapeHtml` escapes quotes) |
| 7867 | `<div class="mm-cat-name">${cat}</div>` → escape `cat` |

That is 10 rows but 9 audit "sites" (6929 and 6946 are two separate `<td>${cat}</td>` occurrences
in the Vista anual table; the audit counts them as one bullet). All must be wrapped with
`escapeHtml(...)`.

## The Fixes

### Fix 1 — XSS in import preview table (HIGH)

In `parsearImport()`, wrap each of the 5 user-controlled fields with `escapeHtml()` at their point of
interpolation in the `tbodyRows.push(\`...\`)` template:

- `${fechaRaw}` → `${escapeHtml(fechaRaw)}`
- `${categoria}` → `${escapeHtml(categoria)}`
- `${descripcion || "—"}` → `${escapeHtml(descripcion) || "—"}` (keep the `|| "—"` fallback semantics;
  escape the value, then fall back — see note below)
- `${respVal}` → `${escapeHtml(respVal)}`
- `${fuente || "—"}` → `${escapeHtml(fuente) || "—"}`

Note on `|| "—"`: `escapeHtml("")` returns `""` (falsy), so `escapeHtml(descripcion) || "—"` preserves
the original "show em-dash when empty" behavior. `escapeHtml(descripcion || "—")` would also work and
never produce unsafe output; the implementer should pick `escapeHtml(x) || "—"` to keep the fallback
placeholder unescaped-and-literal and match intent. Either is safe; the plan mandates
`escapeHtml(x) || "—"` for consistency.

Leave `idx+1`, `tipoNorm`, `montoRaw`/`fmtMoneda(...)`, `monBadge`, and the error badge unchanged.

### Fix 2 — XSS via unescaped category name (HIGH)

Wrap `cat`/`r.cat`/`a.cat` with `escapeHtml()` at each of the 9 sites in the table above. At line 5110,
only the standalone `${cat}` (text content) is wrapped — the `getCatEmoji(cat,'📌')` call argument is
left as-is (it's a function argument, not interpolated markup). At line 7499, only `${a.cat}` is
wrapped — `${icon}` and `${pctStr}` are safe. At line 7675, `cat` is in a `data-cat="..."` attribute;
`escapeHtml` escapes `"` and `'`, so wrapping is correct and consistent. Change nothing else on any
line (classNames, emoji spans, `pacingHtml`, numeric values).

### Fix 3 — CSV export formula injection (MEDIUM)

Replace the one-line `esc` helper in `exportarCSV()` (line ~5532) with:

```js
const esc = v => {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g,'""')}"`;
};
```

This prefixes a single quote to any value beginning with `=`, `+`, `-`, or `@` **before** quote-escaping
and wrapping, neutralizing formula interpretation in Excel/Sheets. Apply **only** inside `exportarCSV()`.

**Additional site noted, NOT fixed in this task:** `descargarTemplateCSV()` (line ~8469) builds a
second `;`-delimited CSV via `new Blob([lineas.join("\n")]...)` at line ~8480, raw-interpolating user
category/fuente names (`catEj`, `fuenteEj`, `fuenteTC`) with no `esc` helper at all. It is a genuine but
lower-risk formula-injection candidate (template/example download). It is a **different shape** from
`exportarCSV()` (no BOM, no quote-escaping, `;` delimiter), so it is not a "confirmed identical
duplicate." Per the audit's instruction it is flagged here for the human to decide separately and is
explicitly out of scope for Fix 3.

### Fix 4 — Missing SRI on CDN scripts (MEDIUM)

Two-part fix for 4 `<script src>` tags (lines 20, 21, 22, 2504):

1. **Pin Supabase.** Line 21 uses floating `@supabase/supabase-js@2`. An SRI hash is tied to exact file
   bytes, so the version must be pinned first. Resolve the current version via
   `curl -s "https://data.jsdelivr.com/v1/packages/npm/@supabase/supabase-js/resolved?specifier=2"`
   (or by reading the redirect target of the `@2` URL), then rewrite the src to
   `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<resolved-version>` before hashing.
2. **Add SRI + crossorigin to all 4.** For each final pinned URL, compute the hash locally:
   `curl -s <script-url> | openssl dgst -sha384 -binary | openssl base64 -A`, prefix `sha384-`, and add
   `integrity="sha384-<hash>"` and **`crossorigin="anonymous"`** (correct spelling — not
   `crossorogin`) to the tag.

Do not rely on any jsdelivr `?SRI` convenience endpoint blindly; compute hashes locally so the hash
provably matches the bytes the browser will fetch.

**Testing limitation:** No browser automation is available in this environment. Verification is:
(a) re-run the curl+hash command for each of the 4 URLs and confirm it matches what was written to the
tag; (b) syntax check still passes. Confirming the page actually loads with no SRI-mismatch console
error is a **manual follow-up the human must do** in a real browser — noted in the plan's testing
section.

### Fix 5 — Financial data persists in localStorage after logout (MEDIUM-HIGH)

In `volverConfig()`, immediately after `supabaseSession = null;` (line ~4254), add:

```js
localStorage.removeItem(CACHE_TRANSAC_KEY);
localStorage.removeItem(CACHE_CATEG_KEY);
```

This clears the full transaction history and category cache on logout so a subsequent user on a shared
computer cannot read the prior session's financial data via devtools.

**Scope decision on other `fp_*` keys (enumerated, deliberately NOT cleared):**

| Key | Line(s) | Contains | Cleared? |
|-----|---------|----------|----------|
| `fp_transac_cache` | 4106 | full transaction history | **YES** (this fix) |
| `fp_categ_cache` | 4107 | categories | **YES** (this fix) |
| `fp_sel_mes` / `fp_sel_anio` | 4667–4668 | selected month/year (UI) | no |
| `fp_fil_mes/anio/tipo/fuente/resp/buscar` | 4669–4674 | filter selections (UI) | no |
| `fp_invite_token` | 4120, 10326+ | invite flow token | no |
| `fp_sb_email` | 4149, 4179 | remembered login email | no |
| `fp_sb_password` | 4180, 4357 | login password (see note) | no |

Only `fp_transac_cache` and `fp_categ_cache` hold financial data. The `fp_sel_*`/`fp_fil_*` keys are UI
preferences (month, year, filters) — not a data-exposure risk, and clearing them would degrade UX on
next login for no security benefit. `fp_invite_token`/`fp_sb_email` are low-sensitivity. This fix clears
**only** the two cache keys; it does not clear anything else.

**Out-of-scope observation (flag to human):** `fp_sb_password` is written to `localStorage` in the login
path and removed on successful login (line 4180). A plaintext password in `localStorage`, even
transiently, is a separate finding worth a dedicated review — it is NOT part of these 5 fixes and this
plan does not touch it.

## Testing Strategy

There is no automated test suite. The project's established "test" is a syntax check that extracts every
inline `<script>` block and parses each with `new Function(src)`, catching parse errors. This is the
canonical gate and every task's final step runs it.

Per-fix functional verification is manual (documented per task in the plan):
- Fix 1/2: paste/import a category or field containing `<img src=x onerror=alert(1)>` or `<b>x</b>` and
  confirm it renders as literal text, not markup.
- Fix 3: export a transaction whose category/description is `=1+1` and confirm the CSV cell begins with
  a leading `'`.
- Fix 4: re-run the curl+hash command and diff against the written `integrity` value; browser
  console-error check is a manual human follow-up.
- Fix 5: log in, confirm cache keys exist in devtools → Application → Local Storage, log out, confirm
  both keys are gone.

## Task Breakdown & Order

Five independent tasks touching disjoint line ranges. Order: **Fix 1 → Fix 2 → Fix 3 → Fix 5 → Fix 4.**
Fixes 1/2/3/5 are mechanical with no external dependency and go first. Fix 4 is last because it needs
network access (`curl`) to resolve the Supabase version and compute SRI hashes; agents in this
environment do have `curl` access, but keeping it last isolates the only network-dependent step.
