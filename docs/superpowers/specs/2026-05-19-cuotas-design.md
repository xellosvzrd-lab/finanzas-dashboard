# Spec: Compras en Cuotas

**Fecha:** 2026-05-19  
**Estado:** Aprobado — listo para implementar  
**Branch destino:** `feat/cuotas`

---

## Problema

El usuario compra algo en 12 cuotas pero hoy tiene que entrar cada cuota manualmente todos los meses. No puede ver cuánto debe en cuotas activas, cuánto tiene comprometido a futuro, ni cuándo termina de pagar cada compra.

---

## Decisión de diseño central

Cada cuota es una **transacción real** en la tabla `transacciones`, con su `mes_liquidacion` apuntando al mes correcto. Las N cuotas se crean todas de una vez al registrar la compra (*upfront generation*).

Esto reutiliza sin cambios toda la lógica existente: `getMesLiquidacion()`, cálculo de presupuesto, Compartidos, gráficos y filtros ya procesan estas transacciones correctamente.

---

## 1. Modelo de datos

### 1.1 Tabla nueva: `compras_cuotas`

```sql
CREATE TABLE compras_cuotas (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario         TEXT          NOT NULL,
  descripcion     TEXT          NOT NULL,
  categoria       TEXT          NOT NULL,
  responsabilidad TEXT          NOT NULL,
  fuente          TEXT          NOT NULL,            -- debe ser FUENTE_TC
  moneda          TEXT          NOT NULL DEFAULT 'ARS',
  monto_total     NUMERIC(14,2) NOT NULL,
  cuotas_total    INT2          NOT NULL CHECK (cuotas_total BETWEEN 2 AND 60),
  monto_cuota     NUMERIC(14,2) NOT NULL,            -- editable, soporta CFT
  primer_mes_liq  TEXT          NOT NULL,            -- "YYYY-MM"
  cft_anual_pct   NUMERIC(6,2)  NULL,                -- solo informativo
  estado          TEXT          NOT NULL DEFAULT 'activa',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  user_id         UUID          NOT NULL
);

-- estado: 'activa' | 'cancelada' | 'completada'
-- completada se setea automáticamente cuando cuota_nro = cuota_total

CREATE INDEX idx_compras_usuario_estado ON compras_cuotas(usuario, estado);
```

**RLS policy** (mismo patrón que `plazos_fijos`):
```sql
ALTER TABLE compras_cuotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_compras" ON compras_cuotas
  USING (user_id = auth.uid());
```

### 1.2 Columnas nuevas en `transacciones`

```sql
ALTER TABLE transacciones
  ADD COLUMN compra_id    UUID  NULL,
  ADD COLUMN cuota_nro    INT2  NULL,
  ADD COLUMN cuota_total  INT2  NULL;

CREATE INDEX idx_trans_compra ON transacciones(compra_id)
  WHERE compra_id IS NOT NULL;
```

Las columnas son `NULL` por defecto — ninguna transacción existente requiere migración.

### 1.3 Cómo se genera cada cuota

Al guardar una compra de 12 cuotas con `primer_mes_liq = "2026-06"`:

| cuota_nro | mes_liquidacion | descripcion               |
|-----------|-----------------|---------------------------|
| 1         | 2026-06         | iPhone 15 MercadoPago 01/12 |
| 2         | 2026-07         | iPhone 15 MercadoPago 02/12 |
| ...       | ...             | ...                       |
| 12        | 2027-05         | iPhone 15 MercadoPago 12/12 |

`mes_liquidacion` se calcula: `primer_mes_liq + (cuota_nro - 1) meses`.

---

## 2. Flujo UX — Nueva Transacción

### 2.1 Toggle "Forma de pago"

Aparece **solo** cuando la fuente seleccionada es `FUENTE_TC` (mismo trigger que `_actualizarMesLiqField`).

```
Forma de pago
[ Pago único ]  [ En cuotas ]   ← toggle, default: Pago único
```

En modo "Pago único" el comportamiento es idéntico al actual.

### 2.2 Campos adicionales en modo "En cuotas"

El campo `mes_liquidacion` individual desaparece y se reemplaza por:

```
Monto total (ARS $)         Cuotas
[ 120.000              ]    [ 12 ▼ ]
                             chips: 3 · 6 · 9 · 12 · 18 · 24

Monto por cuota: $10.000,00  ← calculado automáticamente, editable
                               (si el usuario lo edita, prevalece ese valor)

1ra cuota se liquida en
[ 2026-06 ▼ ]   ← default: mes siguiente al actual

☐ Tiene interés (CFT)
   CFT anual %: [____]       ← aparece solo si el checkbox está tildado
```

**Reglas de cálculo:**
- Default: `monto_cuota = monto_total / cuotas`
- Si el usuario edita `monto_cuota`: se guarda ese valor en todas las cuotas (el monto_total queda como referencia pero `monto_cuota` es la fuente de verdad para cada transacción)
- `cuotas_total` límite: 2–60

### 2.3 Botón guardar en modo cuotas

El botón cambia dinámicamente a **"Guardar 12 cuotas"** (actualiza con el número elegido).

**Al confirmar:**
1. `INSERT` en `compras_cuotas` (1 fila)
2. `INSERT` en `transacciones` (N filas en batch) con:
   - `tipo = "Gasto"`
   - `monto = monto_cuota`
   - `descripcion = "${descripcion} ${cuota_nro.toString().padStart(2,'0')}/${cuotas_total}"`
   - `mes_liquidacion` calculado para cada cuota
   - `compra_id`, `cuota_nro`, `cuota_total`
   - `fecha = fecha_compra` (la misma para todas)
3. Toast: *"12 cuotas registradas — próxima: junio 2026"*
4. Limpia el formulario y vuelve a `pago único`

