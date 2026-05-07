# UI Refresh — Premium + Cálido/Humano — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the finance dashboard to a premium + warm aesthetic via gradient headers, glassmorphism KPI cards, a unified Lucide icon system, and purposeful micro-interactions.

**Architecture:** All changes are in a single file (`index.html`, ~7561 lines) — CSS block at the top, HTML in the middle, JS at the bottom. No build pipeline. Changes are isolated: CSS additions/overrides, HTML attribute updates, JS constant replacements, and `lucide.createIcons()` calls after DOM renders.

**Tech Stack:** Vanilla HTML/CSS/JS, Lucide icons (CDN UMD), Supabase auth (unchanged), Chart.js (unchanged)

---

## File Map

| Area | Location in `index.html` |
|---|---|
| CSS `:root` variables | Lines 36–72 |
| CSS `[data-theme="light"]` | Lines 75–89 |
| CSS `.page-header` | Line 239 |
| CSS `.kpi-card` | Line 264 |
| CSS `.kpi-icon` | Lines 313–325 |
| CSS `.nav-item` / `.bn-item` | Search for `.nav-item {` |
| `<head>` script tags | Lines ~20–35 |
| Topnav HTML | Lines 1781–1797 |
| Bottom-nav HTML | Lines 1799–1819 |
| Page headers HTML (presupuesto) | Line 2190 |
| Page headers HTML (transacciones) | Line 1911 |
| Page headers HTML (compartidos) | Line 2068 |
| Page headers HTML (config) | Line 2348 |
| Page headers HTML (inversiones) | Line 2405 |
| KPI cards HTML (presupuesto) | Lines 2203–2261 |
| KPI cards HTML (resumen) | Lines 1843–1876 |
| IC_COPY / IC_EDIT / IC_TRASH | Lines 2754–2756 |
| `📊 Sugerir` button | Line 2197 |
| `_actualizarStringsUsuario()` | Line 3084 |
| `filtrarTabla()` end | Search for end of `function filtrarTabla` |

---

## Task 1: CSS RGB Variables + Lucide CDN

**Files:**
- Modify: `index.html` — `:root` block (line 36), `[data-theme="light"]` block (line 75), `<head>` (before closing `</head>`)

- [ ] **Step 1: Add RGB variables to `:root`**

Find the line `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);` (line ~71) and add after it, before the closing `}`:

```css
    /* RGB splits for rgba() usage */
    --card-rgb:        255, 252, 249;
    --accent-rgb:      200, 132, 90;
    --green-rgb:       90, 140, 107;
    --red-rgb:         200, 90, 90;
    --yellow-rgb:      200, 164, 90;
    --text-rgb:        45, 41, 38;
    --text-muted-rgb:  140, 123, 114;
```

- [ ] **Step 2: Add RGB variables to `[data-theme="light"]`**

Find `--overlay: rgba(45,41,38,0.45);` in the `[data-theme="light"]` block (line ~88) and add after it:

```css
    --card-rgb:       255, 255, 255;
    --text-rgb:       28, 20, 16;
```

(accent/green/red/yellow RGB values are same in both themes — no override needed)

- [ ] **Step 3: Add Lucide CDN script tag**

Find the closing `</head>` tag and add before it:

```html
<script src="https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js"></script>
```

> Use pinned version 0.468.0 to avoid breaking changes.

- [ ] **Step 4: Verify**

Open `index.html` in browser. Open DevTools console, run:
```javascript
getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim()
```
Expected: `"200, 132, 90"`

