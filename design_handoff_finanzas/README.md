# Handoff: Rediseño Dashboard Finanzas

> Paquete de handoff para implementar el rediseño en un codebase real usando Claude Code.

---

## 0. Cómo usar este paquete (leer primero)

Los archivos de este bundle son **referencias de diseño hechas en HTML/React-via-Babel** — prototipos que muestran el look & feel y el comportamiento buscado. **No son código de producción para copiar tal cual.**

La tarea es **recrear estos diseños en el entorno del codebase existente** (la app actual está en Vercel; presumiblemente React/Next.js) usando sus patrones, su router y sus librerías. Si todavía no hay un sistema de componentes, se puede elegir el stack más apropiado (recomendado: **React + Tailwind**, o CSS variables como acá) e implementar ahí.

**Fidelidad: ALTA (hi-fi).** Colores, tipografía, espaciados e interacciones están definidos. Recrear pixel-perfect respetando los tokens de la sección 3.

### Orden sugerido de implementación
1. Cargar los **design tokens** (sección 3) como CSS variables o config de Tailwind. Soportar **dark/light** desde el día 1 (`data-theme` en `<html>`).
2. Cargar las **fuentes** (sección 4).
3. Construir los **primitivos** (sección 5): Card, Chip, Button, Bar, Ring, Donut, Spark, MonthBars.
4. Armar el **AppShell** desktop (sidebar + topbar) y el **MobileShell** (header + bottom nav).
5. Implementar pantallas en este orden: **Mi mes** (la estrella) → Resumen → Transacciones → Compartidos → Categorías → Inversiones.

---

## 1. Overview

App de finanzas personales (PWA, es-AR) para una pareja ("Daniel" y "Ama"). Maneja ARS + USD (dólar MEP), presupuesto por % del sueldo, cuotas con CFT, gastos compartidos al 50%, e inversiones.

El rediseño le da una identidad **fintech cálida y personal**: acento violeta, tipografía grotesca con carácter, números tabulares, emojis como lenguaje de categorías, y un dark/light real. La pregunta central que la app debe responder de un vistazo es: **«¿cuánto me queda para gastar este mes?»**

## 2. Pantallas incluidas

| # | Pantalla | Plataforma | Archivo de referencia |
|---|----------|-----------|----------------------|
| 1 | **Mi mes** (dirección elegida: "Cálida") | Mobile + **Desktop** | `screens-mimes.jsx` → `MiMesCalida` / `screens-key.jsx` → `MiMesDesktop` |
| 7 | **Nueva transacción** (form: cuotas/CFT/división) | Desktop | `screens-extra.jsx` → `NuevaTransaccion` |
| 2 | Resumen | Mobile + Desktop | `screens-mobile.jsx` / `screens-key.jsx` |
| 3 | Transacciones | Mobile + Desktop | `screens-mobile.jsx` / `screens-key2.jsx` |
| 4 | Compartidos (con Ama) | Mobile + Desktop | `screens-mobile.jsx` / `screens-key2.jsx` |
| 5 | Categorías y fuentes | Desktop | `screens-extra.jsx` → `Categorias` |
| 6 | Inversiones | Desktop | `screens-extra.jsx` → `Inversiones` |

> Nota: se exploraron 3 direcciones para "Mi mes" (Cálida ★ elegida, Editorial, Glass). Solo **Cálida** es la dirección a implementar; las otras quedan en `screens-mimes.jsx` como referencia descartada.

---

## 3. Design Tokens

Definir como CSS custom properties en `:root[data-theme='...']`. Los **acentos semánticos** se definen en oklch (misma luminosidad/croma, varía el tono) para que dark y light se sientan coherentes.

### Tipografía
- **Display / números:** `'Schibsted Grotesk'` — pesos 400/500/600/700/800. `letter-spacing: -0.025em` en títulos, `-0.02em` en números.
- **Texto / UI:** `'Hanken Grotesk'` — pesos 400/500/600/700.
- Números SIEMPRE con `font-variant-numeric: tabular-nums`.
- Body global: `letter-spacing: -0.01em`.

### Radios
```
--r-xs: 8px;  --r-sm: 12px;  --r-md: 18px;
--r-lg: 26px; --r-xl: 34px;  --r-pill: 999px;
```

