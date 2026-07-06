# Preferencias de usuario — eliminar gating por nombre "Ama" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los 8 sitios donde la lógica de negocio depende de `USUARIO.toLowerCase() === "ama"` por fuentes de verdad configurables: una preferencia explícita `usd_mep` en `user_metadata` para la matemática USD/MEP, `prefers-color-scheme` del SO para el tema por defecto, y un default uniforme para el desglose de "Mi mes".

**Architecture:** Todo vive en el único `index.html` (sin build pipeline, JS/HTML/CSS inline). Se introduce un global booleano `PREF_USD_MEP` hidratado desde `user_metadata.usd_mep` al login (siguiendo el patrón exacto de `cat_emojis`). Un checkbox nuevo en Categorías → Cuenta y Seguridad escribe la preferencia vía `supabaseClient.auth.updateUser`. Los gatings de tema y desglose pasan a mirar el SO / un default fijo. No hay migración ni backfill: corte limpio.

**Tech Stack:** JS/HTML/CSS vanilla en `index.html`. Supabase Auth (`user_metadata`) para persistir la preferencia. `window.matchMedia` para el tema por defecto. Sin tests automatizados (single-file) — verificación manual en navegador.

## Global Constraints

- Sin build pipeline, sin frameworks — todo vive en `index.html` (de `CLAUDE.md`).
- **Los números de línea de este plan son de referencia PRE-implementación.** Cada edit se hace por coincidencia de string exacta (no por número de línea), porque las Tasks 1 y 5 agregan líneas que corren el resto del archivo. Aplicar las tasks en orden.
- Persistencia de preferencia = patrón exacto de `cat_emojis`: `supabaseClient.auth.updateUser({ data: { usd_mep: <bool> } }).catch(() => {})` para escribir; `session.user.user_metadata?.usd_mep` para leer (de la spec, Decisión 1).
- NO tocar el fetch de `tipoCambioMEP` ni el KPI "Saldo en USD" — siguen activos para todos (de la spec, "Fuera de alcance").
- NO tocar `toggleTheme()` ni la persistencia en `localStorage['fin-theme']` — solo cambia el DEFAULT cuando no hay valor guardado (de la spec, Decisión 2).
- NO escribir código de migración — corte limpio, se aplican los nuevos defaults también a Daniel y Ama (de la spec, Decisión 4).
- NO arreglar el bug de `inicializarDisclosureCompartidos` — está fuera de alcance (de la spec, "Hallazgo fuera de alcance").
- Copy exacto del checkbox: `Cobro parte de mis ingresos en USD — convertir a ARS con dólar MEP en mi presupuesto`.
- Nombre del global: `PREF_USD_MEP`. Clave en metadata: `usd_mep`. Id del checkbox: `pref-usd-mep`. Nombre de la función de escritura: `guardarPrefUsdMep`.

---

## Task 1: Global `PREF_USD_MEP`, hidratación al login, y `CATS_INGRESO_REAL` por preferencia

Cubre los sitios de gating #1 (`CATS_INGRESO_REAL`). Establece el global que consumen las Tasks 4 y 5.

**Files:**
- Modify: `index.html:4033` (declaración de globals)
- Modify: `index.html:4446-4448` (`_setVariablesUsuario` → `CATS_INGRESO_REAL`)
- Modify: `index.html:4460-4462` (`_configurarUsuario` → lectura de la preferencia)

**Interfaces:**
- Produces: global `let PREF_USD_MEP` (boolean), hidratado en `_configurarUsuario` **antes** de la llamada a `_setVariablesUsuario`. Consumido por Tasks 4 y 5 y por `CATS_INGRESO_REAL`.

- [ ] **Step 1: Declarar el global `PREF_USD_MEP`**

Ubicar (línea ~4033):
```js
let CATS_INGRESO_REAL = ["Sueldo", "Otros Ingresos"];
let tipoCambioMEP   = null;
```
Reemplazar por:
```js
let CATS_INGRESO_REAL = ["Sueldo", "Otros Ingresos"];
let tipoCambioMEP   = null;
let PREF_USD_MEP    = false; // preferencia usuario: convertir ingresos USD→ARS vía dólar MEP (user_metadata.usd_mep)
```