Also verify `window.lucide` is defined (not undefined).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(ui): add CSS RGB variables + Lucide CDN"
```

---

## Task 2: Page Header — Gradient Title + Eyebrow Label

**Files:**
- Modify: `index.html` — CSS `.page-header` section (~line 239), 5 page header HTML blocks

- [ ] **Step 1: Add eyebrow + gradient CSS**

Find `.page-header h1 { font-size: 2rem; font-weight: 800;...` (line 246) and replace the entire rule plus surrounding context:

Replace:
```css
  .page-header {
    display: flex; align-items: center;
    justify-content: space-between;
    margin-bottom: 2.4rem;
    padding-bottom: 1.2rem;
    border-bottom: 1px solid var(--border);
  }
  .page-header h1 { font-size: 2rem; font-weight: 800; letter-spacing: -.045em; line-height: 1.05; }
```

With:
```css
  .page-header {
    display: flex; align-items: center;
    justify-content: space-between;
    margin-bottom: 2.4rem;
    padding-bottom: 1.2rem;
    border-bottom: none;
    position: relative;
  }
  .page-header::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(to right, var(--accent), transparent);
    opacity: 0.35;
  }
  .page-eyebrow {
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
    opacity: 0.75;
    margin-bottom: 0.2rem;
    font-family: 'Libre Franklin', system-ui, sans-serif;
    font-weight: 600;
  }
  .page-header h1 {
    font-size: 2rem; font-weight: 800; letter-spacing: -.045em; line-height: 1.05;
    background: linear-gradient(135deg, var(--text) 20%, var(--accent) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
```

- [ ] **Step 2: Add `.page-header-left` wrapper div CSS**

After the `.page-header h1` rule just added, add:

```css
  .page-header-left { display: flex; flex-direction: column; }
```

- [ ] **Step 3: Update mobile overrides**

Find `.page-header h1 { font-size: 1.6rem; }` (~line 1184) and verify it still works with gradient text (it will — font-size override doesn't affect gradient). No change needed there.

Find `.page-header h1 { font-size: 1.3rem;` (~line 1276) — same, no change needed.

- [ ] **Step 4: Update page-presupuesto header HTML**

Find (line ~2190):
```html
      <div id="page-presupuesto" class="page">
        <div class="page-header">
          <h1>Mi mes</h1>
```

Replace with:
```html
      <div id="page-presupuesto" class="page">
        <div class="page-header">
          <div class="page-header-left">
            <p class="page-eyebrow" id="eyebrow-presupuesto">MI MES</p>
            <h1>Mi mes</h1>
          </div>
```

- [ ] **Step 5: Update page-transacciones header HTML**

Find (line ~1911):
```html
        <div class="page-header">
          <h1>Transacciones</h1>
```

Replace with:
```html
        <div class="page-header">
          <div class="page-header-left">
            <p class="page-eyebrow" id="eyebrow-transacciones">TRANSACCIONES</p>
            <h1>Transacciones</h1>
          </div>
```

- [ ] **Step 6: Update page-compartidos header HTML**

Find (line ~2068):
```html
        <div class="page-header">
          <h1>Compartidos</h1>
```

Replace with:
```html
        <div class="page-header">
          <div class="page-header-left">
            <p class="page-eyebrow" id="eyebrow-compartidos">COMPARTIDOS</p>
            <h1>Compartidos</h1>
          </div>
```

- [ ] **Step 7: Update page-config header HTML**

Find (line ~2348):
```html
        <div class="page-header">
          <h1>Categorías</h1>
```

Replace with:
```html
        <div class="page-header">
          <div class="page-header-left">
            <p class="page-eyebrow" id="eyebrow-config">CATEGORÍAS</p>
            <h1>Categorías</h1>
          </div>
```

- [ ] **Step 8: Update page-inversiones header HTML**

Find (line ~2405):
```html
        <div class="page-header">
          <h1>Inversiones</h1>
```

Replace with:
```html
        <div class="page-header">
          <div class="page-header-left">
            <p class="page-eyebrow" id="eyebrow-inversiones">INVERSIONES</p>
            <h1>Inversiones</h1>
          </div>
```

- [ ] **Step 9: Update `_actualizarStringsUsuario()` to populate eyebrows**

Find the end of `_actualizarStringsUsuario()` function — the line `if (topnavUser) topnavUser.textContent = USUARIO;` (~line 3102). After it, before the closing `}`, add:

```javascript
  const meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  const now = new Date();
  const eyebrowBase = `${meses[now.getMonth()]} ${now.getFullYear()} · ${USUARIO.toUpperCase()}`;
  ['presupuesto','transacciones','compartidos','config','inversiones'].forEach(id => {
    const el = document.getElementById(`eyebrow-${id}`);
    if (el) el.textContent = eyebrowBase;
  });
```

- [ ] **Step 10: Verify**

Navigate to each tab in browser. Each page title should show terracota-to-dark gradient text. Eyebrow shows "MAY 2026 · DANIEL" (or current user). Separator line fades left-to-right.

- [ ] **Step 11: Commit**

```bash
git add index.html
git commit -m "feat(ui): gradient page titles + eyebrow labels"
```

---

## Task 3: Sub-Section Headers + Chart Title Bars

**Files:**
- Modify: `index.html` — CSS for `.comp-title`, `.pres-title`, `.chart-title`

- [ ] **Step 1: Add left-bar treatment CSS**

Find `.chart-title,` in the Bricolage font-family declaration block (~line 120). Then find where `.chart-title` is actually styled. Search for `.chart-title {` and add/override:

After the existing `.chart-title` styles (or add as new rule before the `/* ─── KPI CARDS ─` comment):

```css
  /* Sub-section header bars */
  .chart-title,
  .comp-title,
  .pres-title,
  .section-title {
    border-left: 3px solid var(--accent);
    padding-left: 0.75rem;
    font-weight: 700;
    color: var(--text);
  }
```

> Note: This uses `color: var(--text)` not gradient — gradient is reserved for page-level `h1` only.

- [ ] **Step 2: Verify**

Navigate to Mi mes — section titles (like "Presupuesto por categoría") should show terracota left bar. Same in Compartidos for the table title.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(ui): left-bar accent on sub-section headers"
```

---

## Task 4: KPI Cards — Glassmorphism + Top Highlight

**Files:**
- Modify: `index.html` — CSS `.kpi-card` block (~line 264)

- [ ] **Step 1: Update `.kpi-card` CSS**

Find:
```css
  .kpi-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius); padding: .8rem .95rem;
    box-shadow: var(--shadow);
```

Replace with:
```css
  .kpi-card {
    background: rgba(var(--card-rgb), 0.72);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(var(--accent-rgb), 0.14);
    border-radius: var(--radius); padding: .8rem .95rem;
    box-shadow: 0 4px 24px rgba(var(--text-rgb), 0.07), inset 0 1px 0 rgba(255,255,255,0.55);
    position: relative;
    overflow: hidden;
    transition: transform 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out);
```

- [ ] **Step 2: Add top highlight pseudo-element**

After the `.kpi-card { ... }` block, add:

```css
  .kpi-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(to right, var(--accent), transparent);
    opacity: 0.45;
    border-radius: var(--radius) var(--radius) 0 0;
  }
```

- [ ] **Step 3: Add hover effect (desktop only)**

Add after the `::before` rule:

```css
  @media (hover: hover) {
    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 32px rgba(var(--text-rgb), 0.12), inset 0 1px 0 rgba(255,255,255,0.65);
    }
  }
```

- [ ] **Step 4: Verify**

Navigate to Mi mes. KPI cards should have subtle glass texture, thin terracota top accent line, and lift slightly on hover (desktop). Verify no visual regression on Ama's light theme — test by temporarily adding `data-theme="light"` to `<body>` in DevTools.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(ui): KPI cards glassmorphism + top highlight + hover lift"
```

---

## Task 5: KPI Icon Circles — Upgrade Size + Lucide Icons

**Files:**
- Modify: `index.html` — CSS `.kpi-icon` (~line 313), all `.kpi-icon` HTML in page-resumen and page-presupuesto

- [ ] **Step 1: Update `.kpi-icon` CSS**

Find:
```css
  .kpi-icon {
```

The full block is around lines 313–325. Replace the entire `.kpi-icon` block:

```css
  .kpi-icon {
    width: 36px; height: 36px;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: .55rem;
    flex-shrink: 0;
  }
  .kpi-icon svg { width: 17px; height: 17px; }
  .kpi-icon.ico-green  { background: rgba(var(--green-rgb), 0.13);  color: var(--green); }
  .kpi-icon.ico-red    { background: rgba(var(--red-rgb), 0.13);    color: var(--red); }
  .kpi-icon.ico-accent { background: rgba(var(--accent-rgb), 0.13); color: var(--accent); }
  .kpi-icon.ico-yellow { background: rgba(var(--yellow-rgb), 0.13); color: var(--yellow); }
  .kpi-icon.ico-muted  { background: rgba(var(--text-muted-rgb), 0.1); color: var(--text-muted); }
  @media (max-width: 480px) {
    .kpi-icon { width: 28px; height: 28px; border-radius: 8px; margin-bottom: .35rem; }
    .kpi-icon svg { width: 14px; height: 14px; }
  }
```

- [ ] **Step 2: Replace KPI icons in page-presupuesto**

In the KPI cards section of page-presupuesto (lines ~2204–2260), replace each `<div class="kpi-icon ..."><svg ...></svg></div>` with Lucide `data-lucide` versions:

**kpi-hero "Lo que te queda"** (line ~2205):
```html
<div class="kpi-icon ico-green"><i data-lucide="wallet" width="17" height="17"></i></div>
```

**"Sueldo"** (line ~2212):
```html
<div class="kpi-icon ico-green"><i data-lucide="banknote" width="17" height="17"></i></div>
```

**"Presupuestado"** (line ~2219):
```html
<div class="kpi-icon ico-accent"><i data-lucide="pie-chart" width="17" height="17"></i></div>
```

**"Gastado"** (line ~2225):
```html
<div class="kpi-icon ico-red"><i data-lucide="shopping-bag" width="17" height="17"></i></div>
```

**"Margen planeado"** (line ~2232):
```html
<div class="kpi-icon ico-muted"><i data-lucide="sliders-horizontal" width="17" height="17"></i></div>
```

**"Saldo en USD"** (line ~2238):
```html
<div class="kpi-icon ico-green"><i data-lucide="dollar-sign" width="17" height="17"></i></div>
```

**"Ahorro (categoría)"** (line ~2244):
```html
<div class="kpi-icon ico-green"><i data-lucide="piggy-bank" width="17" height="17"></i></div>
```

**"Podés gastar por día"** (line ~2250):
```html
<div class="kpi-icon ico-accent"><i data-lucide="calendar-days" width="17" height="17"></i></div>
```

**"Compartidos"** (line ~2256):
```html
<div class="kpi-icon ico-accent"><i data-lucide="users" width="17" height="17"></i></div>
```

- [ ] **Step 3: Replace KPI icons in page-resumen**

In page-resumen KPI section (lines ~1844–1875):

**"Ingresos"**:
```html
<div class="kpi-icon ico-green"><i data-lucide="trending-up" width="17" height="17"></i></div>
```

**"Gastos"**:
```html
<div class="kpi-icon ico-red"><i data-lucide="trending-down" width="17" height="17"></i></div>
```

**"Balance"**:
```html
<div class="kpi-icon ico-accent"><i data-lucide="scale" width="17" height="17"></i></div>
```

**"Ahorro"**:
```html
<div class="kpi-icon ico-yellow"><i data-lucide="target" width="17" height="17"></i></div>
```

- [ ] **Step 4: Add `lucide.createIcons()` call after app render**

Find `function _renderApp()` and locate where it ends / where it calls `navegarA(...)`. After `navegarA("presupuesto")` (or wherever the function ends its DOM setup), add:

```javascript
  if (window.lucide) lucide.createIcons();
```

Also find `function cargarPresupuesto()` — at the end of its async body (after all DOM updates), add:
```javascript
  if (window.lucide) lucide.createIcons();
```

- [ ] **Step 5: Verify**

Navigate to Mi mes. Each KPI card should show a Lucide icon in a colored rounded square. Icons should be crisp at 17px. Navigate to Resumen (hidden tab via DevTools or direct call `navegarA('resumen')`) — same treatment.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(ui): KPI icon circles with Lucide icons"
```

---

## Task 6: Nav Icons → Lucide (Topnav + Bottom Nav)

**Files:**
- Modify: `index.html` — topnav HTML (lines 1786–1791), bottom-nav HTML (lines 1802–1818)

- [ ] **Step 1: Replace topnav inline SVGs**

Find each `<button class="nav-item"` in the topnav (lines 1786–1791). Replace the inline `<svg ...>` inside each with a Lucide `<i>` tag:

```html
<button class="nav-item" onclick="navegarA('presupuesto')"><i data-lucide="calendar-days" width="14" height="14"></i>Mi mes</button>
<button class="nav-item" onclick="navegarA('transacciones')"><i data-lucide="receipt" width="14" height="14"></i>Transacciones</button>
<button class="nav-item" onclick="navegarA('compartidos')"><i data-lucide="users" width="14" height="14"></i>Compartidos</button>
<button class="nav-item" onclick="navegarA('config')"><i data-lucide="tag" width="14" height="14"></i>Categorías</button>
<button class="nav-item" onclick="navegarA('inversiones')"><i data-lucide="trending-up" width="14" height="14"></i>Inversiones</button>
<button class="nav-item" onclick="navegarA('resumen')"><i data-lucide="bar-chart-2" width="14" height="14"></i>Resumen</button>
```

- [ ] **Step 2: Replace bottom-nav inline SVGs**

For each `<span class="bn-icon"><svg ...></svg></span>` in bottom-nav (lines 1802–1818), replace `<svg ...></svg>` with Lucide `<i>` tags:

```html
<!-- bn-presupuesto -->
<span class="bn-icon"><i data-lucide="calendar-days" width="20" height="20"></i></span>

<!-- bn-transacciones -->
<span class="bn-icon"><i data-lucide="receipt" width="20" height="20"></i></span>

<!-- bn-compartidos -->
<span class="bn-icon"><i data-lucide="users" width="20" height="20"></i></span>

<!-- bn-config -->
<span class="bn-icon"><i data-lucide="tag" width="20" height="20"></i></span>

<!-- bn-inversiones -->
<span class="bn-icon"><i data-lucide="trending-up" width="20" height="20"></i></span>

<!-- bn-resumen -->
<span class="bn-icon"><i data-lucide="bar-chart-2" width="20" height="20"></i></span>
```

- [ ] **Step 3: Call `lucide.createIcons()` on page load**

Find the `DOMContentLoaded` listener or the end of the inline `<script>` initialization block. Add at the earliest point after DOM is ready:

```javascript
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
});
```

If a `DOMContentLoaded` listener already exists, add `if (window.lucide) lucide.createIcons();` inside it.

- [ ] **Step 4: Add nav icon hover CSS**

After the existing `.nav-item` styles, add:

```css
  @media (hover: hover) {
    .nav-item:hover i, .nav-item:hover svg {
      transform: scale(1.12);
      transition: transform 0.15s var(--ease-out);
      color: var(--accent);
    }
    .nav-item.active i, .nav-item.active svg {
      color: var(--accent);
    }
  }
```

- [ ] **Step 5: Verify**

Open browser. Check topnav shows Lucide icons at 14px next to labels. Check mobile bottom nav shows 20px icons. Hover over nav items on desktop — icon scales slightly and turns terracota. Active tab icon should be terracota.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(ui): nav icons migrated to Lucide + hover micro-interaction"
```

---

## Task 7: Action Icons → Lucide + Emoji Cleanup

**Files:**
- Modify: `index.html` — lines 2754–2756 (`IC_COPY`, `IC_EDIT`, `IC_TRASH`), line 2197 (`📊 Sugerir`), end of `filtrarTabla()`

- [ ] **Step 1: Replace IC_COPY, IC_EDIT, IC_TRASH constants**

Find lines 2754–2756:
```javascript
const IC_COPY  = `<svg ...>...</svg>`;
const IC_EDIT  = `<svg ...>...</svg>`;
const IC_TRASH = `<svg ...>...</svg>`;
```

Replace with:
```javascript
const IC_COPY  = `<i data-lucide="copy"    width="14" height="14" style="vertical-align:middle;pointer-events:none"></i>`;
const IC_EDIT  = `<i data-lucide="pencil"  width="14" height="14" style="vertical-align:middle;pointer-events:none"></i>`;
const IC_TRASH = `<i data-lucide="trash-2" width="14" height="14" style="vertical-align:middle;pointer-events:none"></i>`;
```

- [ ] **Step 2: Call `lucide.createIcons()` after table renders**

Find `function filtrarTabla()` — locate the line where it sets `tbody.innerHTML = ...` or appends rows (the final DOM write). After that line, add:

```javascript
  if (window.lucide) lucide.createIcons();
```

- [ ] **Step 3: Replace `📊 Sugerir` button**

Find (line ~2197):
```html
<button class="btn" onclick="sugerirPresupuestoDesdeHistorial()" title="Promedia los últimos 3 meses" style="font-size:.82rem">📊 Sugerir</button>
```

Replace with:
```html
<button class="btn" onclick="sugerirPresupuestoDesdeHistorial()" title="Promedia los últimos 3 meses" style="font-size:.82rem;display:flex;align-items:center;gap:.35rem"><i data-lucide="bar-chart-2" width="14" height="14"></i>Sugerir</button>
```

- [ ] **Step 4: Verify**

Navigate to Transacciones. Transactions list should show Lucide copy/edit/trash icons. Navigate to Mi mes — "Sugerir" button should show bar-chart icon. No broken icons (if any `data-lucide` value is wrong, Lucide renders nothing — check DevTools for `lucide:` warnings).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(ui): action icons migrated to Lucide + emoji cleanup"
```

---

## Task 8: Settlement Badge Animation + Tabular Nums

**Files:**
- Modify: `index.html` — CSS for `.saldado-badge`, `.kpi-value`, settlement badge HTML context

- [ ] **Step 1: Add settlement badge entrance animation CSS**

Search for `.saldado-badge` in CSS. Add or extend:

```css
  @keyframes badgeEntrada {
    from { transform: scale(0.75); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }
  .saldado-badge {
    animation: badgeEntrada 0.3s var(--ease-out);
  }
```

- [ ] **Step 2: Add tabular-nums to numeric elements**

Find the Bricolage Grotesque font-family declaration block (~line 116). After the `text-rendering: optimizeLegibility;` line, add:

```css
  .kpi-value, #sub-neto, .comp-balance-value, .donut-center-val {
    font-variant-numeric: tabular-nums;
  }
```

- [ ] **Step 3: Verify**

Navigate to Compartidos. Click "Saldar mes" — the "✓ Mes saldado" badge should appear with a pop-in animation (scale from 0.75 to 1).

Navigate to Mi mes — KPI numbers should align cleanly (tabular-nums ensures digits are same width, preventing layout shift on value changes).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(ui): badge entrance animation + tabular-nums on KPI values"
```

---

## Self-Review Checklist

| Spec requirement | Task |
|---|---|
| CSS RGB variables for rgba() | Task 1 |
| Lucide CDN | Task 1 |
| Page title gradient text | Task 2 |
| Eyebrow label with month + user | Task 2 |
| Post-header gradient separator | Task 2 |
| Sub-section header left bar | Task 3 |
| KPI card glassmorphism | Task 4 |
| KPI card top highlight | Task 4 |
| KPI card hover lift | Task 4 |
| KPI icon circles (size + color) | Task 5 |
| KPI Lucide icons | Task 5 |
| Nav icons → Lucide | Task 6 |
| Nav icon hover micro-interaction | Task 6 |
| Action icons → Lucide | Task 7 |
| Emoji cleanup (📊) | Task 7 |
| Settlement badge animation | Task 8 |
| Tabular-nums on KPI values | Task 8 |
| Ama light theme not broken | Task 4 (verify step) |