### Acentos semánticos (compartidos entre dark/light, salvo override en light)
```
--pos:  oklch(0.74 0.15 152)   /* ingresos · verde  */
--neg:  oklch(0.70 0.16 25)    /* gastos · coral    */
--info: oklch(0.70 0.15 252)   /* azul              */
--save: oklch(0.74 0.13 195)   /* ahorro · teal     */
--warn: oklch(0.78 0.14 75)    /* aviso · amarillo  */
```

### Tema OSCURO (default) — `:root[data-theme='dark']`
```
--bg:        #141019
--bg-grad:   radial-gradient(120% 80% at 80% -10%, #251c39 0%, #141019 55%)
--elev:      #1b1626
--surface:   #221c30
--surface-2: #2b2440
--surface-3: #352c4d
--line:        rgba(255,255,255,0.08)
--line-strong: rgba(255,255,255,0.15)
--text:      #f4f1fa
--text-dim:  #b3aac6
--text-faint:#7e7595
--brand:     oklch(0.74 0.15 300)   /* violeta */
--brand-2:   oklch(0.78 0.16 330)   /* violeta-rosa */
--brand-ink: #fff
--brand-soft: color-mix(in oklab, var(--brand) 16%, var(--surface))
--pos-soft:  color-mix(in oklab, var(--pos) 16%, var(--surface))
--neg-soft:  color-mix(in oklab, var(--neg) 16%, var(--surface))
--shadow-card: 0 1px 0 rgba(255,255,255,.04) inset, 0 8px 30px rgba(0,0,0,.45)
--shadow-pop:  0 18px 50px rgba(0,0,0,.55)
```

### Tema CLARO — `:root[data-theme='light']`
```
--bg:        #f4f1fb
--bg-grad:   radial-gradient(120% 80% at 80% -10%, #efe7ff 0%, #f4f1fb 55%)
--elev:      #ffffff
--surface:   #ffffff
--surface-2: #f3eefb
--surface-3: #ece4f8
--line:        rgba(28,18,48,0.09)
--line-strong: rgba(28,18,48,0.16)
--text:      #1a1426
--text-dim:  #5b5370
--text-faint:#8c84a0
--brand:     oklch(0.58 0.18 300)
--brand-2:   oklch(0.60 0.19 330)
--brand-ink: #fff
--brand-soft: color-mix(in oklab, var(--brand) 12%, #fff)
/* en light se re-saturan los semánticos un punto: */
--pos:  oklch(0.58 0.15 152)
--neg:  oklch(0.56 0.18 25)
--info: oklch(0.55 0.16 252)
--save: oklch(0.56 0.12 195)
--pos-soft: color-mix(in oklab, var(--pos) 12%, #fff)
--neg-soft: color-mix(in oklab, var(--neg) 12%, #fff)
--shadow-card: 0 1px 2px rgba(28,18,48,.05), 0 10px 30px rgba(60,40,110,.08)
--shadow-pop:  0 18px 50px rgba(60,40,110,.18)
```

### Reglas de color (importante)
- **Nunca gris puro:** todos los neutros tienen un tinte violeta sutil.
- Ingreso/positivo = `--pos`. Gasto/negativo = `--text` (no rojo) salvo que sea un saldo neto negativo, donde sí se usa `--neg`.
- El signo negativo usa el carácter `−` (U+2212), no guion. Helper en sección 6.
- Badges de "Compartido / ÷ Ama" usan `--brand` sobre `--brand-soft`.

### Escala tipográfica observada (px)
| Uso | Size / Weight |
|-----|---------------|
| Número héroe (Mi mes) | 52 / 700 |
| Número héroe desktop (KPI) | 28 / 700 |
| Título de pantalla (h1) | 24 (mobile) – 27 (desktop) / 600 |
| Título de card | 15 / 700 |
| Texto base | 14–15 / 400–600 |
| Etiqueta/eyebrow | 11.5–12 / 700, `letter-spacing:.14em`, UPPERCASE, color `--brand` |
| Caption / faint | 11.5–12.5 / 600, color `--text-faint` |
| Tabla header | 11.5 / 700, `.06em`, UPPERCASE, `--text-faint` |

