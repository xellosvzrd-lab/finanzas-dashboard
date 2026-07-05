# Tema Light — Liquid Glass Índigo Pastel

> Spec de diseño. Estado: aprobado por Daniel el 2026-07-05 tras revisión de mockup en el companion visual. Sigue directamente al spec `2026-07-05-liquid-glass-redesign-design.md`.

## 1. Objetivo

Reactivar el toggle de tema (`toggleTheme()`, hoy un no-op visual porque ambos bloques quedaron idénticos tras el rediseño índigo) con un **tema claro real**: la misma estética liquid-glass, con vidrio translúcido tintado en índigo sobre un fondo claro en vez de oscuro. No es un regreso al viejo tema de Ama — es la versión clara del mismo sistema de diseño nuevo.

## 2. Alcance

- Únicamente el bloque `:root[data-theme='light']` en `index.html`. El bloque `:root[data-theme='dark']` no se toca.
- Como todas las pantallas ya heredan su apariencia de las variables CSS (`--card`, `--surface`, `--brand`, etc.) y de las clases compartidas (`.card`, `.chart-card`, `.kpi-card`, `.mm-hero`, `.inv-hero-card`, etc.) — confirmado por el rediseño anterior — este cambio se propaga automáticamente a las 6 pantallas y ambos breakpoints sin tocar HTML ni JS.
- No se toca `toggleTheme()` ni `_setVariablesUsuario()` — el toggle ya funciona correctamente a nivel de código, solo faltaban valores distintos en el bloque light.

**Fuera de alcance:** volver a atar el tema por usuario (Daniel=dark fijo / Ama=light fijo). El toggle queda disponible para cualquiera de los dos — decisión ya tomada en el spec anterior (sección 3) de no reintroducir esa distinción.

## 3. Paleta — versión clara del índigo pastel

Mismo hue de marca (270, índigo) que el tema oscuro, pero con luminosidad/saturación ajustadas para fondo claro — mismo criterio que usaba el tema claro viejo de Ama antes del rediseño (verde/rojo/info/save más oscuros para mantener contraste sobre blanco), aplicado ahora al índigo.

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

  --accent-rgb:     92,  77, 214;   /* oklch(0.58 0.18 270) aprox. en sRGB */
  --green-rgb:       63, 159,  95;
  --red-rgb:        200,  80,  58;
  --yellow-rgb:     168, 134,  42;
  --text-rgb:        36,  31,  71;
  --text-muted-rgb:  74,  69, 112;
  --card-rgb:       122, 116, 232;
}
```

Nota sobre `--pos`/`--neg`/`--info`/`--save`/`--warn`: a diferencia del tema oscuro (que hereda estos valores del `:root` base compartido, sección 4 del spec anterior), el tema claro **sí** los redefine — igual que hacía el tema claro viejo — porque los valores del `:root` base están calibrados para fondo oscuro y pierden contraste sobre blanco/lavanda claro.

## 4. Comportamiento heredado (sin cambios de código)

- `.card`, `.chart-card`, `.kpi-card`, `.plazo-card`, `.comp-balance-card`, `.topnav`, `.bn-pill`: ya tienen `backdrop-filter` (de la Task 2 del rediseño anterior) y ya leen `var(--card)`/`var(--surface)` — con los nuevos valores heredan el vidrio claro automáticamente.
- `.mm-hero`, `.inv-hero-card`: el `::before` especular (blanco puro `rgba(255,255,255,.3)`) sigue funcionando igual de bien sobre fondo claro — el blanco puro sigue siendo más claro que el tinte índigo de fondo, el brillo se sigue notando.
- `@supports not (backdrop-filter)` fallback: el bloque existente usa `background: #221c30` (oscuro) para las 7 superficies y el gradiente de marca para los heroes — **ese fallback está pensado para el tema oscuro**. Para el tema claro necesita su propio fallback sólido claro (ver sección 5, es lo único que requiere un ajuste de CSS fuera del bloque de tokens).

## 5. Ajuste necesario fuera del bloque de tokens

El bloque `@supports not (backdrop-filter: blur(1px))` (agregado en la Task 2 del rediseño anterior) hoy fuerza `background: #221c30` sin importar el tema — eso rompe el tema claro en navegadores sin soporte de `backdrop-filter` (texto oscuro sobre fondo oscuro). Hay que scopear ese fallback por atributo de tema:

```css
:root[data-theme='dark'] .card, :root[data-theme='dark'] .chart-card, /* ...selectores existentes... */ { background: #221c30; }
:root[data-theme='light'] .card, :root[data-theme='light'] .chart-card, /* ...mismos selectores... */ { background: #ece7f7; }
```

(el detalle exacto de esta regla se resuelve en el plan de implementación, no es una decisión de diseño — el color sólido claro debe ser un tono lavanda pálido opaco, consistente con `--bg`).

## 6. No-goals

- No se reintroduce la asociación fija Daniel=dark / Ama=light.
- No se toca ningún JS (`toggleTheme`, `_setVariablesUsuario`, ni el objeto `_C`/`PALETTE` de los gráficos — esos ya son colores fijos usados en ambos temas, no dependen de `data-theme`, y no fueron parte de esta decisión de diseño).
- No se agregan mockups nuevos por pantalla — el mecanismo de herencia por variables ya está validado por el rediseño oscuro; alcanza con la validación a escala completa de "Mi mes" hecha en el companion visual.
