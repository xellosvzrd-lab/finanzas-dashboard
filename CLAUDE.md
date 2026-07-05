# Proyecto Finanzas Personales — Memoria del Proyecto

> Archivo de contexto para Claude. Última actualización: 2026-07-02.

---

## Project Architecture
- Single-file finance dashboard (`index.html` ~10,225 líneas) with HTML/CSS/JS inline
- Supabase backend — **ONE shared instance**, NOT multiple projects
- Deployed via Vercel with preview branches (push feature branch → Vercel auto-deploys preview)
- Navigation tabs: **Mi mes · Transacciones · Compartidos · Categorías · Inversiones · Resumen**
- Pages `page-nueva`, `page-anual`, `page-importar` exist in HTML but are NOT in the main nav
- When adding UI elements, ALWAYS verify which page/tab contains them and that the page is reachable via navigation

## Workflow Rules
- Implement changes immediately — do NOT present a plan and wait for approval unless explicitly asked to plan first
- Always `git add`, `git commit`, confirm staged status before claiming changes are on any branch
- After UI changes, verify the element is visible on the currently active/navigable page
- When a task is done: stage → commit → push. Do not skip steps.

## Git & Deployment
- Use feature branches for non-trivial changes, push to get Vercel preview
- Squash-merge PRs via `gh pr merge --squash`
- After merge, verify deployment status
- ONE Supabase project — never suggest running migrations on multiple projects
- Current working branch: `feature/voice-capture` (1 commit ahead of main as of 2026-07-02)

## UI/Design Preferences
- Warm-earth palette with terracotta tones (modern, warm, intimate aesthetic)
- Users: Daniel (dark theme) and Ama (light theme)
- `PARTNER` variable is dynamic — use it for responsibility labels, never hardcode
- No dark mode for Daniel's theme by design; Ama has `[data-theme="light"]`
- Chart.js for all charts with animations enabled
- Mobile responsiveness is critical — test for overflow and max-width constraints on every UI change

## Context Management
- For large sessions, save progress to memory files before context window fills up
- If session is getting long, proactively suggest breaking into a new session with a context handoff
- Never let session hit 'Prompt is too long' — checkpoint early

---

## 1. Arquitectura general

| Capa | Tecnología | Detalle |
|---|---|---|
| Frontend | HTML único (single-file) | Hosted en Vercel |
| Backend | Supabase | PostgreSQL + Auth + Row Level Security |
| Base de datos | Supabase (PostgreSQL) | Tablas: ver sección 2b |
| PDF parsing | pdf.js 3.11.174 (CDN) | Client-side, sin servidor |
| Gráficos | Chart.js 4.4.1 (CDN) | Bar, Doughnut, Line, Mixed |
| Iconos | Lucide (CDN) | Inline SVGs via `lucide.createIcons()` |

**No hay build pipeline, no hay npm, no hay framework.** Todo es HTML/CSS/JS vanilla en un único `index.html`.

---

## 2. El dashboard unificado

- **Repo:** `xellosvzrd-lab/finanzas-dashboard`
- **URL:** `https://finanzas-dashboard-oncu.vercel.app/`
- **Archivo:** `index.html` (~10,225 líneas) — repo local en `~/Documents/ProyectosClaude/finanzas-dashboard-live/`
- **Autenticación:** Supabase email + password (+ Google OAuth opcional). Ambos usuarios (Daniel y Ama) comparten la misma URL.
- **Usuario dinámico:** `USUARIO` se determina desde `session.user.user_metadata.nombre` al login. Si no está seteado, se muestra un modal de bienvenida la primera vez.
- **Render principal:** `_renderApp()` → `_normalizarCategorias()` + `setTipo("Gasto")` + `filtrarTabla()` + `inicializarSelectoresCompartidos()` + `inicializarSelectoresPresupuesto()` + `inicializarRespButtons()` + `navegarA("presupuesto")`

### 2b. Tablas Supabase

