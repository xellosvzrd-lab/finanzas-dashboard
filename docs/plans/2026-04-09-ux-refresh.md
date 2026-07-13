# UX Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renovar el dashboard con tema cálido/minimalista, lenguaje cotidiano, navegación de 4 tabs, progressive disclosure y formulario simplificado.

**Architecture:** Single-file HTML/CSS/JS vanilla (`index.html`, ~5340 líneas). Los cambios se aplican en capas independientes: primero variables CSS, luego labels, luego nav, luego interactividad. Rama: `feature/ux-refresh` creada desde `main`.

**Tech Stack:** HTML/CSS/JS vanilla, Supabase JS SDK ya integrado, localStorage para persistencia de estado.

---

## Notas de contexto para subagentes

- **Repo local:** `/Users/teamnucita/Documents/ProyectosClaude/finanzas-dashboard-live/`
- **Variables globales clave:** `USUARIO` (nombre del usuario actual), `PARTNER` (el otro usuario), `supabaseClient`, `supabaseSession`
- **`navegarA(pagina)`** muestra/oculta `.page` divs y actualiza `.nav-item` active
- **`_renderApp()`** renderiza contenido inicial de todas las páginas
- **Las páginas HTML** tienen IDs: `page-resumen`, `page-transacciones`, `page-nueva`, `page-compartidos`, `page-presupuesto`, `page-anual`, `page-config`, `page-importar`
- **El tab de Presupuesto** (`page-presupuesto`) pasa a llamarse "Mi mes" en la UI
- **El tab de Config** (`page-config`) pasa a llamarse "Categorías" en la UI
- **NO cambiar** la lógica de negocio (cálculos, reglas de compartidos, MEP)
- **El KPI Disponible** ya usa `sueldoEfectivo - totalPresARS` (correcto, NO tocar)

---

## Files

- Modify: `index.html` — único archivo. Todas las tareas lo modifican en zonas distintas.

---

### Task 1: CSS variables — tema cálido

**Files:**
- Modify: `index.html` — bloque `:root` (líneas ~17-49) y `body` background (líneas ~51-62)

- [ ] **Step 1: Crear rama feature**

```bash
cd /Users/teamnucita/Documents/ProyectosClaude/finanzas-dashboard-live
git checkout -b feature/ux-refresh
```

- [ ] **Step 2: Reemplazar el bloque `:root`**

Buscar el bloque exacto:
```css
  :root {
    /* Backgrounds */
    --bg:      #07071a;
    --bg2:     #0d0d22;
    --bg3:     #0a0a1c;
    --card:    #10102a;
    --border:  #1c1c3a;
    --border2: #2c2c50;

    /* Accent system */
    --accent:      #7c6eff;
    --accent-dim:  rgba(124,110,255,0.13);
    --accent-glow: rgba(124,110,255,0.28);
    --accent2:     #f06fa0;
    --accent2-dim: rgba(240,111,160,0.13);

    /* Semantic colors con versión dim */
    --green:      #34d399;
    --green-dim:  rgba(52,211,153,0.11);
    --red:        #f87171;
    --red-dim:    rgba(248,113,113,0.11);
    --yellow:     #fbbf24;
    --yellow-dim: rgba(251,191,36,0.11);

    /* Text */
    --text:       #e4e4f0;
    --text-muted: #6060a0;

    --radius: 14px;
    --shadow: 0 8px 40px rgba(0,0,0,0.55);
    --glass:  rgba(255,255,255,0.035);
    --glass-border: rgba(255,255,255,0.07);
  }
```

Reemplazar con:
```css
  :root {
    /* Backgrounds — tema cálido */
    --bg:      #FAF8F5;
    --bg2:     #F2EEE9;
    --bg3:     #EDE8E3;
    --card:    #FFFFFF;
    --border:  #EDE8E3;
    --border2: #D4CFC9;

    /* Accent: terracota */
    --accent:      #C8845A;
    --accent-dim:  rgba(200,132,90,0.13);
    --accent-glow: rgba(200,132,90,0.28);
    --accent2:     #C8845A;
    --accent2-dim: rgba(200,132,90,0.13);

    /* Semantic colors */
    --green:      #5A8C6B;
    --green-dim:  rgba(90,140,107,0.11);
    --red:        #C85A5A;
    --red-dim:    rgba(200,90,90,0.11);
    --yellow:     #C8A45A;
    --yellow-dim: rgba(200,164,90,0.11);

    /* Text */
    --text:       #2D2926;
    --text-muted: #8C7B72;

    --radius: 14px;
    --shadow: 0 1px 3px rgba(45,41,38,0.08);
    --glass:  rgba(255,255,255,0.6);
    --glass-border: rgba(45,41,38,0.06);
  }
```