- [ ] **Step 2: Hidratar `PREF_USD_MEP` al login**

Ubicar (líneas ~4460-4462), al comienzo de `_configurarUsuario`:
```js
async function _configurarUsuario(session) {
  const metaNombre   = session.user.user_metadata?.nombre;
  const metaEmojis   = session.user.user_metadata?.cat_emojis;
```
Reemplazar por (agrega una línea; queda antes de `_setVariablesUsuario`, que corre en la misma función más abajo):
```js
async function _configurarUsuario(session) {
  const metaNombre   = session.user.user_metadata?.nombre;
  const metaEmojis   = session.user.user_metadata?.cat_emojis;
  PREF_USD_MEP       = session.user.user_metadata?.usd_mep === true;
```

- [ ] **Step 3: `CATS_INGRESO_REAL` según la preferencia (no según el nombre)**

Ubicar (líneas ~4446-4448), dentro de `_setVariablesUsuario`:
```js
  CATS_INGRESO_REAL = USUARIO.toLowerCase() === "ama"
    ? ["Sueldo", "Otros Ingresos", "Intereses"]
    : ["Sueldo", "Otros Ingresos"];
```
Reemplazar por:
```js
  CATS_INGRESO_REAL = PREF_USD_MEP
    ? ["Sueldo", "Otros Ingresos", "Intereses"]
    : ["Sueldo", "Otros Ingresos"];
```

- [ ] **Step 4: Verificar en navegador**

Abrir la app y loguear. En la consola del navegador (DevTools):
```js
console.log(PREF_USD_MEP, CATS_INGRESO_REAL);
```
Esperado para un usuario sin `usd_mep` en su metadata: `false ["Sueldo","Otros Ingresos"]` (sin "Intereses"). No debe haber errores en consola.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(prefs): introducir PREF_USD_MEP y CATS_INGRESO_REAL por preferencia

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Tema por defecto según `prefers-color-scheme`

Cubre el sitio de gating #2. Independiente de las demás tasks.

**Files:**
- Modify: `index.html:4450-4451` (`_setVariablesUsuario` → cálculo de `_defaultTheme`)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: nada nuevo — solo cambia el valor de `_defaultTheme`, ya consumido en las líneas 4452-4457.

- [ ] **Step 1: Reemplazar el default por el del SO**

Ubicar (líneas ~4450-4451):
```js
  const _savedTheme = localStorage.getItem('fin-theme');
  const _defaultTheme = USUARIO.toLowerCase() === "ama" ? "light" : "dark";
```
Reemplazar por:
```js
  const _savedTheme = localStorage.getItem('fin-theme');
  const _defaultTheme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? "dark" : "light";
```

- [ ] **Step 2: Verificar en navegador**

En DevTools, con localStorage limpio de `fin-theme`:
```js
localStorage.removeItem('fin-theme'); location.reload();
```
Con el SO en modo oscuro, tras el reload `document.documentElement.dataset.theme` debe ser `"dark"`; con el SO en claro, `"light"`. Cambiar el tema del SO (o simular con DevTools → Rendering → "Emulate CSS prefers-color-scheme") y recargar confirma que sigue al SO. Luego usar el toggle de tema manual y recargar: debe ganar el valor guardado (`fin-theme`), no el del SO.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(prefs): tema por defecto sigue prefers-color-scheme del SO

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Desglose de "Mi mes" expandido por defecto para todos

Cubre el sitio de gating #9. Independiente de las demás tasks.

**Files:**
- Modify: `index.html:9181-9183` (`inicializarDisclosureMimes`)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: nada nuevo.

- [ ] **Step 1: Default expandido fijo**

Ubicar (líneas ~9181-9183):
```js
  // Default: Daniel expandido, Ama colapsado. Override si hay valor guardado.
  const saved = localStorage.getItem(USUARIO + "_disclosure_mimes");
  const defaultExpanded = USUARIO.toLowerCase() !== "ama";
```
Reemplazar por:
```js
  // Default: expandido para todos. Override si hay valor guardado.
  const saved = localStorage.getItem(USUARIO + "_disclosure_mimes");
  const defaultExpanded = true;
```

