# Proporción Personalizada de Gastos Compartidos — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el split 50/50 hardcodeado de transacciones `"Compartido"` por una proporción configurable por mes/año (ej. 60/40), persistida en una tabla Supabase nueva, con herencia hacia el futuro y fallback a 50/50 si nunca se configuró nada.

**Architecture:** Nuevo módulo `src/js/16-proporcion.js` con estado en memoria (`proporcionesCompartidos[]`), una función de resolución (`obtenerProporcionParaMes`) que implementa la herencia, y un helper de conveniencia (`obtenerFactorCompartidoPropio`) para los consumidores que solo necesitan "mi propia fracción". Todos los puntos del código que hoy multiplican por `0.5` o dividen por `2` para responsabilidad `"Compartido"` pasan a usar estas funciones. La UI vive inline en la página Compartidos, junto al selector de mes/año existente.

**Tech Stack:** Vanilla JS, Supabase (PostgreSQL + RLS), build.sh (concatenación alfabética de `src/js/*.js`)

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-07-02-proporcion-compartidos-design.md` (aprobado).
- Proporción configurable por mes/año, NO por categoría ni por transacción individual (fuera de alcance).
- El ratio es compartido (mismo valor para Daniel y Ama), nunca una preferencia per-usuario.
- Mes sin configuración hereda el último valor configurado hacia atrás en el tiempo; si nunca se configuró nada, fallback a 50/50.
- Cambiar el ratio de un mes pasado NO debe afectar otros meses.
- `PARTNER`/`USUARIO` son variables dinámicas — nunca hardcodear "Daniel"/"Ama" en texto de UI (sí se usan como anclas fijas en el modelo de datos, ver Sección 1 del spec).
- Sin suite de tests automatizada en este proyecto — toda verificación es manual sobre el preview de Vercel.
- Mobile responsiveness y tema claro de Ama (`[data-theme="light"]`) son restricciones de diseño obligatorias para cualquier UI nueva.

---

## Archivos involucrados

| Acción | Archivo |
|---|---|
| Crear | `src/js/16-proporcion.js` |
| Modificar | `src/index.template.html` — control de reparto inline en Compartidos, CSS, ids dinámicos |
| Modificar | `src/js/03-data.js` — cargar `proporcionesCompartidos` en `iniciarApp()` |
| Modificar | `src/js/06-compartidos.js` — UI de reparto + reemplazo de `/2`/`*0.5` en balance, categorías y drill-down |
| Modificar | `src/js/07-presupuesto.js` — reemplazo de `/2`/`*0.5` en presupuesto, sparklines, tendencias, KPIs |
| Modificar | `src/js/04-graficos.js` — reemplazo de `*0.5` en Resumen mensual |
| Modificar | `src/js/10-utils.js` — reemplazo de `*0.5` en sparklines de Mi mes |
| Modificar | `src/js/11-cuotas.js` — reemplazo de factor fijo en la card de cuotas |
| SQL (manual) | Supabase SQL Editor — crear tabla `proporcion_compartidos` |

> `build.sh` incluye `16-proporcion.js` automáticamente: usa `sorted(glob.glob("src/js/*.js"))` — orden alfabético, sin cambios necesarios en `build.sh`.

### Nota de implementación importante (desviación menor respecto al spec)

El spec (Sección 2) menciona cachear `proporcionesCompartidos` en `localStorage`. Al revisar el código real de tablas chicas equivalentes (`recurrentes`, `metas_ahorro` en `13-recurrentes.js`/`14-metas-ahorro.js`), **ninguna usa caché en localStorage** — ambas simplemente caen a un estado vacío/null en caso de error. Este plan sigue el patrón real y establecido del proyecto (sin localStorage) en vez de introducir un mecanismo nuevo no usado en ningún otro lado del código: el objetivo del spec ("nunca romper la app si falla la carga") se cumple igual, porque `obtenerProporcionParaMes()` cae a 50/50 cuando el array está vacío.

### Bugs pre-existentes descubiertos y corregidos como parte de este trabajo

Al auditar cada punto donde se usa `/2` o `*0.5`, se encontraron dos casos donde el código asume implícitamente que `USUARIO === "Daniel"`, algo invisible hoy porque a 50/50 el bug no cambia ningún número — pero se volvería un bug visible en la sesión de Ama en cuanto el reparto deje de ser 50/50:

1. `06-compartidos.js`, mapas `compPorCatARS`/`compPorCatUSD`: las claves `.daniel`/`.ama` en realidad representan "yo" (`USUARIO`) y "el otro" (`PARTNER`) respectivamente, **no** los nombres literales — se corrige el cálculo para usar el ratio relativo a la sesión (`pctUsuarioMes`/`pctPartnerMes`), no el literal `pctDaniel`/`pctAma`.
2. `06-compartidos.js`, drill-down de transacciones (`buildCompRows`): la variable `esAma` compara literalmente `t.usuario === "ama"` en vez de comparar contra `PARTNER` — en la sesión de Ama esto asigna la transacción al bucket equivocado. Se corrige a una comparación relativa a la sesión (`pagoPartner`).

Ambos se corrigen en la Tarea 6, con el detalle exacto documentado ahí.

---

## Task 1: Migración SQL — tabla `proporcion_compartidos`

**Files:**
- SQL a ejecutar en: Supabase Dashboard → SQL Editor

- [ ] **Paso 1: Ejecutar la migración en Supabase SQL Editor**

```sql
create table proporcion_compartidos (
  id           uuid primary key default gen_random_uuid(),
  mes          smallint not null check (mes between 1 and 12),
  anio         smallint not null,
  pct_daniel   numeric(5,2) not null check (pct_daniel >= 0 and pct_daniel <= 100),
  updated_by   text,
  updated_at   timestamptz not null default now(),
  unique (mes, anio)
);

create index if not exists idx_proporcion_compartidos_mes_anio on proporcion_compartidos(mes, anio);

alter table proporcion_compartidos enable row level security;

-- Sin user_id: el ratio es compartido entre Daniel y Ama, cualquier usuario autenticado
-- de esta instancia puede leer y escribir todas las filas.
create policy "proporcion_compartidos_select" on proporcion_compartidos
  for select using (auth.role() = 'authenticated');

create policy "proporcion_compartidos_insert" on proporcion_compartidos
  for insert with check (auth.role() = 'authenticated');

create policy "proporcion_compartidos_update" on proporcion_compartidos
  for update using (auth.role() = 'authenticated');
```

- [ ] **Paso 2: Verificar en Table Editor de Supabase**

Confirmar que la tabla `proporcion_compartidos` aparece con las columnas correctas, que RLS está habilitado (ícono de candado), y que el índice `idx_proporcion_compartidos_mes_anio` existe (Database → Indexes).

- [ ] **Paso 3: Commit**

```bash
git commit --allow-empty -m "infra: tabla proporcion_compartidos creada en Supabase (RLS habilitado)"
```

---

## Task 2: Crear `16-proporcion.js` — estado, resolución y persistencia

**Files:**
- Create: `src/js/16-proporcion.js`

**Interfaces:**
- Produces: `proporcionesCompartidos` (array), `cargarProporcionesCompartidos()` (async, sin retorno), `obtenerProporcionParaMes(mes, anio)` → `{ pctDaniel, pctAma }`, `obtenerFactorCompartidoPropio(mes, anio)` → number (0–1), `guardarProporcionMes(mes, anio, pctDanielInput)` (async, sin retorno)

- [ ] **Paso 1: Crear el archivo con estado, carga y resolución**

```javascript
// ─── PROPORCIÓN DE GASTOS COMPARTIDOS ──────────────────────────
let proporcionesCompartidos = []; // filas de proporcion_compartidos cacheadas en memoria

