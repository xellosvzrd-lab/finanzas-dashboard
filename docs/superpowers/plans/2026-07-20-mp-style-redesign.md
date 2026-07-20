# MP Style Redesign (Verde Bosque + Liquid Glass) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin `index.html` from the current indigo liquid-glass palette to the approved "MP Style" — Mercado Pago-style layout anatomy (color header, round quick actions, sidebar/bottom-nav) on a "verde bosque" liquid-glass material — across all 6 nav tabs plus `page-nueva`, without touching data logic, Supabase calls, or JS business rules.

**Architecture:** Nine sequential, independently-deployable tasks. Task 1 replaces CSS custom properties only (theme tokens + glass material + the two hardcoded JS color constants that mirror them) — this alone reskins the whole app without touching layout. Task 2 activates the already-present-but-disabled `.sidebar` markup (currently `display:none`) in place of `.topnav`, and restyles `.bottom-nav`. Tasks 3–9 touch one page's HTML/CSS at a time, reusing the class-naming conventions and JS functions that already exist (`navegarA()`, `fmt()`, `fmtMoneda()`, `fmtFecha()`, `escapeHtml()`, `toggleDesglose()`, etc.) — no new JS logic, no new global state except a single boolean for the balance-visibility toggle.

**Tech Stack:** Vanilla CSS custom properties (`oklch()`, `color-mix()`), vanilla HTML, existing Chart.js 4.4.1 / Lucide setup. No build step, no Tailwind, no new dependencies.

## Global Constraints

- Single file `index.html`, no build pipeline, no npm, no framework — edit `index.html` directly (per `CLAUDE.md` §1; ignore the stale `ARCHIVO GENERADO` comment on line 1, there is no `src/js/` or `build.sh` in this repo — it was removed 2026-07-06, see `[[project_finanzas]]`).
- Never hardcode `"Ama"` — always use the `PARTNER` variable for responsibility labels (per `CLAUDE.md` §5, §14, and handoff §"Nueva transacción").
- Reuse existing formatters `fmt()`, `fmtMoneda()`, `fmtShort()`, `fmtFecha()` — do not reinvent money/date formatting (per `CLAUDE.md` §5 and handoff "Assets"/"Design Tokens").
- Any new dynamic string interpolated into `innerHTML` must go through `escapeHtml()` (per `CLAUDE.md` §11 "XSS en innerHTML dinámico").
- Mobile-first: verify no horizontal overflow and respect existing `max-width`/`@media (max-width: 768px)` breakpoints on every change (per `CLAUDE.md` §"UI/Design Preferences" and handoff "Interactions & Behavior").
- Do not rename or remove any function (`navegarA`, `filtrarTabla`, `toggleDesglose`, `toggleDetalleCompartidos`, `inicializarRespButtons`, etc.) or element `id` that JS queries by — only change classes/markup around them (verified per-task via `grep` for the `id`/function name).
- `toggleTheme()` and `:root[data-theme='dark'|'light']` are reused as-is; only their variable *values* change, no new variables are invented, following the exact pattern of `docs/superpowers/plans/2026-07-05-liquid-glass-light-theme.md` (per handoff "Interactions & Behavior").
- The heatmap calendar, recurrentes section (Mi mes), and "Cuenta y Seguridad" section (Categorías) are explicitly **not** maquetados in the hifi handoff — carry them forward unchanged except for inheriting the new glass material via existing shared classes (`.card`, `.chart-card`) (per handoff §"Mi mes"/§"Categorías").
- Verification per task (no browser available in this environment):
  1. `grep` for every `id`/function name touched to confirm JS hooks still exist and are not orphaned.
  2. Extract inline `<script>` blocks and syntax-check with Node (same technique as `.github/workflows/validate.yml`): `node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');const re=/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(html))!==null){new Function(m[1]);}console.log('OK')"`
  3. `node scripts/test-reparto.js` — must still pass (reparto/responsabilidad math is untouched but the script re-parses the whole file, so it also catches gross JS breakage).
  4. Manual tag-balance check on the touched HTML range: `grep -o '<div' index.html | wc -l` vs `grep -o '</div>' index.html | wc -l` before/after the edit (delta must be 0, since edits only replace markup, not add/remove net divs, unless the step explicitly says otherwise).
  5. Final human QA by Daniel on the Vercel preview deploy (real device, both themes) — out of scope for the agent, but every task ends in a deployable, previewable state.

---

## Task 1: Tokens del tema "verde bosque" + material glass + colores de charts en JS

**Files:**
- Modify: `index.html:64-118` (`:root[data-theme='dark']` block)
- Modify: `index.html:121-178` (`:root[data-theme='light']` block)
- Modify: `index.html:4242-4257` (`const _C = {...}` — colores Chart.js/sparklines)
- Modify: `index.html:4260-4273` (`const PALETTE = [...]` — colores categóricos de `_catColor()`)
- Reference (read-only, source of verdad): `design_handoff_mp_style/styles-mp-verde.css`

**Interfaces:**
- Consumes: nothing — this is the foundation task.
- Produces: same CSS variable names (`--bg`, `--bg-grad`, `--elev`, `--surface`, `--surface-2`, `--surface-3`, `--line`, `--line-strong`, `--text`, `--text-dim`, `--text-faint`, `--brand`, `--brand-2`, `--brand-ink`, `--brand-soft`, `--pos`, `--neg`, `--info`, `--save`, `--warn`, `--pos-soft`, `--neg-soft`, `--shadow-card`, `--shadow-pop`, plus all "legacy alias" vars: `--bg2`, `--bg3`, `--card`, `--border`, `--border2`, `--accent`, `--accent-dim`, `--accent-glow`, `--white`, `--overlay`, `--green`, `--green-dim`, `--red`, `--red-dim`, `--yellow`, `--yellow-dim`, `--text-muted`, `--radius`, `--shadow`, `--glass`, `--glass-border`, `--card-blur`, `--modal-bg`, and the `--*-rgb` splits) — same names, new values. Every later task consumes these unchanged names. Also produces `_C.accent`/`_C.green`/`_C.red` (Chart.js color strings) and `PALETTE[0]`/`PALETTE[5]` (brand-derived categorical colors) with new values.

- [ ] **Step 1: Replace the dark theme token block**

Locate `index.html:64-118`:
```css
  :root[data-theme='dark'] {
    --bg:          #10121f;
    --bg-grad:     radial-gradient(120% 80% at 80% -10%, #1f2247 0%, #10121f 55%);
    --elev:        #1b1d33;
    --surface:     rgba(122,116,232,0.14);
    --surface-2:   rgba(122,116,232,0.20);
    --surface-3:   rgba(122,116,232,0.28);
    --line:        rgba(255,255,255,0.15);
    --line-strong: rgba(255,255,255,0.22);
    --text:        #f4f1fa;
    --text-dim:    #b3aac6;
    --text-faint:  #7e7595;
    --brand:       oklch(0.72 0.17 270);
    --brand-2:     oklch(0.76 0.18 285);
    --brand-ink:   #fff;
    --brand-soft:  color-mix(in oklab, var(--brand) 16%, var(--surface));
    --pos-soft:    color-mix(in oklab, var(--pos)   16%, var(--surface));
    --neg-soft:    color-mix(in oklab, var(--neg)   16%, var(--surface));
    --shadow-card: 0 8px 26px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.22);
    --shadow-pop:  0 18px 50px rgba(0,0,0,.55);
    ...
```
(full 55-line block including semantic accents that live in the shared `:root` at the top, lines 47-51, stay as-is — only `--pos`/`--neg`/`--info`/`--save` get *overridden* inside each theme block, exactly like the light block already does).

