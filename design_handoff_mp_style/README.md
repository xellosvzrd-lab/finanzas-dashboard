# Handoff: Rediseño "MP Style" — finanzas-dashboard

## Overview
Rediseño completo de la app de finanzas personales (repo `xellosvzrd-lab/finanzas-dashboard`, single-file `index.html` ~10.225 líneas, vanilla HTML/CSS/JS + Supabase) con la anatomía de layout de Mercado Pago (header de color con saldo grande, accesos rápidos redondos, listas compactas, nav inferior móvil con CTA central, sidebar con CTA en desktop) sobre un material "liquid glass" con paleta propia **verde bosque**. Cubre los 6 tabs reales (Mi mes · Transacciones · Compartidos · Categorías · Inversiones · Resumen) más el formulario de Nueva transacción (page-nueva).

## About the Design Files
Los archivos de este paquete son **referencias de diseño hechas en HTML/JSX con Babel standalone** — prototipos que muestran el look & feel previsto, NO código de producción para copiar tal cual. La tarea es **recrear estos diseños dentro del stack real del repo**: un único `index.html` vanilla (sin build, sin framework) con variables CSS de tema, Chart.js para gráficos y Lucide para íconos. El 90% del cambio visual se logra editando las variables de tema (`--brand`, `--card`, `--surface`, etc.) y las ~10 clases de superficie compartida (`.card`, `.chart-card`, `.kpi-card`, `.plazo-card`, `.comp-balance-card`, `.topnav`, `.bn-pill`, `.mm-hero`, `.inv-hero-card`), igual que en los rediseños anteriores documentados en `docs/superpowers/plans/2026-07-05-liquid-glass-*.md`. Los cambios estructurales (header de color, accesos rápidos, sidebar desktop) sí requieren tocar el HTML de cada página.

## Fidelity
**High-fidelity (hifi).** Colores, tipografía, espaciados y jerarquías son finales. Recrear pixel-perfect con **CSS vanilla** (el repo NO usa Tailwind ni build pipeline): mapear los tokens de abajo a las variables de tema existentes en `:root[data-theme="dark"|"light"]` de `index.html`.

## Mapeo a la app real (páginas de index.html)
| Diseño | Página HTML | Nav |
|---|---|---|
| Mi mes | `page-presupuesto` | tab 1 (landing post-login) |
| Transacciones | `page-transacciones` | tab 2 |
| Compartidos | `page-compartidos` | tab 3 |
| Categorías | `page-config` | tab 4 |
| Inversiones | `page-inversiones` | tab 5 (solo desktop nav) |
| Resumen | `page-resumen` | tab 6 (solo desktop nav) |
| Nueva transacción | `page-nueva` | CTA central bottom-nav / botón sidebar |

Navegación: `navegarA(pagina)`. Desktop = `.topnav` (el diseño lo reemplaza por sidebar — decisión de este rediseño); mobile = `.bottom-nav` con 4 items + CTA central (igual que hoy).

## Screens / Views

### 1. Mi mes (page-presupuesto) — móvil 402×874 y desktop 1280×880
- **Header de color** (gradiente verde `linear-gradient(150deg, oklch(0.42 0.12 172), oklch(0.55 0.135 148))`, texto blanco): saludo con avatar (38px, círculo translúcido blanco 22%), picker Mes/Año como pill, label "Saldo de junio" + ícono ojo (toggle visibilidad), saldo grande `fmtARS(balance)` a 42px/800/-0.03em, dos pills translúcidas con ↑ Ingresos y ↓ Gastos.
- **Grilla de accesos rápidos** superpuesta al header (margin-top −44px, card glass fuerte, radius 22): 4 acciones = Nueva / Gastos / Compartidos / Categorías. Círculo 52px con ícono en color brand sobre fondo `color-mix(brand 11%, superficie)`, label 11.5px/600 debajo.
- **Cards de features reales de Mi mes**: KPI de cuotas activas del mes (`compras_cuotas`) y tarjeta de **meta de ahorro** (`metas_ahorro`) con barra de progreso 60% y "$2,4M de $4,0M". En desktop también la cotización Dólar MEP (`tipoCambioMEP`) con variación. Nota: el heatmap calendario y la sección de recurrentes de Mi mes no están maquetados — conservar los actuales aplicando el nuevo material glass.
- **Donut de gastos por categoría** (equivalente a `DonutChart.tsx`): grosor 16 (móvil) / 21 (desktop 158px), gap 3px entre segmentos, strokeLinecap round, centro con total. Leyenda: cuadrado 9px radius 3 + label + % (top 4-5 categorías por gasto).
- **Tabla de desglose** (progressive disclosure real, `toggleDesglose()`): columnas Categoría · Presup. ($ absolutos, columna `presupuesto.monto`) · Gasto actual · % (calculado en runtime = gasto/presupuesto; el % del sueldo NO se almacena) + columna Progreso con barra en desktop. Encabezados 10-11px uppercase letterspacing .05em. Gasto en rojo `--neg` si excede presupuesto. Barra: 6px, radius 6, gradiente brand→brand-2 (roja si excedida). Link "Editar presupuesto" en color brand.
- **Desktop**: banda héroe de color (radius 24) con saldo + accesos a la derecha; abajo 3 KPI cards (Ingresos/Gastos/Saldo) y grid 1.7fr/1fr con tabla + columna lateral (MEP + donut).

