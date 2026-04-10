---
title: "feat: Mes de liquidación para tarjetas de crédito"
status: active
origin: docs/brainstorms/2026-04-10-001-mes-liquidacion-tarjetas-requirements.md
created: 2026-04-10
---

# feat: Mes de liquidación para tarjetas de crédito

## Problema

Las tarjetas de crédito operan con ciclos de cierre que no coinciden con meses calendario. El sistema actual no distingue entre fecha de compra y mes presupuestario, forzando al usuario a ingresar fechas falsas (1° del mes) y perdiendo la fecha real de la operación.

## Solución

Introducir el concepto `FUENTE_TC` (tarjeta de crédito) en la tabla `categorias` y el campo `mes_liquidacion` (`YYYY-MM`) en transacciones. Una función auxiliar centralizada `getMesLiquidacion(t)` reemplaza el acceso directo a `t.fecha` en todos los filtros de mes. (see origin: `docs/brainstorms/2026-04-10-001-mes-liquidacion-tarjetas-requirements.md`)

## Scope

### Incluido
- Toggle FUENTE_TC / FUENTE en página de Categorías con badge visual
- Campo `mes_liquidacion` en formularios de nueva y edición de transacción (solo TC)
- `getMesLiquidacion(t)` como única fuente de verdad para asignación de mes en todas las vistas
- Sub-etiqueta "Liq. abr 2026" en la columna fecha cuando difiere del mes de compra
- Inclusión de fuentes TC en el selector de filtro de fuente

### Excluido
- Migración automática de transacciones existentes
- Auto-detección de fechas de cierre desde PDF
- Registro de cierres reales por período
- Cuotas automáticas

## Decisiones de diseño

| Decisión | Rationale |
|---|---|
| Tipo discriminador `FUENTE_TC` en tabla `categorias` existente | Reutiliza la lógica de CRUD existente para fuentes; no requiere tabla nueva |
| `mes_liquidacion` sin valor por defecto, campo obligatorio | Previene miscategorización silenciosa; el usuario debe decidir explícitamente |
| `getMesLiquidacion(t)` retorna `{year, month}` (month base-1) | Consistente con la forma en que el resto del código construye comparaciones de mes/año |
| Visibility de campo por tipo de fuente (no por presencia del campo) | Evita estado inconsistente: una TC sin mes_liquidacion muestra el campo vacío obligatorio |
| Sub-etiqueta solo cuando mes difiere | Reduce ruido visual; solo aparece cuando la diferencia es informativa |
| Badge "Liq. pendiente" para TC sin mes_liquidacion | Permite identificar transacciones históricas que necesitan corrección sin bloquear el uso normal |
| Confirmación inline al reclasificar (no confirm()) | confirm() puede suprimirse en iOS Safari; inline es más robusto y consistente con el resto de la app |
| Reclasificación via upsert (no delete+insert) | Evita la ventana de inconsistencia donde la fuente puede quedar eliminada sin el nuevo tipo |
| batch TC → mes_liquidacion derivado de t.fecha | Mejor aproximación disponible para batch; el usuario puede editar individualmente si la cuota es de otro mes |
| Alerta al reclasificar fuente existente | Informa al usuario sin bloquear — las transacciones históricas usan t.fecha como fallback |

## Prerequisito de schema (antes de cualquier deploy)

Ejecutar en los dos proyectos Supabase (`finanzas-daniel` y `finanzas-ama`):

```sql
ALTER TABLE transacciones ADD COLUMN mes_liquidacion TEXT DEFAULT NULL;
```

El `SELECT *` de `cargarTodasTransacciones()` ya lo captará automáticamente.

## Dependencias y secuencia

Las unidades están numeradas en orden de implementación. Las etapas 1-3 deben completarse antes de que los formularios y filtros funcionen correctamente.

```
Etapa 1: Schema DB (prerequisito bloqueante)
  └─ Etapa 2: Estado global + cargarCategorias
       └─ Etapa 3: getMesLiquidacion helper
            ├─ Etapa 4: Config page (badge + toggle)
            ├─ Etapa 5: Formulario nueva transacción
            ├─ Etapa 6: Formulario edición de transacción
            ├─ Etapa 7: guardarTransaccion + guardarEdicionTransaccion
            ├─ Etapa 8: batchAddTransacciones
            └─ Etapa 9: Filtros + sub-etiqueta en tabla
```

