# Metas de Ahorro — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir definir una meta de ahorro (nombre, monto objetivo, fecha opcional, individual o compartida) y convertir la tarjeta existente "Ahorro acumulado" (`mm-sc-ahorro`) en una barra de progreso hacia esa meta.

**Architecture:** Nuevo módulo `14-metas-ahorro.js` con CRUD contra tabla Supabase `metas_ahorro` (RLS), cálculo de progreso client-side sobre `allTransac`, y render que alterna entre el estado "sin meta" (comportamiento actual) y "con meta" (barra de progreso) dentro de la misma tarjeta `.mm-sc`. Modal de gestión sigue el patrón visual de `modal-recurrentes`.

**Tech Stack:** Vanilla JS, Supabase (PostgreSQL + RLS), build.sh (concatenación alfabética de `src/js/*.js`)

---

## Archivos involucrados

| Acción | Archivo |
|---|---|
| Crear | `src/js/14-metas-ahorro.js` |
| Modificar | `src/index.template.html` — tarjeta `mm-sc-ahorro`, modal nuevo, CSS |
| Modificar | `src/js/03-data.js` — cargar meta activa en `iniciarApp()` |
| Modificar | `src/js/07-presupuesto.js` — `renderPresupuesto()` y `actualizarKpisPres()` llaman `renderMetaAhorro()` |
| SQL (manual) | Supabase SQL Editor — crear tabla `metas_ahorro` |

> `build.sh` ya incluye `14-metas-ahorro.js` automáticamente: usa `sorted(glob.glob("src/js/*.js"))` — orden alfabético, sin cambios necesarios.

---

## Task 1: Migración SQL — tabla `metas_ahorro`

**Files:**
- SQL a ejecutar en: Supabase Dashboard → SQL Editor

- [ ] **Paso 1: Ejecutar la migración en Supabase SQL Editor**

```sql
create table metas_ahorro (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  usuario text not null,              -- "Daniel" | "Ama"
  nombre text not null,               -- "Vacaciones a Bariloche"
  monto_objetivo numeric(12,2) not null check (monto_objetivo > 0),
  moneda text not null default 'ARS', -- ARS | USD
  fecha_objetivo date,                -- opcional
  fecha_inicio timestamptz not null default now(),
  compartida boolean not null default false,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_metas_ahorro_user_id on metas_ahorro(user_id);

alter table metas_ahorro enable row level security;

create policy "metas_ahorro_select" on metas_ahorro
  for select using (auth.uid() = user_id or compartida = true);

create policy "metas_ahorro_insert" on metas_ahorro
  for insert with check (auth.uid() = user_id);

create policy "metas_ahorro_update" on metas_ahorro
  for update using (auth.uid() = user_id);

create policy "metas_ahorro_delete" on metas_ahorro
  for delete using (auth.uid() = user_id);

-- Solo una meta activa por usuario
create unique index metas_ahorro_activa_unica on metas_ahorro(user_id) where activa = true;
```

- [ ] **Paso 2: Verificar en Table Editor de Supabase**

Confirmar que la tabla `metas_ahorro` aparece con las columnas correctas, que RLS está habilitado (ícono de candado), y que el índice único parcial `metas_ahorro_activa_unica` existe (Database → Indexes).

- [ ] **Paso 3: Commit**

```bash
git commit --allow-empty -m "infra: tabla metas_ahorro creada en Supabase (RLS habilitado)"
```

---

## Task 2: Crear `14-metas-ahorro.js` — estado, carga y progreso

**Files:**
- Create: `src/js/14-metas-ahorro.js`

- [ ] **Paso 1: Crear el archivo con estado global, carga y cálculo de progreso**

