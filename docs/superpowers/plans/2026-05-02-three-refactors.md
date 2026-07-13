# Three Refactors: Performance + ARIA + Inversiones Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three bounded improvements to `index.html`: (1) render-path performance via element caching + rAF batching, (2) keyboard accessibility for heatmap and multi-select widgets, (3) inversiones tab ARIA/keyboard polish and dead-code cleanup.

**Architecture:** All changes are in `index.html` (7300-line single-file SPA). No build pipeline. Vanilla JS + Supabase. Changes are additive — no existing behaviour removed, no dependencies added.

**Tech Stack:** Vanilla JS, HTML, CSS. Chart.js 4.4.1, Supabase JS v2. No test framework (manual verification via browser DevTools).

**Context:**
- Health score KPI already removed in April sprint — nothing to delete there
- Inversiones tab (`#page-inversiones`) is complete and working — this plan adds ARIA, not features
- Multi-select panel (`#fil-cat-panel`) and heatmap (`heatmap-clickable`) have zero keyboard accessibility
- `filtrarTabla()` already has 120ms debounce — this plan adds rAF batching and element caching
- `_filtroDebounce`, `_accionesLabelTimer`, `--white`, `--overlay` tokens, `:focus-visible` already added in previous audit commit

---

## Task 1: Element caching + rAF batching in filtrarTabla

**File:** `index.html`
- Modify: JS around line 4712 (global variable declarations)
- Modify: `filtrarTabla()` function, ~line 3750

**Problem:** `filtrarTabla()` calls `document.getElementById()` for the same elements on every invocation. The final `tbody.innerHTML = ...` is a synchronous DOM write that blocks paint.

- [ ] **Step 1: Add element cache object after existing globals (~line 4715)**

Find this block (around line 4712):
```js
let _filFechaExacta = null;
let _accionesRefreshTimer = null;
let _accionesLabelTimer  = null;
let _filtroDebounce      = null;
```

Add after it:
```js
const _$ = {};  // element cache — populated lazily
function _el(id) { return _$[id] || (_$[id] = document.getElementById(id)); }
```

- [ ] **Step 2: Replace getElementById calls inside filtrarTabla with _el()**

Find `function filtrarTabla()` (~line 3750). Replace every `document.getElementById("fil-...")` and `document.getElementById("tabla-body")` call with `_el("fil-...")` / `_el("tabla-body")`.

Before (example pattern throughout the function):
```js
const mes    = document.getElementById("fil-mes").value;
const anio   = document.getElementById("fil-anio").value;
const tipo   = document.getElementById("fil-tipo").value;
const fuente = document.getElementById("fil-fuente")?.value || "";
const resp   = document.getElementById("fil-resp")?.value || "";
const buscar = document.getElementById("fil-buscar").value.toLowerCase();
```

After:
```js
const mes    = _el("fil-mes").value;
const anio   = _el("fil-anio").value;
const tipo   = _el("fil-tipo").value;
const fuente = _el("fil-fuente")?.value || "";
const resp   = _el("fil-resp")?.value || "";
const buscar = _el("fil-buscar").value.toLowerCase();
```

Also replace `const tbody = document.getElementById("tabla-body");` with `const tbody = _el("tabla-body");`.

- [ ] **Step 3: Wrap the final DOM write in requestAnimationFrame**

Find the end of `filtrarTabla()` where `tbody.innerHTML = ...` is assigned. Wrap it:

Before:
```js
  tbody.innerHTML = datos.map((t, i) => {
    // ... row template
  }).join("");
}
```

After:
```js
  const html = datos.map((t, i) => {
    // ... row template (unchanged)
  }).join("");
  requestAnimationFrame(() => { tbody.innerHTML = html; });
}
```

- [ ] **Step 4: Verify in browser**

Open Transactions tab. Type in search box. Observe:
- No jank while typing (debounce + rAF)
- Rows render correctly
- Filters still work
- Sort still works