---

## Unidades de implementación

### UI-1: Estado global y carga de categorías
**Archivo:** `index.html`

**Qué cambia:**

1. **Globals** (~línea 2206): Agregar `let categFuentesTC = [];` junto a `let categFuentes = [];`

2. **`cargarCategorias()`** (~líneas 2579-2592): Después de que `_aplicarCacheCateg()` procesa `FUENTE`, agregar una línea equivalente para `FUENTE_TC`:
   ```
   categFuentesTC = data.filter(r => r.tipo === 'FUENTE_TC').map(r => r.valor);
   ```

3. **`_aplicarCacheCateg()`** (~líneas 2379-2396): La función puebla DOS selectores desde `categFuentes`: el `#f-fuente` (formulario de nueva transacción) y el `#fil-fuente` (filtro en Transacciones). Ambos deben reconstruirse con `[...categFuentes, ...categFuentesTC]` para que las fuentes TC aparezcan en ambos lugares. Si solo se actualiza `#fil-fuente`, las fuentes TC no aparecerán en el formulario de nueva transacción y `UI-5` fallará.

**Patrón existente a seguir:** la forma en que `_aplicarCacheCateg` ya itera `categFuentes` para poblar `#f-fuente` y `#fil-fuente`.

**Escenarios de test:**
- Hay una categoría tipo `FUENTE_TC` en Supabase → `categFuentesTC` se popula al cargar
- El selector `#fil-fuente` lista fuentes de ambos tipos sin duplicados
- Sin categorías `FUENTE_TC` → `categFuentesTC = []`, ningún comportamiento roto

---

### UI-2: Helper `getMesLiquidacion(t)`
**Archivo:** `index.html`

**Qué cambia:**

Agregar función auxiliar junto a las otras funciones de utilidad (cerca de `fmtFecha`, `parsearDecimal`):

```
function getMesLiquidacion(t) {
  if (t.mes_liquidacion && /^\d{4}-(0[1-9]|1[0-2])$/.test(t.mes_liquidacion)) {
    const [y, m] = t.mes_liquidacion.split('-').map(Number);
    return { year: y, month: m };
  }
  const d = new Date(t.fecha + 'T12:00:00');
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
```

**Notas de implementación:**
- El sufijo `T12:00:00` evita problemas de zona horaria con `new Date('YYYY-MM-DD')` que puede parsear como UTC midnight y aparecer el día anterior en GMT-3
- La validación regex descarta valores malformados (fallback a `t.fecha`)
- Month retorna base-1 (enero = 1) — consistente con cómo el resto del código compara meses

**Escenarios de test:**
- `t.mes_liquidacion = "2026-04"` → `{ year: 2026, month: 4 }`
- `t.mes_liquidacion = null` → parsea `t.fecha` correctamente
- `t.mes_liquidacion = ""` o `t.mes_liquidacion = "invalid"` → parsea `t.fecha` como fallback
- `t.fecha = "2026-01-15"` sin mes_liquidacion → `{ year: 2026, month: 1 }`

---

### UI-3: Reemplazo de `t.fecha` en funciones de filtrado
**Archivo:** `index.html`

**Qué cambia:**

Reemplazar el acceso directo a `t.fecha` para comparaciones de mes/año en cada uno de estos sitios. El display de fecha (`fmtFecha(t.fecha)`) no cambia.

| Función | Línea aprox. | Cambio |
|---|---|---|
| `filtrarTabla()` | 3247 | `new Date(t.fecha + 'T12:00:00')` para comparación de mes → `getMesLiquidacion(t)` |
| `renderPresupuesto()` (desde cargarPresupuesto) | 4516 | Mismo patrón |
| `actualizarKpisPres()` | 4710 | Mismo patrón |
| `cargarCompartidos()` | 3771, 3776 | Dos usos, ambos de bucketing |
| `cargarResumenMes()` | 2746, 2846 | Dos usos |
| `cargarEvolucion()` | 3097 | Llamada desde cargarResumenMes |
| `cargarAnual()` | 4123, 4132, 4144, 4219 | **Los 4 usos son bucketing** — todos deben cambiarse |

