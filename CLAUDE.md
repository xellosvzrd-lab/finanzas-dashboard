# Proyecto Finanzas Personales — Memoria del Proyecto

> Archivo de contexto para Claude. Última actualización: 2026-04-15.

---

## Project Architecture
- Single-file finance dashboard (`index.html` ~5900+ lines) with HTML/CSS/JS inline
- Supabase backend — **ONE shared instance**, NOT multiple projects
- Deployed via Vercel with preview branches (push feature branch → Vercel auto-deploys preview)
- Navigation tabs: Mi mes | Transacciones | Compartidos | Categorías — pages `page-resumen`, `page-nueva`, `page-anual`, `page-importar` exist in HTML but are NOT in the main nav
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
| Frontend | HTML único (single-file) | Hosted en GitHub Pages |
| Backend | Google Apps Script | REST JSON sobre `doGet`/`doPost` |
| Base de datos | Google Sheets | Una hoja por tipo de dato |
| PDF parsing | pdf.js 3.11.174 (CDN) | Client-side, sin servidor |
| Gráficos | Chart.js 4.4.1 (CDN) | Bar, Doughnut, Line, Mixed |

**No hay build pipeline, no hay npm, no hay framework.** Todo es HTML/CSS/JS vanilla en un único `index.html`.

---

## 2. El dashboard unificado

- **Repo:** `xellosvzrd-lab/finanzas-dashboard`
- **URL:** `https://finanzas-dashboard-oncu.vercel.app/`
- **Archivo:** `index.html` (~5340 líneas) — repo local en `~/Documents/ProyectosClaude/finanzas-dashboard-live/`
- **Autenticación:** Supabase email + password. Ambos usuarios (Daniel y Ama) comparten la misma URL.
- **Usuario dinámico:** `USUARIO` se determina desde `session.user.user_metadata.nombre` al login. Si no está seteado, se muestra un modal de bienvenida la primera vez.
- **Render principal:** `_renderApp()` → `_normalizarCategorias()` + `setTipo("Gasto")` + `filtrarTabla()` + `inicializarSelectoresCompartidos()` + `inicializarSelectoresPresupuesto()` + `inicializarRespButtons()` + `navegarA("presupuesto")`

---

## 3. Variables globales clave

```javascript
let USUARIO = "";          // Seteado por _setVariablesUsuario() desde user_metadata.nombre
                           // Si falta en Supabase → modal bienvenida → guardarNombre()
let PARTNER = "";          // Derivado de USUARIO. Opuesto entre "Daniel" y "Ama"
let API_URL  = "";          // URL del Apps Script
let allTransac = [];        // TODAS las transacciones cargadas
let categGasto   = [];      // ej: ["Alimentación","Alquiler",...]
let categIngreso = [];      // ej: ["Sueldo","Otros Ingresos",...]
let categFuentes = [];      // ej: ["Efectivo","Débito",...]
let categResponsabilidad = [...]; // ver arriba, distinto por usuario
let presupuestoActual = {}; // { categoria: porcentaje }  ← ahora en %, no montos absolutos
let tipoCambioMEP = null;   // solo Ama — dólar MEP venta, para convertir USD a ARS

// Gráficos
let chartCat       = null;
let chartDonut     = null;
let chartEvolCombo = null;  // gráfico doble eje en Resumen (reemplazó chartEvol + chartBal)
```

---

## 4. Navegación

**La sidebar fue eliminada** (PR UX refresh, 2026-04-10). La navegación principal son 4 tabs:

| Tab | Página HTML | Label visible |
|---|---|---|
| Mi mes | `page-presupuesto` | Mi mes |
| Transacciones | `page-transacciones` | Gastos |
| Compartidos | `page-compartidos` | Compartidos |
| Categorías | `page-config` | Categorías |

Las páginas `page-resumen`, `page-nueva`, `page-anual`, `page-importar` siguen existiendo en el HTML pero no están en el nav principal.

```javascript
function navegarA(pagina) {
  // alias: "mimes" → "presupuesto", "categorias" → "config"
  // muestra/oculta .page divs, actualiza .topnav .nav-item y bottom nav #bn-*
  // llama cargarCompartidos(), cargarPresupuesto(), cargarAnual(), renderizarConfig() según destino
}
```

**Desktop:** `<nav class="topnav">` con 4 `.nav-item` buttons.
**Mobile:** `<nav class="bottom-nav">` con 4 items (`#bn-presupuesto`, `#bn-transacciones`, `#bn-compartidos`, `#bn-config`).

`_renderApp()` llama `navegarA("presupuesto")` al final → landing post-login es Mi mes.

**FAB:** botón flotante `<button class="fab">` dentro de `page-presupuesto` → `navegarA('nueva')`. Posición: fijo bottom-right, encima del bottom nav en mobile.

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
fmt(n)           // $1.234,56  (es-AR, ARS)
fmtMoneda(n, moneda)  // USD → "U$S 1,234.56"
fmtShort(n)      // $1.2k / $1.2M
fmtFecha(s)      // "12 ene. 2026"
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

