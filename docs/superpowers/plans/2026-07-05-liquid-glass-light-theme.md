# Tema Light — Liquid Glass Índigo Pastel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reactivar el toggle de tema (`toggleTheme()`) con un tema claro real — la misma estética liquid-glass del tema oscuro, adaptada a fondo claro con la paleta índigo pastel ya aprobada.

**Architecture:** Cambio de solo 2 bloques CSS en `index.html`: los tokens de `:root[data-theme='light']` (hoy idéntico al oscuro, por diseño de la Task 1 del rediseño anterior) y el fallback `@supports not (backdrop-filter)` que hoy usa un color sólido oscuro sin importar el tema. Ningún componente HTML/JS se toca — todo hereda vía las mismas variables CSS ya validadas en el rediseño oscuro.

**Tech Stack:** CSS puro (custom properties, `oklch()`, `color-mix()`, `@supports`). Sin JS, sin build pipeline.

## Global Constraints

- Sin build pipeline, sin frameworks — todo vive en `index.html` (de `CLAUDE.md`).
- No tocar `toggleTheme()`, `_setVariablesUsuario()`, ni ningún otro JS — cambio puramente de tokens CSS (de la spec, sección 2).
- No reintroducir la asociación fija Daniel=dark / Ama=light — el toggle queda disponible para cualquiera de los dos (de la spec, sección 2).
- No tocar el bloque `:root[data-theme='dark']` (de la spec, sección 2).

---

## Task 1: Tokens del tema light índigo pastel

**Files:**
- Modify: `index.html:115-166` (bloque `:root[data-theme='light']`)

**Interfaces:**
- Consumes: nada nuevo — reemplaza el bloque completo de tokens.
- Produces: las mismas variables CSS que ya consumen `.card`, `.chart-card`, `.kpi-card`, `.plazo-card`, `.comp-balance-card`, `.topnav`, `.bn-pill`, `.mm-hero`, `.inv-hero-card` y el resto del archivo — no se agregan variables nuevas, se reemplazan los valores.

- [ ] **Step 1: Reemplazar el bloque completo**