| Tabla | Descripción |
|---|---|
| `transacciones` | Todas las transacciones (gastos/ingresos) |
| `categorias` | Categorías de gasto, ingreso y fuente por usuario |
| `presupuesto` | Montos ($) de presupuesto por categoría, mes, año, usuario |
| `compras_cuotas` | Compras en cuotas con N, monto por cuota, mes inicio |
| `metas_ahorro` | Meta de ahorro activa (nombre, monto objetivo, moneda, fecha, compartida) |
| `plazos_fijos` | Plazos fijos con capital, tasa, fecha vencimiento, moneda |
| `acciones` | Tenencias de acciones y cripto con símbolo, cantidad, precio compra |
| `recurrentes` | Transacciones recurrentes detectadas y manuales |

---

## 3. Variables globales clave

```javascript
let supabaseClient  = null;
let supabaseSession = null;
let USUARIO         = "Daniel";       // Seteado por _setVariablesUsuario() desde user_metadata.nombre
let PARTNER         = "Ama";          // Derivado de USUARIO. Opuesto entre "Daniel" y "Ama"
let comprasEnCuotas = [];             // Loaded by cargarCuotasActivas()
let CATS_INGRESO_REAL = ["Sueldo", "Otros Ingresos"];
let tipoCambioMEP   = null;           // Solo Ama — dólar MEP venta, para convertir USD a ARS
let allTransac      = [];             // TODAS las transacciones cargadas (paginadas si >1000)
let resumenData     = [];

const CATS_TRANSFERENCIA = ["Internas"];   // excluidas de gráficos (era ["Transferencia"] antes)
let categGasto           = [];
let categIngreso         = [];
let categFuentes         = [];
let categFuentesTC       = [];
let categResponsabilidad = ["Mío","Compartido","De Ama"];
let _todasCategorias     = [];

// Gráficos
let chartCat       = null;
let chartDonut     = null;
let chartEvolCombo = null;  // gráfico doble eje en Resumen

// Sort de tabla
let sortCol = "fecha";
let sortDir = -1;           // -1 = desc (más reciente primero), 1 = asc

let _pendingDelete = null;  // { id, timeout } — undo delete

// Cache keys localStorage
const CACHE_TRANSAC_KEY = "fp_transac_cache";
const CACHE_CATEG_KEY   = "fp_categ_cache";
```

---

## 4. Navegación (6 tabs)

**Desktop:** `<nav class="topnav">` con 6 `.nav-item` buttons.
**Mobile:** `<nav class="bottom-nav">` con 4 items + botón CTA central (nueva transacción). Inversiones y Resumen solo en top nav desktop.

| Tab | Página HTML | Label visible |
|---|---|---|
| Mi mes | `page-presupuesto` | Mi mes |
| Transacciones | `page-transacciones` | Transacciones |
| Compartidos | `page-compartidos` | Compartidos |
| Categorías | `page-config` | Categorías |
| Inversiones | `page-inversiones` | Inversiones |
| Resumen | `page-resumen` | Resumen |

Las páginas `page-nueva`, `page-anual`, `page-importar` siguen existiendo en el HTML pero no están en el nav.

```javascript
function navegarA(pagina) {
  // alias: "mimes" → "presupuesto", "categorias" → "config"
  // muestra/oculta .page divs, actualiza .topnav .nav-item y bottom nav #bn-*
  // llama cargarCompartidos(), cargarPresupuesto(), cargarAnual(), etc. según destino
}
```

`_renderApp()` llama `navegarA("presupuesto")` al final → landing post-login es Mi mes.

**FAB/CTA mobile:** botón central en bottom nav → `navegarA('nueva')`. Se oculta en `page-nueva`.

---

## 5. Funciones clave

### Normalización case-insensitive
```javascript
function _normalizarCategorias() {
  // Normaliza t.categoria, t.fuente, t.responsabilidad contra las listas canónicas
  // Se llama antes de cada render y después de cargar transacciones
}
```