---

## 4. Fuentes

Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700;800&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## 5. Componentes / primitivos

Ver definiciones exactas en `styles.css` (Card/Chip/Button/etc.) y `helpers.jsx` (charts SVG).

| Primitivo | Descripción | Tokens clave |
|-----------|-------------|--------------|
| **Card** | superficie base | `bg:--surface`, `border:1px --line`, `radius:--r-md (18px)`, `shadow:--shadow-card` |
| **Chip** | filtro/etiqueta pill | `bg:--surface-2`, `radius:pill`, `12.5px/600`. Estado `.on`: `--brand` sobre `--brand-soft` |
| **Button primary** | CTA | `bg:--brand`, ink `#fff`, `radius:pill`, `padding:11px 18px`, sombra de color de marca |
| **Button ghost** | secundario | `bg:--surface-2`, `border:--line` |
| **Bar** | progreso lineal | track `--surface-2`, fill color semántico, `h:6–12px`, `radius:6px` |
| **Ring** | progreso circular | track `--surface-2`, stroke color, `strokeLinecap:round` |
| **Donut** | gastos por categoría | segments con `gap:3`, `strokeLinecap:round`, centro con total |
| **Spark** | área sparkline | gradiente vertical 0.28→0 opacity, línea `2.5px` |
| **MonthBars** | 12 meses ingreso/gasto | dos columnas por mes: `--pos` y `--neg` (gasto a opacity .85), `radius:4px 4px 0 0` |

### Lista (list row) — patrón repetido
Ícono emoji en cuadro `40×40`, `radius:12px`, `bg:--surface-2` · título `14.5/600` · subtítulo `12.5 --text-faint` · monto a la derecha `15/700` (tabular). Filas separadas por `border-top:1px --line`, sin borde en la primera.

---

## 6. Lógica / formato (es-AR)

```js
// moneda ARS — signo opcional, separador de miles es-AR, "−" tipográfico
fmtARS(n, {sign:false, decimals:0})  // → "$537.700"  /  "+$767.700"  /  "−$48.900"
fmtUSD(n)                            // → "U$S 416"
// abreviación para ejes: 1_370_000 → "$1,37M"
```
- Conversión USD: `montoARS / MES.mep`, con `mep ≈ 1292` ARS/USD (debe venir de API real).
- "Te queda para gastar" = `sueldo − gastado_real_del_mes`.
- "Por día" = `quedaMes / díasRestantes`.
- Presupuesto de categoría = `(pctSueldo/100) * sueldo`. "Usado %" = `gastado / presupuesto`, clamp a 1; si `gastado > presupuesto` la barra y el % van en `--neg`.
- Compartidos: cada gasto se divide ÷2. `neto = danielPagó − amaPagó`. Balance neto **negativo = le debés a Ama**, positivo = Ama te debe.

---

## 7. Layouts por pantalla

### AppShell (desktop) — `screens-key.jsx`
- Grid horizontal: **sidebar 232px** (fija) + main (flex).
- Sidebar: `bg:--elev`, `border-right:1px --line`, padding `22px 14px`. Logo 💰 en cuadro gradiente `34×34`. Items de nav: `padding:10px 12px`, `radius:12px`; activo = `--brand` sobre `--brand-soft`, peso 700. Footer con avatar de usuario.
- Topbar: `padding:24px 30px 18px`, `border-bottom:1px --line`. h1 27px + subtítulo `--text-dim`. Acciones a la derecha (MonthPill + botones).
- Contenido: `padding:22px 30px`.
- Tamaño de referencia del artboard: **1280×880**.

### MobileShell — `screens-mimes.jsx` (TopPad + NavCalida)
- Contenedor `402×874` (iPhone). `padding-top:56px` por el status bar.
- Header: saludo "Hola, Dani 👋" + month-pill; campana a la derecha en cuadro `40×40` pill.
- **Bottom nav (NavCalida):** sticky, barra `--surface` con `radius:24px`, 5 slots: Mi mes, Resumen, **[+]**, Compartidos, Más. El `[+]` es un cuadro `50×50` `radius:16px` en `--brand` con sombra de marca, levantado `-2px`. Item activo en `--brand`, resto `--text-faint`. Labels `10px/600`.

