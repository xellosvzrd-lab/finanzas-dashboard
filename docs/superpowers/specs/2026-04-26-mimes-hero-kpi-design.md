# Mi mes — Hero KPI & Cleanup

## Goal
Simplify Mi mes page to KPIs + budget table only. Elevate "Lo que te queda" to hero status.

## Changes

### 1. Remove ring chart
Delete `<div id="pres-ring-container"></div>` from HTML. No JS changes needed — function still runs but renders into removed node (harmless), or remove the render call in `actualizarKpisPres`.

### 2. Hero card: "Lo que te queda"
**HTML:** Move card to first position in `#pres-kpi-grid`. Add `kpi-hero` class. Add micro-bar inside:
```html
<div class="kpi-hero-bar-wrap">
  <div class="kpi-hero-bar-fill" id="pres-hero-bar"></div>
</div>
<div class="kpi-sub" id="pres-kpi-saldo-real-sub">Sueldo − Gastado real</div>
```

**CSS:**
- `.kpi-hero` → `grid-column: span 2`, value font-size `1.8rem`
- `.kpi-hero-bar-wrap` → full width, height 6px, bg `var(--bg3)`, border-radius 99px
- `.kpi-hero-bar-fill` → height 100%, border-radius 99px, transition width 0.6s ease
- Color classes on fill: `bar-ok` (green), `bar-warn` (yellow), `bar-over` (red)
- `.kpi-hero:has(.balance-pos)::before` → accent gradient (existing pattern)
- `.kpi-hero:has(.balance-neg)::before` → red gradient (existing pattern)

**JS (in `actualizarKpisPres`):**
- Compute `pctUsado = totalGasto / sueldo` (0–1+)
- Set `pres-hero-bar` width to `min(pctUsado * 100, 100)%`
- Apply bar color class: `bar-ok` < 80%, `bar-warn` 80–100%, `bar-over` > 100%
- Update sub-label: `Sueldo − Gastado real · ${Math.round(pctUsado*100)}% usado`
- Apply `balance-pos` / `balance-neg` class to value element based on sign

### 3. Grid order
Lo que te queda (2col hero) → Sueldo → Presupuestado → Gastado → Margen planeado → Ahorro → Podés gastar/día → USD (hidden)

## Out of scope
- No changes to budget table, toggle, notes, header selectors
- No changes to other pages