Replace the color-bearing lines (keep every "legacy aliases" line structurally identical, they reference the vars above via `var(...)` so they update automatically) with:
```css
  :root[data-theme='dark'] {
    --bg:          #0e1512;
    --bg-grad:     radial-gradient(120% 80% at 80% -10%, #17251d 0%, #0e1512 55%);
    --elev:        #131c16;
    --surface:     #18241d;
    --surface-2:   #1f2e25;
    --surface-3:   #28392e;
    --line:        rgba(226,244,233,0.08);
    --line-strong: rgba(226,244,233,0.15);
    --text:        #ecf5ef;
    --text-dim:    #a8bfb1;
    --text-faint:  #71887a;
    --brand:       oklch(0.66 0.13 160);
    --brand-2:     oklch(0.75 0.14 140);
    --brand-ink:   #0a1710;
    --brand-soft:  color-mix(in oklab, var(--brand) 18%, var(--surface));
    --pos:         oklch(0.68 0.14 120);
    --neg:         oklch(0.62 0.17 25);
    --info:        oklch(0.62 0.09 245);
    --save:        oklch(0.66 0.09 195);
    --pos-soft:    color-mix(in oklab, var(--pos) 18%, var(--surface));
    --neg-soft:    color-mix(in oklab, var(--neg) 18%, var(--surface));
    --shadow-card: 0 1px 0 rgba(226,244,233,.04) inset, 0 8px 30px rgba(0,0,0,.45);
    --shadow-pop:  0 18px 50px rgba(0,0,0,.55);

    /* legacy aliases — componentes existentes sin cambios */
    --bg2:         var(--surface-2);
    --bg3:         var(--surface-3);
    --card:        var(--surface);
    --border:      var(--line);
    --border2:     var(--line-strong);
    --accent:      var(--brand);
    --accent-dim:  var(--brand-soft);
    --accent-glow: color-mix(in oklab, var(--brand) 28%, transparent);
    --white:       var(--brand-ink);
    --overlay:     rgba(0,0,0,0.55);
    --green:       var(--pos);
    --green-dim:   var(--pos-soft);
    --red:         var(--neg);
    --red-dim:     var(--neg-soft);
    --yellow:      var(--warn);
    --yellow-dim:  color-mix(in oklab, var(--warn) 16%, var(--surface));
    --text-muted:  var(--text-dim);
    --radius:      var(--r-md);
    --shadow:      var(--shadow-card);
    --glass:       rgba(226,244,233,0.07);
    --glass-border:rgba(226,244,233,0.15);
    --card-blur:   16px;
    --modal-bg:    rgba(19,28,22,0.92);

    /* RGB splits para rgba() */
    --accent-rgb:      95, 179, 138;
    --green-rgb:       130, 209, 149;
    --red-rgb:         214, 108,  87;
    --yellow-rgb:      210, 188,  58;
    --text-rgb:        236, 245, 239;
    --text-muted-rgb:  168, 191, 177;
    --card-rgb:         24,  36,  29;
  }
```
Notas de decisiones tomadas acá (ya documentadas en este plan, no silenciosas): `--warn` no forma parte de la paleta "verde bosque" del handoff (solo define `--brand/--brand-2/--pos/--neg/--info/--save`) — se dejó sin cambios (sigue siendo el ámbar compartido `--warn` del `:root` de nivel superior, línea 51) porque se usa en badges de cuotas/alertas y el handoff no da un valor de reemplazo. `--glass`/`--glass-border`/`--modal-bg` se recalculan desde el nuevo hex de `--surface`/`--bg` para mantener consistencia visual (el handoff no los da directamente, ya se derivaban de `--surface`/`--bg` antes también). Los splits RGB son descomposiciones sRGB aproximadas de los nuevos valores oklch/hex, usados solo para los call-sites legacy `rgba(var(--accent-rgb),N)` — precisión cosmética, no crítica a nivel píxel.

- [ ] **Step 2: Replace the light theme token block**

Locate `index.html:121-178`, misma estructura. Reemplazar con:
```css
  :root[data-theme='light'] {
    --bg:          #f1f6f2;
    --bg-grad:     radial-gradient(120% 80% at 80% -10%, #e4f1e7 0%, #f1f6f2 55%);
    --elev:        #fafdfb;
    --surface:     #fafdfb;
    --surface-2:   #e9f1ea;
    --surface-3:   #dce9de;
    --line:        rgba(20,32,26,0.10);
    --line-strong: rgba(20,32,26,0.18);
    --text:        #14201a;
    --text-dim:    #4c5f54;
    --text-faint:  #7c8f83;
    --brand:       oklch(0.50 0.13 165);
    --brand-2:     oklch(0.63 0.14 145);
    --brand-ink:   #fff;
    --brand-soft:  color-mix(in oklab, var(--brand) 12%, #fff);
    --pos:         oklch(0.58 0.14 120);
    --neg:         oklch(0.52 0.18 25);
    --info:        oklch(0.53 0.09 245);
    --save:        oklch(0.56 0.09 195);
    --pos-soft:    color-mix(in oklab, var(--pos) 12%, #fff);
    --neg-soft:    color-mix(in oklab, var(--neg) 12%, #fff);
    --shadow-card: 0 1px 2px rgba(20,40,28,.05), 0 10px 30px rgba(20,70,45,.08);
    --shadow-pop:  0 18px 50px rgba(20,70,45,.16);

    --bg2:         var(--surface-2);
    --bg3:         var(--surface-3);
    --card:        var(--surface);
    --border:      var(--line);
    --border2:     var(--line-strong);
    --accent:      var(--brand);
    --accent-dim:  var(--brand-soft);
    --accent-glow: color-mix(in oklab, var(--brand) 24%, transparent);
    --white:       var(--brand-ink);
    --overlay:     rgba(20,32,26,0.35);
    --green:       var(--pos);
    --green-dim:   var(--pos-soft);
    --red:         var(--neg);
    --red-dim:     var(--neg-soft);
    --yellow:      var(--warn);
    --yellow-dim:  color-mix(in oklab, var(--warn) 12%, #fff);
    --text-muted:  var(--text-dim);
    --radius:      var(--r-md);
    --shadow:      var(--shadow-card);
    --glass:       rgba(20,32,26,0.06);
    --glass-border:rgba(20,32,26,0.14);
    --card-blur:   16px;
    --modal-bg:    rgba(250,253,251,0.94);

    --accent-rgb:      64, 128,  94;
    --green-rgb:       102, 166, 100;
    --red-rgb:         190,  76,  56;
    --yellow-rgb:      168, 134,  42;
    --text-rgb:         20,  32,  26;
    --text-muted-rgb:   76,  95,  84;
    --card-rgb:        250, 253, 251;
  }
```

- [ ] **Step 3: Add the glass material layer (`.glassui`) as a new selector block**