```javascript
// ─── METAS DE AHORRO ──────────────────────────────────────────
let metaActiva = null; // meta activa cargada desde Supabase (propia o compartida del partner)

// ─── SUPABASE: CARGA ──────────────────────────────────────────

async function cargarMetaAhorro() {
  try {
    const { data, error } = await supabaseClient
      .from('metas_ahorro')
      .select('*')
      .eq('activa', true);
    if (error) throw error;
    const metas = data || [];
    const propia = metas.find(m => m.usuario === USUARIO);
    const compartidaPartner = metas.find(m => m.compartida && m.usuario !== USUARIO);
    metaActiva = propia || compartidaPartner || null;
  } catch(e) {
    console.warn("Error cargando meta de ahorro:", e);
    metaActiva = null;
  }
}

// ─── PROGRESO ─────────────────────────────────────────────────

function calcularProgresoMeta(meta) {
  const desde = new Date(meta.fecha_inicio);
  const total = allTransac
    .filter(t => t.categoria === "Ahorro" && !esTransferencia(t) && new Date(t.fecha) >= desde)
    .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
  const pct = Math.min(100, (total / meta.monto_objetivo) * 100);
  return { total, pct, restante: Math.max(0, meta.monto_objetivo - total) };
}
```

- [ ] **Paso 2: Agregar funciones Supabase CRUD (guardar/eliminar)**

```javascript
// ─── SUPABASE: CRUD ───────────────────────────────────────────

async function guardarMetaAhorro({ nombre, monto_objetivo, moneda, fecha_objetivo, compartida }) {
  if (!nombre || !(monto_objetivo > 0)) {
    showToast("Completá nombre y monto objetivo", "err");
    return;
  }
  try {
    const propia = metaActiva && metaActiva.usuario === USUARIO ? metaActiva : null;
    if (propia) {
      const { error: errArchivar } = await supabaseClient
        .from('metas_ahorro')
        .update({ activa: false })
        .eq('id', propia.id);
      if (errArchivar) throw errArchivar;
    }
    const payload = {
      user_id:        supabaseSession.user.id,
      usuario:        USUARIO,
      nombre,
      monto_objetivo,
      moneda,
      fecha_objetivo: fecha_objetivo || null,
      compartida:     !!compartida,
      activa:         true
    };
    const { error } = await supabaseClient.from('metas_ahorro').insert([payload]);
    if (error) throw error;
    await cargarMetaAhorro();
    renderMetaAhorro();
    cerrarModalMeta();
    showToast("✅ Meta guardada", "ok");
  } catch(e) {
    showToast("❌ Error al guardar la meta", "err");
  }
}

async function eliminarMetaAhorro() {
  const propia = metaActiva && metaActiva.usuario === USUARIO ? metaActiva : null;
  if (!propia) return;
  if (!confirm("¿Eliminar esta meta de ahorro?")) return;
  try {
    const { error } = await supabaseClient.from('metas_ahorro').delete().eq('id', propia.id);
    if (error) throw error;
    await cargarMetaAhorro();
    renderMetaAhorro();
    cerrarModalMeta();
    showToast("✅ Meta eliminada", "ok");
  } catch(e) {
    showToast("❌ Error al eliminar la meta", "err");
  }
}
```

- [ ] **Paso 3: Build y verificar que no hay errores de sintaxis**

```bash
./build.sh
```

Expected: termina sin errores. `grep -c "function cargarMetaAhorro" index.html` debe devolver `1`.

- [ ] **Paso 4: Commit**

```bash
git add src/js/14-metas-ahorro.js
git commit -m "feat(metas-ahorro): módulo de carga, progreso y CRUD Supabase"
```

---

## Task 3: HTML — tarjeta `mm-sc-ahorro` con dos estados + modal + CSS

**Files:**
- Modify: `src/index.template.html`

- [ ] **Paso 1: Reemplazar la tarjeta `mm-sc-ahorro` (línea ~3134) por la versión con dos estados**

Buscar este bloque:

```html
          <div class="card mm-sc">
            <div class="mm-sc-icon">🐷</div>
            <div class="mm-sc-label">Ahorro acumulado</div>
            <div class="mm-sc-val" style="color:var(--pos)" id="mm-sc-ahorro">—</div>
            <div class="mm-sc-sub" id="mm-sc-ahorro-sub">este mes</div>
          </div>
```

Reemplazarlo por:

```html
          <div class="card mm-sc">
            <div id="mm-sc-ahorro-default">
              <div class="mm-sc-icon">🐷</div>
              <div class="mm-sc-label">Ahorro acumulado</div>
              <div class="mm-sc-val" style="color:var(--pos)" id="mm-sc-ahorro">—</div>
              <div class="mm-sc-sub" id="mm-sc-ahorro-sub">este mes</div>
              <div class="mm-sc-meta-link" onclick="abrirModalMeta()">🎯 Definir meta de ahorro</div>
            </div>
            <div id="mm-sc-ahorro-meta" style="display:none">
              <div class="mm-sc-meta-top">
                <div class="mm-sc-icon">🎯</div>
                <span class="mm-sc-meta-edit" onclick="abrirModalMeta()">✏️</span>
              </div>
              <div class="mm-sc-label" id="mm-sc-meta-nombre">—</div>
              <div class="mm-sc-meta-bar-track">
                <div class="mm-sc-meta-bar-fill" id="mm-sc-meta-bar"></div>
              </div>
              <div class="mm-sc-meta-pct" id="mm-sc-meta-pct">0%</div>
              <div class="mm-sc-sub" id="mm-sc-meta-sub">—</div>
              <div class="mm-sc-meta-badge" id="mm-sc-meta-badge" style="display:none">🤝 Compartida con <span id="mm-sc-meta-partner"></span></div>
            </div>
          </div>
```

- [ ] **Paso 2: Agregar modal "Meta de ahorro"**

Buscar el cierre del modal de recurrentes:

```html
<!-- /MODAL RECURRENTES -->
```

Justo después, agregar:

```html

<!-- MODAL META DE AHORRO -->
<div id="modal-meta-ahorro" class="modal-overlay" style="display:none" onclick="if(event.target===this)cerrarModalMeta()">
  <div class="modal-content modal-recur">
    <div class="modal-recur-header">
      <h3 class="modal-recur-title">🎯 Meta de ahorro</h3>
      <button class="modal-close-btn" onclick="cerrarModalMeta()">×</button>
    </div>
    <div class="modal-recur-add-form" style="display:flex">
      <input id="meta-nombre" type="text" class="modal-recur-input" placeholder="Nombre (ej: Vacaciones a Bariloche)">
      <input id="meta-monto" type="text" inputmode="decimal" class="modal-recur-input" placeholder="Monto objetivo">
      <select id="meta-moneda" class="modal-recur-input">
        <option value="ARS">ARS</option>
        <option value="USD">USD</option>
      </select>
      <input id="meta-fecha" type="date" class="modal-recur-input">
      <label class="meta-check-label">
        <input type="checkbox" id="meta-compartida"> Meta compartida con <span id="meta-partner-label">Ama</span>
      </label>
      <div class="modal-recur-add-actions">
        <button class="btn-recur-confirm" onclick="_guardarMetaForm()">Guardar</button>
        <button class="btn-recur-ignore" id="meta-btn-eliminar" onclick="_eliminarMetaForm()" style="display:none">Eliminar meta</button>
      </div>
    </div>
  </div>
</div>
<!-- /MODAL META DE AHORRO -->
```

- [ ] **Paso 3: Agregar CSS** (dentro del bloque `<style>`, justo después de `.mm-sc-sub` línea ~1884)

Buscar:

```css
  .mm-sc-sub   { font-size: 12px; color: var(--text-faint); margin-top: 4px; }
```

Reemplazar por:

```css
  .mm-sc-sub   { font-size: 12px; color: var(--text-faint); margin-top: 4px; }
  .mm-sc-meta-link {
    font-size: 11px; color: var(--accent); margin-top: 6px; cursor: pointer;
  }
  .mm-sc-meta-top { display: flex; align-items: center; justify-content: space-between; }
  .mm-sc-meta-edit { cursor: pointer; font-size: .85rem; opacity: .7; }
  .mm-sc-meta-bar-track {
    background: var(--bg2); border-radius: 6px; height: 8px; overflow: hidden; margin: 8px 0 4px;
  }
  .mm-sc-meta-bar-fill {
    background: var(--pos); height: 100%; border-radius: 6px; transition: width .5s var(--ease-out);
  }
  .mm-sc-meta-pct { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--text); }
  .mm-sc-meta-badge {
    display: inline-block; margin-top: 6px; font-size: 11px; color: var(--text-muted);
    background: var(--bg2); border-radius: 10px; padding: 2px 8px;
  }
  .meta-check-label {
    display: flex; align-items: center; gap: 6px; color: var(--text-muted); font-size: .8rem; margin-top: 2px;
  }
```

- [ ] **Paso 4: Build y verificar que no hay errores de sintaxis**

```bash
./build.sh
```