- [ ] **Step 2: Verificar en navegador**

En DevTools, limpiar la preferencia y recargar:
```js
localStorage.removeItem(USUARIO + "_disclosure_mimes"); location.reload();
```
Navegar a "Mi mes": el desglose (`#pres-desglose`) debe verse expandido y el botón `#btn-toggle-desglose` decir "Ocultar desglose ▴". Colapsarlo con el botón, recargar: debe respetar el valor guardado (colapsado).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(prefs): desglose de Mi mes expandido por defecto para todos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Matemática USD/MEP gateada por `PREF_USD_MEP`

Cubre los sitios de gating #3-#8 (las 6 líneas del comportamiento MEP). Depende de Task 1 (el global `PREF_USD_MEP` debe existir).

**Files:**
- Modify: `index.html:7185` (`sugerirPresupuestoDesdeHistorial`)
- Modify: `index.html:7380` (`renderPresupuesto` — sueldo efectivo presupuesto)
- Modify: `index.html:7443` (`renderPresupuesto` — gastos USD→ARS)
- Modify: `index.html:7513` (`renderPresupuesto` — sublabel KPI sueldo)
- Modify: `index.html:7896` (`actualizarKpisPres` — sueldo efectivo KPI)
- Modify: `index.html:7951` (`actualizarKpisPres` — gastos USD→ARS KPI)

**Interfaces:**
- Consumes: global `PREF_USD_MEP` (de Task 1).
- Produces: nada nuevo.

- [ ] **Step 1: Sitio en `sugerirPresupuestoDesdeHistorial` (~7185)**

Ubicar:
```js
    const usdARS = USUARIO.toLowerCase() === "ama" && tipoCambioMEP ? (ingUSD - gasUSD) * tipoCambioMEP : 0;
```
Reemplazar por:
```js
    const usdARS = PREF_USD_MEP && tipoCambioMEP ? (ingUSD - gasUSD) * tipoCambioMEP : 0;
```

- [ ] **Step 2: Sitio en `renderPresupuesto` — sueldo efectivo (~7380)**

Ubicar:
```js
  const usdEnARSPres = USUARIO.toLowerCase() === "ama" && tipoCambioMEP ? ingresosUSDPres * tipoCambioMEP : 0;
```
Reemplazar por:
```js
  const usdEnARSPres = PREF_USD_MEP && tipoCambioMEP ? ingresosUSDPres * tipoCambioMEP : 0;
```

- [ ] **Step 3: Sitio en `renderPresupuesto` — gastos USD→ARS (~7442-7443)**

Ubicar (incluye la línea previa para que el match sea único):
```js
  let gastoUSDEnARS = 0;
  if (USUARIO.toLowerCase() === "ama" && tipoCambioMEP) {
```
Reemplazar por:
```js
  let gastoUSDEnARS = 0;
  if (PREF_USD_MEP && tipoCambioMEP) {
```

- [ ] **Step 4: Sitio en `renderPresupuesto` — sublabel KPI sueldo (~7513)**

Ubicar:
```js
    sublSueldo.textContent = USUARIO.toLowerCase() === "ama" && tipoCambioMEP && ingresosUSDPres > 0
```
Reemplazar por:
```js
    sublSueldo.textContent = PREF_USD_MEP && tipoCambioMEP && ingresosUSDPres > 0
```

- [ ] **Step 5: Sitio en `actualizarKpisPres` — sueldo efectivo (~7896)**

Ubicar:
```js
  const usdEnARSKpi = USUARIO.toLowerCase() === "ama" && tipoCambioMEP ? ingUSDKpi * tipoCambioMEP : 0;
```
Reemplazar por:
```js
  const usdEnARSKpi = PREF_USD_MEP && tipoCambioMEP ? ingUSDKpi * tipoCambioMEP : 0;
```

- [ ] **Step 6: Sitio en `actualizarKpisPres` — gastos USD→ARS (~7950-7951)**