### 1) Mi mes (Cálida) ★ — pantalla estrella
> ⚠️ IMPORTANTE: esta pantalla muestra **TODOS** los datos que tu app real maneja. La primera versión del handoff los había simplificado y por eso la implementación se desvió. Estos son los campos obligatorios:
> **Lo que te queda** (sueldo − gastado real) · **Sueldo** · **Presupuestado** · **Gastado** (incluye 50% de compartidos) · **Margen planeado** (sueldo − presupuestado) · **Saldo USD** (queda ÷ MEP) · **Podés gastar por día** (queda ÷ días) · **Ahorro acumulado** · **Compartidos con Ama** · **Cuotas: este mes + comprometido futuro** · **Tabla de presupuesto por % del sueldo** (categoría, % sueldo, gastado, restante, progreso) con botones **Sugerir** y **Guardar presupuesto**.
>
> Regla de negocio del % sueldo: los valores se ingresan como **% del sueldo del mes**. Gastos **Mío → 100%**, **Compartido → 50%**, **De Ama → 0%**.

- **Mobile (`MiMesCalida`):** orden vertical → header → hero violeta → 3 quick-stats (Ingresos/Gastos/Ahorro) → **card "Desglose del sueldo"** (Sueldo/Presupuestado/Gastado/Margen) → **card "Cuotas activas"** (este mes / comprometido futuro) → **"Tus categorías"** (lista con barras) → bottom-nav.
- **Desktop (`MiMesDesktop` en `screens-key.jsx`):** AppShell con sidebar. **Fila 1** grid `1.5fr / 1fr`: izquierda hero violeta contenido (número 58/700; cajas Por día / Saldo USD / Días); derecha card **"Desglose del sueldo"** (ledger de 4 filas). **Fila 2** = 4 stat-cards: Ahorro acumulado, Compartidos con Ama, Cuotas este mes, Comprometido futuro. **Fila 3** = card **"Presupuesto por categoría"** (tabla: Categoría · % Sueldo · Gastado · Restante · Progreso). ⚠️ El hero es una CARD CONTENIDA, nunca full-bleed.
- **Hero card (detalle, vale para mobile y desktop)** (`radius:28px`/`--r-lg`): fondo `linear-gradient(150deg, --brand → --brand-2)`, texto blanco, sombra de marca. Círculo decorativo blanco semi-transparente arriba-derecha. Contenido: eyebrow "💸 Te queda para gastar" → número `fmtARS(quedaMes)` a **52/700** → "de tu sueldo, hasta fin de mes". Debajo, dos mini-cards glass (`rgba(255,255,255,.16)`, blur): "Por día" y "En USD".
- **Quick stats:** fila de 3 cards (Ingresos `--pos` / Gastos `--neg` / Ahorro `--save`), `16.5/700`.
- **Categorías:** card con filas: emoji + nombre + "Quedan $X" + % usado a la derecha; debajo una Bar (indentada `47px`) que se pone `--neg` si se pasó del presupuesto.

### 2) Resumen
- **Desktop:** 4 KPIs arriba (Ingresos/Gastos/Balance/Ahorro) cada uno con delta-pill (`↑/↓ %` sobre `--pos-soft`/`--neg-soft`) y Spark. Fila media de 3 cards: Donut "Gastos por categoría" con leyenda + %, "Ingresos vs Gastos" con 2 barras y balance, "Top gastos del mes". Abajo: card full-width "Evolución mensual · 12 meses" con MonthBars + leyenda.
- **Mobile:** KPI duo (Ingresos/Gastos con spark) → banda de balance en `--brand-soft` → card donut → card 12 meses.

### 3) Transacciones
- **Desktop:** barra de filtros (search + chips Todos/Ingresos/Gastos + dropdowns Categoría/Fuente/Mío·Ama + CSV) → línea de resumen "Neto del período / ↑ingresos / ↓gastos / N movimientos" → **tabla** con columnas `Fecha · Categoría · ¿De quién? · Descripción · Fuente · Monto` (grid `88px 1.1fr 0.9fr 1.6fr 1.1fr 140px`). "De quién" es badge; ingresos en `--pos`; chip de moneda (ARS/USD) antes del monto.
- **Mobile:** search → chips → lista **agrupada por día** (primer grupo = "Hoy"), cada grupo es una card. Badge "÷ Ama" en compartidos; "USD" debajo del monto si aplica.