Ubicar (línea 115):
```css
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

Reemplazar por:
```css
  :root[data-theme='light'] {
    --bg:          #f5f1fb;
    --bg-grad:     radial-gradient(120% 80% at 80% -10%, #e4defb 0%, #f5f1fb 55%);
    --elev:        #ffffff;
    --surface:     rgba(122,116,232,0.16);
    --surface-2:   rgba(122,116,232,0.22);
    --surface-3:   rgba(122,116,232,0.30);
    --line:        rgba(60,50,140,0.14);
    --line-strong: rgba(60,50,140,0.22);
    --text:        #241f47;
    --text-dim:    #4a4570;
    --text-faint:  #7f76a0;
    --brand:       oklch(0.58 0.18 270);
    --brand-2:     oklch(0.62 0.19 285);
    --brand-ink:   #fff;
    --brand-soft:  color-mix(in oklab, var(--brand) 12%, #fff);
    --pos:         oklch(0.58 0.15 152);
    --neg:         oklch(0.56 0.18 25);
    --info:        oklch(0.55 0.16 252);
    --save:        oklch(0.56 0.12 195);
    --warn:        oklch(0.60 0.14 75);
    --pos-soft:    color-mix(in oklab, var(--pos) 12%, #fff);
    --neg-soft:    color-mix(in oklab, var(--neg) 12%, #fff);
    --shadow-card: 0 8px 22px rgba(90,70,180,.12), inset 0 1px 0 rgba(255,255,255,.5);
    --shadow-pop:  0 18px 50px rgba(90,70,180,.22);

    --bg2:         var(--surface-2);
    --bg3:         var(--surface-3);
    --card:        var(--surface);
    --border:      var(--line);
    --border2:     var(--line-strong);
    --accent:      var(--brand);
    --accent-dim:  var(--brand-soft);
    --accent-glow: color-mix(in oklab, var(--brand) 24%, transparent);
    --white:       var(--brand-ink);
    --overlay:     rgba(36,31,71,0.35);
    --green:       var(--pos);
    --green-dim:   var(--pos-soft);
    --red:         var(--neg);
    --red-dim:     var(--neg-soft);
    --yellow:      var(--warn);
    --yellow-dim:  color-mix(in oklab, var(--warn) 12%, #fff);
    --text-muted:  var(--text-dim);
    --radius:      var(--r-md);
    --shadow:      var(--shadow-card);
    --glass:       rgba(60,50,140,0.06);
    --glass-border:rgba(60,50,140,0.14);
    --card-blur:   16px;

    --accent-rgb:     92,  77, 214;
    --green-rgb:       63, 159,  95;
    --red-rgb:        200,  80,  58;
    --yellow-rgb:     168, 134,  42;
    --text-rgb:        36,  31,  71;
    --text-muted-rgb:  74,  69, 112;
    --card-rgb:       122, 116, 232;
  }
```

Nota: a diferencia del bloque dark (que hereda `--pos`/`--neg`/`--info`/`--save`/`--warn` del `:root` compartido), este bloque light **sí** los redefine — están calibrados para fondo claro, los del `:root` compartido pierden contraste sobre blanco/lavanda.

- [ ] **Step 2: Verificar sintaxis**

Run:
```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let ok = true;
scripts.forEach((s, i) => { try { new Function(s); } catch(e) { ok = false; console.log('Script', i, 'ERROR:', e.message); } });
console.log(ok ? 'ALL OK' : 'ERRORS FOUND');
"
```
Expected: `ALL OK`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(ui): tokens del tema light — liquid glass índigo pastel"
```

---

## Task 2: Fallback `@supports` correcto por tema

**Files:**
- Modify: `index.html:1378-1385` (bloque `@supports not (backdrop-filter: blur(1px))`)

**Interfaces:**
- Consumes: los tokens `--brand`/`--brand-2` de Task 1 (ya se resuelven distinto por tema automáticamente, no requieren cambios en esta tarea).
- Produces: nada nuevo.

El fallback para navegadores sin `backdrop-filter` hoy fuerza `background: #221c30` (un violeta oscuro sólido) sin importar el tema — correcto para dark, pero rompe el contraste en light (texto oscuro sobre fondo oscuro). El fallback de `.mm-hero`/`.inv-hero-card` no necesita cambios: ya usa `var(--brand)`/`var(--brand-2)`, que se resuelven distinto por tema automáticamente.

- [ ] **Step 1: Scopear el fallback sólido por tema**

Ubicar (línea 1378):
```css
  @supports not (backdrop-filter: blur(1px)) {
    .card, .chart-card, .kpi-card, .plazo-card, .comp-balance-card, .topnav, .bn-pill {
      background: #221c30;
    }
    .mm-hero, .inv-hero-card {
      background: linear-gradient(150deg, var(--brand) 0%, var(--brand-2) 100%);
    }
  }
```

Reemplazar por:
```css
  @supports not (backdrop-filter: blur(1px)) {
    :root[data-theme='dark'] .card, :root[data-theme='dark'] .chart-card, :root[data-theme='dark'] .kpi-card,
    :root[data-theme='dark'] .plazo-card, :root[data-theme='dark'] .comp-balance-card,
    :root[data-theme='dark'] .topnav, :root[data-theme='dark'] .bn-pill {
      background: #221c30;
    }
    :root[data-theme='light'] .card, :root[data-theme='light'] .chart-card, :root[data-theme='light'] .kpi-card,
    :root[data-theme='light'] .plazo-card, :root[data-theme='light'] .comp-balance-card,
    :root[data-theme='light'] .topnav, :root[data-theme='light'] .bn-pill {
      background: #ece7f7;
    }
    .mm-hero, .inv-hero-card {
      background: linear-gradient(150deg, var(--brand) 0%, var(--brand-2) 100%);
    }
  }
```

- [ ] **Step 2: Verificar sintaxis**

Run el mismo comando del Task 1 Step 2.
Expected: `ALL OK`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix(ui): fallback @supports correcto por tema (dark/light) sin backdrop-filter"
```

---

## Task 3: QA + push + PR

**Files:** ninguno nuevo — solo verificación.

- [ ] **Step 1: Verificación visual manual**

Abrir la app logueado, ir a Categorías → Cuenta y Seguridad (o donde esté el botón de tema) y tocar el toggle. Confirmar:
- El tema oscuro se ve igual que antes (índigo sobre fondo oscuro) — sin regresión.
- El tema claro ahora muestra vidrio índigo pastel sobre fondo lavanda claro, con texto oscuro legible, en las 6 pantallas (desktop y mobile).
- Verde/rojo (montos positivos/negativos) se ven con buen contraste sobre el vidrio claro.

- [ ] **Step 2: Push a rama feature y abrir PR**

```bash
git checkout -b feature/liquid-glass-light-theme
git push -u origin feature/liquid-glass-light-theme
gh pr create --title "feat(ui): tema light real — liquid glass índigo pastel" --body "$(cat <<'EOF'
## Summary
- Reactiva el toggle de tema con un tema claro real (antes era un no-op visual).
- Misma paleta índigo del tema oscuro, adaptada a fondo claro — ver spec docs/superpowers/specs/2026-07-05-liquid-glass-light-theme-design.md
- Fallback @supports sin backdrop-filter ahora es correcto por tema.
- Cambio puramente de tokens CSS — sin tocar JS ni el tema oscuro.

## Test plan
- [ ] Toggle de tema en desktop y mobile, confirmar ambos looks
- [ ] Recorrer las 6 pantallas en tema claro, confirmar contraste de texto y de verde/rojo
- [ ] Confirmar que el tema oscuro no cambió
EOF
)"
```

- [ ] **Step 3: Verificar checks de CI/Vercel**

```bash
gh pr checks --watch
```
Expected: checks de Vercel en verde. El check "review" puede seguir fallando por el problema preexistente de infraestructura (`claude: command not found`) — no bloquea.

---

## Self-Review

1. **Cobertura de la spec:** tokens light (Task 1) ✓, fallback @supports por tema (Task 2, spec sección 5) ✓, QA visual de las 6 pantallas en ambos temas (Task 3) ✓. No-goals respetados: no se tocó JS, no se tocó el tema dark, no se reintrodujo la asociación Daniel=dark/Ama=light.
2. **Placeholders:** ninguno — código completo en cada step.
3. **Consistencia:** los mismos 7 selectores de superficie compartida (`.card`, `.chart-card`, `.kpi-card`, `.plazo-card`, `.comp-balance-card`, `.topnav`, `.bn-pill`) se usan en Task 2 igual que en el rediseño oscuro original — no se inventan selectores nuevos.