Esto es nuevo — `styles-mp-verde.css` del handoff define un set de variables `--g-*` (brillo interior, hairline, gradiente) scopeado a `.glassui` que las Tareas 2-9 van a usar en header/accesos rápidos/sidebar. Insertar inmediatamente después del bloque del tema light (después de `index.html:178`, antes de `/* ─── CARD PRIMITIVE ─── */` en `181`):
```css
  :root[data-theme='light'] .glassui {
    --g-text:#14201a; --g-text-2:rgba(20,32,26,0.64); --g-text-3:rgba(20,32,26,0.44);
    --g-mat:rgba(250,253,251,0.55); --g-mat-strong:rgba(250,253,251,0.76); --g-mat-deep:rgba(250,253,251,0.32);
    --g-border:rgba(246,252,248,0.8); --g-hair:rgba(20,32,26,0.07);
    --g-shine:inset 1.2px 1.2px 0 rgba(255,255,255,0.92), inset -1px -1px 1px rgba(255,255,255,0.5);
    --g-shadow:0 2px 10px rgba(20,70,45,0.08), 0 14px 40px rgba(20,70,45,0.14);
  }
  :root[data-theme='dark'] .glassui {
    --g-text:#ecf5ef; --g-text-2:rgba(236,245,239,0.68); --g-text-3:rgba(236,245,239,0.42);
    --g-mat:rgba(226,244,233,0.14); --g-mat-strong:rgba(226,244,233,0.22); --g-mat-deep:rgba(226,244,233,0.08);
    --g-border:rgba(226,244,233,0.2); --g-hair:rgba(226,244,233,0.1);
    --g-shine:inset 1.2px 1.2px 0 rgba(226,244,233,0.22), inset -1px -1px 1px rgba(226,244,233,0.06);
    --g-shadow:0 2px 12px rgba(0,0,0,0.35), 0 18px 50px rgba(0,0,0,0.5);
  }
  .glassui { color: var(--g-text); }

  /* MP-style header/quick-action primitives (usados por headers de Mi mes, Transacciones, Compartidos) */
  .mp-head { position: relative; color: #fff; background: linear-gradient(150deg, oklch(0.42 0.12 172), oklch(0.55 0.135 148)); }
  :root[data-theme='dark'] .mp-head { background: linear-gradient(150deg, oklch(0.34 0.10 172), oklch(0.45 0.11 150)); }
  .mp-head::after { content:''; position:absolute; inset:0; background:radial-gradient(120% 90% at 85% -20%, rgba(255,255,255,0.16), transparent 60%); pointer-events:none; border-radius:inherit; }
  .mp-head > * { position:relative; z-index:1; }
  .mp-hbtn { width:36px; height:36px; border-radius:999px; background:rgba(255,255,255,0.16); display:flex; align-items:center; justify-content:center; color:#fff; border:0.5px solid rgba(255,255,255,0.28); flex:none; }
  .mp-avatar { width:38px; height:38px; border-radius:999px; background:rgba(255,255,255,0.22); border:1px solid rgba(255,255,255,0.4); display:flex; align-items:center; justify-content:center; font-weight:700; color:#fff; flex:none; }
  .mp-wpill { display:inline-flex; align-items:center; gap:6px; border-radius:999px; padding:5px 12px; background:rgba(255,255,255,0.16); border:0.5px solid rgba(255,255,255,0.25); font-size:12px; font-weight:600; color:#fff; white-space:nowrap; }
  .mp-wbtn { display:inline-flex; align-items:center; justify-content:center; gap:8px; border-radius:999px; padding:11px 20px; background:#fff; color:oklch(0.44 0.13 165); font-weight:700; font-size:14px; box-shadow:0 6px 18px rgba(8,40,25,0.28); }
  .mp-action { display:flex; flex-direction:column; align-items:center; gap:7px; font-size:11.5px; font-weight:600; color:var(--text-dim); text-align:center; background:none; border:none; cursor:pointer; font-family:inherit; }
  .mp-action .ico { width:52px; height:52px; border-radius:999px; display:flex; align-items:center; justify-content:center; color:var(--brand); background:color-mix(in oklab, var(--brand) 11%, var(--surface)); border:0.5px solid var(--line); box-shadow: var(--shadow-card); }
```
`.mp-wbtn` usa el tono de marca `oklch(0.44 0.13 165)` (matchea la idea de "tinta sobre brand" del patrón `--brand-ink` del handoff para texto sobre blanco) porque debe seguir siendo legible sobre blanco en ambos temas.

- [ ] **Step 4: Update `_C` (Chart.js/sparkline colors)**

Locate `index.html:4242-4257`:
```javascript
const _C = {
  muted:      "#b3aac6",   // var(--text-dim)
  grid:       "rgba(255,255,255,0.08)",
  accent:     "#7a74e8",   // var(--accent) índigo
  green:      "#4ec476",   // var(--green)
  greenA75:   "rgba(78,196,118,.75)",
  greenA65:   "rgba(78,196,118,.65)",
  greenA90:   "rgba(78,196,118,.9)",
  red:        "#e56e4a",   // var(--red)
  redA75:     "rgba(229,110,74,.75)",
  redA65:     "rgba(229,110,74,.65)",
  redA90:     "rgba(229,110,74,.9)",
  accentA13:  "rgba(122,116,232,.16)",
  greenChart: "rgba(78,196,118,0.7)",
  redChart:   "rgba(229,110,74,0.7)",
};
```
Reemplazar con valores derivados del tema dark nuevo (este objeto es theme-independent hoy — se renderiza una vez y no se re-evalúa en `toggleTheme()`, así que se mantiene esa misma convención, solo se recolorea a los equivalentes verde/dark que se ven bien en ambos temas del canvas, igual que hacía el índigo antes):
```javascript
const _C = {
  muted:      "#a8bfb1",   // var(--text-dim) dark
  grid:       "rgba(226,244,233,0.08)",
  accent:     "#5fb38a",   // var(--accent) verde — oklch(0.66 0.13 160) approx
  green:      "#82d195",   // var(--green) — oklch(0.68 0.14 120) approx
  greenA75:   "rgba(130,209,149,.75)",
  greenA65:   "rgba(130,209,149,.65)",
  greenA90:   "rgba(130,209,149,.9)",
  red:        "#d66c57",   // var(--red) — oklch(0.62 0.17 25) approx
  redA75:     "rgba(214,108,87,.75)",
  redA65:     "rgba(214,108,87,.65)",
  redA90:     "rgba(214,108,87,.9)",
  accentA13:  "rgba(95,179,138,.16)",
  greenChart: "rgba(130,209,149,0.7)",
  redChart:   "rgba(214,108,87,0.7)",
};
```

- [ ] **Step 5: Update `PALETTE` (categorical colors for `_catColor()`)**

Locate `index.html:4260-4273`. Es una paleta categórica de 12 colores afinada para contraste, independiente de los tokens brand/semánticos (existe para distinguir categorías en el donut/leyenda, no para reflejar el color de marca). Solo las dos entradas derivadas de brand chocan visualmente con el nuevo verde y necesitan cambiar; el resto (azul info, coral neg, teal save, ámbar warn, verde pos, y los cinco tonos de relleno) quedan igual porque no forman parte de la identidad "verde bosque" y el handoff no pide cambiarlos:
```javascript
const PALETTE = [
  "#5FB38A",  // brand   — verde bosque (era índigo #7A74E8)
  "#6680DC",  // info    — azul índigo
  "#D97060",  // neg     — coral
  "#58C0B0",  // save    — teal
  "#C8BC45",  // warn    — ámbar
  "#82D195",  // brand-2 — verde claro (era rosa #DE7EC5)
  "#5ABB78",  // pos     — verde
  "#E09060",  // naranja cálido
  "#7BA8D4",  // celeste
  "#B87AD4",  // lavanda
  "#80C878",  // lima
  "#D4A060",  // sienna
];
```
Nota: `PALETTE[0]` (verde `#5FB38A`) y `PALETTE[6]` (`#5ABB78`, verde "pos" sin cambios) quedan cerca en tono — aceptable porque nunca son adyacentes en la práctica (`_catColor()` hashea nombre de categoría → índice, y Daniel/Ama solo tienen ~15-20 categorías en total, el riesgo de colisión es el mismo que cualquier otro par en una paleta de 12 colores y ya existía antes de este cambio).

- [ ] **Step 6: Verify no syntax breakage**

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');const re=/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(html))!==null){new Function(m[1]);}console.log('OK')"
node scripts/test-reparto.js
grep -c "^  :root\[data-theme=" index.html
```
Expected: `OK` impreso, `test-reparto.js` sale con exit 0 y su propio PASS, y `grep -c` devuelve `2` (un bloque dark, uno light — confirma que no quedó ningún bloque duplicado/huérfano).

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat(theme): swap indigo liquid-glass tokens for verde bosque palette

Foundation step of the MP Style redesign — CSS custom properties only,
no structural/layout changes. Recolors _C and PALETTE JS constants to
match since they duplicate token values in hex for Chart.js canvas.
"
```

---

## Task 2: Sidebar desktop (activar) + Bottom nav mobile (glass restyle)

**Files:**
- Modify: `index.html:2024` (`.sidebar { display: none; }` override)
- Modify: `index.html:2021` (`@media (max-width: 768px) { .topnav { display: none; } }` — extend to hide topnav at all widths)
- Modify: `index.html:2781-2805` (sidebar markup — add "Nueva transacción" CTA, per handoff)
- Modify: `index.html:2131-2148` (`.sidebar .nav-item` / `.nav-item.active` rules — apply glass look)
- Modify: `index.html:1423-1497` (`.bottom-nav`, `.bn-pill`, `.bn-item`, `.bn-cta` — glass restyle only, no structure change)
- Reference: `design_handoff_mp_style/README.md` §"Navegación" (Móvil/Desktop)