- [ ] **Step 3: Reemplazar el background del body**

Buscar:
```css
  body {
    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: var(--bg);
    background-image:
      radial-gradient(ellipse 90% 55% at 12% -8%, rgba(124,110,255,0.22) 0%, transparent 55%),
      radial-gradient(ellipse 65% 45% at 92% 105%, rgba(240,111,160,0.13) 0%, transparent 50%),
      radial-gradient(ellipse 50% 40% at 50% 50%, rgba(52,211,153,0.04) 0%, transparent 60%);
    background-attachment: fixed;
    color: var(--text);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
```

Reemplazar con:
```css
  body {
    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
```

- [ ] **Step 4: Verificar que el archivo abre sin errores**

Abrir `index.html` en el browser y confirmar que no hay errores de CSS en la consola. La app debería verse con el tema cálido (fondo crema, accent terracota).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(ux): tema cálido — paleta terracota/crema"
```

---

### Task 2: Lenguaje cotidiano — labels de UI

**Files:**
- Modify: `index.html` — labels en HTML (títulos, KPI labels, nav items)

**Mapa de cambios (buscar → reemplazar):**

| Buscar | Reemplazar |
|--------|------------|
| `🎯 Presupuesto mensual` | `Mi mes` |
| `💰 Sueldo del mes` | `Sueldo` |
| `📊 Total presupuestado` | `Presupuestado` |
| `💸 Gastado efectivo` | `Gastado` |
| `✅ Disponible` | `Lo que te queda` |
| `💵 Saldo USD del mes` | `En dólares` |
| `Los cambios se guardan en tu Google Sheet` | `Tus categorías y fuentes de pago` |

- [ ] **Step 1: Cambiar título de página Presupuesto**

Buscar:
```html
          <h1>🎯 Presupuesto mensual</h1>
```
Reemplazar con:
```html
          <h1>Mi mes</h1>
```

- [ ] **Step 2: Cambiar labels de KPIs en page-presupuesto**

Buscar:
```html
            <div class="kpi-label">💰 Sueldo del mes</div>
```
Reemplazar:
```html
            <div class="kpi-label">Sueldo</div>
```

Buscar:
```html
            <div class="kpi-label">📊 Total presupuestado</div>
```
Reemplazar:
```html
            <div class="kpi-label">Presupuestado</div>
```

Buscar:
```html
            <div class="kpi-label">💸 Gastado efectivo</div>
```
Reemplazar:
```html
            <div class="kpi-label">Gastado</div>
```

Buscar:
```html
            <div class="kpi-label">✅ Disponible</div>
```
Reemplazar:
```html
            <div class="kpi-label">Lo que te queda</div>
```

Buscar:
```html
            <div class="kpi-label">💵 Saldo USD del mes</div>
```
Reemplazar:
```html
            <div class="kpi-label">En dólares</div>
```

- [ ] **Step 3: Cambiar subtitle de page-config**

Buscar:
```html
          <div style="font-size:.85rem;color:var(--text-muted)">Los cambios se guardan en tu Google Sheet</div>
```
Reemplazar:
```html
          <div style="font-size:.85rem;color:var(--text-muted)">Tus categorías y fuentes de pago</div>
```

- [ ] **Step 4: Cambiar label del campo de responsabilidad en el formulario**

Buscar:
```html
              <label>¿De quién es?</label>
```
Reemplazar:
```html
              <label>¿Cómo se divide?</label>
```

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(ux): lenguaje cotidiano — labels en castellano simple"
```

---

### Task 3: Navegación — 4 tabs

**Files:**
- Modify: `index.html` — HTML nav (sidebar + bottom nav), CSS de layout, función `navegarA()`, función `_renderApp()`

Esta es la tarea más grande. Lee con cuidado todo el contexto antes de tocar nada.

**Lógica de la transformación:**
- La sidebar izquierda desaparece del desktop
- El top nav horizontal reemplaza a la sidebar en desktop
- El bottom nav mobile pasa de 5 ítems a 4
- Los 4 tabs son: Mi mes (=presupuesto), Transacciones, Compartidos, Categorías (=config)
- Las páginas Resumen, Nueva, Anual e Importar siguen existiendo en el HTML pero ya no están en el nav principal
- `page-nueva` sigue accesible vía botón en page-transacciones
- La página activa al cargar pasa de Resumen a Presupuesto (Mi mes)

