# Preferencias de usuario — eliminar gating por nombre "Ama" — Design Spec

> Fecha: 2026-07-06
> Estado: aprobado (4 decisiones de diseño cerradas por Daniel antes de escribir esta spec)

## Problema

Una auditoría de seguridad encontró 8 sitios en `index.html` donde lógica de negocio real
depende de `USUARIO.toLowerCase() === "ama"` en vez de una preferencia configurable. Esto rompe
la promesa multi-tenant de la app (cualquier pareja nueva puede crear su cuenta): un usuario
llamado "Ama" hereda comportamientos financieros que no eligió, y ningún otro usuario puede
activarlos aunque cobre en USD.

Los 8 sitios se agrupan en 4 comportamientos:

1. **`CATS_INGRESO_REAL`** (`index.html:4446-4448`) — si el usuario es "ama", "Intereses" cuenta
   como ingreso real; si no, no.
2. **Conversión USD→ARS vía dólar MEP** en la matemática de ingresos/presupuesto — 6 sitios:
   `index.html:7185` (`sugerirPresupuestoDesdeHistorial`), `7380`, `7443`, `7513`
   (`renderPresupuesto`), `7896`, `7951` (`actualizarKpisPres`). Solo "ama" suma
   `ingresosUSD × tipoCambioMEP` a su sueldo base y convierte sus gastos USD a ARS en el KPI.
3. **Tema por defecto** (`index.html:4451`) — `ama → light`, resto → `dark`.
4. **Desglose de "Mi mes" expandido/colapsado por defecto** (`index.html:9183`) — `ama → colapsado`,
   resto → expandido.

## Alcance y no-alcance

**Dentro de alcance:** eliminar los 8 gatings por nombre, reemplazándolos por las fuentes de
verdad correctas (preferencia configurable, preferencia del SO, default uniforme).

**Fuera de alcance (confirmado, NO tocar):**
- El fetch de `tipoCambioMEP` — se sigue haciendo para todos, sin cambios.
- El KPI "Saldo en USD" — se sigue mostrando a cualquiera con saldo USD, sin cambios.
- El toggle manual de tema (`toggleTheme()`) y su persistencia en `localStorage['fin-theme']` —
  ya funcionan; solo cambia el **default** cuando no hay valor guardado.
- Bug preexistente y NO relacionado: `inicializarDisclosureCompartidos` escribe la preferencia
  de "Compartidos" pero nunca la restaura. Se documenta como hallazgo aparte (ver sección
  "Hallazgo fuera de alcance"), **no se arregla en esta spec**.
- Sin código de migración / backfill — corte limpio (ver Decisión 4).

## Las 4 decisiones de diseño (cerradas)

### Decisión 1 — Conversión USD/MEP: nueva preferencia explícita

Un checkbox explícito nuevo en **Categorías → Cuenta y Seguridad**:

> "Cobro parte de mis ingresos en USD — convertir a ARS con dólar MEP en mi presupuesto"

- Se guarda en Supabase Auth `user_metadata`, siguiendo **exactamente** el patrón de `cat_emojis`
  (`supabaseClient.auth.updateUser({ data: { usd_mep: <bool> } })`, leído de
  `session.user.user_metadata`).
- Controla **solo** la matemática de ingresos:
  - agregar `"Intereses"` a `CATS_INGRESO_REAL`, y
  - sumar `ingresosUSD × tipoCambioMEP` al sueldo base + convertir gastos USD a ARS en los KPIs de
    presupuesto.
- **No** cambia el fetch de `tipoCambioMEP` ni el KPI "Saldo en USD" (siguen activos para todos).

Se introduce un global booleano `PREF_USD_MEP` (fuente de verdad en runtime), inicializado en
`false`, hidratado desde `user_metadata.usd_mep` al login **antes** de que `_setVariablesUsuario`
compute `CATS_INGRESO_REAL`. Los 7 sitios que hoy chequean `USUARIO.toLowerCase() === "ama"` para
la matemática (1 en `CATS_INGRESO_REAL` + 6 de MEP) pasan a chequear `PREF_USD_MEP`.

### Decisión 2 — Tema por defecto: seguir el SO

Cuando **no** hay `fin-theme` guardado en localStorage, el default sale de
`window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'` en vez de mirar el
nombre de usuario. Si hay valor guardado, gana el valor guardado (sin cambios).

### Decisión 3 — Desglose de "Mi mes": expandido por defecto para todos

Se elimina la rama `!== "ama"`: cuando no hay preferencia guardada en
`localStorage[USUARIO + "_disclosure_mimes"]`, el default es **expandido** para todos.

### Decisión 4 — Migración: corte limpio, sin backfill

Se aplican los nuevos defaults también a Daniel y Ama. Ama puede ver el tema cambiar una vez (de
light fijo a lo que diga su SO); lo vuelve a fijar con un tap del toggle y queda guardado en
`fin-theme`. Ama, si quiere seguir con la conversión USD/MEP, tildará el nuevo checkbox una vez.
**No hay código de migración.**

## Arquitectura

Todo vive en el único `index.html` (sin build pipeline, JS/HTML/CSS inline).

### Nuevo estado global

`let PREF_USD_MEP = false;` declarado junto a los demás globals (`index.html:4033`, tras
`tipoCambioMEP`).

### Lectura de la preferencia (login)

En `_configurarUsuario(session)` (`index.html:4460`), leer `session.user.user_metadata?.usd_mep` y
setear `PREF_USD_MEP = metaUsdMep === true;` **antes** de la llamada a `_setVariablesUsuario`
(`index.html:4472`), porque `_setVariablesUsuario` computa `CATS_INGRESO_REAL` a partir de esta
preferencia. Se sigue el patrón de `cat_emojis`, que se lee en la misma función unas líneas antes.