async function cargarProporcionesCompartidos() {
  try {
    const { data, error } = await supabaseClient
      .from('proporcion_compartidos')
      .select('*');
    if (error) throw error;
    proporcionesCompartidos = data || [];
  } catch(e) {
    console.warn("Error cargando proporcion_compartidos:", e);
    proporcionesCompartidos = [];
  }
}

// Resuelve el ratio vigente para un mes/año dado, con herencia del último
// valor configurado hacia atrás en el tiempo. Fallback 50/50 si no hay nada.
function obtenerProporcionParaMes(mes, anio) {
  const periodoObjetivo = anio * 12 + mes;
  const candidatas = proporcionesCompartidos
    .filter(p => (p.anio * 12 + p.mes) <= periodoObjetivo)
    .sort((a, b) => (b.anio * 12 + b.mes) - (a.anio * 12 + a.mes));
  if (!candidatas.length) return { pctDaniel: 50, pctAma: 50 };
  const pctDaniel = Number(candidatas[0].pct_daniel);
  return { pctDaniel, pctAma: 100 - pctDaniel };
}

// Fracción (0–1) que le corresponde al usuario de la sesión actual (USUARIO)
// para un mes dado. Los consumidores que solo necesitan "mi propia parte"
// (Mi mes, Resumen, cuotas, sparklines) usan este helper en vez de
// obtenerProporcionParaMes() directamente.
function obtenerFactorCompartidoPropio(mes, anio) {
  const { pctDaniel, pctAma } = obtenerProporcionParaMes(mes, anio);
  const pct = USUARIO === "Daniel" ? pctDaniel : pctAma;
  return pct / 100;
}
```

- [ ] **Paso 2: Agregar la función de guardado (upsert)**

Agregar al final del archivo:

```javascript

async function guardarProporcionMes(mes, anio, pctDanielInput) {
  const pctDaniel = Math.max(0, Math.min(100, parsearDecimal(pctDanielInput)));
  try {
    const { error } = await supabaseClient
      .from('proporcion_compartidos')
      .upsert(
        { mes, anio, pct_daniel: pctDaniel, updated_by: USUARIO, updated_at: new Date().toISOString() },
        { onConflict: 'mes,anio' }
      );
    if (error) throw error;
    const idx = proporcionesCompartidos.findIndex(p => p.mes === mes && p.anio === anio);
    if (idx >= 0) proporcionesCompartidos[idx].pct_daniel = pctDaniel;
    else proporcionesCompartidos.push({ mes, anio, pct_daniel: pctDaniel, updated_by: USUARIO });
    showToast("✅ Reparto actualizado", "ok");
    if (typeof cargarCompartidos === "function") cargarCompartidos();
  } catch(e) {
    console.warn("Error guardando proporcion_compartidos:", e);
    showToast("⚠️ No se pudo guardar el reparto", "err");
  }
}
```

- [ ] **Paso 3: Build y verificar que no hay errores de sintaxis**

```bash
./build.sh
```

Expected: termina sin errores. `grep -c "function obtenerProporcionParaMes" index.html` debe devolver `1`.

- [ ] **Paso 4: Commit**

```bash
git add src/js/16-proporcion.js
git commit -m "feat(proporcion): módulo de carga, resolución con herencia y guardado del ratio mensual"
```

---

## Task 3: Integrar la carga en `03-data.js`

**Files:**
- Modify: `src/js/03-data.js`

**Interfaces:**
- Consumes: `cargarProporcionesCompartidos()` de Task 2

- [ ] **Paso 1: Agregar `cargarProporcionesCompartidos()` en el path con cache**

Buscar:

```javascript
    Promise.all([cargarCategorias(), cargarTodasTransacciones(), cargarRecurrentes(), cargarMetaAhorro()])
```

Reemplazar por:

```javascript
    Promise.all([cargarCategorias(), cargarTodasTransacciones(), cargarRecurrentes(), cargarMetaAhorro(), cargarProporcionesCompartidos()])
```

- [ ] **Paso 2: Agregar `cargarProporcionesCompartidos()` en el path sin cache**

Buscar:

```javascript
      await Promise.all([cargarCategorias(), cargarTodasTransacciones(), cargarRecurrentes(), cargarMetaAhorro()]);
```

Reemplazar por:

```javascript
      await Promise.all([cargarCategorias(), cargarTodasTransacciones(), cargarRecurrentes(), cargarMetaAhorro(), cargarProporcionesCompartidos()]);
```

- [ ] **Paso 3: Build**

```bash
./build.sh
```

Expected: termina sin errores. `grep -c "cargarProporcionesCompartidos()" index.html` debe devolver al menos `3` (2 llamadas de este task + 1 definición de Task 2).

- [ ] **Paso 4: Commit**

```bash
git add src/js/03-data.js
git commit -m "feat(proporcion): cargar proporción de compartidos junto con transacciones en iniciarApp"
```

---

## Task 4: HTML — control de reparto inline en Compartidos + CSS + ids dinámicos

**Files:**
- Modify: `src/index.template.html`

- [ ] **Paso 1: Agregar el control de reparto junto al selector de mes/año**

Buscar (dentro de `page-compartidos`):

```html
        <!-- Selector de mes -->
        <div class="mes-selector" style="margin-bottom:1.5rem">
          <select id="comp-mes"></select>
          <select id="comp-anio"></select>
        </div>
```

Reemplazar por:

```html
        <!-- Selector de mes -->
        <div class="mes-selector" style="margin-bottom:1.5rem">
          <select id="comp-mes"></select>
          <select id="comp-anio"></select>
        </div>

        <!-- Reparto de gastos compartidos del mes -->
        <div class="reparto-control" id="reparto-control" style="margin-bottom:1.5rem">
          <span class="reparto-label">Reparto:</span>
          <span class="reparto-nombre" id="reparto-nombre-a">Daniel</span>
          <input type="text" inputmode="decimal" id="reparto-pct-a" class="reparto-input" value="50">
          <span class="reparto-pct-sign">%</span>
          <span class="reparto-sep">/</span>
          <span class="reparto-nombre" id="reparto-nombre-b">Ama</span>
          <input type="text" inputmode="decimal" id="reparto-pct-b" class="reparto-input" value="50">
          <span class="reparto-pct-sign">%</span>
          <button class="reparto-guardar-btn" id="reparto-guardar-btn" onclick="_guardarReparto()" title="Guardar reparto del mes">💾</button>
        </div>
```

- [ ] **Paso 2: Dar id a la subtitle de "Contribución del mes" para poder actualizarla dinámicamente**

Buscar:

```html
            <div class="comp-contrib-subtitle">gastos divididos al 50%</div>