Open DevTools → Performance tab. Record while typing in search. Confirm long tasks < 50ms.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "perf: element caching + rAF batching in filtrarTabla"
```

---

## Task 2: ARIA + keyboard for heatmap days

**File:** `index.html`
- Modify: heatmap template string, ~line 5416
- Modify: `irATransaccionesDia()` or add a keyboard handler after it

**Problem:** Clickable heatmap days are `<div>` elements. No keyboard access, no ARIA role, no label. Screen readers and keyboard users cannot interact with them.

- [ ] **Step 1: Update heatmap day template to include ARIA and tabindex**

Find this line (~5416):
```js
    html += `<div class="${cls}" style="--heat:${heat}" title="${d}/${filMes}: ${g > 0 ? fmt(g) : "Sin gastos"}"${onclick}>${d}</div>`;
```

Replace with:
```js
    const label = g > 0
      ? `Día ${d}: ${fmt(g)} en gastos`
      : `Día ${d}: sin gastos`;
    const a11y = g > 0
      ? ` role="button" tabindex="0" aria-label="${label}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();irATransaccionesDia(${filAnio},${filMes},${d})}"`
      : ` aria-label="${label}" aria-disabled="true"`;
    html += `<div class="${cls}" style="--heat:${heat}"${onclick}${a11y}>${d}</div>`;
```

Note: `title` attribute removed — it was redundant with `aria-label` and doesn't show on touch devices.

- [ ] **Step 2: Add :focus-visible style for heatmap days (CSS)**

Find `.heatmap-day.heatmap-clickable:hover` style (~line 352). Add after it:
```css
  .heatmap-day.heatmap-clickable:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
```

- [ ] **Step 3: Verify in browser**

Navigate to "Mi mes" page. Tab through the page. Confirm:
- Clickable heatmap days receive focus (visible outline)
- Pressing Enter/Space on a focused day navigates to Transactions filtered for that day
- Non-clickable days are not focusable (no tabindex)
- Screen reader announces "Día 5: $12.340 en gastos" (test with VoiceOver on Mac: Cmd+F5)

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "a11y: keyboard + ARIA for heatmap clickable days"
```

---

## Task 3: ARIA + keyboard for multi-select category filter

**File:** `index.html`
- Modify: HTML for `#fil-cat-btn` and `#fil-cat-panel`, ~line 1884
- Modify: `toggleMultiSelect()`, ~line 3697

**Problem:** The category filter uses a `<div>` as a button. The dropdown panel has no ARIA roles. No Escape to close, no click-outside dismiss, no keyboard navigation between options.

- [ ] **Step 1: Update multi-select HTML to use proper button + ARIA**

Find (~line 1884):
```html
            <div class="multi-select-btn" id="fil-cat-btn" onclick="toggleMultiSelect()">
              <span id="fil-cat-label">Todas las categorías</span><span>▾</span>
            </div>
            <div class="multi-select-panel" id="fil-cat-panel" style="display:none">
```

Replace with:
```html
            <button class="multi-select-btn" id="fil-cat-btn" onclick="toggleMultiSelect()"
                    aria-haspopup="listbox" aria-expanded="false" aria-controls="fil-cat-panel"
                    type="button">
              <span id="fil-cat-label">Todas las categorías</span><span aria-hidden="true">▾</span>
            </button>
            <div class="multi-select-panel" id="fil-cat-panel" style="display:none"
                 role="listbox" aria-label="Filtrar por categoría" aria-multiselectable="true">
```

- [ ] **Step 2: Update toggleMultiSelect() to sync aria-expanded + add Escape/click-outside**

Find `function toggleMultiSelect()` (~line 3697):
```js
function toggleMultiSelect() {
  const panel = document.getElementById("fil-cat-panel");
  const isOpen = panel.style.display !== "none";
  panel.style.display = isOpen ? "none" : "block";
  document.getElementById("fil-cat-btn").classList.toggle("active", !isOpen);
}
```

Replace with:
```js
function toggleMultiSelect() {
  const panel = _el("fil-cat-panel");
  const btn   = _el("fil-cat-btn");
  const isOpen = panel.style.display !== "none";
  panel.style.display = isOpen ? "none" : "block";
  btn.classList.toggle("active", !isOpen);
  btn.setAttribute("aria-expanded", String(!isOpen));
}
function _cerrarMultiSelect() {
  const panel = _el("fil-cat-panel");
  const btn   = _el("fil-cat-btn");
  if (panel && panel.style.display !== "none") {
    panel.style.display = "none";
    btn.classList.remove("active");
    btn.setAttribute("aria-expanded", "false");
  }
}
```

