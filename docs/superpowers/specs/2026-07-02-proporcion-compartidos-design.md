# Spec: Proporción personalizada de gastos compartidos

**Fecha:** 2026-07-02
**Estado:** Aprobado — pendiente de implementación

---

## Resumen

Hoy toda transacción marcada `"Compartido"` se divide 50/50 entre Daniel y Ama de forma hardcodeada (`/2`, `*0.5`) en múltiples puntos de `06-compartidos.js` y `07-presupuesto.js`. Esta feature permite configurar una proporción distinta (ej. 60/40, 70/30) por **mes/año**, que se hereda hacia adelante hasta que se vuelva a cambiar, con fallback a 50/50 si nunca se configuró nada. La configuración vive inline en la página Compartidos, junto al selector de mes/año ya existente.

---

## Decisiones de diseño

| Decisión | Elección |
|---|---|
| Granularidad de la proporción | Por mes/año (no global fijo, no por categoría, no por transacción individual) |
| Simetría | Un solo valor compartido por período — no es una preferencia por-usuario; Daniel y Ama ven siempre el mismo ratio para un mes dado |
| Retroactividad al cambiar un mes pasado | Afecta solo a ese mes específico; otros meses no se alteran |
| Comportamiento de mes nuevo sin configurar | Hereda el último valor configurado en un mes anterior (no vuelve a 50/50 automáticamente) |
| Fallback si nunca se configuró nada | 50/50 (comportamiento actual, retrocompatible) |
| Persistencia | Tabla Supabase nueva y dedicada `proporcion_compartidos`, análoga al patrón de `presupuesto`/`recurrentes`/`metas_ahorro` |
| Ubicación de la UI | Inline en la página Compartidos, junto al selector de mes/año existente (no modal, no en Categorías) |
| Override por transacción individual | Fuera de alcance en esta versión (puede agregarse después si hace falta en la práctica) |
| Override por categoría | Fuera de alcance |

---

## 1. Modelo de datos

### Tabla Supabase nueva: `proporcion_compartidos`

```sql
create table proporcion_compartidos (
  id           uuid primary key default gen_random_uuid(),
  mes          int  not null check (mes between 1 and 12),
  anio         int  not null,
  pct_daniel   numeric not null check (pct_daniel >= 0 and pct_daniel <= 100),
  updated_by   text,          -- "Daniel" | "Ama" — quién hizo el último cambio (informativo, no afecta cálculo)
  updated_at   timestamptz not null default now(),
  unique (mes, anio)
);
```

Notas de diseño:

- `pct_ama` **no se guarda** — se deriva siempre como `100 - pct_daniel`. Esto evita estados inconsistentes donde los dos porcentajes no sumen 100.
- Los nombres de columna usan `pct_daniel` en vez de `pct_usuario`/`pct_partner` porque el ratio es un dato **compartido**, no ligado a la sesión de quien lo consulta. Esto es consistente con el código ya existente en `06-compartidos.js`, que usa literalmente las claves `.daniel` / `.ama` en sus estructuras internas (`{ daniel: 0, ama: 0 }`) — no es una desviación de las convenciones del proyecto, es continuar el mismo patrón.
- `unique (mes, anio)`: configurar el ratio de un mes es un `upsert`, nunca un insert duplicado.
- **RLS:** a diferencia de `presupuesto` (que sí es per-usuario), esta tabla **no** filtra por usuario — ambos usuarios (Daniel y Ama) tienen lectura y escritura sobre todas las filas, porque el ratio de un mes debe ser el mismo para ambos. Es la misma instancia Supabase compartida ya usada por el resto del proyecto (ver CLAUDE.md, "ONE shared instance").
- `pct_daniel` es `numeric` (no `int`): se permiten decimales (ej. 33.33/66.67), consistente con que `parsearDecimal()` ya soporta comas/decimales en el resto del proyecto.

### Función de resolución (herencia del último valor configurado)

```
obtenerProporcionParaMes(mes, anio):
  1. Buscar en el array cacheado de proporcion_compartidos todas las filas
     donde (anio, mes) de la fila <= (anio, mes) objetivo,
     comparando como período compuesto (anio*12 + mes).
  2. Ordenar esas filas por (anio, mes) descendente.
  3. Tomar la primera (la más reciente que sea <= al período buscado).
  4. Si no hay ninguna → devolver { pctDaniel: 50, pctAma: 50 } (default).
  5. Si hay una → devolver { pctDaniel: fila.pct_daniel, pctAma: 100 - fila.pct_daniel }.
```

Esta resolución se hace **en el cliente**, sobre datos ya cargados en memoria (la tabla es chica — se carga entera, sin paginación, igual que `recurrentes` o `plazos_fijos`). No se implementa como query SQL con comparación de tuplas; se evita esa complejidad innecesaria dado el volumen de filas esperado (unas pocas decenas por año, no miles).

---

## 2. Componentes y carga de datos

### Nuevo módulo: `src/js/16-proporcion.js`