**Interfaces:**
- Consumes: tokens from Task 1 (`--brand`, `--surface`, `--line`, `--glass`, `--glass-border`, patrón de pill `.mp-wbtn`).
- Produces: `.sidebar` visible a `≥860px` en lugar de `.topnav` (que pasa a `display:none` incondicional); id `#sidebar-nueva-cta` para el nuevo CTA (no lo consume ninguna otra tarea, es puramente visual, llama al `navegarA('nueva')` existente). Markup e ids de `.bottom-nav`/`.bn-pill`/`.bn-cta` (`bn-presupuesto`, `bn-transacciones`, `bn-compartidos`, `bn-config`) sin cambios — las Tareas 3-9 siguen dependiendo de que `navegarA()` actualice la clase `.active` en estos mismos ids vía la lógica de sync existente en `7605-7620`.

- [ ] **Step 1: Disable `.topnav` unconditionally, enable `.sidebar` at desktop widths**

En `index.html:2021`:
```css
  @media (max-width: 768px) { .topnav { display: none; } }
```
Reemplazar por:
```css
  .topnav { display: none; } /* reemplazado por .sidebar (MP Style) — ver Task 2 del rediseño verde bosque */
```
En `index.html:2024`:
```css
  .sidebar { display: none; }
```
Reemplazar por:
```css
  .sidebar { display: none; width: 236px; flex-shrink: 0; }
  @media (min-width: 860px) {
    .sidebar {
      display: flex; flex-direction: column;
      position: sticky; top: 0; align-self: flex-start;
      height: 100vh; padding: 18px 14px;
      background: var(--glass);
      border-right: 1px solid var(--glass-border);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
    }
  }
```
Como `.layout { display:flex }` ya se aplica a `≥860px` (`index.html:2027`), el sidebar ahora ocupa su columna de 236px y `.main` (ya `flex:1;min-width:0`, `2167`) llena el resto — no hacen falta cambios en `.layout`/`.main`.

- [ ] **Step 2: Add "Nueva transacción" CTA to sidebar markup**

En `index.html:2782-2785` (dentro de `<aside class="sidebar" id="sidebar">`, justo después de `.sidebar-logo`, antes de `<nav class="sidebar-nav">`):
```html
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">💰</div>
        <span class="sidebar-logo-text">Finanzas</span>
      </div>
      <button class="sidebar-cta" id="sidebar-nueva-cta" onclick="navegarA('nueva')">
        <i data-lucide="plus" width="18" height="18"></i>
        Nueva transacción
      </button>
      <nav class="sidebar-nav">
```
Agregar el CSS correspondiente justo después de la regla `.sidebar-logo-text` en `index.html:2129`:
```css
  .sidebar-logo-text { font-family: var(--font-display); font-weight: 700; font-size: 17px; color: var(--text); }
  .sidebar-cta {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    height: 44px; margin: 0 2px 16px; border-radius: 999px; border: none;
    font-family: inherit; font-weight: 700; font-size: 14px; color: var(--brand-ink);
    background: linear-gradient(150deg, var(--brand), var(--brand-2));
    box-shadow: 0 6px 18px color-mix(in oklab, var(--brand) 40%, transparent);
    cursor: pointer; transition: filter .15s;
  }
  .sidebar-cta:hover { filter: brightness(1.05); }
```
Lucide renderiza automáticamente el nuevo `<i data-lucide="plus">` en la próxima llamada a `lucide.createIcons()` — mismo patrón ya usado en otras partes del archivo (ej. `2733`), sin cambios de JS.

- [ ] **Step 3: Restyle sidebar nav items and container radius to glass card look**

En `index.html:2131-2148`, mantener selectores/estructura pero redondear el contenedor completo del sidebar según spec (radius 24) y usar el nuevo gradiente `--brand`/`--brand-2` (ya heredado automáticamente del token swap de la Tarea 1 porque estas reglas referencian `var(--brand)`/`var(--brand-2)`/`var(--glass)` — **no hace falta editar acá**, confirmar en el grep del Step 5 que estas reglas siguen presentes sin cambios).

Agregar el radius del contenedor y el gap interno de 12px insertando en la regla `.sidebar` escrita en el Step 1: aplicar `border-radius: 24px` no es directo para un sidebar sticky full-height pegado al borde del viewport según el "sidebar 236px glass radius 24" del handoff — como el nuestro va de borde a borde (sin margen respecto al viewport), aplicar el radius solo a las esquinas derechas para que igual se lea como un panel redondeado:
```css
      border-radius: 0 24px 24px 0;
```
(agregar a la regla `.sidebar` dentro del bloque `@media (min-width: 860px)` del Step 1).

- [ ] **Step 4: Restyle bottom nav to glass material (mobile) — no structural change**

En `index.html:1423-1497` ubicar `.bottom-nav`, `.bn-pill`, `.bn-cta`. Ya leen `var(--glass)`/`var(--brand)`/`var(--card-blur)` (confirmar con `grep -n "background: var(--glass)\|var(--brand)" index.html` dentro de ese rango) — si aparece algún valor índigo hardcodeado (rgba con el triplete literal `122,116,232` etc.) reemplazarlo por interpolaciones `var(--accent-rgb)` para que sigan automáticamente el nuevo split RGB de la Tarea 1:
```bash
grep -n "122, *116, *232\|122,116,232" index.html
```
Para cada hit dentro de `1423-1497`, reemplazar el triplete literal por `var(--accent-rgb)`, ej. `rgba(122,116,232,0.35)` → `rgba(var(--accent-rgb),0.35)`.

- [ ] **Step 5: Verify**

```bash
grep -n 'id="sidebar"' index.html
grep -n "onclick=\"navegarA('nueva')\"" index.html
grep -c '<div' index.html; grep -c '</div>' index.html
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');const re=/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(html))!==null){new Function(m[1]);}console.log('OK')"
node scripts/test-reparto.js
```
Expected: id de sidebar presente exactamente una vez, al menos 3 call-sites de `navegarA('nueva')` (CTA del bottom-nav, CTA del sidebar, "+ Anotar" de Mi mes), conteos de apertura/cierre de div iguales, `OK`, y `test-reparto.js` pasa.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(nav): activate MP-style sidebar on desktop, retire .topnav

Sidebar markup already existed but was force-hidden (display:none);
this wires it up as the live desktop nav per the MP Style handoff,
adds the sidebar CTA, and brings bottom-nav glass colors in line with
the new verde bosque tokens from Task 1.
"
```

---

## Task 3: Mi mes (`page-presupuesto`) — header de color + accesos rápidos + donut

**Files:**
- Modify: `index.html:3296-3321` (`.mm-header` block)
- Modify: `index.html:3324-3392` (`.mm-row1` — hero card)
- Modify: `index.html:1540-1647` (`.mm-hero`, `.mm-cat-row` CSS)
- Reference: `design_handoff_mp_style/README.md` §"1. Mi mes"

**Interfaces:**
- Consumes: `.mp-head`, `.mp-avatar`, `.mp-wpill`, `.mp-action` de la Tarea 1; ids `#mm-hero-amount`, `#mm-greeting`, `#mm-mes-label` consumidos por el JS existente en `cargarPresupuesto()` — **no renombrar estos ids**.
- Produces: `#mm-balance-toggle` (nuevo botón, nueva clave de localStorage `USUARIO + "_mm_balance_oculto"`, mismo patrón de persistencia que `toggleDesglose()` per `CLAUDE.md` §5), clase `.mm-quick-grid` (nueva, 4 botones de acción: Nueva/Gastos/Compartidos/Categorías, todos llaman al `navegarA()` existente).

- [ ] **Step 1: Wrap `.mm-header` content in `.mp-head glassui` and add balance-visibility toggle**