Expected: termina sin errores. `grep -c "modal-meta-ahorro" index.html` debe devolver `2` (apertura + referencias en CSS/JS aún no, pero el div debe estar presente al menos 1 vez en el HTML — verificar con `grep -c "id=\"modal-meta-ahorro\"" index.html` que da `1`).

- [ ] **Paso 5: Commit**

```bash
git add src/index.template.html
git commit -m "feat(metas-ahorro): HTML tarjeta dos estados + modal gestión + CSS"
```

---

## Task 4: Render de la tarjeta y del modal en `14-metas-ahorro.js`

**Files:**
- Modify: `src/js/14-metas-ahorro.js`

- [ ] **Paso 1: Agregar `renderMetaAhorro()`**

Agregar al final del archivo:

```javascript

// ─── RENDER TARJETA MI MES ────────────────────────────────────

function renderMetaAhorro() {
  const cardDefault = document.getElementById('mm-sc-ahorro-default');
  const cardMeta    = document.getElementById('mm-sc-ahorro-meta');
  if (!cardDefault || !cardMeta) return;

  if (!metaActiva) {
    cardDefault.style.display = '';
    cardMeta.style.display = 'none';
    return;
  }

  cardDefault.style.display = 'none';
  cardMeta.style.display = '';

  const { total, pct, restante } = calcularProgresoMeta(metaActiva);

  document.getElementById('mm-sc-meta-nombre').textContent = metaActiva.nombre;
  document.getElementById('mm-sc-meta-bar').style.width = pct + '%';
  document.getElementById('mm-sc-meta-pct').textContent = Math.round(pct) + '%';

  let sub = `${fmtMoneda(total, metaActiva.moneda)} / ${fmtMoneda(metaActiva.monto_objetivo, metaActiva.moneda)} · faltan ${fmtMoneda(restante, metaActiva.moneda)}`;
  if (metaActiva.fecha_objetivo) {
    sub += ` · meta: ${fmtFecha(metaActiva.fecha_objetivo)}`;
  }
  document.getElementById('mm-sc-meta-sub').textContent = sub;

  const badge = document.getElementById('mm-sc-meta-badge');
  if (metaActiva.compartida) {
    document.getElementById('mm-sc-meta-partner').textContent = PARTNER;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }

  if (pct >= 100) {
    const flag = USUARIO + "_meta_celebrada_" + metaActiva.id;
    if (!localStorage.getItem(flag)) {
      _confettiBrief({ count: 80 });
      showToast("¡Felicitaciones, cumpliste tu meta de ahorro! 🎉", "ok");
      localStorage.setItem(flag, "1");
    }
  }
}
```

- [ ] **Paso 2: Agregar funciones del modal**

Agregar al final del archivo:

```javascript

// ─── MODAL META DE AHORRO ─────────────────────────────────────

function abrirModalMeta() {
  _renderModalMeta();
  document.getElementById('modal-meta-ahorro').style.display = 'flex';
}

function cerrarModalMeta() {
  document.getElementById('modal-meta-ahorro').style.display = 'none';
}

function _renderModalMeta() {
  const propia = metaActiva && metaActiva.usuario === USUARIO ? metaActiva : null;
  document.getElementById('meta-nombre').value     = propia ? propia.nombre : '';
  document.getElementById('meta-monto').value      = propia ? propia.monto_objetivo : '';
  document.getElementById('meta-moneda').value     = propia ? propia.moneda : 'ARS';
  document.getElementById('meta-fecha').value      = propia && propia.fecha_objetivo ? propia.fecha_objetivo : '';
  document.getElementById('meta-compartida').checked = propia ? !!propia.compartida : false;
  document.getElementById('meta-partner-label').textContent = PARTNER;
  document.getElementById('meta-btn-eliminar').style.display = propia ? '' : 'none';
}

function _guardarMetaForm() {
  const nombre     = document.getElementById('meta-nombre').value.trim();
  const monto      = parsearDecimal(document.getElementById('meta-monto').value);
  const moneda     = document.getElementById('meta-moneda').value;
  const fecha      = document.getElementById('meta-fecha').value;
  const compartida = document.getElementById('meta-compartida').checked;
  guardarMetaAhorro({ nombre, monto_objetivo: monto, moneda, fecha_objetivo: fecha, compartida });
}

function _eliminarMetaForm() {
  eliminarMetaAhorro();
}
```