Sigue la convención de un archivo por feature (`13-recurrentes.js`, `14-metas-ahorro.js`, `15-captura-voz.js`).

```javascript
let proporcionesCompartidos = [];   // todas las filas de proporcion_compartidos, cacheadas en memoria

async function cargarProporcionesCompartidos() {
  // SELECT * FROM proporcion_compartidos
  // en caso de error: deja proporcionesCompartidos = [] (fail-safe, ver Sección 4)
  // cachea en localStorage bajo una nueva key CACHE_PROPORCION_KEY, igual que otras tablas chicas
}

function obtenerProporcionParaMes(mes, anio) {
  // implementa la lógica de herencia de la Sección 1
  // retorna { pctDaniel, pctAma } — nunca null/undefined
}

async function guardarProporcionMes(mes, anio, pctDaniel) {
  // clamp pctDaniel a [0, 100] antes de enviar
  // upsert en proporcion_compartidos on (mes, anio)
  // solo actualiza proporcionesCompartidos[] en memoria SI el upsert confirma éxito
  // re-renderiza cargarCompartidos() para reflejar el nuevo ratio
}
```

### Integración con el flujo de arranque

`cargarProporcionesCompartidos()` se invoca una vez durante `iniciarApp()`/`_renderApp()`, junto a las demás cargas de tablas chicas (`cargarCuotasActivas()`, `cargarRecurrentes()`, etc.), y de nuevo tras un `guardarProporcionMes()` exitoso.

### Consumidores: reemplazo de la lógica hardcodeada

`obtenerProporcionParaMes(mes, anio)` es la **única función que conocen los consumidores**. Ningún otro módulo necesita saber cómo se resuelve la herencia — solo pide "dame el ratio vigente para este mes". Todos los puntos que hoy calculan `m / 2` o `m * 0.5` para responsabilidad `"Compartido"` migran a usar `m * (pctDaniel/100)` o `m * (pctAma/100)` según de quién sea la transacción (`t.usuario`), evaluando el ratio **del mes al que pertenece la transacción** (vía `getMesLiquidacion(t)`, ya existente), no el mes actualmente seleccionado en el filtro de UI.

Puntos de reemplazo identificados en el código actual (línea aproximada al momento de este spec):

- `06-compartidos.js`: línea 44 (`_calcularBalanceCompartido`), líneas 96-98 y 110-112 (`cargarCompartidos`, mapas por categoría ARS/USD), línea 168 (drill-down de transacciones individuales).
- `07-presupuesto.js`: línea 119 (consumo de presupuesto por categoría), línea 220 (`montoEfectivoGasto`), línea 249 (histórico de meses en sparklines), líneas 350-351 (surplus/gasto por categoría del mes actual), línea 368 (conversión USD→ARS para Ama), línea 391 (comparación con mes anterior — debe usar el ratio del mes anterior, no el actual), líneas 853-854 y 878 (duplicado del cálculo de KPI, mismo criterio).

Cada uno de estos puntos debe recibir el `mes`/`anio` de la transacción (o del período que esté iterando) y llamar a `obtenerProporcionParaMes(mes, anio)` en vez de usar la constante fija.

---

## 3. UI en la página Compartidos

Control inline junto al selector de mes/año existente (`#comp-mes` / `#comp-anio`):

```
[Mes ▾] [Año ▾]    Reparto:  Daniel [ 60 ]%  /  Ama [ 40 ]%   💾
```

- Dos inputs `type="text" inputmode="decimal"` enlazados: al tipear en uno, el otro se recalcula en vivo como `100 - valor` (mismo patrón que `.pres-monto-live` en Presupuesto).
- Guardado **explícito** con botón (no autosave en cada tecla), para evitar escrituras excesivas a Supabase — mismo patrón que el resto de formularios de configuración del proyecto.
- Al llamar `cargarCompartidos()` para un mes/año dado, los inputs se pre-llenan con el resultado de `obtenerProporcionParaMes(mes, anio)` (heredado o default).
- Las etiquetas visibles ("Daniel"/"Ama") se arman dinámicamente con `USUARIO`/`PARTNER`, nunca hardcodeadas en el HTML — aunque el dato subyacente en la base de datos sí usa `pct_daniel` como ancla fija (ver Sección 1). Esto respeta la regla del proyecto de nunca hardcodear nombres en la capa de presentación, sin contradecir el modelo de datos.
- No hay, en esta versión, ningún indicador visual de "este mes tiene override explícito" vs "este mes heredó el valor de otro mes" — el usuario simplemente ve el número resultante. Se considera fuera de alcance (YAGNI); puede agregarse en una iteración futura si se necesita.
- Validación: `parsearDecimal()` + clamp a `[0, 100]`. Si ambos campos quedan vacíos al guardar, no se envía nada y se mantiene el valor previamente vigente.
- Mobile: el control debe apilarse verticalmente (o usar flex-wrap) dentro del ancho de la card de Compartidos sin generar overflow horizontal. Usa variables CSS (`var(--card)`, `var(--border)`, `var(--bg2)`) para funcionar correctamente en el tema claro de Ama (`[data-theme="light"]`).

