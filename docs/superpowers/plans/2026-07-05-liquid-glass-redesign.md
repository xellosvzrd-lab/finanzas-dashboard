# Rediseño Liquid Glass (paleta índigo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar el lenguaje visual "liquid glass" (paneles translúcidos con blur + tinte índigo) a las 6 pantallas del dashboard (Mi mes, Transacciones, Compartidos, Categorías, Inversiones, Resumen), en desktop y mobile, unificando el tema Daniel/Ama en un solo look.

**Architecture:** `index.html` ya centraliza casi todo el color/superficie en variables CSS (`--brand`, `--surface`, `--card`, `--border`, etc.) consumidas por un puñado de clases base (`.card`, `.chart-card`, `.kpi-card`, `.plazo-card`, `.comp-balance-card`, `.topnav`, `.bn-pill`) que casi todas las pantallas reutilizan vía `class="card mm-xxx"`. Por eso el 90% del cambio visual se logra editando esas ~10 definiciones compartidas en vez de tocar cada pantalla — sigue el patrón DRY que el archivo ya usa, no lo rompe.

**Tech Stack:** HTML/CSS/JS vanilla, sin build pipeline, un único archivo `index.html` (~10.300 líneas). `backdrop-filter` (con prefijo `-webkit-`) para el efecto de vidrio, `oklch()` para color (ya usado en el archivo).

## Global Constraints

- Sin build pipeline, sin npm, sin frameworks — todo vive en `index.html` (de `CLAUDE.md` del repo).
- No tocar lógica de negocio, cálculos, ni esquema de datos — cambio puramente visual/CSS (de la spec, sección 1).
- No agregar features nuevas "mientras estamos" (de `feedback_finanzas_approach` — no abstracciones ni features no pedidas).
- Verde = positivo/ingreso y Rojo = negativo/gasto son intocables — no repurposear estos tokens (de la spec, sección 4).
- Trabajar en rama `feature/*`, push → Vercel preview → PR a `main` (workflow del proyecto).
- Modales, toasts, tooltips y dropdowns quedan fuera de esta pasada — los 12 mockups aprobados no los incluyeron (ver spec, sección 2 "Alcance").

---

## Task 1: Unificar tokens de color — tema único con índigo

**Files:**
- Modify: `index.html:59-170` (bloques `:root[data-theme='dark']` y `:root[data-theme='light']`)

**Interfaces:**
- Consumes: nada (es la base del sistema de color).
- Produces: variables CSS (`--bg`, `--bg-grad`, `--surface`, `--surface-2`, `--surface-3`, `--line`, `--line-strong`, `--text`, `--text-dim`, `--text-faint`, `--brand`, `--brand-2`, `--card`, `--border`, `--border2`, `--accent`, `--accent-dim`, `--glass`, `--glass-border`, `--accent-rgb`, etc.) que consumen todas las tareas siguientes y todo el CSS existente del archivo.

Hoy `[data-theme='dark']` (Daniel) y `[data-theme='light']` (Ama) tienen paletas opuestas (fondo oscuro vs. fondo blanco). La spec (sección 3) aprueba unificar en un solo tema — ambos atributos deben renderizar **exactamente igual** para no tocar el botón de toggle ni el JS que setea `data-theme` (`toggleTheme()` en `index.html:8414`, `_setVariablesUsuario` en `index.html:4396-4398`). Dejamos ese JS intacto: el botón sigue funcionando, simplemente ya no cambia nada visualmente.

- [ ] **Step 1: Reemplazar el bloque `:root[data-theme='dark']` (líneas 59-111)**

Reemplazar el contenido completo (identificado por `grep -n "data-theme='dark'" index.html` → línea 59) con:

```css
  /* ─── TEMA ÚNICO — Liquid Glass índigo (unifica Daniel/Ama) ── */
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
    --glass:       rgba(255,255,255,0.07);
    --glass-border:rgba(255,255,255,0.15);
    --card-blur:   16px;

    /* RGB splits para rgba() */
    --accent-rgb:     122, 116, 232;
    --green-rgb:       78, 196, 118;
    --red-rgb:        229, 110,  74;
    --yellow-rgb:     210, 188,  58;
    --text-rgb:       244, 241, 250;
    --text-muted-rgb: 179, 170, 198;
    --card-rgb:       122, 116, 232;
  }
```