- [ ] **Paso 3: Build**

```bash
./build.sh
```

Expected: termina sin errores. `grep -c "function renderMetaAhorro" index.html` debe devolver `1`.

- [ ] **Paso 4: Commit**

```bash
git add src/js/14-metas-ahorro.js
git commit -m "feat(metas-ahorro): render tarjeta Mi mes y modal de gestión"
```

---

## Task 5: Integrar carga en `03-data.js`

**Files:**
- Modify: `src/js/03-data.js`

- [ ] **Paso 1: Agregar `cargarMetaAhorro()` en el path con cache (línea ~166)**

Buscar:

```javascript
    Promise.all([cargarCategorias(), cargarTodasTransacciones(), cargarRecurrentes()])
```

Reemplazar por:

```javascript
    Promise.all([cargarCategorias(), cargarTodasTransacciones(), cargarRecurrentes(), cargarMetaAhorro()])
```

- [ ] **Paso 2: Agregar `cargarMetaAhorro()` en el path sin cache (línea ~176)**

Buscar:

```javascript
      await Promise.all([cargarCategorias(), cargarTodasTransacciones(), cargarRecurrentes()]);
```

Reemplazar por:

```javascript
      await Promise.all([cargarCategorias(), cargarTodasTransacciones(), cargarRecurrentes(), cargarMetaAhorro()]);
```

- [ ] **Paso 3: Build**

```bash
./build.sh
```

Expected: termina sin errores. `grep -c "cargarMetaAhorro()" index.html` debe devolver `2`.

- [ ] **Paso 4: Commit**

```bash
git add src/js/03-data.js
git commit -m "feat(metas-ahorro): cargar meta activa junto con transacciones en iniciarApp"
```

---

## Task 6: Integrar render en `07-presupuesto.js`

**Files:**
- Modify: `src/js/07-presupuesto.js`

- [ ] **Paso 1: Llamar `renderMetaAhorro()` dentro del IIFE de `renderPresupuesto()` (línea ~511)**

Buscar:

```javascript
    _s('mm-sc-ahorro',     fmt(ahorroMesCat));
    _s('mm-sc-ahorro-sub', 'acumulado: ' + fmt(ahorroAcumCat));
    const partnerEl = document.getElementById('mm-sc-comp-partner');
    if (partnerEl) partnerEl.textContent = PARTNER;
  })();
```

Reemplazar por:

```javascript
    _s('mm-sc-ahorro',     fmt(ahorroMesCat));
    _s('mm-sc-ahorro-sub', 'acumulado: ' + fmt(ahorroAcumCat));
    const partnerEl = document.getElementById('mm-sc-comp-partner');
    if (partnerEl) partnerEl.textContent = PARTNER;
    renderMetaAhorro();
  })();
```

- [ ] **Paso 2: Llamar `renderMetaAhorro()` al final de `actualizarKpisPres()` (línea ~905)**

Buscar:

```javascript
  const subTotal = document.getElementById("pres-kpi-total-sub");
  if (subTotal) {
    subTotal.textContent = totalPctPres.toFixed(0) + "% del sueldo asignado";
  }
}
```

Reemplazar por:

```javascript
  const subTotal = document.getElementById("pres-kpi-total-sub");
  if (subTotal) {
    subTotal.textContent = totalPctPres.toFixed(0) + "% del sueldo asignado";
  }

  renderMetaAhorro();
}
```

> Nota: hay dos funciones `actualizarKpisPres` y `renderPresupuesto` con bloques `subTotal` similares (líneas ~513-517 y ~901-904) — verificar que el reemplazo se aplica al de `actualizarKpisPres` (el segundo, dentro de la función que termina en línea ~905), no al de `renderPresupuesto`. El de `renderPresupuesto` ya queda cubierto por el Paso 1.

- [ ] **Paso 3: Build**

```bash
./build.sh
```

Expected: termina sin errores. `grep -c "renderMetaAhorro()" index.html` debe devolver al menos `4` (2 llamadas + 1 definición + invocaciones internas del modal).

- [ ] **Paso 4: Commit**

```bash
git add src/js/07-presupuesto.js
git commit -m "feat(metas-ahorro): renderizar tarjeta de meta al cargar y actualizar Mi mes"
```