Reemplazar `index.html:3296-3321`:
```html
        <div class="mm-header">
          <div>
            <div class="mm-page-title">Mi mes</div>
            <div class="mm-greeting" id="mm-greeting">Hola 👋</div>
            <div class="mm-month-pill">
              <button type="button" onclick="cambiarMesPresupuesto(-1)" aria-label="Mes anterior">‹</button>
              <span id="mm-mes-label"></span>
              <button type="button" onclick="cambiarMesPresupuesto(1)" aria-label="Mes siguiente">›</button>
            </div>
            ...
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <button class="btn btn-primary mm-anotar-btn" onclick="navegarA('nueva')">+ Anotar</button>
            ...
          </div>
        </div>
```
Por:
```html
        <div class="mm-header mp-head glassui">
          <div class="mm-head-top">
            <div class="mp-avatar" id="mm-head-avatar">D</div>
            <div class="mm-month-pill">
              <button type="button" onclick="cambiarMesPresupuesto(-1)" aria-label="Mes anterior">‹</button>
              <span id="mm-mes-label"></span>
              <button type="button" onclick="cambiarMesPresupuesto(1)" aria-label="Mes siguiente">›</button>
            </div>
            <div class="mm-month-selects" style="display:none">
              <select id="pres-mes" onchange="cargarPresupuesto()"></select>
              <select id="pres-anio" onchange="cargarPresupuesto()"></select>
            </div>
            <button class="mp-hbtn" id="mm-balance-toggle" onclick="toggleBalanceOculto()" aria-label="Mostrar/ocultar saldo" title="Mostrar/ocultar saldo">
              <i data-lucide="eye" width="17" height="17" id="mm-balance-eye-icon"></i>
            </button>
          </div>
          <div class="mm-greeting" id="mm-greeting">Hola 👋</div>
          <div class="mm-hero-eyebrow-mp" id="mm-hero-eyebrow-mp">Saldo de <span id="mm-hero-mes-label"></span></div>
          <div class="mm-hero-amount num" id="mm-hero-amount">$0</div>
          <div class="mm-hero-sub" id="mm-hero-sub">de tu sueldo, hasta fin de mes</div>
          <div class="mm-head-pills">
            <span class="mp-wpill" id="mm-pill-ingresos">↑ Ingresos —</span>
            <span class="mp-wpill" id="mm-pill-gastos">↓ Gastos —</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
            <button class="mp-wbtn mm-anotar-btn" onclick="navegarA('nueva')">+ Anotar</button>
            <button class="mp-hbtn" onclick="sugerirPresupuestoDesdeHistorial()"
                    title="Sugerir presupuesto (promedio 3 meses)" aria-label="Sugerir presupuesto">
              <i data-lucide="bar-chart-2" width="16" height="16"></i>
            </button>
            <button class="mp-hbtn" onclick="copiarPresupuestoMesAnterior()"
                    title="Copiar presupuesto del mes anterior" aria-label="Copiar presupuesto del mes anterior">
              <i data-lucide="copy" width="16" height="16"></i>
            </button>
          </div>
        </div>

        <!-- Accesos rápidos MP-style, superpuestos al header -->
        <div class="card mm-quick-grid glassui">
          <button class="mp-action" onclick="navegarA('nueva')">
            <span class="ico"><i data-lucide="plus" width="22" height="22"></i></span>
            Nueva
          </button>
          <button class="mp-action" onclick="navegarA('transacciones')">
            <span class="ico"><i data-lucide="receipt" width="22" height="22"></i></span>
            Gastos
          </button>
          <button class="mp-action" onclick="navegarA('compartidos')">
            <span class="ico"><i data-lucide="users" width="22" height="22"></i></span>
            Compartidos
          </button>
          <button class="mp-action" onclick="navegarA('config')">
            <span class="ico"><i data-lucide="tag" width="22" height="22"></i></span>
            Categorías
          </button>
        </div>
```
Nota: el id `#mm-hero-amount` se preserva sin cambios (el JS en `cargarPresupuesto()` escribe ahí vía `document.getElementById('mm-hero-amount').textContent = ...`) — solo cambian su contenedor/clases. La card `.mm-hero` original ("Te queda para gastar", en `3327-3346`) queda **en su lugar, debajo** de este nuevo header, sin cambios en esta tarea — el header hero del handoff (saldo grande) es aditivo a, no reemplazo de, la card hero existente, porque lleva una semántica distinta (queda vs. saldo) y el handoff no dice que haya que borrarla.

- [ ] **Step 2: Add supporting CSS**

Insertar después de la regla `.mm-header` existente (ubicarla con `grep -n "^  \.mm-header" index.html`, insertar inmediatamente después de su `}` de cierre):
```css
  .mm-header.mp-head {
    border-radius: 0 0 26px 26px; padding: 16px 18px 52px; margin: -18px -1.1rem 0;
  }
  @media (min-width: 860px) { .mm-header.mp-head { border-radius: 24px; margin: 0 0 -44px; padding: 22px 26px 60px; } }
  .mm-head-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .mm-hero-eyebrow-mp { font-size: 12.5px; font-weight: 600; opacity: .85; margin-top: 14px; }
  .mm-header.mp-head .mm-hero-amount { font-size: 42px; font-weight: 800; letter-spacing: -.03em; margin-top: 2px; }
  .mm-header.mp-head .mm-hero-sub { font-size: 12px; opacity: .8; }
  .mm-head-pills { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .mm-quick-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
    margin: -44px 1.1rem 18px; padding: 18px 12px; border-radius: 22px; position: relative; z-index: 2;
  }
  @media (min-width: 860px) { .mm-quick-grid { margin: -44px 0 22px; } }
```

- [ ] **Step 3: Implement `toggleBalanceOculto()`**

Agregar cerca de `toggleDesglose()` (ubicar con `grep -n "^function toggleDesglose" index.html`, insertar justo después de la llave de cierre de esa función):
```javascript
function toggleBalanceOculto() {
  const el = document.getElementById("mm-hero-amount");
  const icon = document.getElementById("mm-balance-eye-icon");
  const key = USUARIO + "_mm_balance_oculto";
  const oculto = el.dataset.oculto === "1";
  if (oculto) {
    el.textContent = el.dataset.valorReal || el.textContent;
    el.dataset.oculto = "0";
    localStorage.setItem(key, "0");
    icon?.setAttribute("data-lucide", "eye");
  } else {
    el.dataset.valorReal = el.textContent;
    el.textContent = "•••••";
    el.dataset.oculto = "1";
    localStorage.setItem(key, "1");
    icon?.setAttribute("data-lucide", "eye-off");
  }
  if (typeof lucide !== "undefined") lucide.createIcons();
}
```
Esto no toca `cargarPresupuesto()` — solo intercepta el nodo de texto ya renderizado, matcheando el comportamiento "Toggle ojo oculta/muestra el saldo" del handoff, descripto como puro estado de UI, sin dependencia de datos nueva.

- [ ] **Step 4: Verify**

```bash
grep -n 'id="mm-hero-amount"' index.html
grep -n "function toggleBalanceOculto" index.html
grep -n "function cargarPresupuesto" index.html
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');const re=/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(html))!==null){new Function(m[1]);}console.log('OK')"
node scripts/test-reparto.js
```
Expected: `#mm-hero-amount` aparece exactamente una vez como declaración de id (más sus referencias JS), `toggleBalanceOculto` definida una vez, `cargarPresupuesto` intacta/sigue presente, `OK`, tests pasan.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(mi-mes): MP-style color header, balance toggle, quick actions grid

Adds .mp-head hero with avatar/pill/eye-toggle and a 4-action quick
grid (Nueva/Gastos/Compartidos/Categorías) above the existing hero
card, per design_handoff_mp_style/README.md sección 1. No changes to
cargarPresupuesto() data flow — only markup/CSS around existing ids.
"
```

---

## Task 4: Transacciones (`page-transacciones`) — header, subtotal card, badges

**Files:**
- Modify: `index.html:2913-2923` (`.page-header` de Transacciones)
- Modify: `index.html:2970-2983` (wrapper `.tabla-subtotal`)
- Modify: `index.html:2093-2111` (CSS `.trans-mobile-item`, `.trans-mobile-badge`)
- Reference: `design_handoff_mp_style/README.md` §"2. Transacciones"

**Interfaces:**
- Consumes: `.mp-head`/`.mp-wbtn` de la Tarea 1; ids `#sub-neto`, `#sub-count`, `#sub-ingresos`, `#sub-gastos` poblados por `filtrarTabla()` existente — sin cambios.
- Produces: ningún id nuevo consumido por JS.