- [ ] **Step 2: Reemplazar el bloque `:root[data-theme='light']` (antiguas líneas 113-170) con el mismo tema**

El tema "light" pasa a ser un alias idéntico al de arriba — así el botón de toggle (`toggleTheme()`) sigue funcionando sin errores pero no cambia nada visualmente:

```css
  /* ─── TEMA ÚNICO (alias) — el toggle Daniel/Ama ya no cambia look ── */
  :root[data-theme='light'] {
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
    --glass:       rgba(255,255,255,0.07);
    --glass-border:rgba(255,255,255,0.15);
    --card-blur:   16px;

    --accent-rgb:     122, 116, 232;
    --green-rgb:       78, 196, 118;
    --red-rgb:        229, 110,  74;
    --yellow-rgb:     210, 188,  58;
    --text-rgb:       244, 241, 250;
    --text-muted-rgb: 179, 170, 198;
    --card-rgb:       122, 116, 232;
  }
```

- [ ] **Step 3: Verificar sintaxis del archivo**

Run: `node -e "require('fs').readFileSync('index.html','utf8')" && echo "leído OK"` — solo confirma que el archivo sigue siendo legible como texto (no valida CSS). Para validar el CSS, abrir el archivo en un navegador y confirmar que no hay errores en la consola relacionados a `data-theme` (Paso 5).

- [ ] **Step 4: Verificar que no quedaron valores de la paleta vieja**

Run: `grep -n "oklch(0.74 0.15 300)\|oklch(0.58 0.18 300)\|#efe7ff\|#f4f1fb" index.html`
Expected: sin resultados (0 matches) — si aparece algo, es un resabio del tema viejo que hay que limpiar antes de seguir.

- [ ] **Step 5: Verificación visual manual**

Abrir `index.html` en el navegador (o el preview de Vercel una vez pusheada la rama), loguearse, y confirmar:
1. El fondo es oscuro con degradé índigo (no violeta magenta, no blanco).
2. Tocar el botón de cambiar tema (ícono en Categorías → Cuenta y Seguridad, o donde esté `#btn-theme-toggle`) y confirmar que **no cambia nada visualmente** (ambos estados son iguales — esperado).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(ui): unificar tema Daniel/Ama en paleta índigo única"
```

---

## Task 2: Vidrio translúcido en las superficies compartidas

**Files:**
- Modify: `index.html:174-179` (`.card`)
- Modify: `index.html:391-400` (`.kpi-card`)
- Modify: `index.html:474-479` (`.chart-card`)
- Modify: `index.html:724` (`.plazo-card`)
- Modify: `index.html:591-...` (`.comp-balance-card` — confirmar rango exacto con `grep -n "\.comp-balance-card" index.html`)
- Modify: `index.html:1786-1797` (`.topnav`)
- Modify: `index.html:1353-1359` (`.bn-pill`)

**Interfaces:**
- Consumes: `--card-blur` de Task 1.
- Produces: nada nuevo — mismas clases, mismo HTML, solo se ven translúcidas con blur.

Estas 7 selectores ya usan `background: var(--card)` o `var(--surface)` (ahora translúcido por Task 1) — solo falta el `backdrop-filter` para que el blur real aparezca, más un fallback para navegadores sin soporte.

- [ ] **Step 1: Agregar `backdrop-filter` a `.card`**

Ubicar (línea ~174):
```css
  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-card);
  }
```

Reemplazar por:
```css
  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-card);
    backdrop-filter: blur(var(--card-blur)) saturate(160%);
    -webkit-backdrop-filter: blur(var(--card-blur)) saturate(160%);
  }
```

- [ ] **Step 2: Mismo tratamiento en `.kpi-card` (línea ~391)**

Ubicar:
```css
  .kpi-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1rem 1.1rem;
    min-width: 0;
    container-type: inline-size;
    position: relative; overflow: hidden;
    transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
    animation: fadeUp .45s var(--ease-out) both;
  }
```

Agregar las dos líneas de `backdrop-filter` justo después de `background: var(--card);`:
```css
  .kpi-card {
    background: var(--card);
    backdrop-filter: blur(var(--card-blur)) saturate(160%);
    -webkit-backdrop-filter: blur(var(--card-blur)) saturate(160%);
    border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1rem 1.1rem;
    min-width: 0;
    container-type: inline-size;
    position: relative; overflow: hidden;
    transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
    animation: fadeUp .45s var(--ease-out) both;
  }