**Patrón de reemplazo** (directional — no copiar literalmente):
```js
// Antes
const d = new Date(t.fecha + 'T12:00:00');
if (d.getFullYear() === anio && d.getMonth() + 1 === mes) { ... }

// Después
const { year, month } = getMesLiquidacion(t);
if (year === anio && month === mes) { ... }
```

**Sub-paso obligatorio antes de modificar `cargarAnual()`:** Esta función tiene lógica compleja (agrupación, filtros de año, acumulados para gráficos). Antes de hacer cualquier reemplazo, leer el bloque completo e identificar en qué variable local de cada uno de los 4 sitios (líneas 4123, 4132, 4144, 4219) se está comparando `t.fecha` — el patrón exacto puede variar entre sitios. Documentar las 4 variables antes de escribir el reemplazo. Los 4 usos están confirmados como bucketing — ninguno es solo display.

**Sub-paso para `cargarCompartidos()`:** Leer el bloque de esta función antes de modificar para identificar la variable local de mes/año contra la que se compara `t.fecha` en las líneas 3771 y 3776. Puede ser un parámetro de la función, una variable de cierre, o un global — documentar antes de reemplazar.

**Escenarios de test:**
- Transacción TC con `mes_liquidacion = "2026-04"` y `fecha = "2026-01-15"` → aparece en abril, NO en enero, en todas las vistas
- Transacción sin `mes_liquidacion` → filtra por `fecha` igual que hoy (sin regresión)
- Transacción TC sin `mes_liquidacion` (anterior a la feature) → también filtra por `fecha` (fallback documentado)
- Filtro de mes en Transacciones, Mi mes, Compartidos, Resumen y Anual — todos consistentes

---

### UI-4: Config page — badge y toggle de tipo TC
**Archivo:** `index.html`

**Qué cambia:**

1. **`renderizarConfig()`** (~líneas 4795-4813): La función `_renderLista("fuente", categFuentes, "FUENTE")` actualmente renderiza solo `FUENTE`. Extender para también renderizar `categFuentesTC` con `_renderLista("fuente_tc", categFuentesTC, "FUENTE_TC")` en el mismo contenedor `#cfg-lista-fuente`, o modificar `_renderLista` para que cada item TC tenga un badge visual diferenciador.

   La solución más directa: mantener dos llamadas a `_renderLista` o combinar en una lista con badge según tipo. Inspeccionar `_renderLista` antes de decidir.

2. **Badge visual:** Cada fuente TC muestra badge de texto "TC" (color de acento o `var(--accent)`). Las fuentes FUENTE no muestran badge.

3. **Toggle reclasificación:** Botón "Marcar como pago inmediato" en TC / "Marcar como tarjeta de crédito" en FUENTE. Al hacer click:
   - Llamar `confirmarReclasificarFuente(valor, tipoActual)`
   - La función debe:
     1. Contar transacciones históricas con esa fuente en `allTransac`
     2. Si hay transacciones, mostrar una **confirmación inline** en la misma fila (no `confirm()` nativo): aparece un mini-bloque con el texto _"X transacciones anteriores de esta fuente seguirán usando su fecha original. ¿Confirmar?"_ y dos botones "Confirmar" / "Cancelar". Si no hay transacciones, proceder directamente sin confirmación.
     3. Si el usuario confirma: **upsert** con el nuevo tipo (no delete+insert). Usar `.upsert({ tipo: nuevoTipo, valor }, { onConflict: 'tipo,valor' })` o el patrón de upsert disponible en el cliente Supabase. Verificar en implementación cómo está definida la constraint de unicidad en la tabla `categorias`.
     4. Si el upsert falla: mostrar `#cfg-msg-fuente` con error
     5. En éxito: `cargarCategorias()` + `renderizarConfig()` para reflejar el cambio

   **Patrón de mensajes:** usar `#cfg-msg-fuente` inline (como hace `agregarCategoria`), NO `showToast`.

   **Nota implementación upsert:** si el cliente Supabase no soporta upsert con `onConflict` en este schema, la alternativa es hacer delete seguido de insert como transacciones separadas; en ese caso, si el insert falla, mostrar el error con el texto exacto: _"Error al reclasificar. La fuente fue eliminada — volvé a agregarla con el nuevo tipo desde el campo de abajo."_ Esto permite al usuario recuperarse sin perder trabajo.