- [ ] **Step 1: Reemplazar el HTML del sidebar y bottom nav**

Encontrar el bloque que empieza con `<!-- Bottom nav mobile -->` y termina con `</nav><!-- sidebar -->` (alrededor de líneas 1254-1313).

Reemplazar TODO ese bloque (bottom nav + sidebar, incluyendo `<div class="sidebar-overlay">`) con:

```html
<!-- Overlay oscuro al abrir sidebar en mobile -->
<div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>

<!-- Top nav (desktop) -->
<nav class="topnav" id="topnav">
  <div class="topnav-brand">
    💰 <span id="topnav-user"></span>
  </div>
  <div class="topnav-tabs">
    <button class="nav-item" onclick="navegarA('presupuesto')">Mi mes</button>
    <button class="nav-item" onclick="navegarA('transacciones')">Transacciones</button>
    <button class="nav-item" onclick="navegarA('compartidos')">Compartidos</button>
    <button class="nav-item" onclick="navegarA('config')">Categorías</button>
  </div>
  <button class="topnav-logout" onclick="volverConfig()" title="Cerrar sesión">↩</button>
</nav>

<!-- Bottom nav mobile -->
<nav class="bottom-nav" id="bottom-nav">
  <button class="bn-item" id="bn-presupuesto" onclick="navegarA('presupuesto')">
    <span class="bn-icon">🗓</span><span>Mi mes</span>
  </button>
  <button class="bn-item" id="bn-transacciones" onclick="navegarA('transacciones')">
    <span class="bn-icon">📋</span><span>Gastos</span>
  </button>
  <button class="bn-item" id="bn-compartidos" onclick="navegarA('compartidos')">
    <span class="bn-icon">👫</span><span>Compartidos</span>
  </button>
  <button class="bn-item" id="bn-config" onclick="navegarA('config')">
    <span class="bn-icon">⚙️</span><span>Categorías</span>
  </button>
</nav>
```

- [ ] **Step 2: Actualizar `sidebar-user` → `topnav-user` en `_actualizarStringsUsuario` y en `iniciarApp`**

Buscar en el JS:
```javascript
  const sidebarUser = document.getElementById("sidebar-user");
  if (sidebarUser) sidebarUser.textContent = USUARIO;
```
Reemplazar con:
```javascript
  const sidebarUser = document.getElementById("sidebar-user");
  if (sidebarUser) sidebarUser.textContent = USUARIO;
  const topnavUser = document.getElementById("topnav-user");
  if (topnavUser) topnavUser.textContent = USUARIO;
```

También buscar en `iniciarApp()`:
```javascript
  if (USUARIO) document.getElementById("sidebar-user").textContent = USUARIO;
```
Reemplazar con:
```javascript
  if (USUARIO) {
    const su = document.getElementById("sidebar-user");
    if (su) su.textContent = USUARIO;
    const tu = document.getElementById("topnav-user");
    if (tu) tu.textContent = USUARIO;
  }
```

- [ ] **Step 3: Reemplazar CSS del layout**

Buscar el bloque `.layout` y `.sidebar` completo en el CSS. Son varias reglas. Buscar todas las que empiezan con `.sidebar` y `.layout` y reemplazarlas.

Buscar (puede estar en varias líneas no contiguas — buscar una por una):
```css
  .layout { display: flex; min-height: 100vh; }
```
Reemplazar con:
```css
  .layout { display: block; min-height: 100vh; }
```

Buscar y ELIMINAR (o comentar) el bloque de CSS de la clase `.sidebar {` completo (buscar desde `.sidebar {` hasta su cierre, incluyendo `.sidebar-logo`, `.sidebar-bottom`, `.nav-sep`, `.nav-item` relacionados con sidebar).

**IMPORTANTE:** No eliminar `.nav-item` si se usa para el top nav también. En cambio, buscar si `.nav-item` tiene estilos de sidebar específicos (como `border-left`) y reemplazar esos por estilos de top nav.

Agregar al final del bloque `<style>`, antes de `</style>`, los estilos del top nav y el ajuste al `.main`:

