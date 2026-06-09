# Spec: Detección de Transacciones Recurrentes

**Fecha:** 2026-06-09  
**Estado:** Aprobado — pendiente de implementación

---

## Resumen

Feature híbrida que detecta automáticamente candidatas a transacciones recurrentes analizando el historial, permite al usuario confirmarlas o ignorarlas, y alerta cada mes cuando alguna confirmada no fue cargada aún.

---

## Decisiones de diseño

| Decisión | Elección |
|---|---|
| Enfoque | Híbrido: auto-detección + confirmación manual |
| Superficie de alerta | Sección "Recurrentes" dentro de Mi mes |
| Gestión (CRUD) | Modal "⚙️ Gestionar" desde esa sección |
| Acción al tocar pendiente | Navega a Nueva transacción con campos pre-llenados |
| Identidad de una recurrente | `descripcion` + `categoria` |
| Umbral de sugerencia | ≥ 2 meses calendario distintos |
| Persistencia de reglas | Tabla Supabase `recurrentes` (por usuario) |
| Exclusiones | Transacciones con `compra_id != null` (cuotas) e `Ingresos` |

---

## 1. Modelo de datos

### Tabla Supabase: `recurrentes`

```sql
create table recurrentes (
  id              uuid primary key default gen_random_uuid(),
  usuario         text not null,
  descripcion     text not null,
  categoria       text not null,
  monto_ref       numeric,          -- monto de referencia (último conocido)
  fuente          text,             -- pre-llena el form al cargar
  responsabilidad text,             -- pre-llena el form al cargar
  activa          boolean default true,
  created_at      timestamptz default now()
);
```

**RLS:** misma política que `transacciones` — solo acceso al usuario autenticado cuyo `usuario` coincide.

**Variable global:** `let recurrentesActivas = [];` cargada junto con `allTransac` en `iniciarApp`.

---

## 2. Algoritmo de detección

Corre **client-side** sobre `allTransac` una vez que los datos están cargados. Vive en `13-recurrentes.js`.

### `detectarCandidatas(allTransac, recurrentesConfirmadas)`

1. Filtra `allTransac`: solo `tipo === "Gasto"` y `!compra_id`.
2. Agrupa por `{descripcion, categoria}` → Set de meses `"YYYY-MM"` en que aparece cada grupo.
3. Guarda la transacción más reciente del grupo para extraer `fuente`, `responsabilidad` y `monto_ref`.
4. Filtra grupos con `meses.size >= 2`.
5. Excluye grupos cuya clave `descripcion||categoria` ya exista en `recurrentesConfirmadas`.
6. Retorna array de candidatas ordenadas por frecuencia descendente.

### `getEstadoMes(recurrente, allTransac, mesActual)`

Retorna `{ ok: true, transaccion }` si existe en `allTransac` una transacción del `mesActual` (`fecha.startsWith(mesActual)`) con misma `descripcion` + `categoria` + sin `compra_id`. De lo contrario `{ ok: false }`.

`mesActual` = `new Date().toISOString().slice(0, 7)`.

---

## 3. Carga de datos

En `03-data.js`, dentro de `iniciarApp`, se agrega una carga paralela:

```javascript
// junto con cargarTodasTransacciones()
recurrentesActivas = await cargarRecurrentes(); // SELECT * FROM recurrentes WHERE usuario = USUARIO
```

`cargarRecurrentes` sigue el mismo patrón que otras cargas: Supabase query con manejo de error silencioso (retorna `[]` si falla).

---

## 4. UI — Sección en Mi mes

### Estructura HTML (en `index.template.html`, dentro de `#page-presupuesto`)

```html
<section id="recurrentes-section" class="recur-section">
  <div class="recur-header">
    <span class="recur-title">
      📋 Recurrentes
      <span id="recur-badge" class="recur-badge" style="display:none"></span>
    </span>
    <button class="recur-manage-btn" onclick="abrirModalRecurrentes()">⚙️ Gestionar</button>
  </div>
  <div id="recur-list" class="recur-list"></div>
</section>
```

### Renderizado: `renderRecurrentes()` en `13-recurrentes.js`

Llamado al final de `cargarPresupuesto()` (en `07-presupuesto.js`).

**Lógica de render:**

1. Calcula estado de cada recurrente activa con `getEstadoMes`.
2. Detecta candidatas nuevas con `detectarCandidatas`.
3. Renderiza en `#recur-list`:
   - **✅ Cargadas** — fondo verde tenue, monto real de la transacción encontrada.
   - **⚠️ Pendientes** — fondo terracota tenue, monto de referencia (~), clickeables → `cargarRecurrenteForm(recurrente)`.
   - **💡 Candidatas sugeridas** — borde punteado, botones "Confirmar" / "Ignorar".
4. Actualiza `#recur-badge`: muestra cantidad de pendientes; oculto si todas están al día.
5. Si hay pendientes: el header muestra `"2 pendientes"` en badge terracota. Si todas están al día: texto verde `"✓ todas al día"`.

### Interacciones