Ubicar (incluye la línea previa para que el match sea único):
```js
  let gastoUSDEnARSKpi = 0;
  if (USUARIO.toLowerCase() === "ama" && tipoCambioMEP) {
```
Reemplazar por:
```js
  let gastoUSDEnARSKpi = 0;
  if (PREF_USD_MEP && tipoCambioMEP) {
```

- [ ] **Step 7: Verificar que no quedan gatings MEP por nombre**

Run:
```bash
grep -n 'USUARIO.toLowerCase() === "ama"\|USUARIO.toLowerCase() !== "ama"' index.html
```
Esperado: **sin resultados** (los 8 sitios originales quedaron reemplazados por las Tasks 1-4). Si aparece alguno, reemplazarlo siguiendo el patrón correspondiente antes de commitear.

- [ ] **Step 8: Verificar en navegador**

Con `PREF_USD_MEP === false` (usuario sin la preferencia), en "Mi mes": el KPI "Sueldo" debe mostrar solo ARS (sublabel "ingresos del mes") y el KPI "Gastado" NO debe incluir conversión de gastos USD. Forzar temporalmente en consola `PREF_USD_MEP = true; cargarPresupuesto();` y confirmar que el sueldo ahora incluye `USD × MEP` y el sublabel muestra `ARS + U$S … × $… MEP` (si hay ingresos USD y `tipoCambioMEP` cargado). Recargar para volver al estado real.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat(prefs): matematica USD/MEP gateada por PREF_USD_MEP en vez del nombre

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: UI del checkbox y persistencia de la preferencia

Agrega el checkbox en Categorías → Cuenta y Seguridad, la función que persiste el cambio, y el reflejo del estado inicial. Depende de Task 1 (global `PREF_USD_MEP`).

**Files:**
- Modify: `index.html:3554-3560` (card "Cuenta y Seguridad" — agregar checkbox)
- Modify: `index.html:4249-4250` (`renderizarSeccionCuenta` — reflejar estado del checkbox)
- Modify: `index.html:4250` (agregar función `guardarPrefUsdMep` después de `renderizarSeccionCuenta`)

**Interfaces:**
- Consumes: global `PREF_USD_MEP` (de Task 1); `CATS_INGRESO_REAL`; `cargarPresupuesto()` (ya existe, `index.html:7108`); patrón `supabaseClient.auth.updateUser`.
- Produces: función global `guardarPrefUsdMep(checked)`; elemento `#pref-usd-mep`.

- [ ] **Step 1: Agregar el checkbox al card "Cuenta y Seguridad"**

Ubicar (líneas ~3554-3560):
```html
        <!-- Cuenta y Seguridad -->
        <div class="chart-card" style="margin-top:1.5rem">
          <div class="chart-title">Cuenta y Seguridad</div>
          <div id="cuenta-identities">
            <div style="color:var(--text-muted);font-size:.85rem">Cargando…</div>
          </div>
        </div>
```
Reemplazar por (el checkbox va FUERA de `#cuenta-identities`, que se sobrescribe con `innerHTML`):
```html
        <!-- Cuenta y Seguridad -->
        <div class="chart-card" style="margin-top:1.5rem">
          <div class="chart-title">Cuenta y Seguridad</div>
          <div id="cuenta-identities">
            <div style="color:var(--text-muted);font-size:.85rem">Cargando…</div>
          </div>
          <label style="display:flex;align-items:flex-start;gap:.6rem;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);cursor:pointer;font-size:.85rem;color:var(--text)">
            <input type="checkbox" id="pref-usd-mep" onchange="guardarPrefUsdMep(this.checked)" style="margin-top:.15rem;flex-shrink:0">
            <span>Cobro parte de mis ingresos en USD — convertir a ARS con dólar MEP en mi presupuesto</span>
          </label>
        </div>
```

- [ ] **Step 2: Reflejar el estado inicial del checkbox en `renderizarSeccionCuenta`**