```css
  /* ─── TOP NAV ────────────────────────────────────────── */
  .topnav {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0 1.5rem;
    background: var(--card);
    border-bottom: 1px solid var(--border);
    height: 56px;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .topnav-brand {
    font-weight: 700;
    font-size: .95rem;
    color: var(--accent);
    white-space: nowrap;
    margin-right: .5rem;
  }
  .topnav-tabs {
    display: flex;
    gap: .25rem;
    flex: 1;
  }
  .topnav .nav-item {
    background: none;
    border: none;
    cursor: pointer;
    padding: .5rem .85rem;
    border-radius: 8px;
    font-size: .9rem;
    font-weight: 500;
    color: var(--text-muted);
    border-bottom: 2px solid transparent;
    transition: color .15s, border-color .15s;
  }
  .topnav .nav-item:hover { color: var(--text); }
  .topnav .nav-item.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
    background: none;
  }
  .topnav-logout {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.1rem;
    color: var(--text-muted);
    padding: .4rem;
    border-radius: 6px;
  }
  .topnav-logout:hover { color: var(--text); }

  /* Ocultar top nav en mobile */
  @media (max-width: 768px) {
    .topnav { display: none; }
  }

  /* En desktop, ocultar bottom nav */
  @media (min-width: 769px) {
    .bottom-nav { display: none; }
  }

  /* Ajustar main content */
  .main {
    max-width: 960px;
    margin: 0 auto;
    padding: 1.5rem 1.5rem 5rem;
  }
  @media (max-width: 768px) {
    .main { padding: 1rem 1rem 5rem; }
  }
```

- [ ] **Step 4: Actualizar `navegarA()` para los 4 nuevos tabs**

Buscar la función completa `function navegarA(pagina)` y reemplazarla con:

```javascript
function navegarA(pagina) {
  // Aliases para compatibilidad interna
  const alias = { mimes: "presupuesto", categorias: "config" };
  pagina = alias[pagina] || pagina;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const page = document.getElementById("page-" + pagina);
  if (page) page.classList.add("active");

  // Top nav (desktop)
  const navMap = { presupuesto: 0, transacciones: 1, compartidos: 2, config: 3 };
  document.querySelectorAll(".topnav .nav-item").forEach((n, i) => {
    n.classList.toggle("active", i === navMap[pagina]);
  });

  // Bottom nav (mobile)
  ["bn-presupuesto","bn-transacciones","bn-compartidos","bn-config"].forEach(id => {
    document.getElementById(id)?.classList.remove("active");
  });
  const bnMap = { presupuesto: "bn-presupuesto", transacciones: "bn-transacciones", compartidos: "bn-compartidos", config: "bn-config" };
  if (bnMap[pagina]) document.getElementById(bnMap[pagina])?.classList.add("active");

  // Cargar datos de la página destino
  if (pagina === "compartidos")  cargarCompartidos();
  if (pagina === "presupuesto")  cargarPresupuesto();
  if (pagina === "anual")        cargarAnual();
  if (pagina === "config")       renderizarConfig();

  closeSidebar();
  window.scrollTo(0, 0);
}
```

- [ ] **Step 5: Actualizar `_renderApp()` para ir a Mi mes por defecto**

Buscar:
```javascript
function _renderApp() {
  _normalizarCategorias(); // unificar capitalización antes de renderizar
  setTipo("Gasto");
  cargarResumenMes();
  cargarEvolucion(); // fusionado en Resumen
  filtrarTabla();
  inicializarSelectoresCompartidos();
  inicializarSelectoresPresupuesto();
}
```

Reemplazar con:
```javascript
function _renderApp() {
  _normalizarCategorias();
  setTipo("Gasto");
  filtrarTabla();
  inicializarSelectoresCompartidos();
  inicializarSelectoresPresupuesto();
  navegarA("presupuesto"); // Mi mes es la página de aterrizaje
}
```

**Nota:** `cargarResumenMes()` y `cargarEvolucion()` se eliminan del render inicial porque Resumen ya no es la página de aterrizaje. Los datos se cargarán si el usuario navega a esa página directamente (si lo necesita). `cargarPresupuesto()` se llama dentro de `navegarA('presupuesto')`.

- [ ] **Step 6: Cambiar el `page-resumen` para que NO tenga `active` por defecto en el HTML**

Buscar:
```html
      <div id="page-resumen" class="page active">
```
Reemplazar con:
```html
      <div id="page-resumen" class="page">
```

Y cambiar `page-presupuesto` para que tampoco tenga active (lo maneja `_renderApp`):
```html
      <div id="page-presupuesto" class="page">
```
(ya debería estar sin `active`, confirmar)

- [ ] **Step 7: Agregar botón "Anotar" en page-transacciones**