```

- [ ] **Step 3: Mismo tratamiento en `.chart-card` (línea ~474)**

Ubicar:
```css
  .chart-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1.4rem;
    transition: border-color .25s;
  }
```

Reemplazar por:
```css
  .chart-card {
    background: var(--card);
    backdrop-filter: blur(var(--card-blur)) saturate(160%);
    -webkit-backdrop-filter: blur(var(--card-blur)) saturate(160%);
    border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1.4rem;
    transition: border-color .25s;
  }
```

- [ ] **Step 4: Mismo tratamiento en `.plazo-card` (línea 724) — Inversiones**

Ubicar (es una sola línea):
```css
  .plazo-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.1rem; margin-bottom: .65rem; box-shadow: var(--shadow); transition: border-color .18s, box-shadow .18s; }
```

Reemplazar por:
```css
  .plazo-card { background: var(--card); backdrop-filter: blur(var(--card-blur)) saturate(160%); -webkit-backdrop-filter: blur(var(--card-blur)) saturate(160%); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.1rem; margin-bottom: .65rem; box-shadow: var(--shadow); transition: border-color .18s, box-shadow .18s; }
```

- [ ] **Step 5: Mismo tratamiento en `.comp-balance-card` — Compartidos (línea 591)**

Ubicar:
```css
  .comp-balance-card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: 1.2rem 1.6rem;
    margin-bottom: 1.25rem;
    box-shadow: var(--shadow-card);
    display: flex; flex-direction: column; gap: 1rem;
    transition: background .25s, border-color .25s;
```

Reemplazar por:
```css
  .comp-balance-card {
    background: var(--surface);
    backdrop-filter: blur(var(--card-blur)) saturate(160%);
    -webkit-backdrop-filter: blur(var(--card-blur)) saturate(160%);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: 1.2rem 1.6rem;
    margin-bottom: 1.25rem;
    box-shadow: var(--shadow-card);
    display: flex; flex-direction: column; gap: 1rem;
    transition: background .25s, border-color .25s;
```

(la línea de cierre `}` que sigue, no incluida arriba, queda sin cambios).

- [ ] **Step 6: Vidrio en la navegación desktop — `.topnav` (línea ~1786)**

Ubicar:
```css
  .topnav {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0 1.8rem;
    background: var(--card);
    border-bottom: 1px solid var(--border);
    height: 62px;
    position: sticky;
    top: 0;
    z-index: 100;
  }
```

Reemplazar por:
```css
  .topnav {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0 1.8rem;
    background: var(--card);
    backdrop-filter: blur(var(--card-blur)) saturate(160%);
    -webkit-backdrop-filter: blur(var(--card-blur)) saturate(160%);
    border-bottom: 1px solid var(--border);
    height: 62px;
    position: sticky;
    top: 0;
    z-index: 100;
  }
```

- [ ] **Step 7: Vidrio en la navegación mobile — `.bn-pill` (línea ~1353)**

Ubicar:
```css
  .bn-pill {
    display: flex; align-items: center; justify-content: space-between;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 24px; padding: 10px 16px;
    box-shadow: var(--shadow-card);
    pointer-events: all;
  }
```

Reemplazar por:
```css
  .bn-pill {
    display: flex; align-items: center; justify-content: space-between;
    background: var(--surface); border: 1px solid var(--line);
    backdrop-filter: blur(var(--card-blur)) saturate(160%);
    -webkit-backdrop-filter: blur(var(--card-blur)) saturate(160%);
    border-radius: 24px; padding: 10px 16px;
    box-shadow: var(--shadow-card);
    pointer-events: all;
  }
```

No hace falta tocar `.bn-item` — ya usa `flex: 1` (línea 1360), reparte el espacio parejo entre los 4 tabs sin cambios.

- [ ] **Step 8: Fallback para navegadores sin `backdrop-filter`**

Agregar este bloque nuevo justo después del cierre de `.bn-pill` (fin del Step 7):

```css
  /* Fallback sin blur — el vidrio se vuelve panel semi-opaco sólido */
  @supports not (backdrop-filter: blur(1px)) {
    .card, .chart-card, .kpi-card, .plazo-card, .comp-balance-card, .topnav, .bn-pill {
      background: #221c30;
    }
  }