---

## Task 7: Verificación end-to-end

- [ ] **Paso 1: Abrir la app en el navegador, ir a Mi mes**

Confirmar que la tarjeta "Ahorro acumulado" se ve igual que antes (sin meta configurada) y que aparece el link "🎯 Definir meta de ahorro".

- [ ] **Paso 2: Crear una meta**

Click en "🎯 Definir meta de ahorro" → completar nombre, monto objetivo, moneda, fecha opcional → Guardar. Confirmar:
- La tarjeta cambia a modo progreso (nombre, barra, %, sub-texto con `total / objetivo · faltan $X`).
- El ícono ✏️ abre el modal con los datos pre-cargados.

- [ ] **Paso 3: Probar reemplazo de meta**

Editar la meta (✏️) y guardar con datos distintos. Confirmar que el progreso se resetea a 0% (porque `fecha_inicio` se actualiza).

- [ ] **Paso 4: Probar meta compartida**

Marcar "Meta compartida con [PARTNER]" y guardar. Loguearse como el otro usuario (Daniel/Ama) y confirmar que ve la misma meta (nombre/monto/fecha) con su propio progreso, y el badge "🤝 Compartida con [PARTNER]".

- [ ] **Paso 5: Probar eliminar meta**

Abrir el modal → "Eliminar meta". Confirmar que la tarjeta vuelve al estado "sin meta" (comportamiento original + link "Definir meta").

- [ ] **Paso 6: Probar celebración (pct >= 100)**

Con una meta de monto bajo, cargar un gasto en categoría "Ahorro" que la complete. Confirmar confetti + toast "¡Felicitaciones...!" una sola vez (recargar la página y confirmar que NO se repite).

- [ ] **Paso 7: Mobile responsiveness**

Verificar en viewport mobile que la tarjeta y el modal no overflowean ni rompen el layout de `mm-row2`.

- [ ] **Paso 8: Push**

```bash
git push
```

---

## Self-Review

**Cobertura del spec:**
- ✅ Modelo de datos `metas_ahorro` con RLS e índice único parcial → Task 1.
- ✅ `calcularProgresoMeta()` exactamente como en el spec → Task 2 Paso 1.
- ✅ Carga de meta propia o compartida del partner con prioridad a la propia → Task 2 Paso 1 (`cargarMetaAhorro`).
- ✅ Reemplazo de meta archiva la anterior y resetea `fecha_inicio` (insert nuevo con `fecha_inicio = now()` por default) → Task 2 Paso 2 (`guardarMetaAhorro`).
- ✅ Eliminar meta activa = hard delete → Task 2 Paso 2 (`eliminarMetaAhorro`).
- ✅ `monto_objetivo <= 0` bloqueado en formulario → Task 2 Paso 2 (`guardarMetaAhorro` valida antes de enviar) + DB check constraint.
- ✅ UI tarjeta sin meta (link "Definir meta") y con meta (barra, %, sub-texto, ✏️, badge 🤝) → Task 3 Paso 1.
- ✅ Modal con nombre/monto/moneda/fecha/checkbox compartida/Guardar/Eliminar → Task 3 Paso 2, Task 4 Paso 2.
- ✅ Celebración con confetti + toast + flag localStorage por meta → Task 4 Paso 1.
- ✅ Integración en `03-data.js` → Task 5.
- ✅ Integración en `07-presupuesto.js` (ambas funciones) → Task 6.

**Placeholder scan:** sin TBD/TODO, todo el código es completo y ejecutable.

**Consistencia de tipos/firmas:** `metaActiva` (objeto o `null`), `calcularProgresoMeta(meta)` → `{total, pct, restante}`, `guardarMetaAhorro({nombre, monto_objetivo, moneda, fecha_objetivo, compartida})`, `renderMetaAhorro()` sin argumentos — usados de forma consistente en Tasks 2, 4, 6.

---

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-06-10-metas-ahorro.md`. Dos opciones de ejecución:

**1. Subagent-Driven (recomendado)** — despacho un subagente fresco por tarea, reviso entre tareas, iteración rápida.

**2. Inline Execution** — ejecuto las tareas en esta sesión usando executing-plans, en bloque con checkpoints.

¿Cuál preferís?
