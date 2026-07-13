# Liquidación de Compartidos — Requirements

**Fecha:** 2026-04-07  
**Estado:** Listo para planning  
**Repo:** `finanzas-dashboard` (dashboard unificado)

---

## Problema

Cuando Ama le transfiere plata a Daniel (o viceversa) para saldar gastos compartidos, hay que registrar ese movimiento real yendo manualmente a Nueva Transacción y completando todos los campos. Es fricción repetida que ocurre todos los meses por categoría.

## Goal

Agregar un botón "Liquidar" por fila en la tabla de Compartidos que pre-rellene y cree la transacción del cobro/pago real con un solo click, eligiendo solo la fuente.

---

## Concepto clave

La transacción creada **no afecta la pestaña Compartidos**. Es un registro independiente del movimiento real de dinero:

- `responsabilidad = "Mío"` → no entra en el cálculo compartido
- La tabla Compartidos sigue mostrando el balance teórico de gastos compartidos sin cambios
- Es un shortcut para evitar el viaje manual a Nueva Transacción

---

## Comportamiento

### Trigger

Cada fila de la tabla de compartidos ARS con balance distinto de cero muestra un botón **"Liquidar"** al final.

### Flujo

1. Usuario hace click en "Liquidar" de una fila
2. Aparece un selector de fuente (opciones de `categFuentes`)
3. Usuario elige fuente y confirma
4. Se crea la transacción:

| Campo | Valor |
|---|---|
| `fecha` | Último día del mes/año seleccionado en Compartidos |
| `tipo` | `"Ingreso"` si PARTNER te debe (neto positivo para vos) · `"Gasto"` si vos le debés (neto negativo) |
| `categoria` | Categoría de la fila |
| `monto` | Valor absoluto del balance ARS neto de esa categoría |
| `responsabilidad` | `"Mío"` |
| `fuente` | La seleccionada por el usuario |
| `descripcion` | `"Liquidación"` |
| `usuario` | Usuario logueado (`USUARIO`) |
| `moneda` | `"ARS"` |

5. Se muestra toast de confirmación
6. **No** se recarga Compartidos — el balance teórico no cambia

---

## Alcance

### Incluido
- Botón por fila en la tabla ARS de Compartidos
- Solo ARS
- Independiente por usuario — cada uno registra su propio movimiento

### Excluido
- Moneda USD
- Tabla de Reembolsos ("De PARTNER") — solo la tabla de Compartidos
- Modificar el cálculo del balance de Compartidos

---

## Criterios de éxito

- Daniel ve "Liquidar" en cada fila con neto ARS ≠ 0
- Click → elige fuente → transacción creada con los campos correctos
- La transacción aparece en la pestaña Transacciones con responsabilidad "Mío"
- La pestaña Compartidos no cambia tras liquidar