**Escenarios de test:**
- Fuente TC muestra badge "TC" y botón "Marcar como pago inmediato"
- Fuente FUENTE no muestra badge y muestra botón "Marcar como tarjeta de crédito"
- Reclasificar fuente sin transacciones → no muestra confirm; cambia tipo
- Reclasificar fuente con 5 transacciones → confirm con mensaje "5 transacciones anteriores..."
- Error en insert después de delete → `#cfg-msg-fuente` muestra error
- Post-reclasificación: `categFuentesTC` y `categFuentes` se actualizan correctamente

---

### UI-5: Formulario nueva transacción — campo `mes_liquidacion`
**Archivo:** `index.html`

**Qué cambia:**

1. **HTML** (~líneas 1580-1631): Agregar el campo debajo del selector de fuente, con `style="display:none"` por defecto:
   ```html
   <div id="grupo-mes-liquidacion" style="display:none">
     <label>Mes de liquidación</label>
     <input type="month" id="f-mes-liquidacion" />
   </div>
   ```
   El tipo `month` genera un picker de año+mes nativo en móvil, lo que encaja con UX de la app.

2. **JS — onChange de `#f-fuente`**: Al cambiar la fuente seleccionada, evaluar si está en `categFuentesTC`:
   - Si sí: `document.getElementById('grupo-mes-liquidacion').style.display = ''`; campo requerido
   - Si no: `document.getElementById('grupo-mes-liquidacion').style.display = 'none'`; limpiar valor

3. **Validación al guardar**: Si la fuente es TC y `#f-mes-liquidacion` está vacío → mostrar error **inline bajo el grupo** `#grupo-mes-liquidacion`, texto: _"Seleccioná el mes de liquidación para continuar."_ No guardar hasta que se complete.

4. **Reset tras guardar**: El campo debe limpiarse en la función de reset del formulario (el mismo lugar donde se limpian los otros campos).

**Patrón a seguir:** la forma en que `setTipo()` ya muestra/oculta campos según tipo de transacción.

**Escenarios de test:**
- Seleccionar fuente FUENTE → campo `mes_liquidacion` oculto
- Seleccionar fuente FUENTE_TC → campo visible y requerido
- Intentar guardar TC sin mes_liquidacion → error, no guarda
- Cambiar fuente de TC a FUENTE → campo desaparece y valor se limpia
- Tras guardar exitosamente → campo se resetea

---

### UI-6: Formulario edición — campo `mes_liquidacion`
**Archivo:** `index.html`

**Qué cambia:**

1. **HTML modal edit** (~líneas 2113-2174): Agregar campo equivalente al de nueva transacción, también con `style="display:none"` por defecto:
   ```html
   <div id="edit-grupo-mes-liquidacion" style="display:none">
     <label>Mes de liquidación</label>
     <input type="month" id="edit-mes-liquidacion" />
   </div>
   ```

2. **Función que abre el modal** (buscar donde se popula `edit-fuente`, `edit-fecha`, etc.):
   - Si la fuente de la transacción es `FUENTE_TC`: mostrar campo, poblar con `t.mes_liquidacion` (o vacío si no tiene)
   - Si la fuente es `FUENTE`: ocultar campo

3. **onChange de `#edit-fuente`**: Misma lógica de visibilidad que en nueva transacción.

4. **Validación al guardar**: Si fuente TC y campo vacío → mostrar error **inline bajo el grupo** `#edit-grupo-mes-liquidacion`, texto: _"Seleccioná el mes de liquidación para continuar."_ No guardar hasta que se complete.

**Escenarios de test:**
- Abrir edición de transacción TC con mes_liquidacion → campo visible y prellenado
- Abrir edición de transacción FUENTE → campo oculto
- Abrir edición de transacción TC sin mes_liquidacion (histórica post-reclasificación) → campo visible y vacío, requerido antes de guardar
- Cambiar fuente de TC a FUENTE en edit → campo desaparece, mes_liquidacion se borrará al guardar
- Cambiar fuente de FUENTE a TC en edit → campo aparece vacío, requerido

---

### UI-7: Persistencia — guardar y editar transacciones
**Archivo:** `index.html`

**Qué cambia:**

