# Security Audit Fixes (Julio 2026) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply six pre-specified security fixes (2× XSS, 2× CSV formula injection, missing SRI, localStorage data-leak on logout) to the deployed single-file app `index.html`.

**Architecture:** Each fix is a minimal, surgical edit to `index.html` (~10,423-line vanilla HTML/CSS/JS). Fixes 1/2 reuse the existing `escapeHtml()` at output sites; Fix 3 hardens the CSV `esc` helper in `exportarCSV()`; Fix 4 pins the Supabase CDN version and adds SRI to 4 `<script>` tags; Fix 5 clears two financial-data cache keys on logout; Fix 6 adds a dedicated `csvSafe()` guard to the unrelated `descargarTemplateCSV()` template builder. No build step; edits go directly into the deployed file.

**Note:** an earlier draft flagged `fp_sb_password` as a plaintext-password-in-localStorage risk. Re-verified against `index.html`: there is no `setItem("fp_sb_password", ...)` anywhere — only two defensive `removeItem` calls (lines ~4180, ~4357), consistent with commit `5baa642` having already fixed this. It is not a real finding and has no task in this plan.

**Tech Stack:** Vanilla HTML/CSS/JS, Supabase JS SDK (CDN), Chart.js/canvas-confetti/lucide (CDN), `node` for the syntax check, `curl`+`openssl` for SRI hashing.

## Global Constraints

Copied verbatim from the design doc — every task's requirements implicitly include these:

- **Only `index.html` may be modified.** Do NOT touch `src/js/*`, `src/index.template.html`, or run `build.sh` (that scaffold is stale since commit `324b294`; reconciliation is out of scope).
- **Use the existing `escapeHtml()`** at `index.html:4017-4024`. Do NOT redefine it or add a second escaping helper. It escapes `& < > " '`.
- **Minimal diff.** Change only the exact tokens each fix requires; do not reformat, rename, or clean up adjacent code.
- **Verify line numbers before editing** by grepping for the current exact content (audit line numbers are approximate and shift as edits are applied).
- **Every task ends with the syntax check + a commit** using this repo's convention: `fix(security): ...` (see `git log` — e.g. `508ff11`, `53bc067`).