### 2. Transacciones (page-transacciones) — móvil y desktop
- **Header**: título "Transacciones" 21px/800, botón "+ Nueva" blanco con texto brand (móvil) o pill gradiente brand (desktop). Búsqueda como input translúcido blanco 18% dentro del header (móvil) o pill glass en la fila de filtros (desktop).
- **Filtros reales** (`filtrarTabla()`): chips/pills = Mes·Año, Tipo, Fuente, Responsabilidad, cada uno con chevron. Activo: fondo `color-mix(brand 22%, transparent)` texto brand.
- **Barra de subtotales** (la `.tabla-subtotal` real con `#sub-neto`): card glass con "Neto del período" grande 21px/800 coloreado (`.sub-neto-pos`/`.sub-neto-neg`) + conteo y subtotales de gastos/ingresos a la derecha.
- **Fila de transacción** (tabla ordenable, `sortCol`/`sortDir`): badge cuadrado 24px radius 8 con "G" (rojo suave) o "I" (verde suave) · Categoría 13.5px/600 + descripción atenuada · fecha + fuente 11px + chip de responsabilidad (Mío = gris, Compartido = brand, "De Ama" = azul info) · monto derecha 13.5px/700 (verde si ingreso; USD con `fmtUSD`). Desktop añade columnas fuente/fecha y acciones editar/duplicar/borrar (íconos 14px, borrar en rojo 70% opacidad).
- Separadores: hairline 0.5px `--g-hair`.

### 3. Compartidos (page-compartidos)
- **Header/banda**: avatares D+A solapados (−10px), balance centrado: "Balance del mes · Le debés a Ama" + monto 44px/800 + subtítulo "Debés pagarle $X a Ama".
- **Tabla de gastos compartidos**: Categoría·Descripción / chip quién pagó ("Pagué yo" = brand, "Pagó Ama" = brand-2, "De Ama" = info) / monto / fecha es-AR ("02 jun 2026").

### 4. Categorías (page-config)
- 4 grupos reales: Gastos (`categGasto`), Ingresos (`categIngreso`), Fuentes de pago (`categFuentes`), Fuentes con liquidación / tarjetas (`categFuentesTC`) — grid 2×2 en desktop; lista en móvil. La sección "Cuenta y Seguridad" (incl. checkbox `PREF_USD_MEP`) no está maquetada: aplicar el mismo estilo de card.
- Cada grupo: card glass radius 20-22, título 13.5-14.5px/700, filas con nombre + acciones editar/eliminar, pie con input "Agregar…" (glass hundido, radius 11) + botón círculo con +.

### 5. Inversiones (page-inversiones) — solo desktop
- Banda héroe con "Total invertido" (ARS+USD combinado) y pills por tipo.
- Sección colapsable **Plazos Fijos** (`plazos_fijos`): cards con banco, moneda, badge % TNA (color `--save`), capital 24px/700, vencimiento + días.
- Sección colapsable **Acciones & Cripto** (`acciones`): tabla Activo · Cantidad · Precio compra · Valor · Var. (verde/rojo). Precios live: Coinbase (cripto) y proxy Vercel (acciones), auto-refresh — indicar la fuente en un caption.
- Footer con cuotas activas del mes.

