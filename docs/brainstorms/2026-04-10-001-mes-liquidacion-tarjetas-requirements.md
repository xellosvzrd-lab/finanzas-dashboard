# Mes de Liquidación para Tarjetas de Crédito — Requirements

**Fecha:** 2026-04-10  
**Estado:** Listo para planning  
**Repo:** `finanzas-dashboard` (dashboard unificado)

---

## Problema

Los medios de pago inmediato (Efectivo, Débito, MercadoPago) tienen una sola fecha relevante: cuándo ocurrió el gasto. Pero las tarjetas de crédito operan con ciclos de cierre que no coinciden con meses calendario:

- Una compra del 28 de marzo puede pertenecer a "abril" si el cierre anterior fue el 26 de marzo.
- Una cuota de enero registrada en el resumen de abril tiene `fecha = 2026-01-15` pero impacta el presupuesto de abril.
- Los cierres son variables (no siempre el mismo día del mes).

Hoy el usuario compensa esto ingresando manualmente con `fecha = 1° del mes`, perdiendo la fecha real de compra y sin soporte explícito del sistema.

## Goal

Que el sistema distinga semánticamente entre **fecha de compra** y **mes de liquidación** para tarjetas de crédito, mostrando el selector "¿A qué mes corresponde?" solo cuando la fuente es una tarjeta de crédito, y usando ese mes en todos los filtros y vistas.

---

## Conceptos clave

### Tipo de fuente: "FUENTE_TC" vs "FUENTE"

Cada fuente de pago es de uno de dos tipos:

| Tipo | Significado | Ejemplos |
|---|---|---|
| `FUENTE` | Pago inmediato — fecha = mes presupuestario | Efectivo, Débito, MercadoPago |
| `FUENTE_TC` | Tarjeta de crédito — fecha ≠ mes presupuestario | Galicia VISA, Mastercard |

Ambos tipos se almacenan en la tabla `categorias` de Supabase. Las fuentes existentes hoy (tipo `FUENTE`) se pueden reclasificar desde la página de Categorías.

### Campo `mes_liquidacion`

Nueva propiedad en las transacciones. Solo presente en transacciones creadas con fuentes tipo `FUENTE_TC`.

- Formato: `"YYYY-MM"` (ej: `"2026-04"`)
- Indica el mes presupuestario al que pertenece el gasto, independientemente de la `fecha` de compra
- Las transacciones sin este campo (todas las existentes) siguen usando `fecha` para el mes, sin cambios

---

## Comportamiento

### 1. Configuración de fuentes (página Categorías)

- La lista de fuentes muestra una etiqueta visual junto a cada tarjeta de crédito (badge de texto "TC" o icono)
- Cada fuente tiene un botón para cambiar el tipo: "Marcar como tarjeta de crédito" / "Marcar como pago inmediato"
- Al reclasificar, la fuente se elimina de su tipo actual y se re-agrega con el nuevo tipo (delete + insert en Supabase). La operación es atómica: si el insert falla, se muestra un toast de error y el estado de la UI se revierte
- **Al confirmar la reclasificación**, mostrar aviso: _"X transacciones anteriores de esta fuente seguirán usando su fecha original para asignación de mes"_ — el usuario debe editar esas transacciones manualmente si desea corregirlas
- **Fuentes existentes:** el usuario debe reclasificar manualmente las tarjetas de crédito actuales desde esta página

### 2. Formulario Nueva Transacción

- Al seleccionar una fuente de tipo `FUENTE_TC`, aparece un campo adicional:  
  **"Mes de liquidación"** — selector de mes + año, **sin valor por defecto** (campo vacío, obligatorio para poder guardar)
- Al seleccionar una fuente de tipo `FUENTE` (pago inmediato), el campo no aparece (comportamiento actual)
- El campo `fecha` mantiene su comportamiento actual (fecha real de la compra o del gasto)
- Al guardar: si hay `mes_liquidacion`, se envía junto con los demás campos al backend

### 3. Formulario de Edición de Transacción

La visibilidad del campo se maneja por **tipo de fuente**, no por presencia del campo:

- Si la fuente actual es `FUENTE_TC`: muestra y permite editar el campo "Mes de liquidación"
- Si la fuente actual es `FUENTE`: el campo no aparece
- **Al cambiar fuente de `FUENTE_TC` → `FUENTE`:** el campo se oculta y `mes_liquidacion` se borra en el guardado
- **Al cambiar fuente de `FUENTE` → `FUENTE_TC`:** el campo aparece vacío (sin default, obligatorio)
- Transacciones viejas sin `mes_liquidacion` que tengan fuente `FUENTE_TC` (post-reclasificación): el campo aparece vacío y debe completarse antes de guardar

