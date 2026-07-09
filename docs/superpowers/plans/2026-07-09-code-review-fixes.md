# Code Review Fixes — Bugs confirmados de la revisión 2026-07-09 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir los 9 bugs CONFIRMADOS de la revisión de código del 2026-07-09 — cada uno en su propia task/commit, en orden de severidad — sin refactors ni scope creep. Los 3 hallazgos PLAUSIBLE que requieren decisión de producto quedan documentados como "Fuera de alcance" para que Daniel decida más adelante.

**Architecture:** Todo vive en el único `index.html` (sin build pipeline, sin npm, sin framework — JS/HTML/CSS inline, ~10.500 líneas). Todos los fixes son swaps de string exacta sobre funciones existentes: el parser de importación, dos queries de Supabase mal scopeadas por `usuario`, el cálculo de progreso de metas, la hidratación de cache de categorías, el timing del undo-delete, la lectura de moneda en cuotas, la conversión USD→ARS en KPIs de cuotas, el drill-down de Top Gastos y la validación de fechas de importación.

**Tech Stack:** JS/HTML/CSS vanilla en `index.html`. Supabase (`transacciones`, `categorias`). `tipoCambioMEP` para conversión USD→ARS. Sin tests automatizados (single-file) — verificación manual en navegador + syntax-check de bloques `<script>` con Node.

## Global Constraints