1. **`guardarTransaccion()`** (~líneas 3546-3595): Leer `#f-mes-liquidacion`. Si fuente es TC y tiene valor, incluirlo en el objeto del insert. Si fuente es FUENTE, enviar `mes_liquidacion: null`.

   ```js
   // Directional
   const esFuenteTC = categFuentesTC.includes(fuente);
   const mesLiq = esFuenteTC ? document.getElementById('f-mes-liquidacion').value || null : null;
   // ... insert: { ..., mes_liquidacion: mesLiq }
   ```

2. **`guardarEdicionTransaccion()`** (~líneas 3477-3520): Actualmente el `.update()` no incluye `mes_liquidacion`. Agregar:
   - Si fuente del formulario es TC: enviar el valor del campo (puede ser null si el usuario no completó y se decidió guardar de todas formas — aunque la validación debería bloquearlo antes)
   - Si fuente es FUENTE: enviar `mes_liquidacion: null` para borrar el campo si había uno previo

**Nota:** `guardarEdicionTransaccion()` usa `.update()` directamente (no delete+add), confirmar en la lectura del archivo antes de modificar.

**Chequeo defensivo de schema:** En `guardarTransaccion()` y `guardarEdicionTransaccion()`, si Supabase devuelve un error cuyo mensaje contiene `"column"` y `"mes_liquidacion"` (indicando que la columna no existe en ese proyecto), mostrar un toast con el mensaje: _"Error de configuración de base de datos — el administrador debe ejecutar la migración de schema."_ Esto previene fallos silenciosos si uno de los dos proyectos no fue migrado antes del deploy.

**Escenarios de test:**
- Nueva transacción TC con `mes_liquidacion = "2026-04"` → columna guardada en Supabase
- Nueva transacción FUENTE → `mes_liquidacion = null` en Supabase
- Editar transacción TC → `mes_liquidacion` se actualiza
- Editar transacción TC cambiando fuente a FUENTE → `mes_liquidacion = null` en Supabase
- Verificar que las demás columnas no se modifiquen

---

### UI-8: `batchAddTransacciones` — ruta de inserción masiva
**Archivo:** `index.html`

**Qué cambia:**

`batchAddTransacciones()` es la ruta de inserción usada por CSV/Modo Ráfaga. Actualmente no conoce `mes_liquidacion`. Dos opciones de alcance:

**Decisión:** Para transacciones importadas con fuente TC, derivar `mes_liquidacion` automáticamente de `t.fecha`: tomar los primeros 7 caracteres (`t.fecha.substring(0, 7)` → `"YYYY-MM"`). Esto coloca la transacción en el mes de la fecha de compra, que es la mejor aproximación disponible sin intervención del usuario. El usuario puede editar individualmente después si la cuota cae en un mes diferente.

Para fuentes FUENTE, `mes_liquidacion: null` como siempre.

Cambio concreto: en `batchAddTransacciones()`, al construir el objeto de insert:
```js
// Directional
const esFuenteTC = categFuentesTC.includes(fuente);
mes_liquidacion: esFuenteTC ? t.fecha.substring(0, 7) : null
```

**Escenarios de test:**
- Import batch con fuente TC → `mes_liquidacion` derivado de `t.fecha` (ej: fecha "2026-01-15" → mes_liquidacion "2026-01")
- Import batch con fuente FUENTE → `mes_liquidacion = null`
- La transacción TC importada aparece en el mes de su fecha de compra (comportamiento esperado para batch)

---

### UI-9: Sub-etiqueta "Liq." en tabla de transacciones
**Archivo:** `index.html`

**Qué cambia:**

En la función que renderiza filas de la tabla de transacciones (buscar donde se construye el HTML de cada `<tr>` con `t.fecha`, probablemente en `filtrarTabla()` o una función de render llamada desde ella):

La celda de fecha puede mostrar hasta dos elementos bajo la fecha real:

1. **Sub-etiqueta "Liq."** cuando `mes_liquidacion` existe y su mes/año difiere del mes de `fecha`
2. **Badge "pendiente"** cuando la fuente es FUENTE_TC pero `mes_liquidacion` está vacío (transacción histórica que necesita corrección)