---

## 4. Manejo de errores y casos borde

- **Falla la carga de `proporcion_compartidos`** (red, Supabase caído): `cargarProporcionesCompartidos()` captura el error y deja `proporcionesCompartidos = []`. Como consecuencia, `obtenerProporcionParaMes()` devuelve el default 50/50 en todos los cálculos — la app **nunca se rompe**; en el peor caso, simplemente no aplica un override que existía hasta que la carga se recupere.
- **Falla el guardado** (red, RLS, validación server-side): se informa al usuario con `showToast("⚠️ No se pudo guardar el reparto", "error")` — la función utilitaria ya existente en `10-utils.js`, usada por ejemplo en `guardarPresupuesto()`. El estado en memoria (`proporcionesCompartidos[]`) **no se actualiza** hasta confirmar éxito del upsert, para que la UI nunca muestre un valor que no llegó a persistir. Al guardar con éxito, se muestra `showToast("✅ Reparto actualizado", "success")` por consistencia con el resto de guardados del proyecto.
- **Escritura concurrente** (Daniel y Ama configuran el mismo mes casi simultáneamente): se resuelve por `unique(mes, anio)` + `upsert` con semántica last-write-wins. No se implementa locking optimista ni resolución de conflictos — se considera un caso de baja probabilidad práctica (normalmente una sola persona configura el ratio de un mes, no ambas a la vez), y agregar ese mecanismo sería sobre-ingeniería (YAGNI) para este alcance.
- **Mes sin ninguna fila jamás configurada** (estado inicial post-deploy, o migración): fallback a 50/50, idéntico al comportamiento actual. Esto garantiza que el deploy inicial de esta feature sea 100% retrocompatible sin necesidad de backfill de datos históricos.
- **Transacciones que cruzan límites de mes vía `getMesLiquidacion()`**: se reutiliza tal cual la función ya existente que determina a qué "mes de liquidación" pertenece una transacción — no se introduce un criterio nuevo ni distinto al que ya usa el resto de Compartidos para agrupar.
- **`pct_daniel` fuera de rango** por manipulación directa en la base o bug futuro: el `check` constraint SQL (`between 0 and 100`) es la última línea de defensa; en el cliente se clampa el valor antes de enviarlo, como doble resguardo.

---

## 5. Testing y verificación

El proyecto no tiene suite de tests automatizados (sin npm, sin framework de testing — confirmado en CLAUDE.md). La verificación es manual, sobre el preview de Vercel de la rama de feature.

**Funcional:**

1. Mes sin ninguna fila en `proporcion_compartidos` → Compartidos calcula igual que hoy (50/50), verificado con ambos usuarios (Daniel y Ama) logueados por separado.
2. Configurar julio en 70/30 desde la sesión de Daniel → loguearse como Ama → verificar que Ama ve el mismo 70/30 (el ratio es compartido, no per-usuario).
3. Configurar julio en 70/30 y dejar agosto sin tocar → agosto debe heredar 70/30 (no volver a 50/50).
4. Configurar agosto explícitamente en 50/50 después de haber heredado 70/30 de julio → agosto queda en 50/50 y julio permanece sin cambios.
5. Cambiar la proporción de un mes que ya tiene transacciones "Compartido" cargadas → `Mi mes` (KPIs, presupuesto) y `Compartidos` (balance, tabla por categoría, drill-down) deben recalcular con el nuevo ratio de forma consistente entre ambas pantallas.
6. Liquidación (`abrirLiquidar`/"saldar todo") debe usar el ratio correspondiente al mes que se está liquidando, no el del mes actualmente visualizado en el filtro si son distintos.
7. Transacciones en USD con responsabilidad "Compartido" → el ratio debe aplicarse igual en la conversión USD→ARS del presupuesto de Ama.
8. Inputs enlazados: tipear 65 en el campo Daniel debe reflejar automáticamente 35 en el campo Ama, y viceversa.
9. Guardar con la red desconectada (throttling en devtools) → no debe actualizarse el estado local ante error, y debe informarse al usuario.

**Regresión:**

10. Con la tabla `proporcion_compartidos` vacía (estado día 1 post-deploy), Compartidos, Mi mes, y liquidación deben producir **exactamente** los mismos números que en producción hoy. Este es el criterio de aceptación de retrocompatibilidad de esta feature.

**Visual/responsive:**

11. El control de reparto no debe romper el layout mobile de Compartidos (ancho de card, overflow) y debe respetar el tema claro de Ama.

---

## Fuera de alcance (explícitamente descartado en esta versión)

- Override por categoría de gasto.
- Override por transacción individual (evaluado y descartado en la fase de brainstorming; puede reconsiderarse si en la práctica el reparto mensual no alcanza).
- Indicador visual de "mes heredado" vs "mes con override explícito" en la UI de Compartidos.
- Locking optimista / resolución de conflictos de escritura concurrente sobre el mismo mes.
- Backfill de datos históricos — no es necesario porque el fallback a 50/50 reproduce el comportamiento actual exacto.