- [ ] **Step 3: Add Escape key + click-outside listeners**

Find the `DOMContentLoaded` listener or the first `document.addEventListener` (~line 2690 area). Add these inside the existing DOMContentLoaded or just before the closing `</script>` tag:

```js
document.addEventListener("keydown", e => {
  if (e.key === "Escape") _cerrarMultiSelect();
});
document.addEventListener("click", e => {
  const wrap = e.target.closest(".multi-select-wrap");
  if (!wrap) _cerrarMultiSelect();
});
```

- [ ] **Step 4: Verify in browser**

Open Transactions page. Tab to the categories filter button. Confirm:
- Button receives focus (visible outline from existing `:focus-visible`)
- Space/Enter opens the panel
- Escape closes the panel
- Clicking outside closes the panel
- Screen reader announces "Filtrar por categoría, collapsed, has popup" on the button

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "a11y: ARIA + keyboard for multi-select category filter"
```

---

## Task 4: Inversiones tab ARIA + section toggle keyboard access

**File:** `index.html`
- Modify: `#page-inversiones` HTML, ~line 2349
- Modify: `toggleInvSection()`, ~line 6836

**Problem:** Section headers in inversiones ("Plazos Fijos", "Acciones & Cripto") are `<h2>` elements with `onclick` — not focusable or keyboard-accessible. The toggle state is visual-only (arrow character), not communicated to assistive tech.

- [ ] **Step 1: Convert section headers to buttons with ARIA**

Find (~line 2360):
```html
            <h2 style="font-size:1rem;font-weight:700;cursor:pointer" onclick="toggleInvSection('plazos')">
              Plazos Fijos <span id="inv-toggle-plazos" style="font-size:.75rem;color:var(--text-muted)">▴</span>
            </h2>
            <button class="btn btn-primary" style="font-size:.82rem" onclick="abrirFormPlazo()">+ Agregar</button>
```

Replace with:
```html
            <h2 style="font-size:1rem;font-weight:700;margin:0">
              <button style="background:none;border:none;cursor:pointer;font:inherit;color:inherit;display:flex;align-items:center;gap:.4rem;padding:0"
                      onclick="toggleInvSection('plazos')"
                      aria-expanded="true" aria-controls="inv-body-plazos"
                      id="inv-hdr-plazos">
                Plazos Fijos <span id="inv-toggle-plazos" aria-hidden="true" style="font-size:.75rem;color:var(--text-muted)">▴</span>
              </button>
            </h2>
            <button class="btn btn-primary" style="font-size:.82rem" onclick="abrirFormPlazo()" aria-label="Agregar plazo fijo">+ Agregar</button>
```

Find (~line 2377):
```html
            <h2 style="font-size:1rem;font-weight:700;cursor:pointer" onclick="toggleInvSection('acciones')">
              Acciones & Cripto <span id="inv-toggle-acciones" style="font-size:.75rem;color:var(--text-muted)">▴</span>
            </h2>
            <button class="btn btn-primary" style="font-size:.82rem" onclick="abrirFormAccion()">+ Agregar</button>
```

Replace with:
```html
            <h2 style="font-size:1rem;font-weight:700;margin:0">
              <button style="background:none;border:none;cursor:pointer;font:inherit;color:inherit;display:flex;align-items:center;gap:.4rem;padding:0"
                      onclick="toggleInvSection('acciones')"
                      aria-expanded="true" aria-controls="inv-body-acciones"
                      id="inv-hdr-acciones">
                Acciones & Cripto <span id="inv-toggle-acciones" aria-hidden="true" style="font-size:.75rem;color:var(--text-muted)">▴</span>
              </button>
            </h2>
            <button class="btn btn-primary" style="font-size:.82rem" onclick="abrirFormAccion()" aria-label="Agregar tenencia (acción o cripto)">+ Agregar</button>
```

- [ ] **Step 2: Update toggleInvSection() to sync aria-expanded**