| Acción | Resultado |
|---|---|
| Click en fila pendiente | `cargarRecurrenteForm(r)` → navega a `page-nueva` con campos pre-llenados |
| Click "Confirmar" en candidata | `confirmarRecurrente(candidata)` → INSERT en Supabase + re-render |
| Click "Ignorar" en candidata | `ignorarCandidata(key)` → guarda key en `localStorage` como `recur_ignoradas` para no volver a sugerir |
| Click "⚙️ Gestionar" | `abrirModalRecurrentes()` → muestra modal |

### `cargarRecurrenteForm(recurrente)`

```javascript
function cargarRecurrenteForm(r) {
  navegarA('nueva');
  // pre-llena el formulario de nueva transacción
  document.getElementById('f-tipo').value = 'Gasto';
  document.getElementById('f-descripcion').value = r.descripcion;
  document.getElementById('f-categoria').value = r.categoria;
  document.getElementById('f-fuente').value = r.fuente || '';
  seleccionarResp(r.responsabilidad || 'Mío');
  // monto NO se pre-llena: debe ser ingresado manualmente
}
```

El monto se deja vacío intencionalmente — puede variar mes a mes.

---

## 5. UI — Modal de gestión

### HTML (en `index.template.html`)

```html
<div id="modal-recurrentes" class="modal-overlay" style="display:none">
  <div class="modal-box">
    <div class="modal-header">
      <h3>⚙️ Mis recurrentes</h3>
      <button onclick="cerrarModalRecurrentes()">×</button>
    </div>
    <div id="modal-recur-activas"></div>
    <div id="modal-recur-pausadas"></div>
    <button onclick="agregarRecurrenteManual()" class="modal-add-btn">
      + Agregar recurrente manual
    </button>
  </div>
</div>
```

### Funciones del modal

| Función | Acción |
|---|---|
| `abrirModalRecurrentes()` | `display:block` + renderiza listas activas/pausadas |
| `cerrarModalRecurrentes()` | `display:none` |
| `toggleRecurrente(id)` | UPDATE `activa = !activa` en Supabase + re-render |
| `eliminarRecurrente(id)` | DELETE en Supabase + re-render con confirmación |
| `agregarRecurrenteManual()` | Muestra mini-form inline dentro del modal para ingresar descripcion + categoria + fuente + responsabilidad |

---

## 6. Módulo `13-recurrentes.js`

Funciones públicas expuestas:

```
cargarRecurrentes()          → Promise<recurrente[]>
detectarCandidatas()         → candidata[]
getEstadoMes()               → { ok, transaccion? }
renderRecurrentes()          → void
confirmarRecurrente()        → Promise<void>
ignorarCandidata()           → void
cargarRecurrenteForm()       → void
abrirModalRecurrentes()      → void
cerrarModalRecurrentes()     → void
toggleRecurrente()           → Promise<void>
eliminarRecurrente()         → Promise<void>
agregarRecurrenteManual()    → Promise<void>
```

---

## 7. CSS

Nuevas clases en `index.template.html` (siguiendo el sistema de design existente):

```css
.recur-section        /* contenedor de la sección */
.recur-header         /* flex row: título + botón gestionar */
.recur-title          /* label uppercase 10px */
.recur-badge          /* pill terracota con count */
.recur-manage-btn     /* botón ghost pequeño */
.recur-list           /* flex column gap-5px */
.recur-row            /* fila base */
.recur-row--ok        /* fondo verde tenue */
.recur-row--pending   /* fondo terracota tenue, cursor pointer */
.recur-row--suggest   /* borde dashed, fondo neutro */
```

Usa `rgba(var(--*-rgb), opacity)` para respetar el tema claro de Ama.

---

## 8. Orden de implementación

1. **Migración SQL** — crear tabla `recurrentes` con RLS.
2. **`13-recurrentes.js`** — funciones de detección y estado.
3. **`03-data.js`** — agregar `cargarRecurrentes()` al init.
4. **`index.template.html`** — HTML de la sección y el modal + CSS.
5. **`07-presupuesto.js`** — llamar `renderRecurrentes()` al final de `cargarPresupuesto()`.
6. **`build.sh`** — incluir `13-recurrentes.js` en el orden de concatenación.

---

## 9. Casos edge

| Caso | Comportamiento |
|---|---|
| Sin transacciones históricas | Sección no renderiza (o mensaje vacío "Aún no hay recurrentes") |
| Recurrente pausada | No aparece en la lista de Mi mes, no genera alertas |
| Candidata ignorada | Se guarda en `localStorage` bajo `recur_ignoradas_USUARIO`; no reaparece en esa sesión |
| Mismo nombre, distinta categoría | Son dos recurrentes distintas (identidad es `descripcion||categoria`) |
| Usuario Ama vs Daniel | `recurrentes` se filtra por `usuario`; cada uno ve las suyas |
| Transacción cuota | Excluida por `compra_id != null` en la detección |
| Sin conexión | `cargarRecurrentes()` retorna `[]` silenciosamente; sección no muestra candidatas pero tampoco rompe |