```

Reemplazar por:

```html
            <div class="comp-contrib-subtitle" id="comp-contrib-subtitle">gastos divididos al 50%</div>
```

- [ ] **Paso 3: Envolver el "50%" de la nota de Presupuesto en un span con id**

Buscar:

```html
          💡 Los valores se ingresan como <strong>% del sueldo</strong> del mes. Gastos <strong>Mío</strong> → 100% · <strong>Compartidos</strong> → 50% · <strong id="pres-note-partner">De Ama</strong> → 0%.
```

Reemplazar por:

```html
          💡 Los valores se ingresan como <strong>% del sueldo</strong> del mes. Gastos <strong>Mío</strong> → 100% · <strong>Compartidos</strong> → <strong id="pres-note-comp-pct">50%</strong> · <strong id="pres-note-partner">De Ama</strong> → 0%.
```

- [ ] **Paso 4: Agregar CSS del control de reparto**

Buscar:

```css
  .mes-selector select:focus { outline: none; border-color: var(--accent); }
```

Reemplazar por:

```css
  .mes-selector select:focus { outline: none; border-color: var(--accent); }

  /* ─── REPARTO DE COMPARTIDOS ────────────────────────────────── */
  .reparto-control {
    display: flex; align-items: center; gap: .4rem; flex-wrap: wrap;
    font-size: .82rem; color: var(--text-muted);
  }
  .reparto-label  { font-weight: 600; color: var(--text); }
  .reparto-nombre { color: var(--text); font-weight: 500; }
  .reparto-sep    { color: var(--text-faint); }
  .reparto-input {
    background: var(--card); border: 1px solid var(--border);
    color: var(--text); border-radius: 7px; padding: .3rem .4rem;
    width: 52px; text-align: right; font-family: inherit; font-size: .84rem;
    transition: border-color .15s;
  }
  .reparto-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
  .reparto-guardar-btn {
    background: var(--bg2); border: 1px solid var(--border); border-radius: 7px;
    padding: .3rem .5rem; cursor: pointer; font-size: .9rem; line-height: 1;
    transition: border-color .15s, background .15s;
  }
  .reparto-guardar-btn:hover { border-color: var(--accent); background: var(--bg3); }
```

- [ ] **Paso 5: Agregar regla mobile para que el control no rompa el layout**

Buscar:

```css
    .pres-note { font-size: .73rem; }
```

Reemplazar por:

```css
    .pres-note { font-size: .73rem; }
    .reparto-control { width: 100%; }
    .reparto-input { width: 44px; }
```

- [ ] **Paso 6: Build y verificar**

```bash
./build.sh
```

Expected: termina sin errores. `grep -c 'id="reparto-pct-a"' index.html` debe devolver `1`. `grep -c 'id="comp-contrib-subtitle"' index.html` debe devolver `1`.

- [ ] **Paso 7: Commit**

```bash
git add src/index.template.html
git commit -m "feat(proporcion): control de reparto inline en Compartidos + CSS + ids dinámicos"
```

---

## Task 5: Wiring de la UI de reparto en `06-compartidos.js`

**Files:**
- Modify: `src/js/06-compartidos.js`

**Interfaces:**
- Consumes: `obtenerProporcionParaMes(mes, anio)`, `guardarProporcionMes(mes, anio, pctDanielInput)` de Task 2
- Produces: `_guardarReparto()` — usado por el botón 💾 agregado en Task 4

- [ ] **Paso 1: Bindear los inputs enlazados al final de `inicializarSelectoresCompartidos()`**

Buscar:

```javascript
  const selAnio = document.getElementById("comp-anio");
  selAnio.innerHTML = "";
  for (let y = hoy.getFullYear(); y >= hoy.getFullYear() - 3; y--) {
    const o = document.createElement("option");
    o.value = y; o.textContent = y;
    if (y === hoy.getFullYear()) o.selected = true;
    selAnio.appendChild(o);
  }
  selAnio.onchange = cargarCompartidos;
}
```

Reemplazar por:

```javascript
  const selAnio = document.getElementById("comp-anio");
  selAnio.innerHTML = "";
  for (let y = hoy.getFullYear(); y >= hoy.getFullYear() - 3; y--) {
    const o = document.createElement("option");
    o.value = y; o.textContent = y;
    if (y === hoy.getFullYear()) o.selected = true;
    selAnio.appendChild(o);
  }
  selAnio.onchange = cargarCompartidos;

  // ── Reparto: inputs enlazados (tipear uno autocompleta el otro a 100-valor) ──
  const repA = document.getElementById("reparto-pct-a");
  const repB = document.getElementById("reparto-pct-b");
  if (repA && repB && !repA.dataset.bound) {
    repA.dataset.bound = "1";
    repA.addEventListener("input", () => {
      const v = Math.max(0, Math.min(100, parsearDecimal(repA.value)));
      repB.value = String(100 - v).replace(".", ",");
    });
    repB.addEventListener("input", () => {
      const v = Math.max(0, Math.min(100, parsearDecimal(repB.value)));
      repA.value = String(100 - v).replace(".", ",");
    });
  }
}