```

- [ ] **Step 9: Verificación visual manual**

Abrir la app en el navegador (Chrome/Safari soportan `backdrop-filter` nativamente): confirmar que las cards de KPI, las tablas (`.chart-card`), los plazos fijos, el balance de Compartidos, la barra de nav superior y la bottom-nav mobile se ven translúcidas con blur sobre el fondo con degradé, no como paneles sólidos opacos.

- [ ] **Step 10: Commit**

```bash
git add index.html
git commit -m "feat(ui): backdrop-filter en superficies compartidas (.card, .chart-card, .kpi-card, nav)"
```

---

## Task 3: Brillo especular en las cards "hero"

**Files:**
- Modify: `index.html:1414-1420` (`.mm-hero`)
- Modify: `index.html:748-751` (`.inv-hero-card`)

**Interfaces:**
- Consumes: `--brand`, `--brand-2` de Task 1.
- Produces: nada nuevo — mismo HTML.

Ambas clases hoy son un bloque de color sólido (`linear-gradient(var(--brand), var(--brand-2))`), no vidrio. La spec (sección 7) pide que las cards destacadas (hero de "Mi mes", patrimonio de "Inversiones") tengan vidrio + brillo especular arriba, no color sólido opaco.

- [ ] **Step 1: Convertir `.mm-hero` a vidrio con brillo (línea 1414)**

Ubicar:
```css
  .mm-hero {
    border-radius: 28px; padding: 24px 22px;
    position: relative; overflow: hidden; color: #fff;
    background: linear-gradient(150deg, var(--brand) 0%, var(--brand-2) 100%);
    box-shadow: 0 18px 40px color-mix(in oklab, var(--brand) 40%, transparent);
    margin-bottom: 12px;
  }
```

Reemplazar por:
```css
  .mm-hero {
    border-radius: 28px; padding: 24px 22px;
    position: relative; overflow: hidden; color: #fff;
    background: linear-gradient(155deg, color-mix(in oklab, var(--brand) 45%, transparent) 0%, color-mix(in oklab, var(--brand-2) 20%, transparent) 100%);
    backdrop-filter: blur(var(--card-blur)) saturate(160%);
    -webkit-backdrop-filter: blur(var(--card-blur)) saturate(160%);
    border: 1px solid rgba(255,255,255,0.18);
    box-shadow: 0 18px 40px color-mix(in oklab, var(--brand) 30%, transparent), inset 0 1px 0 rgba(255,255,255,.25);
    margin-bottom: 12px;
  }
  .mm-hero::before {
    content: "";
    position: absolute; top: 0; left: 6%; right: 6%; height: 36%;
    background: linear-gradient(180deg, rgba(255,255,255,.3), rgba(255,255,255,0));
    border-radius: 28px 28px 60% 60%;
    pointer-events: none;
  }
```

- [ ] **Step 2: Mismo tratamiento en `.inv-hero-card` (línea 748)**

Ubicar:
```css
  .inv-hero-card   { position: relative; overflow: hidden; border-radius: var(--r-lg);
                      padding: 24px 28px; color: #fff;
                      background: linear-gradient(140deg, var(--brand) 0%, var(--brand-2) 100%);
                      box-shadow: 0 18px 44px color-mix(in oklab, var(--brand) 38%, transparent); }
```

Reemplazar por:
```css
  .inv-hero-card   { position: relative; overflow: hidden; border-radius: var(--r-lg);
                      padding: 24px 28px; color: #fff;
                      background: linear-gradient(155deg, color-mix(in oklab, var(--brand) 45%, transparent) 0%, color-mix(in oklab, var(--brand-2) 20%, transparent) 100%);
                      backdrop-filter: blur(var(--card-blur)) saturate(160%);
                      -webkit-backdrop-filter: blur(var(--card-blur)) saturate(160%);
                      border: 1px solid rgba(255,255,255,0.18);
                      box-shadow: 0 18px 44px color-mix(in oklab, var(--brand) 28%, transparent), inset 0 1px 0 rgba(255,255,255,.25); }
  .inv-hero-card::before {
    content: "";
    position: absolute; top: 0; left: 6%; right: 6%; height: 36%;
    background: linear-gradient(180deg, rgba(255,255,255,.3), rgba(255,255,255,0));
    border-radius: var(--r-lg) var(--r-lg) 60% 60%;
    pointer-events: none;
  }