- [ ] **Step 1: Recolor "+ Nueva" button and search field per spec, keep structure**

En `index.html:2919-2921`, los botones CSV/Importar/+ Anotar ya usan `.btn-ghost`/`.btn-primary`, que ya dependen de tokens (sin valores de color literales — confirmar con `grep -n "class=\"btn btn-primary\"" index.html | head -1` que mapea a una regla CSS que usa `var(--accent)`). No hace falta cambio de markup acá; este step es una confirmación sin código — **no tocar markup de botones que ya funciona y ya hereda los tokens de la Tarea 1.**

- [ ] **Step 2: Restyle `.tabla-subtotal` to the glass card treatment from spec**

En `index.html:2970-2983`, el wrapper ya es `<div class="chart-card">` conteniendo `.tabla-subtotal` — ya hereda `--card`/`--border` de la Tarea 1. Agregar la tipografía "Neto del período" del spec (21px/800) editando la regla CSS en `index.html:559` (`.tabla-subtotal`, confirmada durante la exploración):
```bash
grep -n "^  \.sub-neto\s*{" index.html
```
Si existe una regla específica para `#sub-neto` con font-size/weight, actualizarla a:
```css
  #sub-neto { font-size: 21px; font-weight: 800; letter-spacing: -.02em; }
```
(Insertar esta regla inmediatamente después del bloque `.tabla-subtotal { ... }` en la línea 559 si todavía no existe una regla específica para `#sub-neto` — confirmar con el grep de arriba antes de decidir si es inserción o edición.)

- [ ] **Step 3: Badge colors for "G"/"I" transaction type — add classes, don't change generation logic**

Buscar el JS que genera el badge de la lista mobile (`grep -n "trans-mobile-badge" index.html` para el template de `innerHTML`, esperable cerca de la función equivalente a `renderTransaccionesMobileList()`). Confirmar que la lista de clases ya incluye una clase por tipo (ej. `t.tipo === 'Gasto' ? 'g' : 'i'`); si es así, agregar el CSS correspondiente (append después de `index.html:2111`):
```css
  .trans-mobile-badge.g { background: var(--neg-soft); color: var(--neg); }
  .trans-mobile-badge.i { background: var(--pos-soft); color: var(--pos); }
```

- [ ] **Step 4: Verify**

```bash
grep -n 'id="sub-neto"\|id="sub-count"\|id="sub-ingresos"\|id="sub-gastos"' index.html
grep -n "function filtrarTabla" index.html
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');const re=/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(html))!==null){new Function(m[1]);}console.log('OK')"
node scripts/test-reparto.js
```
Expected: los 4 ids presentes exactamente una vez cada uno, `filtrarTabla` sin cambios, `OK`, tests pasan.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "style(transacciones): verde bosque badges and subtotal typography

Cosmetic-only pass — CSS class additions for G/I badges and #sub-neto
typography per handoff sección 2. filtrarTabla() and all sub-* ids
untouched.
"
```

---

## Task 5: Compartidos (`page-compartidos`) — balance header con avatares

**Files:**
- Modify: `index.html:3138-3149` (`.page-header` Compartidos)
- Modify: `index.html:3174-3189` (`#comp-balance-card`)
- Modify: `index.html:619-660` (CSS `.comp-balance-card`)
- Reference: `design_handoff_mp_style/README.md` §"3. Compartidos"

**Interfaces:**
- Consumes: `.mp-avatar`, `.mp-head` de la Tarea 1; ids `#comp-balance-valor`, `#comp-balance-sub`, `#comp-registrar-btn` poblados por `cargarCompartidos()` — sin cambios.
- Produces: `.comp-avatars-row` (nueva, puramente decorativa, sin id).

- [ ] **Step 1: Add overlapping avatar pair above the balance**

En `index.html:3174-3178`, dentro de `#comp-balance-card`, antes de `.comp-balance-row`:
```html
          <div id="comp-balance-card" class="comp-balance-card" style="margin-bottom:0">
            <div class="comp-avatars-row">
              <div class="mp-avatar" id="comp-avatar-usuario">D</div>
              <div class="mp-avatar comp-avatar-partner" id="comp-avatar-partner">A</div>
            </div>
            <div class="comp-balance-row">
```
El contenido de texto de `#comp-avatar-usuario`/`#comp-avatar-partner` se setea una vez en el Step 2 (inicial estática, no depende de `cargarCompartidos()`) porque `USUARIO`/`PARTNER` ya son globales estables después del login (per `CLAUDE.md` §3).

- [ ] **Step 2: Populate avatar initials from `USUARIO`/`PARTNER`**

Ubicar la función que setea `sidebar-avatar`/`sidebar-user` (`grep -n "sidebar-avatar" index.html` → `index.html:4787`). Agregar dos líneas inmediatamente después de ese bloque, dentro de la misma función:
```javascript
  const compAvatarU = document.getElementById("comp-avatar-usuario");
  const compAvatarP = document.getElementById("comp-avatar-partner");
  if (compAvatarU) compAvatarU.textContent = (USUARIO || "?").charAt(0).toUpperCase();
  if (compAvatarP) compAvatarP.textContent = (PARTNER || "?").charAt(0).toUpperCase();
```
Nunca hardcodea `"Ama"` — ambas letras derivan de los globales dinámicos `USUARIO`/`PARTNER`, según las Global Constraints.

- [ ] **Step 3: CSS for avatar overlap + balance typography**

Insertar después de la regla `.comp-balance-card` (`index.html:619`, confirmar el `}` de cierre exacto con `grep -n "^  \.comp-balance-card" index.html`):
```css
  .comp-avatars-row { display: flex; margin-bottom: 10px; }
  .comp-avatars-row .mp-avatar { background: color-mix(in oklab, var(--brand) 22%, var(--surface)); color: var(--brand); border-color: var(--line); }
  .comp-avatar-partner { margin-left: -10px; background: color-mix(in oklab, var(--brand-2) 22%, var(--surface)) !important; color: var(--brand-2) !important; }
  .comp-balance-value { font-size: 44px; font-weight: 800; letter-spacing: -.03em; }
```
(Si `.comp-balance-value` ya tiene una regla de font-size en otra parte del archivo — confirmada durante la exploración en `index.html:1717` dentro del bloque `@media (max-width: 768px)` para un override *más chico* en mobile — esta nueva regla de scope desktop debe ir **antes** de la línea 1717 en el orden de cascada, es decir insertada cerca de `619` como se indica, no después de `1717`, para que el override mobile siga ganando en anchos chicos.)

- [ ] **Step 4: Verify**

```bash
grep -n 'id="comp-balance-valor"\|id="comp-avatar-usuario"\|id="comp-avatar-partner"' index.html
grep -n "function cargarCompartidos" index.html
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');const re=/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(html))!==null){new Function(m[1]);}console.log('OK')"
node scripts/test-reparto.js
```
Expected: ids de avatar nuevos presentes exactamente una vez, `cargarCompartidos` sin tocar, `OK`, tests pasan.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(compartidos): overlapping avatar pair on balance card

Avatars are populated from dynamic USUARIO/PARTNER globals, never
hardcoded — matches CLAUDE.md constraint on responsibility labels.
"
```

---

## Task 6: Categorías (`page-config`) — grid 2x2 desktop, glass cards

**Files:**
- Modify: `index.html:3640` (CSS `.cfg-grid`)
- Modify: `index.html:3646-3650` etc. (patrón `.cfg-add-row`, repetido 4x — CSS only)
- Reference: `design_handoff_mp_style/README.md` §"4. Categorías"

**Interfaces:**
- Consumes: solo tokens de la Tarea 1.
- Produces: nada nuevo — pasada puramente CSS, sin cambios de markup/id (el grid de 4 cards existente en `3640-3686` ya matchea la estructura del spec "4 grupos reales... grid 2×2 en desktop; lista en móvil").

- [ ] **Step 1: Confirm existing grid CSS and bump radius/gap to spec (22px radius, 12-14px gap)**

```bash
grep -n "^  \.cfg-grid\s*{" index.html
```
Actualizar esa regla a:
```css
  .cfg-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
  @media (min-width: 860px) { .cfg-grid { grid-template-columns: 1fr 1fr; gap: 14px; } }