La spec NO agrega caché en localStorage para esta preferencia: a diferencia de `cat_emojis` (que se
lee sincrónicamente durante renders que ocurren antes de tener sesión), `PREF_USD_MEP` solo se
necesita después del login, cuando la sesión ya está disponible. La fuente de verdad es
`user_metadata`. Cambios cross-device requieren un reload (limitación conocida y aceptable, mismo
comportamiento efectivo que `cat_emojis`, cuyo refetch tampoco fuerza re-render).

### Escritura de la preferencia (checkbox)

Nuevo bloque HTML estático dentro del card "Cuenta y Seguridad" (`index.html:3554-3560`),
**después** del div `#cuenta-identities` (que se re-renderiza vía `innerHTML` y no debe contener el
checkbox). Un `<label>` con `<input type="checkbox" id="pref-usd-mep">` que llama
`guardarPrefUsdMep(this.checked)` en `onchange`.

Nueva función `guardarPrefUsdMep(checked)` que:
1. setea `PREF_USD_MEP = !!checked`;
2. recomputa `CATS_INGRESO_REAL` inline (mismas dos ramas que `_setVariablesUsuario`);
3. persiste con `supabaseClient.auth.updateUser({ data: { usd_mep: PREF_USD_MEP } }).catch(() => {})`
   (patrón `cat_emojis`);
4. re-renderiza Mi mes / presupuesto llamando `cargarPresupuesto()` para que la matemática nueva se
   refleje al instante.

El estado inicial del checkbox se refleja al final de `renderizarSeccionCuenta()`
(`index.html:4220`, invocada por `renderizarConfig`): `chk.checked = PREF_USD_MEP`.

### Cambios en los 8 sitios de gating

| # | Línea(s) | Hoy | Nuevo |
|---|---|---|---|
| 1 | 4446-4448 | `USUARIO.toLowerCase() === "ama"` → incluye "Intereses" | `PREF_USD_MEP` → incluye "Intereses" |
| 2 | 4451-4457 | `_defaultTheme = ama ? "light" : "dark"` | `_defaultTheme = matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light"` |
| 3 | 7185 | `USUARIO.toLowerCase() === "ama" && tipoCambioMEP` | `PREF_USD_MEP && tipoCambioMEP` |
| 4 | 7380 | idem | `PREF_USD_MEP && tipoCambioMEP` |
| 5 | 7443 | idem | `PREF_USD_MEP && tipoCambioMEP` |
| 6 | 7513 | idem (sublabel del KPI sueldo) | `PREF_USD_MEP && tipoCambioMEP && ingresosUSDPres > 0` |
| 7 | 7896 | idem | `PREF_USD_MEP && tipoCambioMEP` |
| 8 | 7951 | idem | `PREF_USD_MEP && tipoCambioMEP` |
| 9 | 9183 | `defaultExpanded = USUARIO.toLowerCase() !== "ama"` | `defaultExpanded = true` |

(9 líneas para 8 comportamientos: los sitios 3-8 son las 6 líneas del comportamiento MEP.)

## Data flow

```
login (getSession)
  └─ _configurarUsuario(session)
       ├─ PREF_USD_MEP = session.user.user_metadata?.usd_mep === true
       └─ _setVariablesUsuario(nombre)
            ├─ CATS_INGRESO_REAL = PREF_USD_MEP ? [...,"Intereses"] : [...]
            └─ _defaultTheme = matchMedia(prefers-color-scheme:dark) ? "dark":"light"

render Mi mes / presupuesto (renderPresupuesto, actualizarKpisPres, sugerir...)
  └─ if (PREF_USD_MEP && tipoCambioMEP) → suma USD×MEP / convierte gastos USD

usuario tilda checkbox (Categorías)
  └─ guardarPrefUsdMep(checked)
       ├─ PREF_USD_MEP = checked
       ├─ CATS_INGRESO_REAL recomputado
       ├─ updateUser({ data: { usd_mep } })   (fire-and-forget)
       └─ cargarPresupuesto()   (re-render inmediato)
```

## Manejo de errores

- `updateUser(...).catch(() => {})` — fire-and-forget idéntico a `cat_emojis`; si falla la red, el
  cambio queda en runtime y se persiste en el próximo cambio o reload con red.
- Todos los guards `id`-based (`if (!el) return;`) se preservan.
- `matchMedia` está soportado en todos los navegadores objetivo (PWA moderna); no requiere fallback,
  pero si `window.matchMedia` no existiera, `?.matches` devuelve `undefined` → `"light"`, un default
  seguro.

## Testing / verificación manual

Sin framework de tests (single-file). Verificación manual tras implementar:
1. Usuario sin `usd_mep` en metadata y sin `fin-theme`: tema sigue al SO; desglose Mi mes expandido;
   "Intereses" NO cuenta como ingreso; sin conversión MEP.
2. Tildar el checkbox: KPIs de presupuesto se actualizan al instante (sueldo incluye USD×MEP,
   gastado incluye gastos USD convertidos); recargar → sigue tildado.
3. Destildar: vuelve al comportamiento base; recargar → sigue destildado.
4. Toggle de tema manual: persiste en `fin-theme` y gana sobre el default del SO.
5. Ama (usuario existente): al primer login post-cambio ve el tema del SO; un tap del toggle lo fija.

## Hallazgo fuera de alcance (documentado, no se arregla)

`inicializarDisclosureCompartidos` (`index.html`, análogo a `inicializarDisclosureMimes`) escribe
`USUARIO + "_disclosure_compartidos"` en `toggleDetalleCompartidos` pero nunca restaura ese valor al
inicializar. Bug menor de UX preexistente, no relacionado con el gating por nombre. Se deja anotado
para un fix futuro separado.