```js
// Directional
const { year: ly, month: lm } = getMesLiquidacion(t);
const fd = new Date(t.fecha + 'T12:00:00');
const mismoMes = fd.getFullYear() === ly && fd.getMonth() + 1 === lm;
const esFuenteTC = categFuentesTC.includes(t.fuente);

let extra = '';
if (!mismoMes && t.mes_liquidacion) {
  extra = `<div class="fecha-liq-label">Liq. ${MESES_ABREV[lm - 1]} ${ly}</div>`;
} else if (esFuenteTC && !t.mes_liquidacion) {
  extra = `<div class="fecha-liq-pendiente">Liq. pendiente</div>`;
}
// fmtFecha(t.fecha) + extra en la celda
```

Donde `MESES_ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']`.

CSS:
```css
.fecha-liq-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 2px;
}
.fecha-liq-pendiente {
  font-size: 0.75rem;
  color: var(--orange, #f59e0b); /* usar el token de warning/accent existente */
  margin-top: 2px;
}
```

Verificar qué variable CSS de warning/naranja existe en el tema antes de hardcodear el fallback.

**Escenarios de test:**
- Transacción TC con `mes_liquidacion = "2026-04"` y `fecha = "2026-01-15"` → muestra "15 ene. 2026" + "Liq. abr 2026" debajo
- Transacción TC con `mes_liquidacion = "2026-01"` y `fecha = "2026-01-15"` (mismo mes) → NO muestra sub-etiqueta
- Transacción TC sin `mes_liquidacion` (histórica post-reclasificación) → muestra "Liq. pendiente" en naranja
- Transacción FUENTE sin `mes_liquidacion` → NO muestra badge pendiente
- Sub-etiqueta usa color muted; badge pendiente usa color warning

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `cargarAnual()` tiene lógica compleja — un reemplazo parcial rompe gráficos | Media | Leer la función completa antes de modificar; probar los 4 gráficos post-cambio |
| `_aplicarCacheCateg()` rellena `#f-fuente` — las fuentes TC deben aparecer allí pero con orden correcto | Baja | Usar `[...categFuentes, ...categFuentesTC]` en ese orden; no de-duplicar si una fuente está en ambas (no debería ocurrir por diseño) |
| Schema aplicado en solo uno de los dos proyectos Supabase | Alta | Checklist explícito: ejecutar el ALTER TABLE en `finanzas-daniel` Y en `finanzas-ama` antes de cualquier deploy |
| `guardarEdicionTransaccion()` usa delete+add en alguna rama del código (workaround antiguo) | Baja | Confirmar al leer las líneas 3477-3520 — el summary dice que usa `.update()` directamente |
| El input `type="month"` puede tener comportamiento diferente en Safari/iOS | Baja | El picker nativo funciona en iOS Safari; si no, degradar a input text con placeholder "YYYY-MM" |

## Checklist de pre-deploy

- [ ] `ALTER TABLE transacciones ADD COLUMN mes_liquidacion TEXT DEFAULT NULL;` ejecutado en **finanzas-daniel**
- [ ] Mismo ALTER ejecutado en **finanzas-ama**
- [ ] Verificar que `cargarTodasTransacciones()` devuelve `mes_liquidacion` en cada fila
- [ ] El deploy del código HTML se realiza **solo después de confirmar** ambos ALTER TABLE — si uno falla, revertir el otro antes de desplegar

**Rollback DDL** (si es necesario revertir el schema):
```sql
ALTER TABLE transacciones DROP COLUMN mes_liquidacion;
```
(aplicar en ambos proyectos; el código HTML en la versión anterior no escribe `mes_liquidacion`, por lo que revertir el schema no corrompe datos existentes)

## Patrones de referencia en el codebase

| Patrón | Dónde encontrarlo |
|---|---|
| Show/hide campos según tipo de transacción | `setTipo()` en index.html |
| Badge/label en lista de config | `_renderLista()` en index.html |
| Delete + insert para cambiar categorías | `agregarCategoria()` / `eliminarCategoria()` ~líneas 4815-4864 |
| Mensajes de error inline en Config | `#cfg-msg-fuente` — ver agregarCategoria |
| Insert a Supabase con crypto.randomUUID | `guardarTransaccion()` ~línea 3546 |
| Update directo en Supabase | `guardarEdicionTransaccion()` ~línea 3477 |
| Variables CSS de tema | `:root` / `[data-theme="light"]` al inicio del `<style>` |