**The syntax check (run verbatim as each task's verification step):**

```bash
node -e '
const fs=require("fs");
const html=fs.readFileSync("index.html","utf8");
const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m,i=0,bad=0;
while((m=re.exec(html))){i++;try{new Function(m[1]);}catch(e){bad++;console.error("Block #"+i+" FAIL: "+e.message);}}
console.log("Checked "+i+" inline <script> blocks, "+bad+" with errors.");
process.exit(bad?1:0);
'
```

Expected output: `Checked 2 inline <script> blocks, 0 with errors.` (exit 0). If it reports errors or a different block count that includes a failure, the edit broke a template literal — fix before committing.

Commit messages end with the repo footer:
```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

---

### Task 1: Escape 5 fields in the import preview table (Fix 1 — HIGH XSS)

**Files:**
- Modify: `index.html` — `parsearImport()` preview row template (audit ~8382-8394)

**Interfaces:**
- Consumes: existing `escapeHtml(s)` (line ~4017). No new symbols produced.

- [ ] **Step 1: Locate the current template**

Run:
```bash
grep -n 'tbodyRows.push' index.html
grep -n '<td>${fechaRaw}</td>\|<td>${categoria}</td>\|<td>${respVal}</td>' index.html
```
Expected: finds the `tbodyRows.push(\`` block and the `<td>` rows around line 8382-8394. Read the block to confirm the exact current text of these five interpolations before editing:
`${fechaRaw}`, `${categoria}`, `${descripcion || "—"}`, `${respVal}`, `${fuente || "—"}`.

- [ ] **Step 2: Apply the 5 escapes**

Make exactly these 5 replacements inside the `tbodyRows.push` template literal (match the current exact text from Step 1; the `<td>` wrappers shown are the anchors):

```
<td>${fechaRaw}</td>            →  <td>${escapeHtml(fechaRaw)}</td>
<td>${categoria}</td>           →  <td>${escapeHtml(categoria)}</td>
<td>${descripcion || "—"}</td>  →  <td>${escapeHtml(descripcion) || "—"}</td>
<td>${respVal}</td>             →  <td>${escapeHtml(respVal)}</td>
<td>${fuente || "—"}</td>       →  <td>${escapeHtml(fuente) || "—"}</td>
```

Leave `${idx + 1}`, `${tipoNorm}`, the `${isNaN(monto) ? montoRaw : fmtMoneda(...)}` cell, `${monBadge}`, and the error-badge cell unchanged.

- [ ] **Step 3: Verify no other field in the block was touched**

Run:
```bash
grep -n 'escapeHtml(fechaRaw)\|escapeHtml(categoria)\|escapeHtml(descripcion)\|escapeHtml(respVal)\|escapeHtml(fuente)' index.html
```
Expected: exactly 5 matches, all within the `parsearImport` preview block.

- [ ] **Step 4: Run the syntax check**

Run the Global Constraints syntax-check command.
Expected: `Checked 2 inline <script> blocks, 0 with errors.` (exit 0).

- [ ] **Step 5: Manual functional check (record result in commit body if done)**

Optional but recommended: in the app's import textarea, paste a row whose category is `<img src=x onerror=alert(1)>`, click Previsualizar, confirm the preview cell shows the literal text (no alert, no image tag). This is a human/browser step; if the environment has no browser, note "manual verification pending" — the syntax check is the automated gate.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "fix(security): escapar campos del preview de importación (XSS)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Escape category name at 9 render sites (Fix 2 — HIGH XSS)

**Files:**
- Modify: `index.html` — 10 lines (9 audit sites) across multiple render functions

**Interfaces:**
- Consumes: existing `escapeHtml(s)` (line ~4017). No new symbols produced.

- [ ] **Step 1: Locate all current sites**

Run:
```bash
grep -n 'ama-chip-label">${cat}\|getCatEmoji(cat.*}</span>${cat}\|${_catEmo}</span>${r\.cat}\|${_re}</span>${cat}\|<td>${cat}</td>\|tendencia-chip.*${a\.cat}\|data-cat="${cat}"\|mm-cat-name">${cat}\|<span>${cat}</span></span>${pacingHtml}' index.html
```
Expected: 10 line matches (audit lines ~4977, 5110, 6384, 6470, 6929, 6946, 7499, 7671, 7675, 7867). Read each to confirm exact current text before editing. If any snippet differs, adapt the match to the current text but change only the `cat`/`r.cat`/`a.cat` token described below.

- [ ] **Step 2: Apply the escapes, one site at a time**

At each site wrap only the category text token with `escapeHtml(...)`; change nothing else on the line:

1. `...ama-chip-label">${cat}</span>...` → `...ama-chip-label">${escapeHtml(cat)}</span>...`
2. `${getCatEmoji(cat,'📌')}</span>${cat}${presTag}` → `${getCatEmoji(cat,'📌')}</span>${escapeHtml(cat)}${presTag}` (wrap ONLY the standalone `${cat}`; leave the `getCatEmoji(cat,'📌')` argument as-is)
3. `...>${_catEmo}</span>${r.cat}</span>...` → `...>${_catEmo}</span>${escapeHtml(r.cat)}</span>...`
4. `...>${_re}</span>${cat}</span></td>` → `...>${_re}</span>${escapeHtml(cat)}</span></td>`
5. `<td>${cat}</td>` (first occurrence, ~6929) → `<td>${escapeHtml(cat)}</td>`
6. `<td>${cat}</td>` (second occurrence, ~6946) → `<td>${escapeHtml(cat)}</td>`
7. `<span class="tendencia-chip ${cls}">${icon} ${a.cat} ${pctStr}</span>` → `<span class="tendencia-chip ${cls}">${icon} ${escapeHtml(a.cat)} ${pctStr}</span>` (wrap ONLY `a.cat`; leave `${cls}`, `${icon}`, `${pctStr}`)
8. `...<span>${cat}</span></span>${pacingHtml}</td>` → `...<span>${escapeHtml(cat)}</span></span>${pacingHtml}</td>` (leave `${pacingHtml}` and the emoji block untouched)
9. `<input type="text" inputmode="decimal" class="pres-input" data-cat="${cat}" ...` → `... data-cat="${escapeHtml(cat)}" ...` (attribute context; `escapeHtml` escapes `"`/`'` so this is correct)
10. `<div class="mm-cat-name">${cat}</div>` → `<div class="mm-cat-name">${escapeHtml(cat)}</div>`

For sites 5 and 6 (two identical `<td>${cat}</td>` lines), edit them individually so both are covered — do not assume a single edit hits both.

- [ ] **Step 3: Verify count**

Run:
```bash
grep -cn 'escapeHtml(cat)\|escapeHtml(r\.cat)\|escapeHtml(a\.cat)' index.html
```
Expected: at least 10 new matches introduced by this task (plus any pre-existing `escapeHtml(cat)` uses elsewhere — Step 1's 10 sites must now all be wrapped). Spot-check the two `<td>${cat}</td>` lines are both now `<td>${escapeHtml(cat)}</td>`.

- [ ] **Step 4: Run the syntax check**

Run the Global Constraints syntax-check command.
Expected: `Checked 2 inline <script> blocks, 0 with errors.` (exit 0).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "fix(security): escapar nombre de categoría en render (XSS)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Harden CSV export against formula injection (Fix 3 — MEDIUM)

**Files:**
- Modify: `index.html` — `esc` helper in `exportarCSV()` (audit ~5532)

**Interfaces:**
- Consumes: nothing new. Modifies the local `esc` closure inside `exportarCSV()` only.

- [ ] **Step 1: Locate the current helper**

Run:
```bash
grep -n 'const esc  = v =>' index.html
```
Expected: one match inside `exportarCSV()` (~line 5532), reading:
`const esc  = v => \`"${String(v ?? "").replace(/"/g,'""')}"\`;`

- [ ] **Step 2: Replace the one-liner with the guarded version**

Replace exactly that line with:

```js
  const esc  = v => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g,'""')}"`;
  };
```

(Preserve the surrounding indentation. Match the existing two-space alignment used in the function.)

- [ ] **Step 3: Confirm the change is inside exportarCSV only**

Run:
```bash
grep -n "if (/^\[=+\\\\-@\]/.test(s))" index.html
```
Expected: exactly one match, within `exportarCSV()`. The `descargarTemplateCSV()` function (~8464) is NOT modified in this task — it is fixed separately in Task 6 with its own dedicated guard (see design doc, Fix 6).

- [ ] **Step 4: Run the syntax check**

Run the Global Constraints syntax-check command.
Expected: `Checked 2 inline <script> blocks, 0 with errors.` (exit 0).

- [ ] **Step 5: Manual functional check (optional)**

Export with a transaction whose category or description is `=1+1`; open the downloaded CSV in a text editor and confirm that cell is `"'=1+1"` (leading single quote inside the quoted field). Browser step; note "pending" if unavailable.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "fix(security): neutralizar inyección de fórmulas en export CSV

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Clear financial caches on logout (Fix 5 — MEDIUM-HIGH)

> Ordered before Fix 4 (SRI) because it is mechanical with no network dependency. Fix 4 is the final task.

**Files:**
- Modify: `index.html` — `volverConfig()` (audit ~4252-4260)

**Interfaces:**
- Consumes: existing consts `CACHE_TRANSAC_KEY` (line ~4106) and `CACHE_CATEG_KEY` (line ~4107). No new symbols produced.

- [ ] **Step 1: Locate the logout handler**

Run:
```bash
grep -n 'async function volverConfig' index.html
grep -n 'supabaseSession = null;' index.html
```
Expected: `volverConfig()` at ~4252; `supabaseSession = null;` at ~4254 inside it. Read the function to confirm the line immediately follows `await supabaseClient.auth.signOut()`.

- [ ] **Step 2: Insert the two removeItem calls**

Immediately after the `supabaseSession = null;` line inside `volverConfig()`, add:

```js
  localStorage.removeItem(CACHE_TRANSAC_KEY);
  localStorage.removeItem(CACHE_CATEG_KEY);
```

Do NOT clear any other `fp_*` key (per the design doc's scope decision: only these two hold financial data; `fp_sel_*`/`fp_fil_*` are UI prefs and must be preserved).

- [ ] **Step 3: Verify placement**

Run:
```bash
grep -n 'removeItem(CACHE_TRANSAC_KEY)\|removeItem(CACHE_CATEG_KEY)' index.html
```
Expected: exactly one match each, both inside `volverConfig()` (line range ~4254-4256). Confirm no `fp_sel_`/`fp_fil_` keys were added.

- [ ] **Step 4: Run the syntax check**

Run the Global Constraints syntax-check command.
Expected: `Checked 2 inline <script> blocks, 0 with errors.` (exit 0).

- [ ] **Step 5: Manual functional check (optional)**

Log in, confirm `fp_transac_cache` and `fp_categ_cache` exist in devtools → Application → Local Storage, click logout, confirm both keys are gone and `fp_sel_mes`/filters remain. Browser step; note "pending" if unavailable.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "fix(security): limpiar caché de transacciones/categorías al cerrar sesión

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Pin Supabase + add SRI to 4 CDN scripts (Fix 4 — MEDIUM)

> Last task: requires network access (`curl`) to resolve the floating Supabase version and compute SRI hashes. Agents in this environment have `curl` and `openssl`. If `curl` is unavailable, STOP and report to the human — this task cannot be completed offline.

**Files:**
- Modify: `index.html` — 4 `<script src>` tags (lines ~20, ~21, ~22, ~2504)

**Interfaces:**
- Consumes: nothing. Produces no JS symbols (HTML attribute changes only).

- [ ] **Step 1: Confirm the 4 tags and their current state**

Run:
```bash
grep -n '<script src=' index.html
```
Expected 4 matches:
- ~20 `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js` (pinned)
- ~21 `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` (FLOATING — must pin)
- ~22 `https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js` (pinned)
- ~2504 `https://cdn.jsdelivr.net/npm/lucide@0.468.0/dist/umd/lucide.min.js` (pinned)

None have `integrity`/`crossorigin`.

- [ ] **Step 2: Resolve the current Supabase version**

Run:
```bash
curl -s "https://data.jsdelivr.com/v1/packages/npm/@supabase/supabase-js/resolved?specifier=2"
```
Expected: JSON containing `"version":"2.x.y"`. Record that exact version as `<SB_VER>`. The pinned URL becomes:
`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<SB_VER>/dist/umd/supabase.js`

Verify the exact file path jsdelivr serves for the pinned version (the `@2` shorthand redirects to a default file). Run:
```bash
curl -sIL "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" | grep -i '^location:'
```
Use the resolved file path from the redirect chain as the pinned URL (append the same path to the versioned base). Confirm it returns JS (HTTP 200) before hashing:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "<PINNED_SUPABASE_URL>"
```
Expected: `200`.

- [ ] **Step 3: Compute SRI hashes for all 4 final URLs**

For each of the 4 final (pinned) URLs, run:
```bash
curl -s "<URL>" | openssl dgst -sha384 -binary | openssl base64 -A
```
Prefix each result with `sha384-`. Record the 4 hashes mapped to their URLs:
- Chart.js 4.4.1 → `sha384-<hashA>`
- Supabase `<SB_VER>` (pinned URL) → `sha384-<hashB>`
- canvas-confetti 1.9.3 → `sha384-<hashC>`
- lucide 0.468.0 → `sha384-<hashD>`

- [ ] **Step 4: Rewrite the 4 tags**

Edit each `<script>` tag to add `integrity="sha384-<hash>"` and `crossorigin="anonymous"` (correct spelling — NOT `crossorogin`). For the Supabase tag, also replace the floating `@2` src with the pinned URL from Step 2. Final tags:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js" integrity="sha384-<hashA>" crossorigin="anonymous"></script>
<script src="<PINNED_SUPABASE_URL>" integrity="sha384-<hashB>" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js" integrity="sha384-<hashC>" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/lucide@0.468.0/dist/umd/lucide.min.js" integrity="sha384-<hashD>" crossorigin="anonymous"></script>
```

- [ ] **Step 5: Verify hashes match what was written**

Re-run the Step 3 hash command for each of the 4 URLs and diff against the `integrity` values now in the file:
```bash
grep -n 'integrity="sha384-' index.html
```
Expected: 4 matches; each hash equals the freshly recomputed hash for its URL. Confirm attribute spelling is `crossorigin` (grep for the typo to be safe):
```bash
grep -n 'crossorogin' index.html   # expected: no matches
```

- [ ] **Step 6: Run the syntax check**

Run the Global Constraints syntax-check command.
Expected: `Checked 2 inline <script> blocks, 0 with errors.` (exit 0). (This check only parses inline scripts; the `<script src>` edits won't affect it, but run it to confirm nothing adjacent was broken.)

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "fix(security): fijar versión de Supabase y agregar SRI a scripts CDN

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Note the manual browser follow-up**

Record for the human: no browser automation exists in this environment, so the final confirmation that the page loads with no SRI-mismatch console error must be done manually by the human in a real browser (open the deployed page, check devtools console for "Failed to find a valid digest" / integrity errors on any of the 4 scripts). The automated gate here is the hash-match verification in Step 5.

---

### Task 6: Guard CSV template download against formula injection (Fix 6 — LOW-MEDIUM)

**Files:**
- Modify: `index.html` — `descargarTemplateCSV()` (audit ~8464-8483)

**Interfaces:**
- Consumes: nothing existing. Produces a new local const `csvSafe` scoped inside `descargarTemplateCSV()` only — not exported, not reused elsewhere (do not hoist it to module/global scope; it is deliberately narrower than `exportarCSV()`'s `esc` because this file has no quote-wrapping).

- [ ] **Step 1: Locate the current function and confirm exact line numbers**

Run:
```bash
grep -n 'function descargarTemplateCSV' index.html
sed -n '/function descargarTemplateCSV/,/^}/p' index.html
```
Expected: `descargarTemplateCSV()` starting at ~line 8464, with body:
```js
function descargarTemplateCSV() {
  const hoy  = new Date();
  const mes  = String(hoy.getMonth() + 1).padStart(2, "0");
  const anio = hoy.getFullYear();
  const fuenteEj = categFuentes[0]   || "Efectivo";
  const fuenteTC = categFuentesTC[0] || "";
  const catEj    = categGasto[0]     || "Alimentación";
  // mes_liquidacion: solo para TC y solo cuando la fecha de compra ≠ mes del resumen
  const lineas = [
    "fecha;tipo;categoria;monto;descripcion;responsabilidad;fuente;moneda;mes_liquidacion",
    `15/${mes}/${anio};Gasto;${catEj};4500;Ejemplo gasto;Mío;${fuenteEj};ARS;`,
    `01/${mes}/${anio};Ingreso;Sueldo;180000;Sueldo ${mes}/${anio};Mío;;ARS;`,
    fuenteTC
      ? `15/01/${anio};Gasto;${catEj};8000;Compra enero en TC;Mío;${fuenteTC};ARS;${anio}-${mes}`
      : `15/01/${anio};Gasto;${catEj};8000;Compra TC (mes_liq distinto);Mío;;ARS;${anio}-${mes}`,
  ];
  const blob = new Blob([lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `template-${anio}-${mes}.csv`; a.click();
  URL.revokeObjectURL(url);
}
```
If the current text differs from this (lines may have shifted from other tasks' edits), use the actual current text as the basis for Step 2's replacements — match on the unique surrounding tokens (`categFuentes[0]`, `categFuentesTC[0]`, `categGasto[0]`, the `lineas` array), not on line numbers.

- [ ] **Step 2: Add the `csvSafe` guard and wrap the three interpolated values**

Replace the function body with:

```js
function descargarTemplateCSV() {
  const hoy  = new Date();
  const mes  = String(hoy.getMonth() + 1).padStart(2, "0");
  const anio = hoy.getFullYear();
  const fuenteEj = categFuentes[0]   || "Efectivo";
  const fuenteTC = categFuentesTC[0] || "";
  const catEj    = categGasto[0]     || "Alimentación";
  const csvSafe = v => /^[=+\-@]/.test(String(v ?? "")) ? "'" + v : (v ?? "");
  // mes_liquidacion: solo para TC y solo cuando la fecha de compra ≠ mes del resumen
  const lineas = [
    "fecha;tipo;categoria;monto;descripcion;responsabilidad;fuente;moneda;mes_liquidacion",
    `15/${mes}/${anio};Gasto;${csvSafe(catEj)};4500;Ejemplo gasto;Mío;${csvSafe(fuenteEj)};ARS;`,
    `01/${mes}/${anio};Ingreso;Sueldo;180000;Sueldo ${mes}/${anio};Mío;;ARS;`,
    fuenteTC
      ? `15/01/${anio};Gasto;${csvSafe(catEj)};8000;Compra enero en TC;Mío;${csvSafe(fuenteTC)};ARS;${anio}-${mes}`
      : `15/01/${anio};Gasto;${csvSafe(catEj)};8000;Compra TC (mes_liq distinto);Mío;;ARS;${anio}-${mes}`,
  ];
  const blob = new Blob([lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `template-${anio}-${mes}.csv`; a.click();
  URL.revokeObjectURL(url);
}
```

Note what changed: added the `csvSafe` const; wrapped every `${catEj}` (3 occurrences), `${fuenteEj}` (1 occurrence), and `${fuenteTC}` (1 occurrence, in the `fuenteTC ? ... : ...` branch) with `csvSafe(...)`. The fixed literal `"Sueldo"` in the second `lineas` entry is NOT wrapped — it is not user-controlled data. `mes`, `anio`, and all the other fixed strings (`"Gasto"`, `"Ingreso"`, `"Mío"`, `"ARS"`, amounts, descriptions) are unchanged.

- [ ] **Step 3: Verify the guard and wrapping**

Run:
```bash
grep -n 'const csvSafe' index.html
grep -c 'csvSafe(catEj)\|csvSafe(fuenteEj)\|csvSafe(fuenteTC)' index.html
```
Expected: one `const csvSafe = ...` line inside `descargarTemplateCSV()`; the count command reports 5 (3× `csvSafe(catEj)`, 1× `csvSafe(fuenteEj)`, 1× `csvSafe(fuenteTC)`). Confirm `csvSafe` is not defined anywhere else and not called outside this function:
```bash
grep -n 'csvSafe' index.html
```
Expected: all matches are inside `descargarTemplateCSV()` (the definition plus its 5 call sites — 6 lines total, though 3 calls to `catEj` land on 3 different `lineas` entries).

- [ ] **Step 4: Run the syntax check**

Run the Global Constraints syntax-check command.
Expected: `Checked 2 inline <script> blocks, 0 with errors.` (exit 0).

- [ ] **Step 5: Manual functional check (optional)**

In the app's category manager, rename (or create) a gasto category to `=1+1`, then click "Descargar template" (or the equivalent template-download control). Open the downloaded CSV in a text editor and confirm the `categoria` field in the example rows reads `'=1+1` (leading single quote, no quote-wrapping since this file format has none). Browser step; note "pending" if unavailable.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "fix(security): neutralizar inyección de fórmulas en template CSV de importación

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Post-Plan Notes for the Human (out of scope for these 6 tasks)

- **`fp_sb_password` — verified false alarm, no action needed.** An earlier draft of this plan flagged it as a plaintext-password-in-localStorage risk. Direct grep against `index.html` found no `setItem("fp_sb_password", ...)` anywhere — only two defensive `removeItem` calls (lines ~4180, ~4357), consistent with commit `5baa642` ("security: remove plaintext password from localStorage, add XSS escaping") already having addressed this. Nothing to do here.