- Sin build pipeline, sin frameworks, sin npm — todo vive en `index.html` (de `CLAUDE.md`, sección "Project Architecture").
- **Los números de línea de este plan son de referencia PRE-implementación.** Cada edit se aplica por coincidencia de string exacta, no por número de línea — la Task 9 agrega líneas que corren el resto del archivo. Aplicar las tasks en orden.
- Un bug = una task = un commit, en el orden listado (orden de severidad). **Excepción:** las Tasks 6 (#6) y 7 (#7) son adjacentes y deben ir en el mismo PR; NUNCA mergear la Task 6 sin la Task 7 — arreglar #6 sola expone inmediatamente #7 (una cuota USD real se sumaría 1:1 a un total ARS).
- No tocar nada del arreglo de auth/sesión ya cerrado esta sesión (`_configurarUsuario`, `set_mi_nombre`, `guardarNombre`, flag `fp_signup_intent`) — fuera de alcance.
- `PARTNER`/`USUARIO` son dinámicos — nunca hardcodear "Daniel"/"Ama" en lógica nueva.

**Syntax-check (correr verbatim como verificación en cada task de código):**

```bash
node -e '
const fs=require("fs");
const html=fs.readFileSync("index.html","utf8");
const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m,i=0,bad=0;
while((m=re.exec(html))){i++;try{new Function(m[1]);}catch(e){bad++;console.error("Block #"+i+" FAIL: "+e.message);}}
console.log("Checked "+i+" inline <script> blocks, "+bad+" with errors.");
process.exit(bad?1:0);
'
```
Salida esperada: `Checked 2 inline <script> blocks, 0 with errors.` (exit 0). Si reporta errores o un conteo distinto que incluye un fallo, el edit rompió un template literal o una etiqueta — arreglar antes de commitear.

Footer obligatorio en todos los commits:
```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

---

## Task 1: Parser de importación corrompe montos con separador de miles argentino

`parseFloat(montoRaw.replace(",",".").replace(/[^\d.]/g,""))` convierte `"4.500,50"` en `"4.500.50"` → `parseFloat` corta en el segundo punto → `4.5`. El helper `parsearDecimal()` (~8849) ya resuelve esto (`replace(/\./g,'').replace(',','.')`), pero no limpia símbolos de moneda ($, espacios). Se lo envuelve con un pre-strip que conserva solo dígitos, punto y coma.

**Files:**
- Modify: `index.html:8419` (validación de monto en el parser de importación)

**Interfaces:**
- Consumes: `parsearDecimal()` (ya existe, `index.html:8849`).
- Produces: nada nuevo.

- [ ] **Step 1: Reutilizar `parsearDecimal()` con pre-limpieza de no-numéricos**

Ubicar (línea ~8419):
```js
    const monto = parseFloat(montoRaw.replace(",",".").replace(/[^\d.]/g,""));
```
Reemplazar por:
```js
    const monto = parsearDecimal(montoRaw.replace(/[^\d.,]/g, ""));
```

(El pre-strip `/[^\d.,]/g` elimina `$`, espacios y demás ruido pero conserva puntos de miles y coma decimal; luego `parsearDecimal` los interpreta bien: `"4.500,50"`→`4500.5`, `"$1.200"`→`1200`. La guarda existente `if (isNaN(monto) || monto <= 0)` en la línea siguiente sigue capturando montos inválidos, porque `parsearDecimal` devuelve `0` ante basura.)

- [ ] **Step 2: Syntax-check**

Correr el snippet de Node de "Global Constraints". Esperado: `Checked 2 inline <script> blocks, 0 with errors.`

- [ ] **Step 3: Verificar en navegador**

Ir a la página de importar. Pegar/cargar una fila con monto `4.500,50`. En la preview el monto debe mostrarse/parsearse como `$4.500,50` (4500.5), no `$4,50`. Probar también `1.234.567,89` → 1234567.89 y `$2.000` → 2000. En la consola no debe haber errores.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix(importar): parsear montos con separador de miles argentino via parsearDecimal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Borrado/reclasificación de categorías sin scope por `usuario`

`eliminarCategoria()` borra la categoría para AMBOS usuarios del workspace (falta `.eq('usuario', USUARIO)`, a diferencia de `toggleCategoria()` que sí lo tiene, ~8224). `ejecutarReclasificarFuente()` tiene el mismo hueco en su `update`. Se agrega el filtro a ambas.

**Files:**
- Modify: `index.html:8192-8193` (`eliminarCategoria` — delete)
- Modify: `index.html:8295-8299` (`ejecutarReclasificarFuente` — update)

**Interfaces:**
- Consumes: `USUARIO` (global).
- Produces: nada nuevo.

- [ ] **Step 1: Scope del delete en `eliminarCategoria`**

Ubicar (líneas ~8192-8193):
```js
    const { error } = await supabaseClient
      .from('categorias').delete().eq('tipo', tipoAPI).eq('valor', valor);
```
Reemplazar por:
```js
    const { error } = await supabaseClient
      .from('categorias').delete().eq('tipo', tipoAPI).eq('valor', valor).eq('usuario', USUARIO);
```

- [ ] **Step 2: Scope del update en `ejecutarReclasificarFuente`**

Ubicar (líneas ~8295-8299):
```js
    const { error } = await supabaseClient
      .from('categorias')
      .update({ tipo: nuevoTipo })
      .eq('tipo', tipoActual)
      .eq('valor', valor);
```
Reemplazar por:
```js
    const { error } = await supabaseClient
      .from('categorias')
      .update({ tipo: nuevoTipo })
      .eq('tipo', tipoActual)
      .eq('valor', valor)
      .eq('usuario', USUARIO);
```

- [ ] **Step 3: Syntax-check**

Correr el snippet de Node de "Global Constraints". Esperado: `Checked 2 inline <script> blocks, 0 with errors.`

- [ ] **Step 4: Verificar en navegador**

Con una categoría que exista para ambos usuarios (ej. misma etiqueta de gasto): en Categorías, eliminarla como el usuario actual. Recargar y confirmar (idealmente logueando como el otro usuario, o revisando en Supabase) que la categoría del OTRO usuario sigue existiendo. Repetir con "reclasificar fuente" (tarjeta ↔ pago inmediato): solo debe cambiar la fuente del usuario actual.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "fix(categorias): scopear delete y reclasificacion de fuente por usuario

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `calcularProgresoMeta()` suma "Ahorro" de todo el workspace

Regresión de la migración multi-tenant: el SELECT de `transacciones` pasó de RLS per-user a workspace-wide, y el filtro de progreso de meta nunca sumó `t.usuario === USUARIO`. Se agrega.

**Files:**
- Modify: `index.html:10111-10113` (`calcularProgresoMeta`)

**Interfaces:**
- Consumes: `USUARIO`, `allTransac`.
- Produces: nada nuevo.

- [ ] **Step 1: Filtrar por usuario en el cálculo de total**

Ubicar (líneas ~10111-10113):
```js
  const total = allTransac
    .filter(t => t.categoria === "Ahorro" && !esTransferencia(t) && new Date(t.fecha) >= desde)
    .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
```
Reemplazar por:
```js
  const total = allTransac
    .filter(t => t.usuario === USUARIO && t.categoria === "Ahorro" && !esTransferencia(t) && new Date(t.fecha) >= desde)
    .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
```

- [ ] **Step 2: Syntax-check**

Correr el snippet de Node de "Global Constraints". Esperado: `Checked 2 inline <script> blocks, 0 with errors.`

- [ ] **Step 3: Verificar en navegador**

En Mi mes, con una meta activa: el progreso debe reflejar solo las transacciones "Ahorro" del usuario actual desde `fecha_inicio`, no las del partner. Verificable en consola: `calcularProgresoMeta(metaActiva)` debe coincidir con la suma de `allTransac.filter(t=>t.usuario===USUARIO && t.categoria==="Ahorro" ...)`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix(metas): contar solo Ahorro del usuario actual en el progreso

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `_aplicarCacheCateg()` pisa `categResponsabilidad` con un valor viejo del cache

`categResponsabilidad = catData.responsabilidad || categResponsabilidad` restaura un valor cacheado y clobbea el que `_setVariablesUsuario()` acaba de derivar de `PARTNER` (corre antes en el flujo de login). Esto rompe las opciones "Compartido"/"De <partner>" justo después de que la pareja se suma al workspace. Como `_setVariablesUsuario()` siempre corre primero, la solución es NO restaurar `categResponsabilidad` desde el cache.

**Files:**
- Modify: `index.html:4430` (`_aplicarCacheCateg`)

**Interfaces:**
- Consumes: `categResponsabilidad` ya seteado por `_setVariablesUsuario()`.
- Produces: nada nuevo.

- [ ] **Step 1: No restaurar `categResponsabilidad` del cache**

Ubicar (línea ~4430):
```js
  categResponsabilidad = catData.responsabilidad  || categResponsabilidad;
```
Reemplazar por:
```js
  // categResponsabilidad NO se restaura del cache: lo fija _setVariablesUsuario()
  // desde PARTNER en cada login (corre antes que _aplicarCacheCateg). Restaurarlo
  // acá pisaba el valor fresco con uno viejo tras sumarse la pareja al workspace.
```

(El resto de `_aplicarCacheCateg` sigue usando `categResponsabilidad` — línea ~4436, `fil-resp` — con el valor correcto ya seteado. `guardarCacheCateg()`/`catData` pueden seguir persistiendo el campo: al no restaurarse nunca, es inocuo.)

- [ ] **Step 2: Syntax-check**

Correr el snippet de Node de "Global Constraints". Esperado: `Checked 2 inline <script> blocks, 0 with errors.`

- [ ] **Step 3: Verificar en navegador**

Loguear (cache hit). En consola: `console.log(categResponsabilidad)` debe devolver `["Mío","Compartido","De " + PARTNER]` con el PARTNER actual (o `["Mío"]` si todavía no hay pareja), nunca un partner viejo. El `<select id="fil-resp">` y el form de nueva transacción deben mostrar las mismas opciones.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix(categorias): no restaurar categResponsabilidad desde el cache

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Race del undo-delete — ventana muerta de 400ms en "Deshacer"

El delete real se dispara a 5000ms (`setTimeout(() => _ejecutarDelete(id), 5000)`, ~5633) pero el toast recién se oculta a 5400ms (~5666), dejando 400ms donde el botón "Deshacer" se ve clickeable pero `_cancelarDelete()` ya no-opea (su guarda `_pendingDelete.id === id` falla) mientras muestra un falso "↩️ Eliminación cancelada". Se adelanta el ocultado del toast a 4900ms — antes del delete a 5000ms — para que la ventana visible de "Deshacer" quede estrictamente dentro de la ventana cancelable.

**Files:**
- Modify: `index.html:5666` (`_showToastUndo` — timeout de ocultado)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: nada nuevo.

- [ ] **Step 1: Ocultar el toast antes de que el delete sea irreversible**

Ubicar (línea ~5666):
```js
  const tid = setTimeout(() => { t.className = "toast"; }, 5400);
```
Reemplazar por:
```js
  const tid = setTimeout(() => { t.className = "toast"; }, 4900);
```

(El delete real sigue a 5000ms en `eliminarTransaccion` (~5633). Invariante a mantener: el ocultado del toast debe ser **estrictamente menor** que el delay del delete. Si algún día se cambia el 5000, actualizar este 4900 para preservar la relación.)

- [ ] **Step 2: Syntax-check**

Correr el snippet de Node de "Global Constraints". Esperado: `Checked 2 inline <script> blocks, 0 with errors.`

- [ ] **Step 3: Verificar en navegador**

En Transacciones, eliminar una transacción. Confirmar: (a) durante los primeros ~4.9s el toast con "↩ Deshacer" es visible y al clickearlo la fila reaparece con "↩️ Eliminación cancelada" real; (b) el toast desaparece antes de que el borrado se vuelva definitivo — ya no existe el intervalo donde el botón se ve pero no cancela. Verificar que el borrado sí ocurre si no se toca nada (recargar y confirmar que la fila no volvió).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix(undo): ocultar toast antes de que el delete sea irreversible

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `guardarCompraEnCuotas()` siempre guarda moneda ARS

El selector `document.querySelector(".moneda-btn.active")?.dataset.val` nunca matchea (los botones reciben `active-ars`/`active-usd`, nunca `active`, y no tienen `data-val`), así que toda cuota se guarda como ARS. Se usa el global `monedaActual` (declarado ~5809, seteado por `setMoneda()`), la misma fuente que `guardarTransaccion()` ya usa correctamente (~5861: `moneda: monedaActual`).

> **NO mergear esta task sin la Task 7 en el mismo PR.** Arreglar #6 sola destapa #7: una cuota USD real recién creada se sumaría 1:1 a un total ARS en los KPIs de cuotas.

**Files:**
- Modify: `index.html:5912` (`guardarCompraEnCuotas` — lectura de moneda)

**Interfaces:**
- Consumes: `monedaActual` (global, ~5809).
- Produces: nada nuevo.

- [ ] **Step 1: Leer la moneda desde `monedaActual`**

Ubicar (línea ~5912):
```js
  const moneda          = document.querySelector(".moneda-btn.active")?.dataset.val || "ARS";
```
Reemplazar por:
```js
  const moneda          = monedaActual;
```

- [ ] **Step 2: Syntax-check**

Correr el snippet de Node de "Global Constraints". Esperado: `Checked 2 inline <script> blocks, 0 with errors.`

- [ ] **Step 3: Verificar en navegador**

En Nueva transacción, activar modo cuotas, seleccionar USD, y guardar una compra en cuotas. En Supabase / al recargar, las transacciones generadas y la fila de `compras_cuotas` deben tener `moneda: "USD"`. Repetir con ARS y confirmar `moneda: "ARS"`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix(cuotas): guardar la moneda seleccionada (monedaActual) y no siempre ARS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: KPIs/modal de cuotas mezclan ARS y USD 1:1

Adyacente a la Task 6 (mismo PR). `_renderCuotasCard()` suma `Number(t.monto)` en los totales ARS (`estesMes`/`futuro`/`floorByMes`, mostrados con `fmt()`) sin mirar la moneda; se convierten las cuotas USD a ARS vía `tipoCambioMEP` antes de sumar (mismo patrón `* (tipoCambioMEP || 1)` que ya usa la asignación de inversiones, ~9630). `_renderModalCuotas()` muestra `restante` con `fmt()` (siempre ARS) aunque cada compra tiene una sola moneda `c.moneda` — se usa `fmtMoneda(restante, c.moneda)`, consistente con las filas (`fmtMoneda(..., t.moneda)`) y la meta (`c.moneda`) que ese modal ya muestra.

**Files:**
- Modify: `index.html:8929-8932` (`_renderCuotasCard` — acumuladores de KPI)
- Modify: `index.html:9102-9103` (`_renderModalCuotas` — restante)

**Interfaces:**
- Consumes: `tipoCambioMEP` (global), `c.moneda`, `fmtMoneda()`.
- Produces: nada nuevo.

- [ ] **Step 1: Convertir cuotas USD→ARS en los acumuladores del card**

Ubicar (líneas ~8929-8932):
```js
      const monto = Number(t.monto) * factor;
      if (m === mesActualStr) estesMes += monto;
      else if (m > mesActualStr) futuro += monto;
      if (Object.prototype.hasOwnProperty.call(floorByMes, m)) floorByMes[m] += monto;
```
Reemplazar por:
```js
      const montoBruto = Number(t.monto) * factor;
      // Los KPIs de cuotas se muestran en ARS (fmt); convertir cuotas USD vía MEP
      // antes de sumar, para no mezclar ARS y USD 1:1. Mismo patrón (tipoCambioMEP || 1)
      // que la asignación de inversiones.
      const monto = (c.moneda === "USD") ? montoBruto * (tipoCambioMEP || 1) : montoBruto;
      if (m === mesActualStr) estesMes += monto;
      else if (m > mesActualStr) futuro += monto;
      if (Object.prototype.hasOwnProperty.call(floorByMes, m)) floorByMes[m] += monto;
```

- [ ] **Step 2: Mostrar `restante` en la moneda de la compra en el modal**

Ubicar (líneas ~9102-9103):
```js
  document.getElementById("cuotas-modal-restante").textContent =
    restante > 0 ? `${fmt(restante)} restantes` : "Completada";
```
Reemplazar por:
```js
  document.getElementById("cuotas-modal-restante").textContent =
    restante > 0 ? `${fmtMoneda(restante, c.moneda || "ARS")} restantes` : "Completada";
```

- [ ] **Step 3: Syntax-check**

Correr el snippet de Node de "Global Constraints". Esperado: `Checked 2 inline <script> blocks, 0 with errors.`

- [ ] **Step 4: Verificar en navegador**

Con una compra en cuotas USD (creada tras la Task 6) y otra ARS activas en el mes: el KPI "cuotas este mes"/"futuro" en Mi mes debe reflejar el monto USD convertido a ARS (≈ `monto × MEP`), no sumado 1:1. Abrir el modal de la compra USD: el "restante" debe mostrarse como `U$S …` (no `$ …`), coincidiendo con las filas de cuota y la meta del modal.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "fix(cuotas): convertir USD->ARS en KPIs y mostrar restante en la moneda de la compra

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Top Gastos — total y drill-down de distinta fuente

El total por categoría (`val`) es responsabilidad-aware y se computa desde `dataMesAll` (todo el workspace: "Mío" propios + "Compartido" de ambos ×factor + "De USUARIO"), pero el drill-down (`txsCat`, ~5156) filtra solo `datos` (transacciones propias), así que una categoría puede mostrar total>0 con "(0 tx)". Se hace que el drill-down liste EXACTAMENTE el conjunto que alimenta el total, pasando `dataMesAll` a `renderTopGastos` y filtrando con el mismo predicado de responsabilidad.

**Files:**
- Modify: `index.html:5131` (firma de `renderTopGastos`)
- Modify: `index.html:5037` (llamada a `renderTopGastos`)
- Modify: `index.html:5156-5158` (`txsCat` en `renderSeccion`)

**Interfaces:**
- Consumes: `dataMesAll` (ya existe en el scope del caller, ~4875), `USUARIO`.
- Produces: nada nuevo.

- [ ] **Step 1: Agregar `dataMesAll` a la firma**

Ubicar (línea ~5131):
```js
function renderTopGastos(sortedCatsARS, sortedCatsUSD, datos, salarioBase) {
```
Reemplazar por:
```js
function renderTopGastos(sortedCatsARS, sortedCatsUSD, datos, salarioBase, dataMesAll) {
```

- [ ] **Step 2: Pasar `dataMesAll` en la llamada**

Ubicar (línea ~5037):
```js
  renderTopGastos(sortedCatsARS, sortedCatsUSD, datos, ingresos);
```
Reemplazar por:
```js
  renderTopGastos(sortedCatsARS, sortedCatsUSD, datos, ingresos, dataMesAll);
```

- [ ] **Step 3: Listar el mismo conjunto que forma el total**

Ubicar (líneas ~5156-5158):
```js
      const txsCat = datos
        ? datos.filter(t => t.categoria === cat && !esTransferencia(t) && (t.moneda || "ARS").toUpperCase() === moneda)
        : [];
```
Reemplazar por:
```js
      // El total (val) es responsabilidad-aware: "Mío" propios + "Compartido" de
      // ambos (×factor) + "De USUARIO". El drill-down debe listar EXACTAMENTE ese
      // conjunto (desde dataMesAll), no solo lo propio — si no, una categoría con
      // total>0 mostraba "(0 tx)".
      const txsCat = (dataMesAll || datos || []).filter(t =>
        t.categoria === cat && !esTransferencia(t)
        && (t.moneda || "ARS").toUpperCase() === moneda
        && ( ((t.responsabilidad || "Mío") === "Mío" && (t.usuario || "Daniel") === USUARIO)
             || t.responsabilidad === "Compartido"
             || t.responsabilidad === "De " + USUARIO ));
```

- [ ] **Step 4: Syntax-check**

Correr el snippet de Node de "Global Constraints". Esperado: `Checked 2 inline <script> blocks, 0 with errors.`

- [ ] **Step 5: Verificar en navegador**

En Resumen/Mi mes → Top Gastos, con una categoría cuyo total venga de gastos "Compartido" pagados por el partner y/o "De USUARIO": el contador "(N tx)" debe ser >0 y el drill-down desplegable debe listar esas transacciones (no vacío). Confirmar que ninguna categoría con total>0 muestra "(0 tx)". Las categorías con solo gastos "Mío" propios se comportan igual que antes.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "fix(top-gastos): drill-down lista el mismo conjunto responsabilidad-aware que el total

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Validación de fecha en importación solo chequea forma, no rangos

El regex `/^\d{1,2}\/\d{1,2}\/\d{2,4}$/` acepta `"45/99/2026"` como ✅ en la preview; recién falla en el insert de Supabase (rompe el batch entero) o guarda basura. Se agrega un chequeo de rango (día 1–31, mes 1–12) tras el match, empujando a `errList` de forma consistente con el resto de la validación.

**Files:**
- Modify: `index.html:8398-8402` (rama `isSlash` de la validación de fecha)

**Interfaces:**
- Consumes: `errList` (ya existe en la función).
- Produces: nada nuevo.

- [ ] **Step 1: Validar rango de día/mes tras el match del regex**

Ubicar (líneas ~8398-8402):
```js
      if (isSlash) {
        const [d,m,y] = fechaRaw.split("/");
        const year = y.length === 2 ? `20${y}` : y;
        fechaValida = `${year}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
      } else if (isDash) {
```
Reemplazar por:
```js
      if (isSlash) {
        const [d,m,y] = fechaRaw.split("/");
        const dNum = parseInt(d, 10), mNum = parseInt(m, 10);
        if (dNum < 1 || dNum > 31 || mNum < 1 || mNum > 12) {
          errList.push("Fecha inválida");
        } else {
          const year = y.length === 2 ? `20${y}` : y;
          fechaValida = `${year}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
        }
      } else if (isDash) {
```

(Chequeo de rango simple — no se hace validación calendario día-por-mes; alcanza con atajar valores claramente inválidos como `45/99/2026`.)

- [ ] **Step 2: Syntax-check**

Correr el snippet de Node de "Global Constraints". Esperado: `Checked 2 inline <script> blocks, 0 with errors.`

- [ ] **Step 3: Verificar en navegador**

En importar, cargar una fila con fecha `45/99/2026`: en la preview debe marcarse como error ("Fecha inválida"), no como ✅. Confirmar que fechas válidas (`9/7/26`, `09/07/2026`) siguen pasando y se normalizan a `2026-07-09`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix(importar): validar rango de dia/mes en fechas antes del insert

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Fuera de alcance — requiere decisión de producto

Estos 3 hallazgos de la revisión NO se arreglan en este plan; quedan documentados para que Daniel decida.

- **#10 — Vista Anual cuenta gastos al 100% ignorando `responsabilidad` (`index.html:6912-6914`, `cargarAnual`).** `byMes[m].gastos += monto` suma el bruto sin aplicar la lógica responsabilidad-aware de "Mi mes". **Requiere decisión de producto:** es ambiguo si la Vista Anual debe ser cashflow bruto (lo que se movió) o neto-por-responsabilidad (lo que efectivamente te tocó). Ambas son defendibles; no hay un "correcto" objetivo sin definir la intención del reporte.

- **#11 — `calcularProgresoMeta()` mezcla ARS/USD sin conversión (`index.html:~10113`).** Las transacciones "Ahorro" en USD y ARS se suman 1:1 contra `meta.monto_objetivo`. **Requiere decisión de producto:** es un gap de diseño preexistente (no una regresión), y depende de cómo debería interactuar la moneda de la meta con ahorros en moneda mixta (¿convertir todo a la moneda de la meta? ¿metas separadas por moneda?). No se arregla sin esa definición.

- **#12 — Fallback `tipoCambioMEP || 1` misvalúa USD como 1:1 ante fallo del fetch MEP (`index.html:9630, 9632, 9633` — asignación de inversiones; y el % de presupuesto de Ama).** Cuando el fetch del MEP falla, los USD se cuentan a paridad 1:1 en ARS de forma silenciosa. **Es un edge case transitorio, no corrupción de datos.** Posible mejora futura de resiliencia (ej. banner de aviso "sin cotización MEP, montos USD sin convertir" en vez de degradar en silencio) — se deja marcado, no se planifica fix ahora.

---

## Task 10: Verificación integral

Confirma que los 9 fixes conviven sin romper flujos y que no quedó regex/query mal scopeada residual. Sin cambios de código.

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Syntax-check final**

Correr el snippet de Node de "Global Constraints". Esperado: `Checked 2 inline <script> blocks, 0 with errors.` (exit 0).

- [ ] **Step 2: Grep de patrones residuales**

Run:
```bash
grep -n 'moneda-btn.active"' index.html
grep -n "delete().eq('tipo'" index.html
grep -n 'montoRaw.replace' index.html
```
Esperado: el primer grep sin resultados (ningún selector `.moneda-btn.active` sin sufijo quedó en lógica de guardado); el segundo debe mostrar el delete ya con `.eq('usuario', USUARIO)`; el tercero sin resultados (ya no existe el `.replace(",",".")` ad-hoc del parser).

- [ ] **Step 3: Recorrido funcional completo (navegador)**

- Importar: monto `4.500,50` → 4500.5; fecha `45/99/2026` → error en preview.
- Categorías: eliminar / reclasificar fuente afecta solo al usuario actual.
- Mi mes: progreso de meta cuenta solo Ahorro propio; opciones de responsabilidad muestran el PARTNER correcto tras recargar (cache hit).
- Transacciones: undo-delete — el toast desaparece antes de que el borrado sea irreversible; "Deshacer" siempre cancela mientras se ve.
- Cuotas: guardar una compra USD guarda `moneda:"USD"`; los KPIs de cuotas convierten USD→ARS; el modal muestra "restante" en la moneda de la compra.
- Top Gastos: ninguna categoría con total>0 muestra "(0 tx)"; el drill-down lista las transacciones compartidas/del partner que forman el total.

- [ ] **Step 4: Sin commit**

Esta task es solo verificación; no genera cambios. Si algo falla, volver a la task correspondiente.