### 4. Filtrado por mes (todas las vistas)

Función auxiliar `getMesLiquidacion(t)` que centraliza la lógica:

**Firma:** retorna `{ year: number, month: number }` con `month` en base 1 (enero = 1).

```
si t.mes_liquidacion existe y es válido (/^\d{4}-\d{2}$/) → parsear como año y mes
sino → parsear t.fecha via new Date(t.fecha + "T12:00:00")
```

> Las transacciones `FUENTE_TC` sin `mes_liquidacion` (anteriores a esta feature) también usan `t.fecha` como fallback. Esto es una limitación conocida: no se migran automáticamente.

Esta función reemplaza el acceso directo a `t.fecha` en todos los filtros. Nota: `cargarAnual()` tiene múltiples usos de `t.fecha` (agrupación por mes, filtro por año, cálculo de gráficos) — cada uno usado para mes/año debe reemplazarse; los usos solo de display (`fmtFecha`) se mantienen.

- `filtrarTabla()` (Transacciones)
- `cargarPresupuesto()` / `cargarMimes()` (Mi mes)
- `cargarCompartidos()` (Compartidos)
- `cargarResumenMes()` (Resumen)
- `cargarAnual()` (Anual — múltiples sitios)

### 5. Tabla de Transacciones

- La columna de fecha sigue mostrando `t.fecha` (fecha real)
- **Obligatorio:** cuando `mes_liquidacion` existe y su mes/año difiere del mes de `fecha`, mostrar una sub-etiqueta debajo de la fecha con el texto `"Liq. [mes abreviado] [año]"` (ej: "Liq. abr 2026") en texto pequeño y color muted
- El selector de filtro de fuente (`fil-fuente`) incluye fuentes de ambos tipos (`FUENTE` y `FUENTE_TC`) — la lista combinada se construye como `[...categFuentes, ...categFuentesTC]`

---

## Backend (Supabase)

### Prerequisito: cambio de schema

**Antes de desplegar cualquier cambio en el frontend**, agregar la columna en Supabase:

```sql
ALTER TABLE transacciones ADD COLUMN mes_liquidacion TEXT DEFAULT NULL;
```

### Tabla `categorias`

- Insertar filas con `tipo = 'FUENTE_TC'` para cada tarjeta de crédito (mismo patrón que `FUENTE`)
- `supabaseClient.from('categorias').select('*')` ya devuelve todas las filas — el frontend diferencia por el campo `tipo`
- Agregar global `categFuentesTC = []` paralelo a `categFuentes`, populado en `cargarCategorias()`:
  ```js
  categFuentesTC = data.filter(r => r.tipo === 'FUENTE_TC').map(r => r.valor);
  ```
- Las operaciones de insert/delete siguen el mismo patrón que `FUENTE`

### Tabla `transacciones`

- La columna `mes_liquidacion` (nullable) ya se incluye automáticamente en el `SELECT *` de `getTransacciones`
- `guardarTransaccion()`: agregar `mes_liquidacion` al objeto de insert (o `null` si no aplica)
- `guardarEdicionTransaccion()`: agregar `mes_liquidacion` al objeto `.update()` en Supabase

---

## Alcance

### Incluido
- Clasificación de fuentes como TC o pago inmediato (toggle en config)
- Campo `mes_liquidacion` en formulario de nueva/edición de transacción (solo para TC)
- Lógica de filtrado centralizada con `getMesLiquidacion(t)` usada en todas las vistas
- Reclasificación manual de fuentes existentes por el usuario

### Excluido
- Migración automática de transacciones existentes (se usan como están, fecha como antes)
- Auto-detección de fecha de cierre a partir del PDF
- Registro de cierres reales por período (calendario de cierres)
- Cuotas automáticas (ingresar una compra y que genere N filas)

---

## Criterios de éxito

- El usuario puede marcar "Galicia VISA" (u otras tarjetas existentes) como `FUENTE_TC` desde Categorías
- Al crear un gasto con fuente TC, aparece el selector "Mes de liquidación" y el gasto se guarda con ese campo
- Al filtrar por abril 2026, aparecen las transacciones TC con `mes_liquidacion = "2026-04"`, aunque `fecha` sea enero
- Las transacciones existentes (sin `mes_liquidacion`) siguen filtrando por `fecha` sin cambios
- `getMesLiquidacion(t)` es la única fuente de verdad para asignación de mes en todas las vistas
- Una transacción TC con `mes_liquidacion = "2026-04"` y `fecha = "2026-01-15"` aparece **solo en abril** en Transacciones, Mi mes, Compartidos, Resumen y Anual — la fecha real (enero) es puramente informativa en la columna de fecha; nunca contribuye a totales, KPIs ni gráficos de otro mes
