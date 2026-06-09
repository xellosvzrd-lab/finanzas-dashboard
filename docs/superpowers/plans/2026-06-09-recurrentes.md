# Transacciones Recurrentes — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detectar automáticamente transacciones que se repiten mes a mes, mostrar su estado en Mi mes, y alertar cuando alguna confirmada todavía no fue cargada.

**Architecture:** Nuevo módulo `13-recurrentes.js` con detección client-side sobre `allTransac` y persistencia de reglas en tabla Supabase `recurrentes`. La UI vive en la página Mi mes: sección de estado + modal de gestión. Clic en pendiente navega al form de Nueva transacción pre-llenado.

**Tech Stack:** Vanilla JS, Supabase (PostgreSQL), build.sh (concatenación alfabética de src/js/*.js)

---

## Archivos involucrados

| Acción | Archivo |
|---|---|
| Crear | `src/js/13-recurrentes.js` |
| Modificar | `src/js/03-data.js` — agregar carga de recurrentes en `iniciarApp()` |
| Modificar | `src/js/07-presupuesto.js` — llamar `renderRecurrentes()` al final de `cargarPresupuesto()` |
| Modificar | `src/index.template.html` — sección HTML en Mi mes + modal + CSS |
| SQL (manual) | Supabase SQL Editor — crear tabla `recurrentes` |

> `build.sh` ya incluye `13-recurrentes.js` automáticamente: usa `sorted(glob.glob("src/js/*.js"))` — orden alfabético, sin cambios necesarios.

---

## Task 1: Migración SQL — tabla `recurrentes`

**Files:**
- SQL a ejecutar en: Supabase Dashboard → SQL Editor

- [ ] **Paso 1: Ejecutar la migración en Supabase SQL Editor**

```sql
create table if not exists recurrentes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  usuario         text not null,
  descripcion     text not null,
  categoria       text not null,
  monto_ref       numeric,
  fuente          text,
  responsabilidad text default 'Mío',
  activa          boolean default true,
  created_at      timestamptz default now()
);

-- RLS
alter table recurrentes enable row level security;

create policy "usuario puede ver sus recurrentes"
  on recurrentes for select
  using (auth.uid() = user_id);

create policy "usuario puede insertar sus recurrentes"
  on recurrentes for insert
  with check (auth.uid() = user_id);

create policy "usuario puede actualizar sus recurrentes"
  on recurrentes for update
  using (auth.uid() = user_id);

create policy "usuario puede eliminar sus recurrentes"
  on recurrentes for delete
  using (auth.uid() = user_id);
```

- [ ] **Paso 2: Verificar en Table Editor de Supabase**

Confirmar que la tabla `recurrentes` aparece con las columnas correctas y que RLS está habilitado (ícono de candado en la tabla).

- [ ] **Paso 3: Commit**

```bash
git commit --allow-empty -m "infra: tabla recurrentes creada en Supabase (RLS habilitado)"
```

---

## Task 2: Crear `13-recurrentes.js` — detección y estado

**Files:**
- Create: `src/js/13-recurrentes.js`

- [ ] **Paso 1: Crear el archivo con variables globales y funciones de detección**

```javascript
// ─── RECURRENTES ──────────────────────────────────────────────
let recurrentesActivas = []; // cargadas desde Supabase

// ─── DETECCIÓN ───────────────────────────────────────────────

function detectarCandidatas() {
  // Filtra: solo gastos sin cuotas
  const gastos = allTransac.filter(t => t.tipo === "Gasto" && !t.compra_id);

  // Agrupa por descripcion||categoria → meses en que aparece
  const grupos = {};
  for (const t of gastos) {
    const key = t.descripcion + "||" + t.categoria;
    const mes = t.fecha.slice(0, 7); // "YYYY-MM"
    if (!grupos[key]) {
      grupos[key] = { descripcion: t.descripcion, categoria: t.categoria, meses: new Set(), ultimo: t };
    }
    grupos[key].meses.add(mes);
    if (t.fecha > grupos[key].ultimo.fecha) grupos[key].ultimo = t;
  }

  // Claves ya confirmadas
  const confirmadas = new Set(
    recurrentesActivas.map(r => r.descripcion + "||" + r.categoria)
  );

  // Claves ignoradas este mes
  const mesActual = new Date().toISOString().slice(0, 7);
  let ignoradas = [];
  try {
    ignoradas = JSON.parse(localStorage.getItem("recur_ignoradas_" + USUARIO + "_" + mesActual) || "[]");
  } catch(e) {}
  const ignoradasSet = new Set(ignoradas);

  return Object.values(grupos).filter(g =>
    g.meses.size >= 2 &&
    !confirmadas.has(g.descripcion + "||" + g.categoria) &&
    !ignoradasSet.has(g.descripcion + "||" + g.categoria)
  );
}

function getEstadoMes(recurrente) {
  const mesActual = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const encontrada = allTransac.find(t =>
    t.descripcion === recurrente.descripcion &&
    t.categoria   === recurrente.categoria &&
    t.fecha.startsWith(mesActual) &&
    !t.compra_id
  );
  return encontrada
    ? { ok: true, monto: encontrada.monto }
    : { ok: false };
}

function ignorarCandidata(descripcion, categoria) {
  const mesActual = new Date().toISOString().slice(0, 7);
  const key = "recur_ignoradas_" + USUARIO + "_" + mesActual;
  let ignoradas = [];
  try { ignoradas = JSON.parse(localStorage.getItem(key) || "[]"); } catch(e) {}
  const keyStr = descripcion + "||" + categoria;
  if (!ignoradas.includes(keyStr)) {
    ignoradas.push(keyStr);
    localStorage.setItem(key, JSON.stringify(ignoradas));
  }
  renderRecurrentes();
}
```

- [ ] **Paso 2: Agregar funciones Supabase CRUD**

```javascript
// ─── SUPABASE CRUD ────────────────────────────────────────────

async function cargarRecurrentes() {
  try {
    const { data, error } = await supabaseClient
      .from('recurrentes')
      .select('*')
      .eq('usuario', USUARIO)
      .order('created_at', { ascending: true });
    if (error) throw error;
    recurrentesActivas = data || [];
  } catch(e) {
    console.warn("Error cargando recurrentes:", e);
    recurrentesActivas = [];
  }
}

async function confirmarRecurrente(candidata) {
  try {
    const payload = {
      user_id:        supabaseSession.user.id,
      usuario:        USUARIO,
      descripcion:    candidata.descripcion,
      categoria:      candidata.categoria,
      monto_ref:      candidata.ultimo.monto,
      fuente:         candidata.ultimo.fuente || null,
      responsabilidad: candidata.ultimo.responsabilidad || 'Mío',
      activa:         true
    };
    const { error } = await supabaseClient.from('recurrentes').insert([payload]);
    if (error) throw error;
    await cargarRecurrentes();
    renderRecurrentes();
    showToast("✅ Recurrente confirmada", "ok");
  } catch(e) {
    showToast("❌ Error al confirmar", "err");
  }
}

async function toggleRecurrente(id) {
  const r = recurrentesActivas.find(x => x.id === id);
  if (!r) return;
  try {
    const { error } = await supabaseClient
      .from('recurrentes').update({ activa: !r.activa }).eq('id', id);
    if (error) throw error;
    await cargarRecurrentes();
    _renderModalRecurrentes();
    renderRecurrentes();
  } catch(e) {
    showToast("❌ Error al actualizar", "err");
  }
}

async function eliminarRecurrente(id) {
  if (!confirm("¿Eliminar esta recurrente?")) return;
  try {
    const { error } = await supabaseClient.from('recurrentes').delete().eq('id', id);
    if (error) throw error;
    await cargarRecurrentes();
    _renderModalRecurrentes();
    renderRecurrentes();
    showToast("✅ Recurrente eliminada", "ok");
  } catch(e) {
    showToast("❌ Error al eliminar", "err");
  }
}

async function agregarRecurrenteManual(descripcion, categoria, fuente, responsabilidad) {
  if (!descripcion || !categoria) { showToast("Completá descripción y categoría", "err"); return; }
  try {
    const payload = {
      user_id:        supabaseSession.user.id,
      usuario:        USUARIO,
      descripcion,
      categoria,
      monto_ref:      null,
      fuente:         fuente || null,
      responsabilidad: responsabilidad || 'Mío',
      activa:         true
    };
    const { error } = await supabaseClient.from('recurrentes').insert([payload]);
    if (error) throw error;
    await cargarRecurrentes();
    _renderModalRecurrentes();
    renderRecurrentes();
    showToast("✅ Recurrente agregada", "ok");
  } catch(e) {
    showToast("❌ Error al agregar", "err");
  }
}
```

- [ ] **Paso 3: Agregar `cargarRecurrenteForm`**

```javascript
// ─── NAVEGACIÓN AL FORM ──────────────────────────────────────

function cargarRecurrenteForm(recurrente) {
  navegarA('nueva');
  setTimeout(() => {
    setTipo('Gasto');
    document.getElementById('f-descripcion').value = recurrente.descripcion || '';
    const selCat = document.getElementById('f-categoria');
    const selFte = document.getElementById('f-fuente');
    if (selCat) selCat.value = recurrente.categoria || '';
    if (selFte) selFte.value = recurrente.fuente || '';
    seleccionarResp(recurrente.responsabilidad || 'Mío');
    document.getElementById('f-monto').focus();
  }, 30);
  showToast("📋 " + recurrente.descripcion + " — ingresá el monto", "ok");
}
```

- [ ] **Paso 4: Build y verificar sin errores de consola**

```bash
./build.sh
```

Esperado: `✓ index.html generado (NNNN líneas) desde 13 módulos` — debe aparecer `13-recurrentes.js` en la lista.

- [ ] **Paso 5: Commit**

```bash
git add src/js/13-recurrentes.js
git commit -m "feat(recurrentes): módulo de detección, CRUD Supabase y navegación al form"
```

---

## Task 3: HTML — sección en Mi mes + modal

**Files:**
- Modify: `src/index.template.html`

Buscar la sección de cuotas en `page-presupuesto` (el bloque `id="mm-cuotas-card"` o similar). La sección de recurrentes va **después** de las stat cards y **antes** del cuotas card.

- [ ] **Paso 1: Agregar sección recurrentes en `page-presupuesto`**

Encontrar la línea con `id="mm-cuotas-card"` y agregar justo **antes**:

```html
<!-- RECURRENTES -->
<section id="recurrentes-section" class="recur-section" style="display:none">
  <div class="recur-section-header">
    <span class="recur-section-title">
      📋 Recurrentes
      <span id="recur-badge" class="recur-badge" style="display:none"></span>
    </span>
    <button class="recur-manage-btn" onclick="abrirModalRecurrentes()">⚙️ Gestionar</button>
  </div>
  <div id="recur-list"></div>
</section>
<!-- /RECURRENTES -->
```

- [ ] **Paso 2: Agregar modal de gestión** (antes del cierre de `</body>`)

```html
<!-- MODAL RECURRENTES -->
<div id="modal-recurrentes" class="modal-overlay" style="display:none" onclick="if(event.target===this)cerrarModalRecurrentes()">
  <div class="modal-content modal-recur">
    <div class="modal-recur-header">
      <h3 class="modal-recur-title">⚙️ Mis recurrentes</h3>
      <button class="modal-close-btn" onclick="cerrarModalRecurrentes()">×</button>
    </div>
    <div id="modal-recur-body"></div>
    <div class="modal-recur-add">
      <div id="modal-recur-add-form" style="display:none" class="modal-recur-add-form">
        <select id="modal-recur-cat" class="modal-recur-input">
          <option value="">Categoría…</option>
        </select>
        <input id="modal-recur-desc" type="text" class="modal-recur-input" placeholder="Descripción (ej: Spotify)">
        <select id="modal-recur-fuente" class="modal-recur-input">
          <option value="">Fuente (opcional)</option>
        </select>
        <select id="modal-recur-resp" class="modal-recur-input">
          <option value="Mío">Mío</option>
          <option value="Compartido">Compartido</option>
        </select>
        <div class="modal-recur-add-actions">
          <button class="btn-recur-confirm" onclick="_guardarRecurrenteManualForm()">Agregar</button>
          <button class="btn-recur-ignore" onclick="document.getElementById('modal-recur-add-form').style.display='none'">Cancelar</button>
        </div>
      </div>
      <button class="btn-recur-add-trigger" onclick="_mostrarFormRecurManual()">+ Agregar recurrente manual</button>
    </div>
  </div>
</div>
<!-- /MODAL RECURRENTES -->
```

- [ ] **Paso 3: Agregar CSS** (dentro del bloque `<style>` existente, cerca de los estilos de cuotas)

```css
/* ── RECURRENTES ────────────────────────────── */
.recur-section {
  margin: 0 0 1rem;
}
.recur-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: .5rem;
}
.recur-section-title {
  color: var(--text-muted);
  font-size: .7rem;
  text-transform: uppercase;
  letter-spacing: .05em;
  display: flex;
  align-items: center;
  gap: .4rem;
}
.recur-badge {
  background: var(--accent);
  color: #fff;
  border-radius: 10px;
  padding: 1px 7px;
  font-size: .65rem;
  font-weight: 700;
}
.recur-manage-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 6px;
  padding: 3px 10px;
  font-size: .7rem;
  cursor: pointer;
}
.recur-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.recur-row {
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: .8rem;
}
.recur-row--ok {
  background: rgba(var(--green-rgb, 76,175,77), .07);
  border: 1px solid rgba(var(--green-rgb, 76,175,77), .2);
}
.recur-row--pending {
  background: rgba(var(--accent-rgb), .06);
  border: 1px solid rgba(var(--accent-rgb), .25);
  cursor: pointer;
}
.recur-row--suggest {
  background: var(--card);
  border: 1px dashed var(--border);
}
.recur-row-icon { flex-shrink: 0; font-size: 1rem; }
.recur-row-info { flex: 1; min-width: 0; }
.recur-row-name {
  color: var(--text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.recur-row-cat { color: var(--text-muted); font-size: .7rem; margin-top: 1px; }
.recur-tag-suggest {
  background: var(--bg2);
  color: var(--text-muted);
  border-radius: 4px;
  font-size: .6rem;
  padding: 1px 5px;
  margin-left: 4px;
  vertical-align: middle;
}
.recur-suggest-actions { display: flex; gap: 4px; margin-top: 5px; }
.btn-recur-confirm {
  background: rgba(var(--accent-rgb), .15);
  color: var(--accent);
  border: 1px solid rgba(var(--accent-rgb), .3);
  border-radius: 5px;
  padding: 2px 10px;
  font-size: .7rem;
  cursor: pointer;
}
.btn-recur-ignore {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 2px 10px;
  font-size: .7rem;
  cursor: pointer;
}
.recur-row-right { text-align: right; flex-shrink: 0; }
.recur-status-ok { color: var(--green); font-size: .75rem; font-weight: 600; }
.recur-status-warn { color: var(--accent); font-size: .75rem; font-weight: 600; }
.recur-status-sub { color: var(--text-muted); font-size: .65rem; }
/* Modal */
.modal-recur {
  max-width: 400px;
  width: 92%;
  max-height: 85vh;
  overflow-y: auto;
  border-radius: 14px;
  padding: 1.2rem;
}
.modal-recur-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.modal-recur-title { color: var(--text); font-size: 1rem; font-weight: 700; margin: 0; }
.modal-close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.4rem;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}
.modal-recur-section-label {
  color: var(--text-muted);
  font-size: .65rem;
  text-transform: uppercase;
  letter-spacing: .06em;
  margin: .8rem 0 .4rem;
}
.modal-recur-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px solid var(--border);
  font-size: .8rem;
}
.modal-recur-row:last-child { border-bottom: none; }
.modal-recur-info { flex: 1; }
.modal-recur-name { color: var(--text); font-size: .8rem; }
.modal-recur-cat { color: var(--text-muted); font-size: .7rem; }
.pill-toggle {
  border-radius: 20px;
  padding: 3px 10px;
  font-size: .7rem;
  cursor: pointer;
  border: 1px solid transparent;
  background: var(--bg2);
  color: var(--text-muted);
}
.pill-toggle--on { background: rgba(var(--green-rgb,76,175,77),.12); color: var(--green); border-color: rgba(var(--green-rgb,76,175,77),.3); }
.modal-recur-del { color: rgba(var(--accent-rgb),.5); font-size: 1.1rem; cursor: pointer; padding: 0 4px; }
.modal-recur-add { margin-top: 1rem; }
.modal-recur-add-form { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
.modal-recur-input {
  background: var(--bg2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 7px;
  padding: 6px 10px;
  font-size: .8rem;
  width: 100%;
  box-sizing: border-box;
}
.modal-recur-add-actions { display: flex; gap: 6px; }
.btn-recur-add-trigger {
  width: 100%;
  background: transparent;
  border: 1px dashed var(--border);
  color: var(--accent);
  border-radius: 8px;
  padding: 8px;
  font-size: .8rem;
  cursor: pointer;
}
```

- [ ] **Paso 4: Build y verificar que no hay errores de sintaxis CSS**

```bash
./build.sh
```

Abrir `index.html` en navegador, ir a Mi mes. La sección de recurrentes no debe verse aún (tiene `display:none` — se activa en JS).

- [ ] **Paso 5: Commit**

```bash
git add src/index.template.html
git commit -m "feat(recurrentes): HTML sección Mi mes + modal gestión + CSS"
```

---

## Task 4: UI rendering en `13-recurrentes.js`

**Files:**
- Modify: `src/js/13-recurrentes.js` (agregar al final del archivo)

- [ ] **Paso 1: Agregar variable de candidatas y `renderRecurrentes()`**

La variable `_candidatasDetectadas` permite referenciar candidatas por índice en los onclick, evitando inyectar objetos JSON en HTML (falla con apóstrofes, comillas, etc.). Agregar al inicio del bloque de renders, junto a las otras variables globales del módulo (después de `let recurrentesActivas = [];`):

```javascript
let _candidatasDetectadas = []; // candidatas del ciclo de render actual
```

Luego agregar la función:

```javascript
// ─── RENDER SECCIÓN MI MES ────────────────────────────────────

function renderRecurrentes() {
  const section = document.getElementById('recurrentes-section');
  const list    = document.getElementById('recur-list');
  const badge   = document.getElementById('recur-badge');
  if (!section || !list) return;

  const activas = recurrentesActivas.filter(r => r.activa);
  _candidatasDetectadas = detectarCandidatas();

  if (!activas.length && !_candidatasDetectadas.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  const estados    = activas.map(r => ({ r, estado: getEstadoMes(r) }));
  const pendientes = estados.filter(x => !x.estado.ok).length;

  if (pendientes > 0) {
    badge.textContent = pendientes + ' pendiente' + (pendientes > 1 ? 's' : '');
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }

  const filasActivas = estados.map(({ r, estado }) => {
    if (estado.ok) {
      return `<div class="recur-row recur-row--ok">
        <div class="recur-row-icon">✅</div>
        <div class="recur-row-info">
          <div class="recur-row-name">${r.descripcion}</div>
          <div class="recur-row-cat">${r.categoria}</div>
        </div>
        <div class="recur-row-right">
          <div class="recur-status-ok">${fmt(estado.monto)}</div>
        </div>
      </div>`;
    } else {
      // Usa data-id para evitar inyectar objetos en onclick
      return `<div class="recur-row recur-row--pending" data-recur-id="${r.id}" onclick="_cargarRecurrentePorId(this.dataset.recurId)">
        <div class="recur-row-icon">⚠️</div>
        <div class="recur-row-info">
          <div class="recur-row-name">${r.descripcion}</div>
          <div class="recur-row-cat">${r.categoria} · tocá para cargar</div>
        </div>
        <div class="recur-row-right">
          <div class="recur-status-warn">pendiente</div>
          ${r.monto_ref ? `<div class="recur-status-sub">~${fmt(r.monto_ref)}</div>` : ''}
        </div>
      </div>`;
    }
  }).join('');

  // Candidatas referencian por índice en _candidatasDetectadas
  const filasCandidatas = _candidatasDetectadas.map((c, idx) => `
    <div class="recur-row recur-row--suggest">
      <div class="recur-row-icon">💡</div>
      <div class="recur-row-info">
        <div class="recur-row-name">${c.descripcion} <span class="recur-tag-suggest">sugerida</span></div>
        <div class="recur-row-cat">${c.categoria} · apareció ${c.meses.size} meses</div>
        <div class="recur-suggest-actions">
          <button class="btn-recur-confirm" onclick="_confirmarCandidataIdx(${idx})">✓ Confirmar</button>
          <button class="btn-recur-ignore"  onclick="_ignorarCandidataIdx(${idx})">Ignorar</button>
        </div>
      </div>
    </div>
  `).join('');

  list.innerHTML = filasActivas + filasCandidatas;
}

// Helpers para onclick seguros (sin JSON en HTML)
function _cargarRecurrentePorId(id) {
  const r = recurrentesActivas.find(x => x.id === id);
  if (r) cargarRecurrenteForm(r);
}
function _confirmarCandidataIdx(idx) {
  const c = _candidatasDetectadas[idx];
  if (c) confirmarRecurrente(c);
}
function _ignorarCandidataIdx(idx) {
  const c = _candidatasDetectadas[idx];
  if (c) ignorarCandidata(c.descripcion, c.categoria);
}
```
```

- [ ] **Paso 2: Agregar funciones del modal**

```javascript
// ─── MODAL GESTIÓN ────────────────────────────────────────────

function abrirModalRecurrentes() {
  _renderModalRecurrentes();
  _poblarSelectsModal();
  document.getElementById('modal-recurrentes').style.display = 'flex';
}

function cerrarModalRecurrentes() {
  document.getElementById('modal-recurrentes').style.display = 'none';
  document.getElementById('modal-recur-add-form').style.display = 'none';
}

function _renderModalRecurrentes() {
  const body    = document.getElementById('modal-recur-body');
  if (!body) return;

  const activas  = recurrentesActivas.filter(r => r.activa);
  const pausadas = recurrentesActivas.filter(r => !r.activa);

  let html = '';

  if (activas.length) {
    html += `<div class="modal-recur-section-label">Activas</div>`;
    html += activas.map(r => _htmlModalRow(r)).join('');
  }
  if (pausadas.length) {
    html += `<div class="modal-recur-section-label">Pausadas</div>`;
    html += pausadas.map(r => _htmlModalRow(r)).join('');
  }
  if (!recurrentesActivas.length) {
    html = `<p style="color:var(--text-muted);font-size:.8rem;padding:.5rem 0">Aún no hay recurrentes confirmadas.</p>`;
  }

  body.innerHTML = html;
}

function _htmlModalRow(r) {
  return `<div class="modal-recur-row">
    <div class="modal-recur-info">
      <div class="modal-recur-name">${r.descripcion}</div>
      <div class="modal-recur-cat">${r.categoria}${r.fuente ? ' · ' + r.fuente : ''}</div>
    </div>
    <span class="pill-toggle ${r.activa ? 'pill-toggle--on' : ''}"
          onclick="toggleRecurrente('${r.id}')">
      ${r.activa ? 'activa' : 'pausada'}
    </span>
    <span class="modal-recur-del" onclick="eliminarRecurrente('${r.id}')">×</span>
  </div>`;
}

function _poblarSelectsModal() {
  const selCat  = document.getElementById('modal-recur-cat');
  const selFte  = document.getElementById('modal-recur-fuente');
  const selResp = document.getElementById('modal-recur-resp');
  if (selCat) {
    selCat.innerHTML = '<option value="">Categoría…</option>' +
      categGasto.map(c => `<option value="${c}">${c}</option>`).join('');
  }
  if (selFte) {
    selFte.innerHTML = '<option value="">Fuente (opcional)</option>' +
      categFuentes.map(f => `<option value="${f}">${f}</option>`).join('');
  }
  if (selResp) {
    selResp.innerHTML = categResponsabilidad
      .map(r => `<option value="${r}">${r}</option>`).join('');
  }
}

function _mostrarFormRecurManual() {
  _poblarSelectsModal();
  document.getElementById('modal-recur-desc').value = '';
  document.getElementById('modal-recur-add-form').style.display = '';
}

function _guardarRecurrenteManualForm() {
  const desc  = document.getElementById('modal-recur-desc').value.trim();
  const cat   = document.getElementById('modal-recur-cat').value;
  const fuente = document.getElementById('modal-recur-fuente').value;
  const resp  = document.getElementById('modal-recur-resp').value;
  agregarRecurrenteManual(desc, cat, fuente, resp);
  document.getElementById('modal-recur-add-form').style.display = 'none';
}
```

- [ ] **Paso 3: Build**

```bash
./build.sh
```

- [ ] **Paso 4: Commit**

```bash
git add src/js/13-recurrentes.js
git commit -m "feat(recurrentes): render sección Mi mes, modal gestión, candidatas"
```

---

## Task 5: Integrar en `03-data.js`

**Files:**
- Modify: `src/js/03-data.js` — función `iniciarApp()` (líneas ~155–182)

- [ ] **Paso 1: Agregar carga de recurrentes en el path con cache (línea ~166)**

Buscar:
```javascript
    Promise.all([cargarCategorias(), cargarTodasTransacciones()])
      .then(() => { ocultarErrorCarga(); _renderApp(); if (badge) badge.style.display = "none"; })
```

Reemplazar con:
```javascript
    Promise.all([cargarCategorias(), cargarTodasTransacciones(), cargarRecurrentes()])
      .then(() => { ocultarErrorCarga(); _renderApp(); if (badge) badge.style.display = "none"; })
```

- [ ] **Paso 2: Agregar en el path sin cache (línea ~176)**

Buscar:
```javascript
      await Promise.all([cargarCategorias(), cargarTodasTransacciones()]);
```

Reemplazar con:
```javascript
      await Promise.all([cargarCategorias(), cargarTodasTransacciones(), cargarRecurrentes()]);
```

- [ ] **Paso 3: Build**

```bash
./build.sh
```

- [ ] **Paso 4: Commit**

```bash
git add src/js/03-data.js
git commit -m "feat(recurrentes): cargar recurrentes junto con transacciones en iniciarApp"
```

---

## Task 6: Integrar en `07-presupuesto.js`

**Files:**
- Modify: `src/js/07-presupuesto.js` — función `cargarPresupuesto()` (líneas ~31–50)

- [ ] **Paso 1: Agregar llamada a `renderRecurrentes()` al final de `cargarPresupuesto()`**

Buscar (las últimas líneas de `cargarPresupuesto`):
```javascript
  await cargarCuotasActivas();
  _renderCuotasCard();
  _inicializarDisclosureCuotas();
  if (window.lucide) lucide.createIcons();
```

Reemplazar con:
```javascript
  await cargarCuotasActivas();
  _renderCuotasCard();
  _inicializarDisclosureCuotas();
  renderRecurrentes();
  if (window.lucide) lucide.createIcons();
```

- [ ] **Paso 2: Build**

```bash
./build.sh
```

- [ ] **Paso 3: Commit**

```bash
git add src/js/07-presupuesto.js
git commit -m "feat(recurrentes): renderizar recurrentes al cargar Mi mes"
```

---

## Task 7: Verificación end-to-end

- [ ] **Paso 1: Abrir la app, ir a Mi mes**

Con al menos 2 meses de historial en `allTransac`, la sección "📋 Recurrentes" debe aparecer mostrando candidatas sugeridas (💡).

- [ ] **Paso 2: Confirmar una candidata**

Click en "✓ Confirmar" sobre una candidata. Verificar:
- La candidata desaparece de la lista de sugerencias
- Aparece en la lista con estado ✅ (si ya fue cargada este mes) o ⚠️ pendiente
- En Supabase Table Editor → tabla `recurrentes` aparece la nueva fila

- [ ] **Paso 3: Probar badge de pendientes**

Si hay recurrentes sin cargar en el mes actual, el badge "N pendientes" debe aparecer en rojo.

- [ ] **Paso 4: Probar click en pendiente**

Click en una fila ⚠️ pendiente. Verificar que navega a "Nueva transacción" con descripción y categoría pre-llenadas, fuente y responsabilidad correctas, monto vacío y foco en el campo monto.

- [ ] **Paso 5: Probar modal de gestión**

Click en "⚙️ Gestionar". Verificar:
- Lista las recurrentes confirmadas separadas en activas/pausadas
- Click en "activa/pausada" alterna el estado
- Click en "×" elimina con confirmación
- "+ Agregar recurrente manual" muestra el mini-form y permite agregar

- [ ] **Paso 6: Probar con usuario Ama**

Iniciar sesión como Ama, verificar que solo ve sus propias recurrentes (RLS).

- [ ] **Paso 7: Commit final**

```bash
git add -A
git commit -m "feat(recurrentes): feature completa — detección híbrida, alertas Mi mes, gestión modal"
git push
```