**Manejo de error:** si el insert de `compras_cuotas` falla, no se insertan transacciones. Si el batch de transacciones falla parcialmente, se hace rollback con `DELETE WHERE compra_id = X`.

### 2.4 Modo Ráfaga

No soporta cuotas. El toggle no aparece en Ráfaga.

---

## 3. Visualización

### 3.1 Tarjeta "Cuotas activas" en Mi mes

**Posición:** debajo de los KPIs, antes del desglose de presupuesto.  
**Visibilidad:** solo si el usuario tiene ≥ 1 compra con `estado = 'activa'`.  
**Estado:** colapsable, persistido en localStorage con clave `USUARIO + "_disclosure_cuotas"`. Default: expandido.

```
┌──────────────────────────────────────────────────────┐
│ 💳  Cuotas activas                    3 compras  ▾  │
├──────────────────────────────────────────────────────┤
│  Este mes:              $32.500                      │
│  Comprometido futuro:   $187.500                     │
│                                                      │
│  iPhone 15 MercadoPago                               │
│  ████████████░░  10/12  ·  $10.000/mes  ·  jul 26   │
│                                                      │
│  Curso Platzi                                        │
│  ███░░░░░░░░░░░   3/12  ·   $7.500/mes  ·  feb 27   │
│                                                      │
│  Heladera Frávega            [compartido]            │
│  ███████░░░░░░░   7/18  ·  $15.000/mes  ·  abr 27   │
│                                                      │
│         [+ Nueva compra en cuotas]   [Ver todas]     │
└──────────────────────────────────────────────────────┘
```

**Cálculos:**
- "Este mes": `SUM(monto) WHERE compra_id IS NOT NULL AND mes_liquidacion = mes_actual AND usuario = USUARIO`
- "Comprometido futuro": mismo filtro con `mes_liquidacion > mes_actual`. Para `responsabilidad = 'Compartido'` aplica 50% (consistente con lógica de presupuesto)
- La **última cuota** muestra el mes de cierre ("jul 26")
- Barra de progreso: `cuotas_pagadas / cuota_total` donde `cuotas_pagadas = COUNT WHERE mes_liquidacion <= mes_actual`

### 3.2 En Transacciones

Las cuotas con `mes_liquidacion > mes_actual` **no aparecen** en la lista de Transacciones.

Las cuotas del mes actual o pasadas aparecen con un badge:
```
14 may  iPhone 15 MercadoPago [3/12]  $10.000  Galicia VISA
```

Click en `[3/12]` → abre modal de gestión de esa compra.

### 3.3 Modal "Gestionar cuotas"

Accesible desde el badge en Transacciones o desde "Ver todas" en Mi mes.

```
iPhone 15 MercadoPago
Galicia VISA · Mío · ARS
Comprado: 14 may 2026

[ ████████░░░░  10 de 12  ·  $20.000 restantes ]

may 2026   $10.000   ✅
jun 2026   $10.000   ✅
...
abr 2027   $10.000   ⏳

[ Cancelar anticipadamente ]   [ Editar ]
```

**"Cancelar anticipadamente":**
1. Confirma con un diálogo: *"Se eliminarán las 2 cuotas restantes. ¿Continuar?"*
2. `DELETE FROM transacciones WHERE compra_id = X AND mes_liquidacion > mes_actual`
3. `UPDATE compras_cuotas SET estado = 'cancelada' WHERE id = X`

**"Editar":**
- Permite cambiar: descripción, categoría, responsabilidad
- El cambio se propaga con `UPDATE transacciones WHERE compra_id = X` (todas, pasadas y futuras)
- No permite cambiar monto, cuotas ni fuente (requeriría regenerar todo)

---

## 4. Completado automático

Cuando `_renderCuotasCard()` calcula el estado de cada compra, si `cuotas_pagadas = cuota_total` (todas las cuotas tienen `mes_liquidacion <= mes_actual`), ejecuta `UPDATE compras_cuotas SET estado = 'completada'` en Supabase para esa compra y la excluye de la tarjeta. Es una actualización lazy al renderizar, no un job separado.

---

## 5. Edge cases

| Caso | Comportamiento |
|---|---|
| Cuota en USD | `moneda = 'USD'` se guarda en `compras_cuotas` y propaga a cada transacción. La conversión MEP para Ama ya funciona en runtime. |
| Cuotas compartidas | `responsabilidad = 'Compartido'` se propaga. El 50% se aplica en los cálculos de Mi mes y Compartidos automáticamente. |
| Cancelación anticipada | Borra cuotas futuras, las pasadas intactas. Marca `estado = 'cancelada'`. |
| Cuota con interés (CFT) | El usuario ingresa el monto por cuota tal como aparece en el resumen del banco. CFT es solo informativo en el modal. |
| Monto por cuota con redondeo | Se acepta que `monto_cuota × cuotas_total ≠ monto_total` exactamente. `monto_cuota` es la fuente de verdad para cada transacción. |

---

## 6. Archivos afectados

| Archivo | Cambios |
|---|---|
| `index.html` | Toggle + campos cuotas en form Nueva (~80 líneas), función `guardarCompraEnCuotas()`, tarjeta Mi mes (~60 líneas CSS + ~100 líneas JS), modal gestión (~80 líneas), filtro Transacciones (ocultar futuras), badge `[N/M]` |
| Supabase | Migración: 1 tabla nueva + 3 columnas + 1 index + 1 RLS policy |

---

## 7. Fuera de scope

- Soporte de cuotas en Modo Ráfaga
- Edición de monto/cuotas/fuente después de crear (se cancela y se rehace)
- Notificaciones push por cuota vencida
- Importador CSV vinculando cuotas automáticamente (se hace manualmente por ahora)