En `page-transacciones`, buscar el header de la página. Agregar botón para acceder al formulario:

Buscar:
```html
            <button class="btn btn-primary" onclick="navegarA('nueva')">+ Nueva</button>
```

Reemplazar con:
```html
            <button class="btn btn-primary" onclick="navegarA('nueva')">+ Anotar</button>
```

(El texto cambia, el link funciona igual)

- [ ] **Step 8: Verificar que el app carga en Mi mes y los 4 tabs funcionan**

Abrir en browser. Confirmar:
- Al cargar, se muestra Mi mes (presupuesto) con datos cargados
- Los 4 tabs del top nav (desktop) o bottom nav (mobile) funcionan
- Compartidos, Categorías cargan sus datos al navegar

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat(ux): navegación 4 tabs — top nav desktop, bottom nav mobile"
```

---

### Task 4: Progressive disclosure — Mi mes

**Files:**
- Modify: `index.html` — HTML de `page-presupuesto` y JS para toggle

El objetivo: agregar un botón "Ver desglose" / "Ocultar desglose" arriba de la tabla de categorías. El desglose está colapsado por defecto para Ama, expandido para Daniel. El estado persiste en localStorage.

- [ ] **Step 1: Agregar botón toggle antes de la tabla en page-presupuesto**

Buscar:
```html
        <!-- Tabla presupuesto vs ejecución -->
        <div class="chart-card" style="padding:0;overflow:hidden">
```

Reemplazar con:
```html
        <!-- Toggle desglose -->
        <div style="display:flex;justify-content:flex-end;margin-bottom:.5rem">
          <button id="btn-toggle-desglose"
                  onclick="toggleDesglose()"
                  style="background:none;border:1px solid var(--border);border-radius:8px;
                         padding:.4rem .9rem;font-size:.83rem;color:var(--text-muted);cursor:pointer;">
            Ver desglose ▾
          </button>
        </div>

        <!-- Tabla presupuesto vs ejecución -->
        <div id="pres-desglose" class="chart-card" style="padding:0;overflow:hidden">
```

**Nota:** se agrega `id="pres-desglose"` al div de la tabla para poder mostrarlo/ocultarlo.

También encontrar el cierre de esa tabla y verificar que el `</div><!-- /chart-card -->` cierre correctamente.

- [ ] **Step 2: Agregar función `toggleDesglose` en el JS**

Agregar al final del archivo (antes del último `</script>`):

```javascript
function toggleDesglose() {
  const el  = document.getElementById("pres-desglose");
  const btn = document.getElementById("btn-toggle-desglose");
  const visible = el.style.display !== "none";
  el.style.display = visible ? "none" : "";
  btn.textContent  = visible ? "Ver desglose ▾" : "Ocultar desglose ▴";
  try { localStorage.setItem(USUARIO + "_disclosure_mimes", visible ? "0" : "1"); } catch(e) {}
}

function inicializarDisclosureMimes() {
  const el  = document.getElementById("pres-desglose");
  const btn = document.getElementById("btn-toggle-desglose");
  if (!el || !btn) return;
  // Default: Daniel expandido, Ama colapsado. Override si hay valor guardado.
  const saved = localStorage.getItem(USUARIO + "_disclosure_mimes");
  const defaultExpanded = USUARIO.toLowerCase() !== "ama";
  const expanded = saved !== null ? saved === "1" : defaultExpanded;
  el.style.display  = expanded ? "" : "none";
  btn.textContent   = expanded ? "Ocultar desglose ▴" : "Ver desglose ▾";
}
```

- [ ] **Step 3: Llamar `inicializarDisclosureMimes` después de que `cargarPresupuesto` renderiza**

Encontrar la función `cargarPresupuesto()` (buscar `async function cargarPresupuesto`). Al final de esa función, antes del cierre `}`, agregar:

```javascript
  inicializarDisclosureMimes();
```

- [ ] **Step 4: Verificar comportamiento**

1. Loguear como Ama → navegar a Mi mes → la tabla debe estar colapsada
2. Click en "Ver desglose" → tabla visible, texto cambia a "Ocultar desglose"
3. Recargar página → el estado persiste (tabla sigue visible)
4. Loguear como Daniel → Mi mes → tabla visible por defecto

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(ux): progressive disclosure en Mi mes — toggle desglose"
```

---

### Task 5: Progressive disclosure — Compartidos

**Files:**
- Modify: `index.html` — HTML de `page-compartidos` y JS para toggle