### 4) Compartidos (con Ama)
- **Hero balance card** a todo color: gradiente `--neg` (le debés) o `--pos` (te debe), número grande, botón glass "Registrar pago →".
- **Contribución del mes:** 2 barras Daniel (`--info`) / Ama (`--brand-2`) con monto y %.
- **Desglose por categoría:** tabla `Categoría · Daniel pagó · Ama pagó · Neto` (mobile: dos líneas por fila). Neto `—` si 0, color por signo.

### 5) Categorías y fuentes (desktop)
- Grid `1.7fr / 1fr`. Izquierda: grid 2-col de cards de categoría (emoji `42×42`, nombre, "% del sueldo", Bar de uso, "gastado de presupuesto"; se pone `--neg` si se pasó). Derecha: card "Fuentes y tarjetas" (lista con punto de color por fuente) + botón "Agregar fuente" + barra de **asignación 100%** segmentada por categoría.

### 6) Inversiones (desktop)
- Fila superior: hero "Patrimonio invertido" (gradiente de marca, ARS + ≈USD + % mes) y card de **asignación** (Donut Plazos/Activos + 2 barras).
- Fila inferior 2-col: "🔒 Plazos fijos activos" (banco, vence/días, monto, TNA, interés estimado) y "📈 Activos & cripto" (mini-tabla Activo/Valor/24h con % en color por signo).

### 7) Nueva transacción (`NuevaTransaccion`, desktop)
Form centrado en una card de ~760px de ancho. Refleja TODAS las opciones reales de tu app:
- **Tipo** (segmented Gasto/Ingreso — Gasto en `--neg`, Ingreso en `--pos`) · **Moneda** (segmented 🇦🇷 ARS / 🇺🇸 USD).
- **Fecha** · **Monto**.
- **Categoría** (select) · **¿Cómo se divide?** (Solo mío / Compartido 50/50 / De Ama) con hint de la regla 100/50/0.
- **Fuente / Medio de pago** (select).
- **Forma de pago** (segmented Pago único / En cuotas). Si "En cuotas", se despliega un bloque con: selector de **cuotas** (3/6/9/12/18/24), **Monto por cuota** (editable si hay interés), **1ra cuota se liquida en** (mes), y toggle **Tiene interés (CFT)** + campo **% anual**.
- **Descripción** (opcional) · botones **Guardar transacción** / **Cancelar**.
- Acción extra en el header: **Carga múltiple** (modo ráfaga, en `--warn`).
- Inputs: `background:--surface-2`, `border:1px --line`, `radius:12px`, `padding:11px 14px`. Selects con chevron a la derecha. Segmented: pill activo con `color-mix` del color semántico al 16%.

---

## 8. Interacciones y comportamiento

- **Toggle tema:** botón claro/oscuro persiste en `localStorage('fin-theme')` y setea `document.documentElement.dataset.theme`. Toda la UI reacciona vía CSS vars (incluido el chrome).
- **Navegación:** sidebar (desktop) / bottom-nav (mobile) entre las 6 secciones. El `[+]` abre el flujo "Anotar gasto/ingreso" (modal/sheet — a diseñar; hoy es CTA).
- **Month picker:** pill `‹ Junio 2026 ›` cambia el período de toda la pantalla.
- **Filtros (Transacciones):** chips toggle + dropdowns; estado `.on` en el activo.
- **Importar:** botón → flujo CSV/Excel (existe en la app actual; mantener).
- **Hover:** botones `filter: brightness(1.06)` (primary) / `bg:--surface-3` (ghost); `:active` baja `translateY(1px)`.
- **Responsive:** desktop usa AppShell; por debajo de ~860px colapsar a MobileShell con bottom-nav. Las grids de cards pasan a 1 columna.
- **Estados a contemplar (no diseñados aún, pedir si se necesitan):** loading (skeletons), vacío (sin movimientos), error de import, validación del form de carga.

---