### Editar transacción (workaround)
El backend **no tiene** `updateTransaccion`. Se usa delete + add:
1. `POST { action: "deleteTransaccion", id }`
2. `POST { action: "addTransaccion", fecha, tipo, categoria, monto, descripcion, usuario, responsabilidad, fuente, moneda }`

---

## 6. Backend API (Apps Script)

### GET calls
```
?action=getTransacciones&usuario=Daniel
?action=getCategorias&usuario=Daniel
?action=getPresupuesto&mes=04&anio=2026&usuario=Daniel   ← usuario REQUERIDO
```

### POST calls (body JSON)
```javascript
{ action: "addTransaccion",    fecha, tipo, categoria, monto, descripcion, usuario, responsabilidad, fuente, moneda }
{ action: "deleteTransaccion", id }
{ action: "addCategoria",      tipo, valor, usuario }   ← usuario REQUERIDO
{ action: "deleteCategoria",   tipo, valor }
{ action: "savePresupuesto",   mes, anio, items, usuario }   ← usuario REQUERIDO
```

> ⚠️ `updateTransaccion` **NO existe** en el backend. Siempre usar delete + add.

---

## 7. Presupuesto

- Los inputs almacenan **porcentajes (0–100)**, no montos absolutos.
- El monto real se calcula en runtime: `(pct / 100) × salaryBase`
- **Daniel:** `salaryBase = ARS ingresos (Sueldo + Otros Ingresos)`
- **Ama:** `salaryBase = ARS ingresos + saldoUSD × tipoCambioMEP`
- El importe ARS se actualiza **en vivo** al tipear (`actualizarKpisPres()` → `.pres-monto-live` span)
- Datos separados por usuario via `usuario` en GET/POST

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
.nav-sep           /* separador de sección en sidebar */
.rafaga-overlay    /* modal Modo Ráfaga */
.pres-monto-live   /* span de importe ARS en vivo en Presupuesto */
```

### Modal Modo Ráfaga (Ama)
Usa **variables CSS** (`var(--card)`, `var(--border)`, `var(--bg2)`) para respetar el tema claro/oscuro. En Daniel no hay tema claro así que no importa.

---

## 10. Historial de commits relevantes

| Commit | Repo | Descripción |
|---|---|---|
| `7be08a9` | Daniel | fix case-insensitive categorías |
| `ff8b063` | Ama | fix updateTransaccion (delete+add workaround) |
| `f618062` | Daniel | 6 fixes: norm fuente/resp, addCategoria usuario, fusión Evolución, presupuesto %, neto KPI, evol combo |
| `4153d6a` | Ama | ídem + fix Modo Ráfaga tema |
| `779c401` | Daniel | importe ARS en vivo + separador decimal coma |
| `dcbf033` | Ama | ídem |
| `4a8d474` | Daniel | presupuesto separado por usuario (GET+POST con usuario) |
| `67b9390` | Ama | ídem |
| `4a8d474` | Daniel | presupuesto separado por usuario (GET+POST con usuario) |
| `5d517eb` | Daniel | fix: mensaje de guardado temporal + limpiar formulario tras guardar |
| `31cb378` | Ama | fix: mensaje de guardado temporal + limpiar formulario tras guardar |

---

## 11. Errores conocidos / workarounds

| Problema | Solución aplicada |
|---|---|
| `updateTransaccion is not defined` | delete + add en `guardarEdicionTransaccion()` |
| PDF Galicia no parsea | regex `DD-MM-YY` con comprobante como ancla |
| Categorías case-sensitive | `_normalizarCategorias()` normaliza al cargar |
| `fuente`/`responsabilidad` case-sensitive | incluidos en `_normalizarCategorias()` |
| Categorías nuevas no aparecen en selects | `addCategoria` ahora envía `usuario` |
| Presupuesto compartido entre usuarios | `getPresupuesto` y `savePresupuesto` ahora envían `usuario` |
| Modo Ráfaga siempre oscuro en Ama | CSS variables en lugar de colores hardcodeados |
| Decimal con coma no acepta | `type="text" inputmode="decimal"` + `parsearDecimal()` |

---

## 12. Estructura de una transacción

```javascript
{
  id:              string,   // ID del backend
  fecha:           "YYYY-MM-DD",
  tipo:            "Gasto" | "Ingreso",
  categoria:       string,   // de categGasto o categIngreso
  monto:           number,   // siempre positivo, el tipo indica dirección
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
// Daniel
CATS_TRANSFERENCIA = ["Transferencia"]  // excluidas de gráficos
CATS_INGRESO_REAL  = ["Sueldo", "Otros Ingresos"]  // para cálculo de sueldo

// Ama
CATS_INGRESO_ARS  = ["Sueldo", "Otros Ingresos", "Intereses"]
CATS_EXCLUIR      = ["Cambio"]  // cambio de divisas, tratamiento especial
// "Cambio" ARS = ingreso del pesos recibido al vender USD
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