Find (~line 6836):
```js
function toggleInvSection(seccion) {
  const body = document.getElementById("inv-body-" + seccion);
  const arrow = document.getElementById("inv-toggle-" + seccion);
```

Replace with:
```js
function toggleInvSection(seccion) {
  const body  = document.getElementById("inv-body-" + seccion);
  const arrow = document.getElementById("inv-toggle-" + seccion);
  const hdr   = document.getElementById("inv-hdr-" + seccion);
```

Then find the part that sets arrow text and body display (~line 6840). After updating arrow/body, add:
```js
  if (hdr) hdr.setAttribute("aria-expanded", body.style.display !== "none" ? "true" : "false");
```

- [ ] **Step 3: Update inicializarDisclosureInversiones() to set initial aria-expanded**

Find `function inicializarDisclosureInversiones()` (~line 6846). After the existing body/arrow logic that reads localStorage, add for each section:
```js
    const hdr = document.getElementById("inv-hdr-" + sec);
    if (hdr) hdr.setAttribute("aria-expanded", body.style.display !== "none" ? "true" : "false");
```

- [ ] **Step 4: Verify in browser**

Navigate to Inversiones tab. Tab to "Plazos Fijos" heading button. Confirm:
- Button receives focus
- Space/Enter toggles the section
- Screen reader announces "Plazos Fijos, expanded, button" / "collapsed" correctly
- "+ Agregar" buttons have descriptive labels

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "a11y: ARIA + keyboard for inversiones section toggles"
```

---

## Task 5: Dead CSS cleanup

**File:** `index.html` — CSS section only

**Problem:** After removals across April–May sprints, some CSS rules reference elements that no longer exist. These waste parse time and create confusion for future maintainers.

- [ ] **Step 1: Identify dead CSS selectors**

Run in browser DevTools console (with the app loaded, all tabs visited):
```js
// Paste in DevTools console — lists CSS rules with no matching elements
[...document.styleSheets[0].cssRules]
  .filter(r => r.selectorText && !document.querySelector(r.selectorText.split(',')[0].trim().replace(/::?[\w-]+/g,'')))
  .map(r => r.selectorText)
  .slice(0, 30)
```

Manually check the output against the CSS. Focus on:
- `.sidebar` rules (sidebar exists in HTML but is hidden on mobile — keep)
- `.kpi-hero` — still used in presupuesto page — keep
- `.rafaga-*` — check if Modo Ráfaga still exists
- `.nav-sep` — check if used

- [ ] **Step 2: Remove confirmed dead CSS rules**

Only remove a rule if BOTH conditions are true:
1. No element matching the selector exists anywhere in the HTML (static or dynamically generated)
2. No JS dynamically adds the class via `classList.add()` or `className`

For each confirmed dead rule, delete the CSS block. Do not remove rules for JS-dynamically-added classes (e.g., `.skeleton`, `.skeleton-row` are added by JS render functions).

- [ ] **Step 3: Verify no visual regression**

Visit all 5 nav tabs (Mi mes, Transacciones, Compartidos, Categorías, Inversiones). Check:
- No layout breakage
- No missing styles
- Modo Ráfaga (if accessible) renders correctly

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "refactor: remove dead CSS rules post-sprint cleanup"
```

---

## Self-Review

**Spec coverage check:**
- [x] Performance: element caching in `filtrarTabla()` — Task 1
- [x] Performance: rAF batching for DOM write — Task 1
- [x] ARIA heatmap: role, tabindex, aria-label, keyboard Enter/Space — Task 2
- [x] ARIA multi-select: button role, aria-expanded, aria-haspopup, Escape, click-outside — Task 3
- [x] ARIA inversiones: section toggles as buttons with aria-expanded, aria-controls — Task 4
- [x] Dead CSS cleanup — Task 5
- [x] Health KPI: already removed in April sprint — no action needed (noted in Architecture)

**Placeholder scan:** No TBD, TODO, or "implement later" phrases found.

**Type consistency:** `_el()`, `_cerrarMultiSelect()`, `toggleInvSection()`, `inicializarDisclosureInversiones()` — all consistent across tasks.