## 9. Accesibilidad / detalles
- Hit targets mobile ≥ 44px (el `[+]` es 50px ✓).
- Contraste: textos sobre superficies cumplen AA con los tokens dados.
- `prefers-reduced-motion`: si se agregan animaciones de entrada, gatearlas.
- Números con `tabular-nums` para que no "bailen" al actualizar.

---

## 10. Archivos en este bundle

| Archivo | Qué contiene |
|---------|--------------|
| `styles.css` | **Todos los tokens** (dark/light), Card/Chip/Button/utilidades. Fuente de verdad del sistema. |
| `helpers.jsx` | Formatters (`fmtARS/fmtUSD/...`) + charts SVG (Donut, HBars, MonthBars, Spark, Ring, Bar). |
| `lib.jsx` | Datos de ejemplo (es-AR) + set de íconos stroke. Reemplazar por datos reales. |
| `screens-styleguide.jsx` | Cards de la guía de estilo (paleta, tipografía, componentes, data-viz). |
| `screens-mimes.jsx` | "Mi mes" en 3 direcciones. **Implementar `MiMesCalida`** + `NavCalida`/`TopPad`. |
| `screens-key.jsx` | AppShell desktop + Resumen. |
| `screens-key2.jsx` | Transacciones + Compartidos (desktop). |
| `screens-mobile.jsx` | Resumen / Transacciones / Compartidos (mobile, Cálida). |
| `screens-extra.jsx` | Categorías + Inversiones (desktop). |
| `app.jsx` | Cómo se ensambla todo + toggle de tema (referencia de orquestación). |
| `Finanzas — Rediseño.html` | Abrir en navegador para ver TODO el rediseño interactivo. |

> Para ver el diseño funcionando: abrir `Finanzas — Rediseño.html`. El resto son módulos cargados vía Babel en el navegador (no es el patrón de producción — es solo para prototipar).

### Screenshots (`screenshots/`)
Cada pantalla en **dark y light**, a tamaño nativo (mobile 402×874, desktop 1280×880). Usar como referencia visual pixel-perfect.

| Pantalla | Dark | Light |
|----------|------|-------|
| Mi mes (desktop) | `00-mimes-desktop-dark.png` | `00-mimes-desktop-light.png` |
| Mi mes (Cálida) | `01-mimes-dark.png` | `01-mimes-light.png` |
| Nueva transacción | `10-nueva-transaccion-dark.png` | `10-nueva-transaccion-light.png` |
| Resumen (mobile) | `02-resumen-dark.png` | `02-resumen-light.png` |
| Transacciones (mobile) | `03-transacciones-dark.png` | `03-transacciones-light.png` |
| Compartidos (mobile) | `04-compartidos-dark.png` | `04-compartidos-light.png` |
| Resumen (desktop) | `05-resumen-desktop-dark.png` | `05-resumen-desktop-light.png` |
| Transacciones (desktop) | `06-transacciones-desktop-dark.png` | `06-transacciones-desktop-light.png` |
| Compartidos (desktop) | `07-compartidos-desktop-dark.png` | `07-compartidos-desktop-light.png` |
| Categorías (desktop) | `08-categorias-desktop-dark.png` | `08-categorias-desktop-light.png` |
| Inversiones (desktop) | `09-inversiones-desktop-dark.png` | `09-inversiones-desktop-light.png` |

---

## 11. Prompt sugerido para Claude Code

> "Adjunto un paquete de handoff de diseño (`design_handoff_finanzas/`). Es la guía para rediseñar mi app de finanzas personales que ya está en producción (React en Vercel). Los archivos `.jsx`/`.html` son **referencias visuales**, no para copiar tal cual: quiero que recrees estos diseños en mi codebase usando mis componentes y router existentes. Empezá por leer `README.md` completo. Paso 1: cargá los design tokens de la sección 3 como CSS variables (o config de Tailwind) con soporte dark/light vía `data-theme`. Paso 2: construí los primitivos (Card, Chip, Button, Bar, Ring, Donut, Spark, MonthBars). Paso 3: implementá la pantalla **Mi mes** (dirección Cálida) primero, que es la más importante. Respetá los tokens exactos y `tabular-nums` en todos los números. Mantené mi lógica de negocio actual (ARS/USD MEP, cuotas, compartidos ÷2) y solo cambiá la capa visual."