```
(Si el archivo ya tiene una regla de 2 columnas para `.cfg-grid` en otro `@media (min-width: 860px)`, no duplicarla — editar la existente en su lugar, confirmado con un segundo `grep -n "\.cfg-grid" index.html` mostrando todas las ocurrencias antes de editar.)

- [ ] **Step 2: Round the "Agregar…" input per spec (radius 11, "glass hundido")**

```bash
grep -n "^  \.cfg-input\s*{" index.html
```
Actualizar a:
```css
  .cfg-input {
    border-radius: 11px; background: color-mix(in oklab, var(--surface) 60%, var(--bg));
    border: 1px solid var(--line); padding: .5rem .75rem; font: inherit; color: var(--text);
  }
```

- [ ] **Step 3: Round the "+ Agregar" button to a circle icon button per spec**

```bash
grep -n "^  \.cfg-add-btn\s*{" index.html
```
Actualizar a:
```css
  .cfg-add-btn {
    width: 38px; height: 38px; padding: 0; border-radius: 999px;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(150deg, var(--brand), var(--brand-2)); color: var(--brand-ink); border: none;
  }
```
Esto cambia el visual del botón a solo-ícono según el spec ("botón círculo con +") — el texto actual del botón es `+ Agregar` (`index.html:3648`); actualizar las 4 etiquetas de botón de `+ Agregar` a solo `+` para que entren en el círculo, ej. en `3648`:
```html
              <button class="btn btn-primary cfg-add-btn" onclick="agregarCategoria('GASTO')" aria-label="Agregar categoría de gasto">+</button>
```
Repetir de forma idéntica para los 3 botones hermanos en `3659`, `3670`, `3681`, cada uno manteniendo su propio argumento de `onclick` (`'INGRESO'`, `'FUENTE'`, `'FUENTE_TC'`) y agregando un `aria-label` correspondiente (accesibilidad, ya que el texto visible ahora es solo "+").

- [ ] **Step 4: Verify**

```bash
grep -n "agregarCategoria(" index.html
grep -c "cfg-add-btn" index.html
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');const re=/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(html))!==null){new Function(m[1]);}console.log('OK')"
node scripts/test-reparto.js
```
Expected: los 4 call-sites de `agregarCategoria(...)` intactos con sus argumentos sin cambios, conteo de `cfg-add-btn` sigue en 4, `OK`, tests pasan.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "style(categorias): glass card grid 2x2, circular add button

CSS-only pass; agregarCategoria() call sites and arguments unchanged.
Cuenta y Seguridad / Mi pareja sections inherit the same .chart-card
glass treatment automatically (not maquetado in the handoff, kept as-is
per Global Constraints).
"
```

---

## Task 7: Inversiones (`page-inversiones`) — hero patrimonio + plazo/acción cards

**Files:**
- Modify: `index.html:778-800` (CSS `.inv-hero-card`)
- Modify: `index.html:754` (CSS `.plazo-card`)
- Reference: `design_handoff_mp_style/README.md` §"5. Inversiones"

**Interfaces:**
- Consumes: tokens de la Tarea 1 (`--brand`, `--save`, `--pos`, `--neg`).
- Produces: nada nuevo — CSS-only, sin cambios de id/markup (ids existentes `#inv-hero-card`, `#plazo-lista`, `#accion-lista` y sus funciones generadoras `abrirFormPlazo()`/`abrirFormAccion()` sin tocar).

- [ ] **Step 1: Recolor hero gradient to the `.mp-head` verde treatment**

En `index.html:778-800` (`.inv-hero-card`), confirmar que el background actual es un gradiente que usa `var(--accent)`/`var(--brand-2)` (ya debería haber cambiado a verde vía la Tarea 1). Actualizarlo explícitamente a la receta de gradiente de `.mp-head` para paridad visual con el header de Mi mes:
```css
  .inv-hero-card {
    position: relative; overflow: hidden; border-radius: var(--r-lg);
    background: linear-gradient(150deg, oklch(0.42 0.12 172), oklch(0.55 0.135 148));
    color: #fff; padding: 22px 26px;
  }
  :root[data-theme='dark'] .inv-hero-card {
    background: linear-gradient(150deg, oklch(0.34 0.10 172), oklch(0.45 0.11 150));
  }
```
(Mantener la regla decorativa `::before` del círculo en `785` sin cambios — usa `rgba(255,255,255,...)` ya agnóstico de tema.)

- [ ] **Step 2: Badge % TNA color to `--save` per spec**

```bash
grep -n "TNA\|tna-badge\|plazo-badge" index.html | head -10
```
Confirmar que la clase del badge (esperable `.plazo-badge` o similar cerca de `.plazo-card` en `754`) usa `var(--save)` para color/background — si sigue hardcodeada, actualizar a:
```css
  .plazo-badge-tna { color: var(--save); background: color-mix(in oklab, var(--save) 16%, var(--surface)); border-radius: 999px; padding: 2px 9px; font-weight: 700; font-size: 11.5px; }
```
Aplicar esta clase en el markup solo si el markup actual del badge no tiene ya una clase dedicada (verificar con el grep de arriba antes de decidir si es edición o no-op).

- [ ] **Step 3: Verify**

```bash
grep -n 'id="inv-hero-card"\|id="plazo-lista"\|id="accion-lista"' index.html
grep -n "function abrirFormPlazo\|function abrirFormAccion" index.html
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');const re=/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(html))!==null){new Function(m[1]);}console.log('OK')"
node scripts/test-reparto.js
```
Expected: los 3 ids intactos, ambas funciones intactas, `OK`, tests pasan.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "style(inversiones): verde bosque hero gradient, TNA badge color

CSS-only. abrirFormPlazo()/abrirFormAccion() and live-price refresh
logic untouched.
"
```

---

## Task 8: Resumen (`page-resumen`) — evolución 12 meses (Chart.js colors)

**Files:**
- Modify: `index.html:2829-2862` (`.kpi-grid` / `.kpi-icon.ico-*` — confirmar que dependen de tokens, sin hex literal)
- Modify: donde se instancia `chartEvolCombo` (ubicar con `grep -n "chartEvolCombo\s*=" index.html`)
- Reference: `design_handoff_mp_style/README.md` §"6. Resumen"

**Interfaces:**
- Consumes: objeto `_C` de la Tarea 1 (ya recoloreado) para `chartEvolCombo`/`chartDonut`/`chartCat` — esta tarea verifica que esas instanciaciones de Chart.js referencian `_C.*` y no hex literal, y corrige las que no.
- Produces: nada nuevo.

- [ ] **Step 1: Audit `chartEvolCombo` for literal colors bypassing `_C`**

```bash
grep -n "chartEvolCombo" index.html
```
Leer las ~60 líneas alrededor de la instanciación y revisar cada valor `backgroundColor`/`borderColor`/`color:`. Cualquier hex/rgba literal que no referencie ya una clave de `_C` debe reemplazarse por la clave `_C` correspondiente (ej. un dataset de barras dibujado con `"#4ec476"` literal pasa a `_C.green`). Este step no tiene rango de línea fijo porque depende de lo que encuentre la auditoría — no adivinar números de línea, usar el output del grep de este step para ubicarlos.

- [ ] **Step 2: Verify KPI icon classes are token-driven (should already be, confirm no-op)**

```bash
grep -n "ico-green\|ico-red\|ico-accent\|ico-yellow" index.html
```
Confirmar que las reglas CSS en `index.html:438-441` usan `var(--green)`/`var(--red)`/`var(--accent)`/`var(--yellow)` (ya confirmado durante la exploración — este step es solo de verificación, sin edición esperada).

- [ ] **Step 3: Verify**

```bash
grep -n "function cargarResumenMes" index.html
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');const re=/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(html))!==null){new Function(m[1]);}console.log('OK')"
node scripts/test-reparto.js
```
Expected: `cargarResumenMes` presente, `OK`, tests pasan.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix(resumen): route any literal chart colors through _C constants

Ensures the evolución 12 meses mixed chart (chartEvolCombo) recolors
automatically with future theme changes, matching the pattern already
used by chartDonut/chartCat.
"
```