### Parseo decimal (acepta coma argentina)
```javascript
function parsearDecimal(val) {
  return parseFloat(String(val || 0).replace(',', '.')) || 0;
}
```
**Todos los inputs de monto y % usan `type="text" inputmode="decimal"`** y sus valores se parsean con `parsearDecimal()`.

### Formateo
```javascript
fmt(n)                // $1.234,56  (es-AR, ARS) — muestra decimales solo si hay centavos reales
fmtMoneda(n, moneda)  // USD → "U$S 1,234.56"
fmtShort(n)           // $1.2k / $1.2M
fmtFecha(s)           // "12 ene. 2026"
escapeHtml(s)         // escape XSS para contenido dinámico en innerHTML
```

### Progressive disclosure (Mi mes y Compartidos)
```javascript
toggleDesglose()                 // toggle tabla categorías en Mi mes
inicializarDisclosureMimes()     // llamada al final de cargarPresupuesto()
toggleDetalleCompartidos()       // toggle tabla detalle en Compartidos
inicializarDisclosureCompartidos() // llamada al final de cargarCompartidos()
```
- Default Daniel=expandido, Ama=colapsado
- Persistido en localStorage: `USUARIO + "_disclosure_mimes"` / `"_disclosure_compartidos"`

### Responsabilidad en formulario (Nueva transacción)
`<select id="f-responsabilidad">` — populado dinámicamente por `inicializarRespButtons()`.
Labels visuales: "Solo mío" / "Lo pagamos juntos" / "Lo pagó [PARTNER]".
Valores canónicos que van a la BD: `"Mío"` / `"Compartido"` / `"De " + PARTNER`.
Resetear con `resetRespField()` tras guardar. Llamar `seleccionarResp(valor)` al duplicar.

### Carga paginada de transacciones
```javascript
async function cargarTodasTransacciones() {
  // Pagina en chunks de 1000 para superar límite Supabase
  // Guarda resultado en localStorage (CACHE_TRANSAC_KEY)
}
```

---

## 6. Features principales

### Cuotas (`compras_cuotas`)
- Guardar compra en cuotas: `guardarCompraEnCuotas()`
- KPI de cuotas en Mi mes muestra total cuotas activas del mes
- Botón eliminar por fila en modal + eliminar compra completa con alerta de impacto
- Número de cuota correcto: `N / total`

### Inversiones (tab)
- **Plazos Fijos:** CRUD en Supabase (`plazos_fijos`), soporte ARS/USD
- **Acciones:** tenencias con símbolo, cantidad, precio compra; live prices via Coinbase (cripto) y proxy Vercel (acciones)
- Secciones colapsables, totales ARS+USD, auto-refresh precios cada N minutos
- Verificar CSP (`connect-src: 'self' api.coinbase.com`) si se agrega nueva fuente de precios

### Recurrentes (`recurrentes`)
- Detección automática de transacciones recurrentes en historial
- CRUD manual: `agregarRecurrenteManual()`, `toggleRecurrente()`, `eliminarRecurrente()`
- Sección en Mi mes y modal de gestión; candidatas sugeridas
- `cargarRecurrenteForm(recurrente)` pre-llena el formulario de nueva transacción

### Metas de ahorro (`metas_ahorro`)
- Una meta activa por usuario (puede ser compartida)
- Progreso calculado en runtime desde `allTransac`
- Tarjeta en Mi mes con dos estados: sin meta / con meta+progreso
- Modal de gestión: `abrirModalMeta()` / `cerrarModalMeta()` / `guardarMetaAhorro()`

### Captura por voz
- Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- `toggleCapturaVoz()` → inicia/detiene reconocimiento
- `_vozParsear(texto)` → extrae monto, categoría, descripción, fuente del transcript
- `_vozMatchLista(str, lista, sinonimos)` → matching tolerante a variaciones
- Pre-llena formulario de nueva transacción; usuario confirma antes de guardar
- `_vozSoportado()` verifica disponibilidad del API

### Heatmap calendario
- Mapa de calor de gasto por día en Mi mes (full-width card)
- Click en día → navega a Transacciones filtrado por esa fecha