### 6. Resumen (page-resumen) — solo desktop
- KPIs Ingresos/Gastos/Neto.
- **Gráfico evolución 12 meses** (el `chartEvolCombo` real, doble eje): barras ingresos (verde) vs gastos (rojo) + línea de neto (color `--info`) superpuesta. En producción: Chart.js mixed chart con animaciones.
- Donut de gastos por categoría + card de promedios/totales del año.

### 7. Nueva transacción (page-nueva) — modal/card centrado 640px
- Toggle **Gasto/Ingreso** como segmented pill: activo relleno `--neg` (rojo) para Gasto, `--pos` (verde) para Ingreso, texto blanco.
- Campos en grid 2 columnas (labels 12px/700): Fecha (dd/mm/aaaa + ícono calendario) · Categoría (select) · Monto (`type="text" inputmode="decimal"`, parsear con `parsearDecimal()` — acepta coma argentina; + select ARS/USD 92px) · Fuente de pago · Mes de liquidación (solo fuentes de `categFuentesTC`) · Responsabilidad (select `#f-responsabilidad` poblado por `inicializarRespButtons()`; labels visuales "Solo mío" / "Lo pagamos juntos" / "Lo pagó [PARTNER]", valores canónicos a BD "Mío"/"Compartido"/"De "+PARTNER — PARTNER es dinámico, nunca hardcodear "Ama") · Descripción opcional a ancho completo.
- Línea auxiliar: "≈ USD X al MEP · se divide 50/50 con Ama".
- Botones: Cancelar (glass, flex 1) + Guardar gasto (gradiente brand, flex 2, radius 999, sombra brand 45%).

### Navegación
- **Móvil**: bottom nav glass (radius 24 24 0 0, sticky) = la `.bottom-nav` real: Mi mes · Transac. · [CTA central] · Compart. · Categ. CTA central: círculo 52px gradiente brand, elevado −30px, → `navegarA('nueva')` (ocultarlo en page-nueva, como hoy). Activo en color brand, íconos 21px, labels 10px/700. Inversiones y Resumen NO van en mobile nav (igual que hoy).
- **Desktop**: sidebar 236px glass radius 24 (reemplaza la `.topnav` actual — cambio estructural de este rediseño) con logo, CTA "Nueva transacción" (pill gradiente, 44px), los 6 tabs (activo = card glass con texto brand), y al pie card de usuario (avatar, USUARIO dinámico, "Partner: [PARTNER]", link "Salir").

## Interactions & Behavior
- Toggle ojo oculta/muestra el saldo (mostrar "•••••").
- Picker Mes/Año: mismo selector actual como pill.
- Filtros client-side con `filtrarTabla()` sobre `allTransac`.
- Progressive disclosure: mantener `toggleDesglose()` / `toggleDetalleCompartidos()` con persistencia en localStorage.
- Tema claro/oscuro: reutilizar `toggleTheme()` y `:root[data-theme="dark"|"light"]` existentes — REEMPLAZAR los valores índigo actuales por los tokens verde bosque de abajo, sin agregar variables nuevas (mismo patrón que `docs/superpowers/plans/2026-07-05-liquid-glass-light-theme.md`).
- Hovers: filas de tabla con fondo `--g-hair`; botones brand con brightness(1.05); transiciones 150ms ease.
- Cotización MEP: `tipoCambioMEP` ya cargado; mostrar venta + variación diaria (verde/rojo).
- Charts: Chart.js 4.4.1 con animaciones (donut, mixed evolución); colores desde las variables CSS.
- Mobile-first: verificar overflow y max-width en cada cambio (regla del repo); KPIs con container queries + clamp ya existentes.

## State Management
Sin estado nuevo: son las mismas páginas y funciones (`cargarPresupuesto()`, `filtrarTabla()`, `cargarCompartidos()`, etc.). La única UI nueva con estado es el toggle de visibilidad de saldo (localStorage por usuario, mismo patrón que los disclosure).

## Design Tokens