---

## Task 9: Nueva transacción (`page-nueva`) — toggle segmentado + botones

**Files:**
- Modify: `index.html:3024-3035` (markup `.tipo-toggle`, `.moneda-toggle` — sin cambios, CSS only)
- Modify: CSS de `.tipo-btn.active-expense`, `.tipo-btn.active-income` / `.active-ars`/`.active-usd` (ubicar con `grep -n "active-expense\|active-income" index.html`)
- Modify: `index.html:3127-3132` (botones Guardar/Cancelar)
- Reference: `design_handoff_mp_style/README.md` §"7. Nueva transacción"

**Interfaces:**
- Consumes: tokens de la Tarea 1 (`--neg` para Gasto, `--pos` para Ingreso, per spec: "activo relleno `--neg` (rojo) para Gasto, `--pos` (verde) para Ingreso").
- Produces: nada nuevo — `setTipo('Gasto'|'Ingreso')`, `setMoneda('ARS'|'USD')`, `guardarTransaccion()`, `#f-responsabilidad` (poblado por `inicializarRespButtons()`) todos sin tocar.

- [ ] **Step 1: Confirm and set toggle active-state colors to spec**

```bash
grep -n "active-expense\|active-income\|active-ars\|active-usd" index.html
```
Actualizar las reglas CSS encontradas (no tocar el HTML en `3024-3035`, los nombres de clase ya matchean `active-expense`/`active-ars` según el markup existente) a:
```css
  .tipo-btn.active-expense { background: var(--neg); color: #fff; }
  .tipo-btn.active-income  { background: var(--pos); color: #fff; }
  .moneda-btn.active-ars, .moneda-btn.active-usd { background: var(--brand); color: var(--brand-ink); }
```
(Si `.tipo-btn` usa nombres de clase activa distintos a los asumidos arriba, usar exactamente las clases devueltas por el grep — no inventar nombres nuevos; `setTipo()` togglea estas clases exactas vía `classList`, confirmar leyendo el JS de alrededor antes de editar.)

- [ ] **Step 2: Restyle Guardar/Cancelar buttons per spec (pill, flex 1/2, brand shadow)**

En `index.html:3127-3132`:
```html
          <div style="display:flex; gap:.75rem; margin-top:.5rem">
            <button class="btn btn-primary" id="btn-guardar" onclick="guardarTransaccion()">
              Guardar
            </button>
            <button class="btn btn-outline" onclick="navegarA('transacciones')">Cancelar</button>
          </div>
```
Reemplazar por:
```html
          <div class="form-nueva-actions">
            <button class="btn btn-outline form-nueva-cancel" onclick="navegarA('transacciones')">Cancelar</button>
            <button class="btn btn-primary form-nueva-guardar" id="btn-guardar" onclick="guardarTransaccion()">
              Guardar gasto
            </button>
          </div>
```
Nota: el texto del botón cambia de "Guardar" a "Guardar gasto" según la redacción exacta del spec — confirmar que `guardarTransaccion()` no lee `this.textContent` para decidir comportamiento (`grep -n "function guardarTransaccion" index.html` y leer su cuerpo) antes de asumir que esto es puramente cosmético; si la función efectivamente ramifica por el texto del botón (improbable pero hay que chequearlo), el binding de `onclick` por id sigue siendo la fuente de verdad y el cambio de label queda igual, porque `onclick` no depende del label.

Agregar el CSS de soporte (insertar cerca de las reglas `.form-card`/`.btn` existentes, ubicar con `grep -n "^  \.form-card\s*{" index.html`):
```css
  .form-nueva-actions { display: flex; gap: .75rem; margin-top: .5rem; }
  .form-nueva-cancel { flex: 1; }
  .form-nueva-guardar {
    flex: 2; border-radius: 999px;
    background: linear-gradient(150deg, var(--brand), var(--brand-2));
    box-shadow: 0 10px 28px color-mix(in oklab, var(--brand) 45%, transparent);
  }
```

- [ ] **Step 3: Verify**

```bash
grep -n 'id="btn-guardar"' index.html
grep -n "function guardarTransaccion" index.html
grep -n "function setTipo\|function setMoneda\|function inicializarRespButtons" index.html
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');const re=/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(html))!==null){new Function(m[1]);}console.log('OK')"
node scripts/test-reparto.js
```
Expected: `#btn-guardar` presente una vez, las 4 funciones intactas, `OK`, tests pasan.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "style(nueva): segmented Gasto/Ingreso toggle colors, pill CTA buttons

CSS + label text only. guardarTransaccion()/setTipo()/setMoneda()/
inicializarRespButtons() untouched; #f-responsabilidad still populated
dynamically with PARTNER, never hardcoded.
"
```

---

### Self-review (per writing-plans skill)

**1. Spec coverage** — cada sección del README tiene una tarea: §1 Mi mes → Task 3, §2 Transacciones → Task 4, §3 Compartidos → Task 5, §4 Categorías → Task 6, §5 Inversiones → Task 7, §6 Resumen → Task 8, §7 Nueva transacción → Task 9, §Navegación (sidebar/bottom-nav) → Task 2, §Design Tokens/Material glass → Task 1. Las dos áreas explícitamente no-maqueteadas (heatmap/recurrentes en Mi mes, Cuenta y Seguridad en Categorías) están señaladas en las Global Constraints y en las Tareas 3/6 en vez de omitirse en silencio.

**2. Placeholder scan** — sin "TBD"/"add validation"/"similar to Task N"; cada bloque CSS/HTML/JS es texto literal, copiable, con selectores exactos y valores `oklch()`/hex exactos tomados de `styles-mp-verde.css`/`styles-mp.css`. Los pocos steps frasados como "confirmar con grep, luego decidir" (Task 4 Step 1, Task 6 Step 1, Task 7 Step 2, Task 9 Step 1) son steps de auditoría, no implementación vaga — cada uno igual especifica el código de reemplazo exacto una vez encontrado el target del grep, porque los nombres de clase exactos de algunos componentes legacy (badges/TNA) no se confirmaron del todo durante la exploración y adivinarlos arriesgaría un no-op silencioso o un selector equivocado.

**3. Type/name consistency** — `navegarA()`, `toggleDesglose()`, `filtrarTabla()`, `cargarPresupuesto()`, `cargarCompartidos()`, `guardarTransaccion()`, `setTipo()`, `setMoneda()`, `inicializarRespButtons()`, `_C`, `PALETTE`, `USUARIO`, `PARTNER` se referencian de forma idéntica (mismo casing, misma firma) en todas las tareas donde aparecen. Los identificadores nuevos introducidos (`toggleBalanceOculto()`, `#mm-balance-toggle`, `.sidebar-cta`, `#sidebar-nueva-cta`, `.mp-head`/`.mp-action`/`.mp-avatar`/`.mp-wpill`/`.mp-wbtn`/`.mp-hbtn`, `.glassui`) se definen cada uno exactamente una vez (primitivas `.mp-*`/`.glassui` en la Tarea 1, CTA de sidebar en la Tarea 2, toggle de balance en la Tarea 3) y se consumen con nombres coincidentes en tareas posteriores (Tareas 3, 5, 7 reusan `.mp-avatar`/`.mp-head` de la Tarea 1 literal).

### Critical Files for Implementation
- `/Users/teamnucita/Documents/ProyectosClaude/finanzas-dashboard-live/index.html`
- `/Users/teamnucita/Documents/ProyectosClaude/finanzas-dashboard-live/design_handoff_mp_style/README.md`
- `/Users/teamnucita/Documents/ProyectosClaude/finanzas-dashboard-live/design_handoff_mp_style/styles-mp-verde.css`
- `/Users/teamnucita/Documents/ProyectosClaude/finanzas-dashboard-live/design_handoff_mp_style/styles-mp.css`
- `/Users/teamnucita/Documents/ProyectosClaude/finanzas-dashboard-live/scripts/test-reparto.js`
- `/Users/teamnucita/Documents/ProyectosClaude/finanzas-dashboard-live/.github/workflows/validate.yml`
</content>