### PWA
- Installable como app en home screen (manifest + service worker)

### Settlement batch + alertas de tendencia
- Liquidación batch de compartidos
- Alertas cuando el gasto supera umbrales en cierta categoría

---

## 7. Presupuesto

- Los inputs almacenan **montos absolutos en pesos ($)** por categoría (columna `presupuesto.monto`, ex `porcentaje`).
- El % del sueldo es un campo **calculado** en runtime, no se almacena: `(monto / salaryBase) × 100`
- **Daniel:** `salaryBase = ARS ingresos (Sueldo + Otros Ingresos)`
- **Ama:** `salaryBase = ARS ingresos + saldoUSD × tipoCambioMEP` (net-USD approach estable)
- El % se actualiza **en vivo** al tipear (`actualizarKpisPres()` → `.pres-monto-live` span)
- Datos separados por usuario via `usuario` en GET/POST
- Migración de esquema: `docs/supabase/migrations/2026-07-05-presupuesto-monto.sql`

---

## 8. PDF Parser (importar datos)

- Usa `pdf.js` client-side
- **Formato Galicia VISA:** `DD-MM-YY` con guiones, 6 dígitos de comprobante como ancla estructural, dos columnas ARS/USD
- `_parsearLinea()` tiene regex Galicia primero, luego fallback genérico `DD/MM`
- La preview incluye columna de Responsabilidad (select editable)

---

## 9. Patrones CSS importantes

### Variables de tema (Ama tiene modo claro)
```css
:root { /* dark */ }
[data-theme="light"] { /* Ama only */ }
```

### Clases semánticas clave
```css
.kpi-card          /* tarjeta de KPI */
.kpi-trend         /* ▲/▼ con color verde/rojo */
.tabla-subtotal    /* barra de stats en Transacciones */
#sub-neto          /* valor grande 1.45rem — neto del período */
.sub-neto-pos      /* color: var(--green) */
.sub-neto-neg      /* color: var(--red) */
.rafaga-overlay    /* modal Modo Ráfaga (Carga múltiple) */
.pres-monto-live   /* span de importe ARS en vivo en Presupuesto */
.modal-recur       /* modal de recurrentes — usa var(--card), var(--border) */
```

### KPI auto-shrink (container queries)
```css
container-type: inline-size;
font-size: clamp(0.75rem, 9cqw, 1.65rem);
```

### Modal Modo Ráfaga (Ama)
Usa **variables CSS** (`var(--card)`, `var(--border)`, `var(--bg2)`) para respetar el tema claro/oscuro.

---

## 10. Historial de commits relevantes (post UX refresh)

| Commit | Descripción |
|---|---|
| `240eaa9` | chore: project tooling — CLAUDE.md, hooks, skills, CI review |
| `5baa642` | security: remove plaintext password from localStorage, add XSS escaping |
| `7883ef2` | security: add Content-Security-Policy meta tag |
| `30501d0` | feat: PWA — installable as home screen app |
| `e32ee23` | feat: settlement batch + spending trend alerts |
| `f2c894d` | feat: add Inversiones tab, remove health score KPI |
| `006bf94` | feat(heatmap): click day → navigate to transactions filtered by date |
| `102e158` | feat(inversiones): migrate plazos fijos and acciones to Supabase |
| `8d53d60` | feat(cuotas): botón eliminar por fila en modal del KPI |
| `8d53d60` | fix: paginar carga de transacciones (límite 1000 filas Supabase) |
| `bee774e` | feat(recurrentes): módulo de detección, CRUD Supabase y navegación al form |
| `5b730fe` | feat(recurrentes): render sección Mi mes, modal gestión, candidatas |
| `4303f79` | feat(metas-ahorro): módulo de carga, progreso y CRUD Supabase |
| `d100717` | feat(metas-ahorro): render tarjeta Mi mes y modal de gestión |
| `1f13967` | feat(compartidos): mostrar ARS y USD por separado cuando van en dirección opuesta |
| `6e9e9b2` | feat(voz): captura de transacciones por voz con Web Speech API |