```

Nota: el `::before` de cada clase no choca con el orb decorativo existente (`.mm-hero-orb`, y el `div` inline con `border-radius:999px` dentro de `.inv-hero-card` en `index.html:3535`) porque esos son elementos hijos reales, no pseudo-elementos — ambos coexisten sin conflicto de z-index ya que el `::before` no tiene `z-index` explícito y el contenido de texto sigue teniendo `position: relative` (ya presente en `.mm-hero-eyebrow`, `.mm-hero-amount`, etc.) por lo que queda por encima en el stacking order normal.

- [ ] **Step 3: Verificación visual manual**

Abrir "Mi mes" y confirmar que el hero "Te queda para gastar" se ve como vidrio (se nota el fondo con degradé detrás, atenuado) con un brillo sutil arriba, no como un bloque de color sólido plano. Repetir en "Inversiones" con la card de patrimonio.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(ui): brillo especular en hero cards (Mi mes, Inversiones)"
```

---

## Task 4: Alinear colores de gráficos (Resumen) con la paleta índigo

**Files:**
- Modify: `index.html:4005-4020` (objeto `_C`)
- Modify: `index.html:4023-4036` (`PALETTE`)

**Interfaces:**
- Consumes: nada (son valores hex hardcodeados, no leen variables CSS).
- Produces: colores usados por `chartCat` (línea 4924), `chartDonut` (línea 4954), y el mini-bar inline de `renderTopGastos` (línea 5049).

El objeto `_C` (línea 4005) tiene colores hardcodeados de una paleta terracota vieja (`muted:"#8C7B72"`, `accent:"#C8845A"`, `green:"#5A8C6B"`, `red:"#C85A5A"`) que **no coinciden** con los tokens CSS actuales (`--green`/`--red` ya son otro verde/rojo desde antes de este proyecto). Esto hace que los gráficos de "Resumen" muestren colores desalineados del resto de la UI. Corresponde arreglarlo ahora porque "Resumen" es una de las 6 pantallas en alcance y sus gráficos usan estos valores directamente.

- [ ] **Step 1: Actualizar `_C` con los tokens vigentes**

Ubicar (línea 4005):
```javascript
const _C = {
  muted:      "#8C7B72",   // var(--text-muted)
  grid:       "rgba(45,41,38,0.06)",
  accent:     "#C8845A",   // var(--accent)
  green:      "#5A8C6B",   // var(--green)
  greenA75:   "rgba(90,140,107,.75)",
  greenA65:   "rgba(90,140,107,.65)",
  greenA90:   "rgba(90,140,107,.9)",
  red:        "#C85A5A",   // var(--red)
  redA75:     "rgba(200,90,90,.75)",
  redA65:     "rgba(200,90,90,.65)",
  redA90:     "rgba(200,90,90,.9)",
  accentA13:  "rgba(200,132,90,.13)",
  greenChart: "rgba(52,211,153,0.7)",
  redChart:   "rgba(248,113,113,0.7)",
};
```

Reemplazar por:
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

- [ ] **Step 2: Actualizar el swatch "brand" de `PALETTE`**

Ubicar (línea 4023):
```javascript
const PALETTE = [
  "#A070D5",  // brand   — violeta
  "#6680DC",  // info    — azul índigo
```

Reemplazar la primera línea por:
```javascript
const PALETTE = [
  "#7A74E8",  // brand   — índigo
  "#6680DC",  // info    — azul índigo
```

El resto de `PALETTE` (líneas 4025-4035) queda igual — es una paleta categórica para distinguir categorías en el gráfico de barras, no necesita rediseño completo, solo que el primer swatch (el que representa "marca") esté alineado.

- [ ] **Step 3: Verificación visual manual**