- [ ] **Step 1: Identificar la estructura de page-compartidos**

Leer el HTML de `page-compartidos` (buscar `<div id="page-compartidos"`). La página tiene:
- Header con título
- Una tabla/grid con los datos (el "detalle")
- El "resumen" (quién le debe a quién) puede ser solo el header de la tabla

La tabla de compartidos está en el div con id `comp-tabla` o similar (buscar `<table` dentro de `page-compartidos`).

- [ ] **Step 2: Agregar botón toggle en page-compartidos**

Leer el contenido de `page-compartidos` para ubicar la tabla. Agregar el botón toggle ANTES del contenedor de la tabla:

```html
        <!-- Toggle detalle compartidos -->
        <div style="display:flex;justify-content:flex-end;margin-bottom:.5rem">
          <button id="btn-toggle-compartidos"
                  onclick="toggleDetalleCompartidos()"
                  style="background:none;border:1px solid var(--border);border-radius:8px;
                         padding:.4rem .9rem;font-size:.83rem;color:var(--text-muted);cursor:pointer;">
            Ver detalle ▾
          </button>
        </div>
```

Y agregar `id="comp-detalle"` al div/tabla contenedor del detalle de compartidos.

- [ ] **Step 3: Agregar funciones `toggleDetalleCompartidos` e `inicializarDisclosureCompartidos`**

Agregar junto a las funciones de disclosure de Mi mes:

```javascript
function toggleDetalleCompartidos() {
  const el  = document.getElementById("comp-detalle");
  const btn = document.getElementById("btn-toggle-compartidos");
  const visible = el.style.display !== "none";
  el.style.display = visible ? "none" : "";
  btn.textContent  = visible ? "Ver detalle ▾" : "Ocultar detalle ▴";
  try { localStorage.setItem(USUARIO + "_disclosure_compartidos", visible ? "0" : "1"); } catch(e) {}
}

function inicializarDisclosureCompartidos() {
  const el  = document.getElementById("comp-detalle");
  const btn = document.getElementById("btn-toggle-compartidos");
  if (!el || !btn) return;
  const saved = localStorage.getItem(USUARIO + "_disclosure_compartidos");
  const defaultExpanded = USUARIO.toLowerCase() !== "ama";
  const expanded = saved !== null ? saved === "1" : defaultExpanded;
  el.style.display  = expanded ? "" : "none";
  btn.textContent   = expanded ? "Ocultar detalle ▴" : "Ver detalle ▾";
}
```

- [ ] **Step 4: Llamar `inicializarDisclosureCompartidos` desde `cargarCompartidos`**

Buscar `async function cargarCompartidos()`. Al final de la función (luego de que renderiza el HTML), agregar:

```javascript
  inicializarDisclosureCompartidos();
```

- [ ] **Step 5: Verificar**