---

## 11. Errores conocidos / workarounds

| Problema | Solución aplicada |
|---|---|
| PDF Galicia no parsea | regex `DD-MM-YY` con comprobante como ancla |
| Categorías case-sensitive | `_normalizarCategorias()` normaliza al cargar |
| `fuente`/`responsabilidad` case-sensitive | incluidos en `_normalizarCategorias()` |
| Límite 1000 filas Supabase | Carga paginada en `cargarTodasTransacciones()` |
| Decimal con coma no acepta | `type="text" inputmode="decimal"` + `parsearDecimal()` |
| Race condition en Total invertido | Fix en `916c7ed` |
| Ama salary formula inestable | Usa net-USD approach estable (revertido en `c6d5d67`) |
| Precios de acciones (CORS) | Proxy Vercel para Yahoo Finance; Coinbase directo para cripto |
| XSS en innerHTML dinámico | `escapeHtml()` en toda interpolación de strings de usuario |
| CSS modal siempre oscuro en Ama | Variables CSS en lugar de colores hardcodeados |

---

## 12. Estructura de una transacción

```javascript
{
  id:              string,   // UUID de Supabase
  fecha:           "YYYY-MM-DD",
  tipo:            "Gasto" | "Ingreso",
  categoria:       string,   // de categGasto o categIngreso
  monto:           number,   // siempre positivo
  descripcion:     string,
  usuario:         "Daniel" | "Ama",
  responsabilidad: "Mío" | "Compartido" | "De Ama" | "De Daniel",
  fuente:          string,   // de categFuentes
  moneda:          "ARS" | "USD"
}
```

---

## 13. Categorías especiales (constantes en código)

```javascript
// Ambos usuarios
CATS_TRANSFERENCIA = ["Internas"]   // excluidas de gráficos

// Daniel
CATS_INGRESO_REAL  = ["Sueldo", "Otros Ingresos"]

// Ama
CATS_INGRESO_ARS  = ["Sueldo", "Otros Ingresos", "Intereses"]
CATS_EXCLUIR      = ["Cambio"]  // cambio de divisas, tratamiento especial
```

---

## 14. Lógica de responsabilidad en Presupuesto y Compartidos

### Daniel
- `"Mío"` gastos Daniel → 100%
- `"Compartido"` gastos (todos) → 50% (neto de reintegros compartidos)
- `"De Ama"` gastos Daniel → 0% (Daniel los pagó, Ama le debe)
- `"De Daniel"` gastos Ama → 100% de Daniel (Ama pagó por él)

### Ama (simétrico)
- `"Mío"` gastos Ama → 100%
- `"Compartido"` → 50%
- `"De Ama"` gastos que pagó Daniel → 100% de Ama
- `"De Daniel"` → 0%

---

## 15. Flujo de autenticación y usuario dinámico

1. `DOMContentLoaded` → `supabaseClient.auth.getSession()` → si hay sesión: `_configurarUsuario(session)` → `iniciarApp()`
2. Si no hay sesión guardada → pantalla de login → `guardarConfig()` → `_configurarUsuario(session)` → `iniciarApp()`
3. `_configurarUsuario(session)` lee `session.user.user_metadata?.nombre`:
   - Si tiene valor → `_setVariablesUsuario(nombre)` → `_actualizarStringsUsuario()` → continúa
   - Si está vacío → `_setVariablesUsuario("")` → `iniciarApp()` muestra modal `#modal-nombre`
4. `guardarNombre()`: guarda nombre con `supabaseClient.auth.updateUser({ data: { nombre } })` → `_setVariablesUsuario(nombre)` → `iniciarApp()`
5. `_setVariablesUsuario(nombre)`: setea `USUARIO`, `PARTNER`, `CATS_INGRESO_REAL`, `categResponsabilidad`
6. Google OAuth disponible como método alternativo (`vincularGoogle()`)