Ubicar (líneas ~4249-4250), el final de la función `renderizarSeccionCuenta`:
```js
    <div id="cuenta-msg" style="margin-top:.5rem;font-size:.82rem"></div>`;
}
```
Reemplazar por:
```js
    <div id="cuenta-msg" style="margin-top:.5rem;font-size:.82rem"></div>`;
  const _prefChk = document.getElementById('pref-usd-mep');
  if (_prefChk) _prefChk.checked = PREF_USD_MEP;
}
```

- [ ] **Step 3: Agregar la función `guardarPrefUsdMep`**

Ubicar el cierre de `renderizarSeccionCuenta` recién editado (la llave `}` que sigue a las dos líneas nuevas) y la línea en blanco previa a `async function volverConfig()`:
```js
  const _prefChk = document.getElementById('pref-usd-mep');
  if (_prefChk) _prefChk.checked = PREF_USD_MEP;
}

async function volverConfig() {
```
Reemplazar por (inserta la función nueva entre ambas):
```js
  const _prefChk = document.getElementById('pref-usd-mep');
  if (_prefChk) _prefChk.checked = PREF_USD_MEP;
}

function guardarPrefUsdMep(checked) {
  PREF_USD_MEP = !!checked;
  CATS_INGRESO_REAL = PREF_USD_MEP
    ? ["Sueldo", "Otros Ingresos", "Intereses"]
    : ["Sueldo", "Otros Ingresos"];
  supabaseClient.auth.updateUser({ data: { usd_mep: PREF_USD_MEP } }).catch(() => {});
  if (typeof cargarPresupuesto === "function") cargarPresupuesto();
}

async function volverConfig() {
```

- [ ] **Step 4: Verificar en navegador**

1. Ir a Categorías → card "Cuenta y Seguridad": el checkbox debe aparecer con el copy exacto y reflejar el estado actual (destildado para un usuario sin la preferencia).
2. Tildarlo. En "Mi mes" el KPI "Sueldo" debe pasar a incluir `USD × MEP` (si hay ingresos USD y `tipoCambioMEP`), y "Intereses" pasa a contar como ingreso real.
3. Recargar la página: el checkbox debe seguir tildado (persistió en `user_metadata`). Confirmar en consola:
```js
supabaseClient.auth.getUser().then(({data:{user}}) => console.log(user.user_metadata.usd_mep));
```
Esperado: `true`.
4. Destildar, recargar: `usd_mep` debe ser `false` y el comportamiento vuelve al base.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(prefs): checkbox de conversion USD/MEP en Cuenta y Seguridad

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Verificación integral y de la promesa multi-tenant

Confirma que ningún gating por nombre "ama"/"daniel" quedó en lógica de negocio.

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Grep de gatings por nombre residuales**

Run:
```bash
grep -n 'toLowerCase() === "ama"\|toLowerCase()==="ama"\|=== "ama"\|==="ama"\|!== "ama"\|!=="ama"\|=== "daniel"\|=== "Daniel"' index.html
```
Esperado: **sin resultados**. Cualquier coincidencia en lógica de negocio es un gating no migrado; investigarla contra la spec antes de dar por cerrado. (Nota: strings de UI que mencionen "Daniel"/"Ama" como ejemplos de texto no cuentan; el grep de arriba apunta a comparaciones de código.)

- [ ] **Step 2: Recorrido funcional completo**

Con un usuario limpio (sin `usd_mep`, sin `fin-theme`, sin `_disclosure_mimes`):
- Tema sigue al SO.
- Desglose de Mi mes expandido.
- "Intereses" NO cuenta como ingreso; sin conversión MEP.
- KPI "Saldo en USD" se muestra igual (no debió cambiar).
- `tipoCambioMEP` se sigue fetcheando (verificar en consola que no es `null` tras cargar, si el fetch está disponible).

Luego tildar el checkbox y confirmar que solo cambia la matemática de ingresos (sueldo incluye USD×MEP, gastado incluye gastos USD, "Intereses" cuenta como ingreso), sin afectar KPI "Saldo en USD" ni el fetch.

- [ ] **Step 3: Sin commit**

Esta task es solo verificación; no genera cambios. Si algo falla, volver a la task correspondiente.
