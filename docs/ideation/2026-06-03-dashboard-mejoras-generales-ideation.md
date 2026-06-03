---
date: 2026-06-03
topic: dashboard-mejoras-generales
focus: mejoras para el tablero de finanzas personales — arquitectura, UI/UX, features — uso real de pareja en Argentina
mode: repo-grounded
---

# Ideation: Dashboard Mejoras Generales

## Grounding Context

**Codebase:** Single-file HTML (8,077 líneas), vanilla JS, Supabase backend, Vercel deployment. Sin build pipeline. PWA habilitado. Dos usuarios: Daniel (dark) y Ama (light), Argentina, una sola instancia de Supabase.

**Pain points clave:** 100% entrada manual de transacciones, workaround delete+add para editar (no hay `updateTransaccion`), monolito de 8K líneas, P1 ARIA gaps, cuotas sin visibilidad forward-looking, presupuesto mensual anclado al mes calendario (no al ciclo de cobro real).

**External signals:** Monarch Money (couples shared views), YNAB (age of money, zero-based), Copilot Money (design-as-retention, ML categorización), Actual Budget (local-first), Belo/Argentina (dual-currency first-class), running pace analogy, flight instruments (primary scan path).

## Topic Axes

1. Información y visibilidad
2. Captura e ingreso
3. Dinámica de pareja
4. Arquitectura y mantenibilidad
5. Flujos de interacción

## Ranked Ideas

### 1. Build step mínimo: fuente modular, deploy single-file
**Description:** Un script de shell (o Makefile) concatena archivos fuente organizados por feature (`src/presupuesto.js`, `src/transacciones.js`, etc.) en el `index.html` de deploy. El artefacto de deploy es idéntico al actual — un único HTML — pero el desarrollo ocurre en archivos de 300-500 líneas en lugar de un monolito de 8K. Sin npm, sin framework, sin build time perceptible.
**Axis:** Arquitectura y mantenibilidad
**Basis:** `direct:` El monolito tiene 8,077 líneas; la constraint de un archivo es self-imposed según CLAUDE.md, no técnicamente requerida. `external:` esbuild produce HTML single-file desde fuente modular en <1s con zero config. `reasoned:` A 8K+ líneas, localizar, razonar y editar features de forma segura es el constraint de DX más grande del proyecto.
**Rationale:** Una tarde de setup desbloquea mantenibilidad indefinida. El deploy artifact no cambia; solo el DX cambia. Es el cambio de menor costo y mayor headroom para todo el trabajo futuro.
**Downsides:** Requiere reorganizar el archivo existente en módulos (one-time effort). Si se elige esbuild agrega una dependencia Node al workflow de dev.
**Confidence:** 88%
**Complexity:** Low
**Status:** Unexplored

### 2. `updateTransaccion` real vía Supabase
**Description:** Una migración agrega `UPDATE transactions SET ... WHERE id = $1 AND user_id = $2`. `guardarEdicionTransaccion()` se reemplaza con `.update()` directo de Supabase. El workaround desaparece del CLAUDE.md. El delete+add que destruye IDs silenciosamente deja de existir.
**Axis:** Arquitectura y mantenibilidad
**Basis:** `direct:` CLAUDE.md §5 y §11 documentan el workaround y el error conocido `updateTransaccion is not defined`. `direct:` delete+add genera nuevo ID en cada edición, rompiendo links `compra_id` de cuotas. `reasoned:` Supabase ya es el backend real — la migración es operación estándar.
**Rationale:** Cada edición destruye el ID original. Con cuotas referenciando IDs, esto es un problema de correctness que crece con cada nueva feature. Fix: 1 migration + ~10 líneas de JS.
**Downsides:** Requiere migración de Supabase. Cualquier ruta Apps Script restante quedaría inconsistente.
**Confidence:** 95%
**Complexity:** Medium
**Status:** Unexplored

### 3. Proyección de ritmo + señal de estrategia mid-month
**Description:** El KPI "Lo que te queda" se reencuadra como ritmo diario: `restante / días_que_quedan`. A mitad de mes se suma una señal estratégica: "On pace → cerrás con +$Z" / "Overspending → frenate acá" / "Too close to call → hold". Cero backend, pure frontend.
**Axis:** Información y visibilidad
**Basis:** `direct:` KPI `surplusTotal` y `Lo que te queda` ya existen (sprint May 4-6). `external:` Running pace analogy del grounding — "at current pace, you'll end the month with +$X is more actionable than current balance." `reasoned:` Todos los inputs ya están en el frontend — es una división + texto.
**Rationale:** La distancia entre "tengo $20k restantes" y "estoy gastando $800/día de más" es el gap que hace fallar los presupuestos. El app ya tiene los datos.
**Downsides:** Los primeros días del mes el denominador es chico → proyección ruidosa. Necesita mínimo 5 días transcurridos para activarse.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 4. Cuota committed floor en Mi mes
**Description:** En el chart de Mi mes, una capa visual de "piso comprometido" por cuotas muestra la suma de transacciones futuras de `compras_cuotas` para los próximos 6 meses. Una sección colapsable detalla: nombre de compra, cuotas restantes, monto mensual.
**Axis:** Información y visibilidad
**Basis:** `direct:` Tablas `compras_cuotas` y transacciones upfront-N ya existentes en allTransac[]. `external:` "Recurring transaction handling (subscriptions as 'hidden money' discovery)" — top user value. `reasoned:` Aggregación por mes de transacciones cuota es filter + groupBy sin cambios de backend.
**Rationale:** Las cuotas son compromisos futuros invisibles en el presupuesto mensual hasta que llegan. Convertir sorpresas en información planificable.
**Downsides:** UX del chart necesita cuidado para no sobrecargar Mi mes.
**Confidence:** 85%
**Complexity:** Low-Medium
**Status:** Unexplored