// Lee el input A (proporción de USUARIO) y guarda el reparto del mes actualmente visualizado.
function _guardarReparto() {
  const mes  = parseInt(document.getElementById("comp-mes").value);
  const anio = parseInt(document.getElementById("comp-anio").value);
  const pctUsuario = Math.max(0, Math.min(100, parsearDecimal(document.getElementById("reparto-pct-a").value)));
  const pctDaniel  = USUARIO === "Daniel" ? pctUsuario : 100 - pctUsuario;
  guardarProporcionMes(mes, anio, pctDaniel);
}
```

- [ ] **Paso 2: Pre-llenar los inputs de reparto al cargar un mes en `cargarCompartidos()`**

Buscar:

```javascript
function cargarCompartidos() {
  const mes  = parseInt(document.getElementById("comp-mes").value);
  const anio = parseInt(document.getElementById("comp-anio").value);
  const CATS = [...new Set([...categGasto, ...categIngreso])].sort();
```

Reemplazar por:

```javascript
function cargarCompartidos() {
  const mes  = parseInt(document.getElementById("comp-mes").value);
  const anio = parseInt(document.getElementById("comp-anio").value);
  const CATS = [...new Set([...categGasto, ...categIngreso])].sort();

  // ── Reparto del mes: resolver ratio vigente (con herencia) y pre-llenar UI ──
  const { pctDaniel: _repPctDaniel, pctAma: _repPctAma } = obtenerProporcionParaMes(mes, anio);
  const pctUsuarioMes = USUARIO === "Daniel" ? _repPctDaniel : _repPctAma;
  const pctPartnerMes = 100 - pctUsuarioMes;
  const repInputA  = document.getElementById("reparto-pct-a");
  const repInputB  = document.getElementById("reparto-pct-b");
  const repNombreA = document.getElementById("reparto-nombre-a");
  const repNombreB = document.getElementById("reparto-nombre-b");
  if (repInputA && repInputB) {
    repInputA.value = String(pctUsuarioMes).replace(".", ",");
    repInputB.value = String(pctPartnerMes).replace(".", ",");
  }
  if (repNombreA) repNombreA.textContent = USUARIO;
  if (repNombreB) repNombreB.textContent = PARTNER;
```

> Nota: `pctUsuarioMes`/`pctPartnerMes` quedan disponibles en el resto de `cargarCompartidos()` (misma función) — se usan en la Tarea 6 para reemplazar los `/2` y `*0.5` de este archivo, evitando resolver el ratio más de una vez por render.

- [ ] **Paso 3: Build y verificar**

```bash
./build.sh
```

Expected: termina sin errores. `grep -c "function _guardarReparto" index.html` debe devolver `1`.

- [ ] **Paso 4: Commit**

```bash
git add src/js/06-compartidos.js
git commit -m "feat(proporcion): UI de reparto en Compartidos — inputs enlazados, guardado y pre-llenado por mes"
```

---

## Task 6: Reemplazar el split hardcodeado en `06-compartidos.js`

**Files:**
- Modify: `src/js/06-compartidos.js`

**Interfaces:**
- Consumes: `obtenerProporcionParaMes(mes, anio)` de Task 2; `pctUsuarioMes`/`pctPartnerMes` de Task 5 (ya en scope de `cargarCompartidos()`)

- [ ] **Paso 1: Reemplazar `_calcularBalanceCompartido()` completa**

Buscar:

```javascript
// Calcula balance compartido del mes/año sin tocar DOM ni DB.
// + = PARTNER te debe | - = vos le debés a PARTNER
function _calcularBalanceCompartido(mes, anio) {
  const datos = allTransac.filter(t => {
    const { year, month } = getMesLiquidacion(t);
    return month === mes && year === anio && t.tipo === "Gasto";
  });
  const datosIng = allTransac.filter(t => {
    const { year, month } = getMesLiquidacion(t);
    return month === mes && year === anio && t.tipo === "Ingreso";
  });
  let compNetARS = 0, compNetUSD = 0;
  const addComp = (t, sign) => {
    const m = Math.abs(Number(t.monto)) / 2;
    if ((t.moneda || "ARS").toUpperCase() === "USD") compNetUSD += sign * m;
    else compNetARS += sign * m;
  };
  datos.filter(t => (t.responsabilidad || "Mío") === "Compartido").forEach(t =>
    addComp(t, (t.usuario || USUARIO) === PARTNER ? -1 : 1));
  datosIng.filter(t => (t.responsabilidad || "Mío") === "Compartido").forEach(t =>
    addComp(t, (t.usuario || USUARIO) === PARTNER ? 1 : -1));
```

Reemplazar por:

```javascript
// Calcula balance compartido del mes/año sin tocar DOM ni DB.
// + = PARTNER te debe | - = vos le debés a PARTNER
function _calcularBalanceCompartido(mes, anio) {
  const datos = allTransac.filter(t => {
    const { year, month } = getMesLiquidacion(t);
    return month === mes && year === anio && t.tipo === "Gasto";
  });
  const datosIng = allTransac.filter(t => {
    const { year, month } = getMesLiquidacion(t);
    return month === mes && year === anio && t.tipo === "Ingreso";
  });
  const { pctDaniel: _balPctDaniel, pctAma: _balPctAma } = obtenerProporcionParaMes(mes, anio);
  const pctUsuario = USUARIO === "Daniel" ? _balPctDaniel : _balPctAma;
  const pctPartner = 100 - pctUsuario;
  let compNetARS = 0, compNetUSD = 0;
  // esGasto=true: si pagó PARTNER, vos le debés tu propia parte (resta);
  //   si pagaste vos, PARTNER te debe su parte (suma). esGasto=false (reintegro) invierte el signo.
  const addComp = (t, esGasto) => {
    const monto       = Math.abs(Number(t.monto));
    const pagoPartner = (t.usuario || USUARIO) === PARTNER;
    const share       = pagoPartner ? monto * (pctUsuario / 100) : monto * (pctPartner / 100);
    const signo       = (pagoPartner ? -1 : 1) * (esGasto ? 1 : -1);
    if ((t.moneda || "ARS").toUpperCase() === "USD") compNetUSD += signo * share;
    else compNetARS += signo * share;
  };
  datos.filter(t => (t.responsabilidad || "Mío") === "Compartido").forEach(t => addComp(t, true));
  datosIng.filter(t => (t.responsabilidad || "Mío") === "Compartido").forEach(t => addComp(t, false));
```

- [ ] **Paso 2: Reemplazar los mapas por categoría en `cargarCompartidos()`**

Buscar:

```javascript
  datos.filter(t => (t.responsabilidad || "Mío") === "Compartido").forEach(t => {
    const cat    = t.categoria;
    const moneda = (t.moneda || "ARS").toUpperCase();
    const map    = moneda === "USD" ? compPorCatUSD : compPorCatARS;
    if (!map[cat]) map[cat] = { daniel: 0, ama: 0 };
    const m = Math.abs(Number(t.monto));
    if ((t.usuario || USUARIO) === PARTNER) {
      map[cat].ama += m / 2;
    } else {
      map[cat].daniel += m / 2;
    }
  });

  // Restar ingresos compartidos (reintegros) — reducen el neto por categoría
  datosIngresos.filter(t => (t.responsabilidad || "Mío") === "Compartido").forEach(t => {
    const cat    = t.categoria;
    const moneda = (t.moneda || "ARS").toUpperCase();
    const map    = moneda === "USD" ? compPorCatUSD : compPorCatARS;
    if (!map[cat]) map[cat] = { daniel: 0, ama: 0 };
    const m = Math.abs(Number(t.monto));
    if ((t.usuario || USUARIO) === PARTNER) {
      map[cat].ama -= m / 2;
    } else {
      map[cat].daniel -= m / 2;
    }
  });
```

Reemplazar por:

```javascript
  // Nota: las claves .daniel/.ama de estos mapas representan "yo" (USUARIO) y
  // "el otro" (PARTNER) respectivamente — no los nombres literales. Por eso se
  // usa pctUsuarioMes/pctPartnerMes (relativos a la sesión), no pctDaniel/pctAma.
  datos.filter(t => (t.responsabilidad || "Mío") === "Compartido").forEach(t => {
    const cat    = t.categoria;
    const moneda = (t.moneda || "ARS").toUpperCase();
    const map    = moneda === "USD" ? compPorCatUSD : compPorCatARS;
    if (!map[cat]) map[cat] = { daniel: 0, ama: 0 };
    const m = Math.abs(Number(t.monto));
    if ((t.usuario || USUARIO) === PARTNER) {
      map[cat].ama += m * (pctUsuarioMes / 100);
    } else {
      map[cat].daniel += m * (pctPartnerMes / 100);
    }
  });

  // Restar ingresos compartidos (reintegros) — reducen el neto por categoría
  datosIngresos.filter(t => (t.responsabilidad || "Mío") === "Compartido").forEach(t => {
    const cat    = t.categoria;
    const moneda = (t.moneda || "ARS").toUpperCase();
    const map    = moneda === "USD" ? compPorCatUSD : compPorCatARS;
    if (!map[cat]) map[cat] = { daniel: 0, ama: 0 };
    const m = Math.abs(Number(t.monto));
    if ((t.usuario || USUARIO) === PARTNER) {
      map[cat].ama -= m * (pctUsuarioMes / 100);
    } else {
      map[cat].daniel -= m * (pctPartnerMes / 100);
    }
  });
```

- [ ] **Paso 3: Corregir el drill-down (`buildCompRows`) — fix del bug de sesión + nuevo ratio**

Buscar:

```javascript
      const drillRows  = txsAll.map(t => {
        const m         = Math.abs(Number(t.monto));
        const esAma     = (t.usuario || "Daniel").toLowerCase() === "ama";
        const esGasto   = t.tipo === "Gasto";
        const signo     = esGasto ? "+" : "−";
        const color     = esGasto ? "var(--accent)" : "var(--green)";
        const tipoLabel = esGasto ? "Gasto" : "Ingreso";
        return `<tr style="background:var(--bg1);">
          <td colspan="2" style="padding:.2rem .8rem;font-size:.76rem;color:var(--text-muted);">
            <span style="color:${color};font-size:.7rem;">[${tipoLabel}]</span> ${fmtFecha(t.fecha)} — ${escapeHtml(t.descripcion||"—")}
          </td>
          <td style="padding:.2rem .8rem;font-size:.76rem;text-align:right;color:var(--text-muted);">Bruto: ${fmtMoneda(m, monedaFilter)}</td>
          <td style="padding:.2rem .8rem;font-size:.76rem;text-align:right;color:${color};">
            ${signo}${fmtMoneda(m/2, monedaFilter)} ${esAma ? "("+PARTNER+")" : "("+USUARIO+")"}
          </td>
        </tr>`;
      }).join("");
```

Reemplazar por:

```javascript
      const drillRows  = txsAll.map(t => {
        const m           = Math.abs(Number(t.monto));
        // Antes: "esAma" comparaba literalmente contra "ama", lo que asignaba
        // el bucket equivocado en la sesión de Ama. Se usa PARTNER (relativo a
        // la sesión) para que coincida con la lógica de compPorCat de arriba.
        const pagoPartner = (t.usuario || USUARIO) === PARTNER;
        const share       = pagoPartner ? m * (pctUsuarioMes / 100) : m * (pctPartnerMes / 100);
        const esGasto   = t.tipo === "Gasto";
        const signo     = esGasto ? "+" : "−";
        const color     = esGasto ? "var(--accent)" : "var(--green)";
        const tipoLabel = esGasto ? "Gasto" : "Ingreso";
        return `<tr style="background:var(--bg1);">
          <td colspan="2" style="padding:.2rem .8rem;font-size:.76rem;color:var(--text-muted);">
            <span style="color:${color};font-size:.7rem;">[${tipoLabel}]</span> ${fmtFecha(t.fecha)} — ${escapeHtml(t.descripcion||"—")}
          </td>
          <td style="padding:.2rem .8rem;font-size:.76rem;text-align:right;color:var(--text-muted);">Bruto: ${fmtMoneda(m, monedaFilter)}</td>
          <td style="padding:.2rem .8rem;font-size:.76rem;text-align:right;color:${color};">
            ${signo}${fmtMoneda(share, monedaFilter)} ${pagoPartner ? "("+PARTNER+")" : "("+USUARIO+")"}
          </td>
        </tr>`;
      }).join("");
```

- [ ] **Paso 4: Hacer dinámica la subtitle "gastos divididos al 50%"**

Buscar:

```javascript
  // ── CONTRIBUCIÓN DEL MES ─────────────────────────────────────
  const contribCard = document.getElementById("comp-contrib");
  if (contribCard) {
    const totalAmbos = totalCompDanielARS + totalCompAmaARS;
    if (totalAmbos > 0.01) {
```

Reemplazar por:

```javascript
  // ── CONTRIBUCIÓN DEL MES ─────────────────────────────────────
  const contribCard = document.getElementById("comp-contrib");
  if (contribCard) {
    const totalAmbos = totalCompDanielARS + totalCompAmaARS;
    const subtitleEl = document.getElementById("comp-contrib-subtitle");
    if (subtitleEl) subtitleEl.textContent = `gastos divididos ${Math.round(pctUsuarioMes)}/${Math.round(pctPartnerMes)}`;
    if (totalAmbos > 0.01) {
```

- [ ] **Paso 5: Build y verificar**

```bash
./build.sh
```

Expected: termina sin errores. `grep -c "pctUsuarioMes" index.html` debe devolver al menos `6` (declaración en Task 5 + usos en los 4 pasos de esta tarea).

- [ ] **Paso 6: Commit**

```bash
git add src/js/06-compartidos.js
git commit -m "fix(compartidos): reemplazar split 50/50 hardcodeado por proporción configurable + fix bug de sesión en drill-down"
```

---

## Task 7: Reemplazar el split hardcodeado en `07-presupuesto.js`

**Files:**
- Modify: `src/js/07-presupuesto.js`

**Interfaces:**
- Consumes: `obtenerFactorCompartidoPropio(mes, anio)` de Task 2

- [ ] **Paso 1: `montoEfectivoGasto()` (función sin uso actual, pero parte del helper documentado en CLAUDE.md)**

Buscar:

```javascript
function montoEfectivoGasto(t) {
  if (t.tipo !== "Gasto") return 0;
  const resp = t.responsabilidad || "Mío";
  const m = Math.abs(Number(t.monto));
  if (resp === "De " + PARTNER)    return 0;
  if (resp === "Compartido") return m / 2;
  return m; // "Mío"
}
```

Reemplazar por:

```javascript
function montoEfectivoGasto(t) {
  if (t.tipo !== "Gasto") return 0;
  const resp = t.responsabilidad || "Mío";
  const m = Math.abs(Number(t.monto));
  if (resp === "De " + PARTNER)    return 0;
  if (resp === "Compartido") {
    const { year, month } = getMesLiquidacion(t);
    return m * obtenerFactorCompartidoPropio(month, year);
  }
  return m; // "Mío"
}
```

- [ ] **Paso 2: `sugerirPresupuestoDesdeHistorial()`**

Buscar:

```javascript
      const gastoCat = Math.max(0, gMio - iMio) + Math.max(0, gComp - iComp) * 0.5 + Math.max(0, gDeU - iDeU);
```

Reemplazar por:

```javascript
      const gastoCat = Math.max(0, gMio - iMio) + Math.max(0, gComp - iComp) * obtenerFactorCompartidoPropio(mes, anio) + Math.max(0, gDeU - iDeU);
```

- [ ] **Paso 3: `buildMonthlyData()`**

Buscar:

```javascript
        return total + mio + comp * 0.5;
```

Reemplazar por:

```javascript
        return total + mio + comp * obtenerFactorCompartidoPropio(m, y);
```

- [ ] **Paso 4: `renderPresupuesto()` y `actualizarKpisPres()` — hoist del factor antes del loop de categorías**

Este bloque de 3 líneas es **idéntico en ambas funciones** (`renderPresupuesto()` y `actualizarKpisPres()`). Usar `replace_all` para aplicar el cambio en las dos ocurrencias a la vez.

Buscar (con reemplazo global):

```javascript
  const gastoPorCat = {};
  let surplusTotal = 0;
  categGasto.forEach(cat => {
```

Reemplazar por (todas las ocurrencias):

```javascript
  const gastoPorCat = {};
  let surplusTotal = 0;
  const factorCompMes = obtenerFactorCompartidoPropio(mes, anio);
  categGasto.forEach(cat => {
```

- [ ] **Paso 5: Reemplazar las líneas de `surplusTotal`/`gastoPorCat` — también idénticas en ambas funciones, usar `replace_all`**

Buscar (con reemplazo global):

```javascript
    surplusTotal += Math.max(0, -netMio) + Math.max(0, -netComp) * 0.5 + Math.max(0, -netDeJ);
    gastoPorCat[cat] = Math.max(0, netMio) + Math.max(0, netComp) * 0.5 + Math.max(0, netDeJ);
```

Reemplazar por (todas las ocurrencias):

```javascript
    surplusTotal += Math.max(0, -netMio) + Math.max(0, -netComp) * factorCompMes + Math.max(0, -netDeJ);
    gastoPorCat[cat] = Math.max(0, netMio) + Math.max(0, netComp) * factorCompMes + Math.max(0, netDeJ);
```

- [ ] **Paso 6: `renderPresupuesto()` — conversión USD→ARS de Ama**

Buscar:

```javascript
    gastoUSDEnARS = (gasUSDMio + gasUSDComp * 0.5) * tipoCambioMEP;
```

Reemplazar por:

```javascript
    gastoUSDEnARS = (gasUSDMio + gasUSDComp * factorCompMes) * tipoCambioMEP;
```

- [ ] **Paso 7: `actualizarKpisPres()` — conversión USD→ARS de Ama (variable distinta, con sufijo Kpi)**

Buscar:

```javascript
    gastoUSDEnARSKpi = (gasUSDMioKpi + gasUSDCompKpi * 0.5) * tipoCambioMEP;
```

Reemplazar por:

```javascript
    gastoUSDEnARSKpi = (gasUSDMioKpi + gasUSDCompKpi * factorCompMes) * tipoCambioMEP;
```

- [ ] **Paso 8: Tendencias vs. mes anterior (dentro de `renderTendencias()`, usa el mes previo, no el actual)**

Buscar:

```javascript
    const dataPrevUsuario = dataPrev.filter(t => (t.usuario || "Daniel") === USUARIO);
    const prevGastoPorCat = {};
    categGasto.forEach(cat => {
```

Reemplazar por:

```javascript
    const dataPrevUsuario = dataPrev.filter(t => (t.usuario || "Daniel") === USUARIO);
    const prevGastoPorCat = {};
    const factorCompPrevMes = obtenerFactorCompartidoPropio(prevMes, prevAnio);
    categGasto.forEach(cat => {
```

Buscar:

```javascript
      const netComp = Math.max(0, gastosComp - ingresosComp);
      prevGastoPorCat[cat] = Math.max(0, gastosMio - ingresosMio) + netComp * 0.5 + Math.max(0, deJGasto - deJIngreso);
```

Reemplazar por:

```javascript
      const netComp = Math.max(0, gastosComp - ingresosComp);
      prevGastoPorCat[cat] = Math.max(0, gastosMio - ingresosMio) + netComp * factorCompPrevMes + Math.max(0, deJGasto - deJIngreso);
```

- [ ] **Paso 9: Actualizar el texto de la nota de presupuesto con el % real del mes**

Buscar:

```javascript
function renderPresupuesto() {
  destroyPresupuestoCharts();
  const mes  = parseInt(document.getElementById("pres-mes").value);
  const anio = parseInt(document.getElementById("pres-anio").value);
```

Reemplazar por:

```javascript
function renderPresupuesto() {
  destroyPresupuestoCharts();
  const mes  = parseInt(document.getElementById("pres-mes").value);
  const anio = parseInt(document.getElementById("pres-anio").value);
  const notePctEl = document.getElementById("pres-note-comp-pct");
  if (notePctEl) notePctEl.textContent = Math.round(obtenerFactorCompartidoPropio(mes, anio) * 100) + "%";
```

- [ ] **Paso 10: Build y verificar**

```bash
./build.sh
```

Expected: termina sin errores. `grep -c "obtenerFactorCompartidoPropio" index.html` debe devolver al menos `9` (1 definición de Task 2 + 8 usos de esta tarea). `grep -c "\* 0\.5" index.html` no debe encontrar ninguna ocurrencia dentro del bloque de `07-presupuesto.js` (verificar visualmente con `grep -n "0\.5" index.html` que las coincidencias restantes, si las hay, correspondan a otros archivos aún no migrados en este plan, ej. `04-graficos.js`, `10-utils.js`, `11-cuotas.js`, que se resuelven en las próximas tareas).

- [ ] **Paso 11: Commit**

```bash
git add src/js/07-presupuesto.js
git commit -m "fix(presupuesto): reemplazar split 50/50 hardcodeado por proporción configurable en Mi mes"
```

---

## Task 8: Reemplazar el split hardcodeado en `04-graficos.js`

**Files:**
- Modify: `src/js/04-graficos.js`

**Interfaces:**
- Consumes: `obtenerFactorCompartidoPropio(mes, anio)` de Task 2

- [ ] **Paso 1: Hoist del factor al inicio de `cargarResumenMes()`**

Buscar:

```javascript
async function cargarResumenMes() {
  const mes  = document.getElementById("sel-mes-resumen").value;
  const anio = document.getElementById("sel-anio-resumen").value;
```

Reemplazar por:

```javascript
async function cargarResumenMes() {
  const mes  = document.getElementById("sel-mes-resumen").value;
  const anio = document.getElementById("sel-anio-resumen").value;
  const factorCompResumen = obtenerFactorCompartidoPropio(parseInt(mes), parseInt(anio));
```

- [ ] **Paso 2: Reemplazar el cálculo de gasto real por categoría (mes actual)**

Buscar:

```javascript
      const real =
        Math.max(0, g(datos,      "Gasto",   "Mío")        - g(datos,      "Ingreso", "Mío"))
      + Math.max(0, g(dataMesAll, "Gasto",   "Compartido") - g(dataMesAll, "Ingreso", "Compartido")) * 0.5
      + Math.max(0, g(dataMesAll, "Gasto",   "De Daniel")  - g(dataMesAll, "Ingreso", "De Daniel"));
```

Reemplazar por:

```javascript
      const real =
        Math.max(0, g(datos,      "Gasto",   "Mío")        - g(datos,      "Ingreso", "Mío"))
      + Math.max(0, g(dataMesAll, "Gasto",   "Compartido") - g(dataMesAll, "Ingreso", "Compartido")) * factorCompResumen
      + Math.max(0, g(dataMesAll, "Gasto",   "De Daniel")  - g(dataMesAll, "Ingreso", "De Daniel"));
```

- [ ] **Paso 3: Corregir el label de gasto (usa `%` fijo y "Ama" hardcodeado en vez de `PARTNER`)**

Buscar:

```javascript
  const gasSubParts = ["Mío 100% · Comp 50% · Reembolsos Ama"];
```

Reemplazar por:

```javascript
  const gasSubParts = [`Mío 100% · Comp ${Math.round(factorCompResumen * 100)}% · Reembolsos ${PARTNER}`];
```

- [ ] **Paso 4: Hoist del factor del mes anterior (para la comparación de tendencia)**

Buscar:

```javascript
    const prevCatMapARS = {};
    prevAllExpCats.forEach(cat => {
```

Reemplazar por:

```javascript
    const prevCatMapARS = {};
    const factorCompPrevResumen = obtenerFactorCompartidoPropio(prevMesNum, prevAnioNum);
    prevAllExpCats.forEach(cat => {
```

- [ ] **Paso 5: Reemplazar el cálculo de gasto real por categoría (mes anterior)**

Buscar:

```javascript
      const real =
        Math.max(0, gp(prevDatos,    "Gasto","Mío")       - gp(prevDatos,   "Ingreso","Mío"))
      + Math.max(0, gp(prevDataAll,  "Gasto","Compartido")- gp(prevDataAll, "Ingreso","Compartido")) * 0.5
      + Math.max(0, gp(prevDataAll,  "Gasto","De Daniel") - gp(prevDataAll, "Ingreso","De Daniel"));
```

Reemplazar por:

```javascript
      const real =
        Math.max(0, gp(prevDatos,    "Gasto","Mío")       - gp(prevDatos,   "Ingreso","Mío"))
      + Math.max(0, gp(prevDataAll,  "Gasto","Compartido")- gp(prevDataAll, "Ingreso","Compartido")) * factorCompPrevResumen
      + Math.max(0, gp(prevDataAll,  "Gasto","De Daniel") - gp(prevDataAll, "Ingreso","De Daniel"));
```

- [ ] **Paso 6: Build y verificar**

```bash
./build.sh
```

Expected: termina sin errores. `grep -c "factorCompResumen\|factorCompPrevResumen" index.html` debe devolver al menos `4`.

- [ ] **Paso 7: Commit**

```bash
git add src/js/04-graficos.js
git commit -m "fix(resumen): reemplazar split 50/50 hardcodeado por proporción configurable + usar PARTNER dinámico en label"
```

---

## Task 9: Reemplazar el split hardcodeado en `10-utils.js` y `11-cuotas.js`

**Files:**
- Modify: `src/js/10-utils.js`
- Modify: `src/js/11-cuotas.js`

**Interfaces:**
- Consumes: `obtenerFactorCompartidoPropio(mes, anio)` de Task 2

- [ ] **Paso 1: `10-utils.js` — sparklines de Mi mes (factor por iteración, cada mes de la serie es distinto)**

Buscar:

```javascript
    const gas = Math.max(0, g(mine, "Gasto", "Mío")         - g(mine, "Ingreso", "Mío"))
              + Math.max(0, g(all,  "Gasto", "Compartido")   - g(all,  "Ingreso", "Compartido")) * 0.5
              + Math.max(0, g(all,  "Gasto", "De Daniel")    - g(all,  "Ingreso", "De Daniel"));
```

Reemplazar por:

```javascript
    const gas = Math.max(0, g(mine, "Gasto", "Mío")         - g(mine, "Ingreso", "Mío"))
              + Math.max(0, g(all,  "Gasto", "Compartido")   - g(all,  "Ingreso", "Compartido")) * obtenerFactorCompartidoPropio(m, y)
              + Math.max(0, g(all,  "Gasto", "De Daniel")    - g(all,  "Ingreso", "De Daniel"));
```

- [ ] **Paso 2: `11-cuotas.js` — card de cuotas activas (factor por cuota individual, cada installment cae en un mes distinto)**

Buscar:

```javascript
  const rows = comprasEnCuotas.map(c => {
    const cuotasTrans = allTransac.filter(t => t.compra_id === c.id);
    const pagadas        = cuotasTrans.filter(t => (t.mes_liquidacion || "") < mesActualStr).length;
    const pagadasDisplay = cuotasTrans.filter(t => (t.mes_liquidacion || "") <= mesActualStr).length;
    const factor  = c.responsabilidad === "Compartido" ? 0.5 : 1;

    if (pagadas >= c.cuotas_total) {
      toComplete.push(c.id);
      return null;
    }

    cuotasTrans.forEach(t => {
      const m = t.mes_liquidacion;
      if (!m) return;
      const monto = Number(t.monto) * factor;
      if (m === mesActualStr) estesMes += monto;
      else if (m > mesActualStr) futuro += monto;
      if (Object.prototype.hasOwnProperty.call(floorByMes, m)) floorByMes[m] += monto;
    });
```

Reemplazar por:

```javascript
  const rows = comprasEnCuotas.map(c => {
    const cuotasTrans = allTransac.filter(t => t.compra_id === c.id);
    const pagadas        = cuotasTrans.filter(t => (t.mes_liquidacion || "") < mesActualStr).length;
    const pagadasDisplay = cuotasTrans.filter(t => (t.mes_liquidacion || "") <= mesActualStr).length;
    const esCompartida   = c.responsabilidad === "Compartido";

    if (pagadas >= c.cuotas_total) {
      toComplete.push(c.id);
      return null;
    }

    cuotasTrans.forEach(t => {
      const m = t.mes_liquidacion;
      if (!m) return;
      // El ratio puede variar mes a mes — se resuelve por cada cuota individual,
      // no una sola vez por compra, porque cada cuota cae en un mes distinto.
      let factor = 1;
      if (esCompartida) {
        const [fy, fm] = m.split("-").map(Number);
        factor = obtenerFactorCompartidoPropio(fm, fy);
      }
      const monto = Number(t.monto) * factor;
      if (m === mesActualStr) estesMes += monto;
      else if (m > mesActualStr) futuro += monto;
      if (Object.prototype.hasOwnProperty.call(floorByMes, m)) floorByMes[m] += monto;
    });
```

- [ ] **Paso 3: Build y verificar**

```bash
./build.sh
```

Expected: termina sin errores. `grep -c "obtenerFactorCompartidoPropio" index.html` debe devolver al menos `11` (9 de Tasks 7-8 + 2 de esta tarea). Verificar que ya no queda ningún `* 0.5` ni `/ 2` asociado a `"Compartido"` en todo el bundle: `grep -n "Compartido" index.html | grep -E "0\.5|/ 2"` debe devolver **vacío**.

- [ ] **Paso 4: Commit**

```bash
git add src/js/10-utils.js src/js/11-cuotas.js
git commit -m "fix(cuotas,sparklines): reemplazar split 50/50 hardcodeado por proporción configurable por mes"
```

---

## Task 10: Verificación end-to-end

- [ ] **Paso 1: Estado inicial (tabla vacía) — retrocompatibilidad**

Abrir la app (Daniel y luego Ama). Confirmar que Compartidos, Mi mes y Resumen muestran **exactamente** los mismos números que antes de este cambio (sin ninguna fila en `proporcion_compartidos`, todo cae a 50/50). Confirmar que el control de reparto en Compartidos muestra 50/50 pre-cargado para el mes actual.

- [ ] **Paso 2: Configurar un mes con proporción distinta**

En la sesión de Daniel, ir a Compartidos, seleccionar el mes actual, cambiar el input de Daniel a `70` (Ama debe autocompletarse a `30`), click en 💾. Confirmar toast "✅ Reparto actualizado" y que la tabla de Compartidos, el balance, y la card "Contribución del mes" (subtitle "gastos divididos 70/30") se recalculan inmediatamente.

- [ ] **Paso 3: Verificar que Ama ve el mismo ratio**

Loguearse como Ama, ir a Compartidos, mismo mes. Confirmar que el control de reparto muestra Ama=30 / Daniel=70 (o el equivalente relativo a su sesión) — el ratio subyacente debe ser el mismo, solo cambia qué lado se muestra primero.

- [ ] **Paso 4: Herencia hacia el mes siguiente**

Sin tocar nada, navegar al mes siguiente en Compartidos (el que todavía no tiene fila propia en `proporcion_compartidos`). Confirmar que hereda 70/30 (no vuelve a 50/50).

- [ ] **Paso 5: Override de un mes heredado**

En ese mes siguiente, configurar explícitamente 50/50 y guardar. Confirmar que ese mes queda en 50/50 y que el mes anterior (70/30) no se alteró.

- [ ] **Paso 6: Verificar Mi mes y Resumen con el ratio custom**

Con el mes en 70/30 (Daniel), ir a Mi mes: confirmar que el KPI de gasto y el desglose por categoría reflejan 70% del neto compartido (no 50%), y que la nota "💡 ... Compartidos → 70% ..." se actualiza. Ir a Resumen: confirmar que el KPI de gastos y su subtítulo ("Mío 100% · Comp 70% · Reembolsos Ama") reflejan el nuevo ratio.

- [ ] **Paso 7: Verificar liquidación usa el ratio del mes liquidado**

Con transacciones "Compartido" cargadas en el mes 70/30, abrir "Saldar todo" y confirmar que los montos a liquidar por categoría coinciden con los mostrados en la tabla de Compartidos para ese mes (70/30), no 50/50.

- [ ] **Paso 8: Cuotas compartidas con ratio variable entre meses**

Si hay una compra en cuotas marcada "Compartido" que atraviesa el mes 70/30 y el mes siguiente (50/50 tras el Paso 5), confirmar en la card de cuotas de Mi mes que "Este mes" y "Próximos meses" reflejan el ratio correspondiente a CADA cuota individual, no un factor único para toda la compra.

- [ ] **Paso 9: Fallo de guardado**

Con las devtools abiertas, throttlear la red a "Offline", intentar guardar un cambio de reparto. Confirmar toast "⚠️ No se pudo guardar el reparto" y que los inputs no quedan en un estado inconsistente con lo realmente persistido (recargar la página sin conexión simulada y confirmar que el valor mostrado es el anterior, no el que falló al guardar).

- [ ] **Paso 10: Mobile y tema claro de Ama**

Verificar en viewport mobile (≤768px) que el control de reparto se ve completo sin overflow horizontal, y que en el tema claro de Ama (`[data-theme="light"]`) los inputs y el botón de guardar usan los colores correctos (no aparecen oscuros/hardcodeados).

- [ ] **Paso 11: Push**

```bash
git push
```

---

## Self-Review

**Cobertura del spec (`docs/superpowers/specs/2026-07-02-proporcion-compartidos-design.md`):**
- ✅ Modelo de datos `proporcion_compartidos` (tabla, RLS sin user_id, unique mes/anio) → Task 1.
- ✅ `pct_ama` derivado, nunca guardado → Task 1 (no existe la columna) + Task 2 (`obtenerProporcionParaMes` siempre deriva `100 - pct_daniel`).
- ✅ Función de resolución con herencia hacia atrás y fallback 50/50 → Task 2, `obtenerProporcionParaMes()`.
- ✅ Carga en memoria sin paginación, sin localStorage (desviación documentada y justificada al inicio del plan) → Task 2 + Task 3.
- ✅ UI inline en Compartidos junto al selector de mes/año, inputs enlazados, guardado explícito con botón → Task 4 (HTML/CSS) + Task 5 (JS).
- ✅ Etiquetas dinámicas con USUARIO/PARTNER → Task 5, Paso 2.
- ✅ Reemplazo de todos los puntos hardcodeados identificados en el spec (Sección 2) → Tasks 6, 7, 8, 9. Se descubrieron y migraron 2 puntos adicionales no listados explícitamente en el spec (`10-utils.js` sparklines, `11-cuotas.js` card de cuotas) — cubiertos en Task 9, consistentes con el principio del spec de "ningún consumidor mantiene lógica de split propia".
- ✅ Manejo de errores: carga falla → array vacío → fallback 50/50 (Task 2); guardado falla → toast de error, sin actualizar estado local (Task 2, `guardarProporcionMes`) → verificado en Task 10, Paso 9.
- ✅ Mes al que pertenece la transacción, no el mes del filtro de UI → respetado explícitamente en Task 7 (tendencias usa `prevMes`/`prevAnio`), Task 8 (ídem), Task 9 (`10-utils.js` usa `m,y` por iteración; `11-cuotas.js` usa el mes de cada cuota individual).
- ✅ Testing manual — los 11 escenarios del spec están cubiertos por los 11 pasos de Task 10 (uno a uno).
- ✅ Fuera de alcance respetado: no se agregó override por categoría, por transacción, indicador visual de herencia, ni locking optimista.

**Placeholder scan:** sin TBD/TODO; todos los bloques `Buscar`/`Reemplazar` contienen código completo y textualmente verificado contra el archivo real al momento de escribir este plan.

**Consistencia de tipos/firmas:**
- `obtenerProporcionParaMes(mes, anio)` → `{ pctDaniel, pctAma }` — mismo shape usado en Tasks 5 y 6.
- `obtenerFactorCompartidoPropio(mes, anio)` → `number` (0–1) — usado consistentemente en Tasks 7, 8, 9 como multiplicador directo.
- `guardarProporcionMes(mes, anio, pctDanielInput)` — firma usada igual en Task 5 (`_guardarReparto`).
- `pctUsuarioMes`/`pctPartnerMes` (variables locales de `cargarCompartidos()`, Task 5) reutilizadas sin redeclarar en Task 6 — se verificó que ambas tareas modifican la misma función y que Task 5 se ejecuta primero en el orden del plan.

**Riesgo de edición ambigua:** los bloques de búsqueda de Task 7 Pasos 4 y 5 son deliberadamente idénticos en dos funciones (`renderPresupuesto`/`actualizarKpisPres`) — se instruye explícitamente usar reemplazo global (`replace_all`) ya que el cambio deseado es idéntico en ambas ocurrencias. Todos los demás bloques de búsqueda de este plan son textualmente únicos en su archivo (verificados contra el código fuente real).

---

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-07-02-proporcion-compartidos.md`. Dos opciones de ejecución:

**1. Subagent-Driven (recomendado)** — se despacha un subagente fresco por tarea, con revisión entre tareas e iteración rápida.

**2. Inline Execution** — se ejecutan las tareas en la misma sesión usando executing-plans, en bloque con checkpoints de revisión.