Ir a "Resumen", confirmar que el gráfico de dona ("Ingresos vs Gastos") usa el verde/rojo nuevos (no el verde/rojo apagado de antes) y que el gráfico de barras por categoría usa el índigo como uno de los colores en vez del violeta viejo.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix(resumen): alinear colores de gráficos Chart.js con la paleta índigo vigente"
```

---

## Task 5: QA cruzado de las 6 pantallas + push + PR

**Files:** ninguno nuevo — solo verificación.

**Interfaces:** N/A — tarea de verificación final.

- [ ] **Step 1: Verificar sintaxis JS/HTML completa**

Run:
```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let ok = true;
scripts.forEach((s, i) => {
  try { new Function(s); } catch(e) { ok = false; console.log('Script block', i, 'ERROR:', e.message); }
});
console.log(ok ? 'ALL OK' : 'ERRORS FOUND');
"
```
Expected: `ALL OK`

- [ ] **Step 2: Recorrido visual manual — desktop**

Con la ventana del navegador en ancho de escritorio (≥1200px), recorrer las 6 pestañas (Mi mes, Transacciones, Compartidos, Categorías, Inversiones, Resumen) y confirmar en cada una:
- El fondo general es el degradé índigo oscuro, no violeta magenta ni blanco.
- Las cards/tablas se ven translúcidas con blur visible sobre el fondo, no sólidas.
- El texto sigue siendo legible (buen contraste) sobre el vidrio.
- Los montos verdes (ingresos/a favor) y rojos (gastos/en contra) se ven con los tonos nuevos (#4ec476 / #e56e4a), no los terracota viejos.

- [ ] **Step 3: Recorrido visual manual — mobile**

Con devtools en modo responsive (390×844 o similar) o en un teléfono real, repetir el recorrido de las 6 pantallas. Confirmar además:
- La bottom-nav se ve como una píldora de vidrio flotante abajo, con los 4 tabs parejos y el FAB central integrado.
- Ninguna card se corta o desborda el ancho de pantalla (`overflow-x` no debería aparecer en el body).

- [ ] **Step 4: Push a rama feature y abrir PR**

Ya se trabajó sobre la rama `feature/liquid-glass-redesign` (creada antes de Task 1) — no hace falta crearla de nuevo, solo pushear:

```bash
git push -u origin feature/liquid-glass-redesign
gh pr create --title "feat(ui): rediseño liquid glass — paleta índigo" --body "$(cat <<'EOF'
## Summary
- Unifica el tema Daniel/Ama en un solo look índigo con vidrio translúcido (liquid glass).
- Aplica backdrop-filter + brillo especular a las superficies compartidas (.card, .chart-card, .kpi-card, .plazo-card, .comp-balance-card, nav).
- Alinea los colores de los gráficos de Resumen (Chart.js) con la paleta vigente.
- Cambio puramente visual — sin tocar lógica de negocio ni esquema de datos. Ver spec: docs/superpowers/specs/2026-07-05-liquid-glass-redesign-design.md

## Test plan
- [ ] Recorrer las 6 pantallas en desktop y confirmar el vidrio + paleta índigo
- [ ] Recorrer las 6 pantallas en mobile (390px) y confirmar bottom-nav + sin overflow
- [ ] Confirmar que el botón de cambiar tema no rompe nada (ambos estados iguales)
- [ ] Confirmar que los montos verdes/rojos se ven con el tono nuevo en Resumen
EOF
)"
```

- [ ] **Step 5: Verificar checks de CI/Vercel**

```bash
gh pr checks --watch
```
Expected: los checks de Vercel (preview deploy) en verde. Si aparece el check "review" en rojo con error `claude: command not found`, es un problema de infraestructura preexistente no relacionado a este cambio (ver conversación previa) — no bloquea el merge.

---

## Self-Review (completado por quien escribió este plan)

1. **Cobertura de la spec:** tokens de color (Task 1) ✓, componente base de vidrio (Task 2) ✓, brillo especular en heroes (Task 3) ✓, gráficos Chart.js (Task 4) ✓, QA de las 6 pantallas + ambos breakpoints (Task 5) ✓, fallback sin `backdrop-filter` (Task 2 Step 8) ✓, tema único sin tocar JS (Task 1) ✓. Los componentes list/table específicos por pantalla (Transacciones lista mobile, Compartidos tablas, Categorías grid, Inversiones asignación) no necesitan tareas propias porque heredan el vidrio automáticamente al usar `.card`/`.chart-card`/`.plazo-card`/`.comp-balance-card` como base — confirmado por grep de `class="card ` y `class="chart-card` en el archivo real.
2. **Placeholders:** ninguno — todo el código de cada step es completo y copiable.
3. **Consistencia de nombres:** `--card-blur` se define en Task 1 y se consume igual en Tasks 2 y 3; `_C` y `PALETTE` se referencian con los mismos nombres exactos que ya existen en el archivo (líneas 4005 y 4023).