### 5. Detección de recurrentes + smart defaults en entrada
**Description:** Al abrir el mes, el sistema escanea `allTransac` buscando descripciones con periodicidad ≈30 días y monto estable (±5%). Sugiere "¿Olvidaste cargar alquiler?" con un tap para confirmar. En el formulario, al tipear descripción auto-rellena categoría, fuente y responsabilidad desde el último match en historial.
**Axis:** Captura e ingreso
**Basis:** `direct:` `allTransac[]` cargado client-side con fechas e importes. `external:` Copilot Money — "each correction trains the model; within weeks the list just works" — versión zero-infra. `direct:` 100% entrada manual → recurrentes son el error sistemático más predecible.
**Rationale:** Si el punto de dolor #1 es que todo es manual, el #2 es que lo manual es lento y propenso al olvido.
**Downsides:** False positives en detección. Necesita "No es recurrente, no sugerir más" explícito.
**Confidence:** 78%
**Complexity:** Medium
**Status:** Unexplored

### 6. Settlement como entidad de primera clase
**Description:** Nueva tabla `liquidaciones` en Supabase: entidad closeable con balance neto Daniel↔Ama, monto de transferencia acordado, y flag `saldado`. Compartidos pasa de "balance del mes" a saldo running continuo. Toggle "Splitear 50/50 con [PARTNER]" en nueva transacción crea dos registros simultáneamente. Saldar = un tap.
**Axis:** Dinámica de pareja
**Basis:** `direct:` `docs/brainstorms/2026-04-07-002-liquidacion-compartidos-requirements.md` — requerimiento nombrado. `direct:` "Saldar todo" planeado en sprint Apr 26-27, no implementado. `external:` Monarch Money labeling system — una etiqueta multiplica a través de todos los reportes.
**Rationale:** La dinámica de pareja es el diferenciador central del app. Formalizarla como primitiva hace que cada futura feature de gastos compartidos sea gratis por construcción.
**Downsides:** Nueva tabla Supabase + migration. UI necesita flujo dedicado de settlement. Ítem más costoso de la lista.
**Confidence:** 82%
**Complexity:** High
**Status:** Unexplored

### 7. Ciclo de cobro como ancla de presupuesto
**Description:** Campo configurable por usuario (`fechaCobro`: 1–28) ancla el "mes presupuestario" al día en que entra el sueldo, no al 1 del mes calendario. Si Daniel cobra el 10, su Mi mes va del 10 al 9 del mes siguiente.
**Axis:** Flujos de interacción
**Basis:** `external:` Copilot Money "pay period mode" y YNAB "age of money" — pay-cycle como feature más pedida por usuarios que cobran a mitad de mes. `reasoned:` Si el sueldo entra el día 10, los gastos del 1 al 9 son económicamente "del mes pasado" — presupuestar sobre dinero que todavía no llegó es una inconsistencia real.
**Rationale:** En Argentina con sueldos entre el 5 y el 15, el mes calendario es una abstracción que no corresponde al ciclo real de liquidez.
**Downsides:** Complica filtros de transacciones. Edge cases en la zona de transición. Necesita brainstorm cuidadoso antes de planear.
**Confidence:** 72%
**Complexity:** Medium
**Status:** Unexplored

## Rejection Summary

| # | Idea | Razón Rechazada |
|---|------|-----------------|
| 1 | Presupuesto en horas de trabajo | Alienante como default; % ya es salary-relative |
| 2 | App solo muestra el futuro | Forma extrema de #3; esconder historial no es la solución |
| 3 | ICU triage view | Duplica #3 con mayor complejidad |
| 4 | Salary-relative display (musical key) | % ya es la unidad correcta; repackaging confuso |
| 5 | Categorías con intención (Necesario/Elegido) | Nuevo campo requerido; too expensive para 2 usuarios |
| 6 | Inbox de texto libre | Cubierto en ideación de mayo 2026 |
| 7 | WhatsApp/email digest | Removido deliberadamente en sprint Apr |
| 8 | Ship logbook context anchors | Demasiado nicho |
| 9 | ATC custody acknowledgment | Requiere push notifications fuera de scope |
| 10 | App por usuario radicalmente diferente | Demasiado caro; dual-theme ya diferencia |
| 11 | Responsabilidad como vista (no atributo) | Schema migration + backward compat; muy caro |
| 12 | Immune system baseline | Duplica deviation flag |
| 13 | Budget templates | Forma débil del auto-rollover; duplicado |
| 14 | Tidal chart for Ama | Solo reasoned: basis; visualización compleja para 2 usuarios |
| 15 | Web Share Target | Alta incertidumbre de implementación |
| 16 | Inline editing (standalone) | Absorbido por updateTransaccion real (#2) |
| 17 | Split at entry (standalone) | Fold into settlement primitive (#6) |
| 18 | Liquidación continua (standalone) | Fold into settlement primitive (#6) |
| 19 | ARIA P1 gaps | Fix conocido debajo del piso de ambición de la sesión |
| 20 | Dual ARS+USD KPI (Ama) | Scope estrecho; prioridad menor |
| 21 | Write-time canonicalization | Alta palanca pero invisible al usuario |
| 22 | Build step (standalone F4 framing) | Absorbido en #1 con framing más concreto |