### Paleta "Verde bosque" — tema claro
- `--bg` #f1f6f2 · superficie `--elev` #fafdfb · `--surface-2` #e9f1ea · `--surface-3` #dce9de
- Texto: `--text` #14201a · `--text-dim` #4c5f54 · `--text-faint` #7c8f83
- Brand: `--brand` oklch(0.50 0.13 165) · `--brand-2` oklch(0.63 0.14 145) · tinta sobre brand: #fff
- Semánticos: `--pos` oklch(0.58 0.14 120) · `--neg` oklch(0.52 0.18 25) · `--info` oklch(0.53 0.09 245) · `--save` oklch(0.56 0.09 195)
- Header gradiente: `linear-gradient(150deg, oklch(0.42 0.12 172), oklch(0.55 0.135 148))`

### Tema oscuro
- `--bg` #0e1512 · `--elev` #131c16 · `--surface` #18241d
- Texto: #ecf5ef / #a8bfb1 / #71887a
- `--brand` oklch(0.66 0.13 160) · `--brand-2` oklch(0.75 0.14 140) (tinta #0a1710)
- `--pos` oklch(0.68 0.14 120) · `--neg` oklch(0.62 0.17 25) · `--info` oklch(0.62 0.09 245) · `--save` oklch(0.66 0.09 195)
- Header gradiente: `linear-gradient(150deg, oklch(0.34 0.10 172), oklch(0.45 0.11 150))`

### Material glass (claro / oscuro)
- Card: fondo rgba(250,253,251,0.55) / rgba(226,244,233,0.14); borde 0.5px rgba(246,252,248,0.8) / rgba(226,244,233,0.2)
- Brillo interior: `inset 1.2px 1.2px 0 rgba(255,255,255,0.92), inset -1px -1px 1px rgba(255,255,255,0.5)` (oscuro: blancos verdosos al 22%/6%)
- Sombra: `0 2px 10px rgba(20,70,45,0.08), 0 14px 40px rgba(20,70,45,0.14)` (oscuro: negras 35%/50%)
- Hairline separador: rgba(20,32,26,0.07) / rgba(226,244,233,0.1)
- En producción con `backdrop-filter: blur(32px) saturate(180%)` real si el fondo lo permite; los mocks lo simulan con fondo translúcido + borde + sombra.

### Escalas
- Radius: 999 (pills/círculos), 26/24/22/20 (cards por jerarquía), 18 (cards chicas), 13-14 (inputs), 8 (badges G/I)
- Espaciado: padding cards 16-20px; filas de lista 10-12px vertical / 14-20px horizontal; gap grillas 12-14px
- Tipografía: sistema (-apple-system/SF Pro o equivalente). Números con `font-variant-numeric: tabular-nums`. Jerarquía: héroe 42-44/800, títulos página 21-26/700-800, títulos card 14-15/700, cuerpo 13-13.5/600, secundario 11.5-12.5, micro 10-11/700 uppercase para encabezados de tabla.
- Formato dinero: `fmtARS`/`fmtUSD` existentes (es-AR, $ 1.234.567).

## Assets
Sin imágenes ni logos externos. Íconos: stroke SVG 1.8-2.2px, linecap/linejoin round, 24px viewBox (calendario, swap, personas, tag, ojo, lápiz, tacho, duplicar, +, chevrons, lupa). Cualquier set de líneas (Lucide) sirve. Emojis solo como avatares de categoría/moneda (💵 💰) — opcional reemplazarlos por íconos.

## Files
- `Finanzas - MP Style.html` — entrada (canvas con los 11 artboards)
- `screens-mp-mobile.jsx` — 4 pantallas móviles
- `screens-mp-desktop.jsx` — Mi mes + Transacciones desktop, shell/sidebar
- `screens-mp-desktop2.jsx` — Compartidos, Categorías, Inversiones, Resumen, Nueva transacción desktop
- `styles-mp.css` — capa MP (header de color, acciones, pills)
- `styles-mp-verde.css` — tokens paleta verde bosque (claro/oscuro) — **fuente de verdad de los tokens**
- `styles-warm.css`, `styles-platforms-warm.css` — base del material glass (variables `--g-*`)
- `lib.jsx`, `helpers.jsx` — datos de muestra y formatters de referencia (en producción usar `fmt()`/`fmtMoneda()`/`fmtShort()`/`fmtFecha()` existentes)