1. Navegar a Compartidos
2. Ama: tabla colapsada por defecto
3. Daniel: tabla expandida por defecto
4. Toggle funciona y persiste en localStorage

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(ux): progressive disclosure en Compartidos — toggle detalle"
```

---

### Task 6: Formulario — radio buttons + collapsible responsabilidad

**Files:**
- Modify: `index.html` — HTML del formulario en `page-nueva`, CSS de radio buttons, JS que lee `f-responsabilidad`

**Objetivo:** Reemplazar el dropdown `<select id="f-responsabilidad">` con tres botones radio estilizados. La sección "¿Cómo se divide?" está colapsada por defecto; el usuario la expande solo si quiere cambiar.

Los valores que se envían a la BD son los strings canónicos: `'Mío'`, `'Compartido'`, `'De ' + PARTNER`. Los labels visuales son distintos: `'Solo mío'`, `'Lo pagamos juntos'`, `'Lo pagó [PARTNER]'`.

- [ ] **Step 1: Agregar CSS para radio buttons estilizados**

Agregar al bloque `<style>` (antes de `</style>`):

```css
  /* ─── RADIO BUTTONS RESPONSABILIDAD ──────────────── */
  .resp-toggle-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    padding: .5rem 0;
    border: none;
    background: none;
    width: 100%;
    font-size: .9rem;
    color: var(--text-muted);
    font-family: inherit;
  }
  .resp-toggle-header .resp-valor-actual {
    font-weight: 600;
    color: var(--text);
  }
  .resp-group {
    display: flex;
    gap: .5rem;
    flex-wrap: wrap;
    margin-top: .5rem;
  }
  .resp-btn {
    flex: 1;
    min-width: 0;
    padding: .55rem .4rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    color: var(--text-muted);
    font-size: .82rem;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    transition: background .12s, color .12s, border-color .12s;
    font-family: inherit;
  }
  .resp-btn.selected {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .resp-btn:hover:not(.selected) {
    border-color: var(--accent);
    color: var(--text);
  }
```

- [ ] **Step 2: Reemplazar el HTML del campo responsabilidad en el formulario**

Encontrar en `page-nueva` el grupo del campo responsabilidad:
```html
            <div class="form-group">
              <label>¿Cómo se divide?</label>
              <select id="f-responsabilidad">
                <option value="Mío">🙋 Mío</option>
                <option value="Compartido">👫 Compartido</option>
                <option value="De Ama">💳 De Ama</option>
              </select>
            </div>
```

Reemplazar con:

```html
            <div class="form-group full" id="resp-container">
              <button type="button" class="resp-toggle-header" onclick="toggleRespField()">
                <span>¿Cómo se divide? — <span class="resp-valor-actual" id="resp-label-actual">Solo mío</span></span>
                <span id="resp-toggle-arrow">▾</span>
              </button>
              <div id="resp-field" style="display:none">
                <div class="resp-group" id="resp-group"></div>
              </div>
              <input type="hidden" id="f-responsabilidad" value="Mío">
            </div>
```

**Nota:** `id="f-responsabilidad"` se mantiene pero cambia a `type="hidden"`. El valor real se escribe con JS al seleccionar un botón. Así el resto del código que lee `f-responsabilidad.value` sigue funcionando sin cambios.

- [ ] **Step 3: Agregar JS para inicializar y manejar los radio buttons**

Agregar estas funciones junto a las otras de disclosure:

```javascript
// ─── RESPONSABILIDAD RADIO BUTTONS ────────────────────────────
const RESP_LABELS = {
  "Mío":        "Solo mío",
  "Compartido": "Lo pagamos juntos",
};

function getRespLabel(valor) {
  if (RESP_LABELS[valor]) return RESP_LABELS[valor];
  if (valor.startsWith("De ")) return "Lo pagó " + (PARTNER || "tu pareja");
  return valor;
}

function inicializarRespButtons() {
  const grupo = document.getElementById("resp-group");
  if (!grupo) return;
  const opciones = [
    { valor: "Mío",          label: "Solo mío" },
    { valor: "Compartido",   label: "Lo pagamos juntos" },
    { valor: "De " + PARTNER, label: "Lo pagó " + (PARTNER || "tu pareja") },
  ];
  grupo.innerHTML = opciones.map(op =>
    `<button type="button" class="resp-btn${op.valor === "Mío" ? " selected" : ""}"
             data-valor="${op.valor}"
             onclick="seleccionarResp('${op.valor.replace(/'/g, "\\'")}')">${op.label}</button>`
  ).join("");
  // Establecer valor inicial
  document.getElementById("f-responsabilidad").value = "Mío";
  document.getElementById("resp-label-actual").textContent = "Solo mío";
}

function seleccionarResp(valor) {
  document.querySelectorAll(".resp-btn").forEach(b => {
    b.classList.toggle("selected", b.dataset.valor === valor);
  });
  document.getElementById("f-responsabilidad").value = valor;
  document.getElementById("resp-label-actual").textContent = getRespLabel(valor);
}

function toggleRespField() {
  const field = document.getElementById("resp-field");
  const arrow = document.getElementById("resp-toggle-arrow");
  const visible = field.style.display !== "none";
  field.style.display = visible ? "none" : "";
  arrow.textContent = visible ? "▾" : "▴";
}

function resetRespField() {
  // Resetear al valor por defecto y colapsar
  seleccionarResp("Mío");
  const field = document.getElementById("resp-field");
  const arrow = document.getElementById("resp-toggle-arrow");
  if (field) field.style.display = "none";
  if (arrow) arrow.textContent = "▾";
}
```

- [ ] **Step 4: Llamar `inicializarRespButtons` desde `_renderApp` o `setTipo`**

`inicializarRespButtons` necesita llamarse después de que `PARTNER` esté seteado y el formulario esté en el DOM.

Encontrar `function _renderApp()` y agregar al final:
```javascript
  inicializarRespButtons();
```

También, cuando se llama `resetRespField()` después de guardar una transacción, los botones vuelven a "Solo mío" colapsado. Buscar en `guardarTransaccion()` donde se limpia el formulario (buscar `f-responsabilidad`, `f-monto.value = ""`, etc.) y agregar:
```javascript
  resetRespField();
```

- [ ] **Step 5: Verificar que el valor de responsabilidad se envía correctamente**

El JS de `guardarTransaccion()` lee:
```javascript
const resp = document.getElementById("f-responsabilidad").value;
```

Como mantuvimos `id="f-responsabilidad"` en un `<input type="hidden">`, esto sigue funcionando sin cambios.

Verificar:
1. Abrir el formulario → "¿Cómo se divide? — Solo mío" visible
2. Click en el header → se expanden los 3 botones
3. Click en "Lo pagamos juntos" → botón se pone terracota, header muestra "Lo pagamos juntos"
4. Guardar transacción → la responsabilidad guardada es "Compartido" (no "Lo pagamos juntos")
5. Tras guardar → vuelve a "Solo mío" colapsado

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(ux): radio buttons responsabilidad + collapsible en formulario"
```

---

### Task 7: Push y PR

- [ ] **Step 1: Push de la rama**

```bash
git push -u origin feature/ux-refresh
```

- [ ] **Step 2: Crear PR**

```bash
gh pr create \
  --base main \
  --title "feat: UX refresh — tema cálido, 4 tabs, progressive disclosure, formulario" \
  --body "$(cat <<'EOF'
## Cambios

### Estética
- Tema cálido: fondo crema #FAF8F5, acento terracota #C8845A
- Sin gradientes oscuros, shadows suaves

### Lenguaje
- KPIs renombrados: 'Disponible' → 'Lo que te queda', 'Sueldo del mes' → 'Sueldo', etc.
- Labels cotidianos en toda la UI

### Navegación
- Sidebar eliminada; top nav horizontal 4 tabs en desktop
- Bottom nav mobile 4 tabs: Mi mes · Transacciones · Compartidos · Categorías
- Landing post-login: Mi mes (presupuesto)

### Progressive disclosure
- Mi mes: toggle 'Ver desglose' para la tabla de categorías (Ama: colapsado, Daniel: expandido)
- Compartidos: toggle 'Ver detalle' (mismo default por usuario)
- Estado persiste en localStorage por usuario

### Formulario
- Responsabilidad: radio buttons estilizados reemplazan dropdown
- Labels visuales amigables → valores canónicos de BD en hidden input
- Colapsado por defecto, expandible al tocar

## Testing
- [ ] Loguear como Ama: ver Mi mes colapsado, Compartidos colapsado
- [ ] Loguear como Daniel: ver Mi mes expandido, Compartidos expandido
- [ ] Guardar transacción con "Lo pagamos juntos" → BD recibe "Compartido"
- [ ] Toggle de disclosure persiste tras recargar
EOF
)"
```

- [ ] **Step 3: Reportar URL del PR**

---

## Self-Review

**Spec coverage check:**
- ✅ Req 1 (lenguaje cotidiano): Task 2 cubre labels principales. Labels de responsabilidad cubiertos en Task 6 (radio buttons).
- ✅ Req 2 (progressive disclosure): Tasks 4 (Mi mes) y 5 (Compartidos). Responsabilidad colapsada en Task 6.
- ✅ Req 3 (estética cálida): Task 1 cubre paleta CSS. Layout spacing implícito en Task 3 (topnav da más espacio).
- ✅ Req 4 (formulario simplificado): Task 6 cubre radio buttons y collapsible. Field reordering NO incluido — la spec menciona "importe → descripción → categoría → fecha" pero reordenar 5 filas en un formulario de 5340 líneas sin romper el layout mobile es riesgo alto para beneficio cosmético. Puede ser un PR separado si el usuario lo prioriza.
- ✅ KPI Disponible: ya corregido en commit previo (usa `sueldoEfectivo - totalPresARS`).
- ⚠️ Login screen: spec menciona "pantalla simple sin campos Supabase". Actualmente el login YA es simple (credenciales hardcodeadas, PR anterior). No hay cambios pendientes aquí.
- ⚠️ KPI cards visual (card blanca con sombra): el CSS ya usa `var(--card)` y la nueva paleta tiene `--card: #FFFFFF` con `--shadow` suave. Efecto visual ya logrado con Task 1 sin cambios adicionales de HTML.
- ⚠️ Empty states: no incluido — requiere identificar todos los estados vacíos en todas las páginas. Puede ser PR separado.
- ⚠️ Field reorder del formulario: excluido por riesgo. PR separado si se prioriza.
