# Dashboard Unificado Multi-usuario — Requirements

**Fecha:** 2026-04-07  
**Estado:** Listo para planning  
**Repo base:** `finanzas-dashboard` (Daniel) — URL definitiva  

---

## Problema

Los dashboards de Daniel y Ama son dos archivos separados con strings y features hardcodeadas por usuario. Al migrar a un Supabase compartido, ambos usuarios acceden desde la misma base de datos, pero:

- El dashboard de Daniel muestra "Compartidos con Ama", "Ama te debe" sin importar quién está logueado
- Ama necesita features que Daniel no usa (cálculo USD×MEP en presupuesto)
- Mantener dos archivos con la misma lógica duplicada genera deuda técnica

## Goal

Un único dashboard (`finanzas-dashboard`) que detecta al usuario logueado y adapta:
- Todos los strings de nombre (USUARIO y PARTNER)
- Las opciones de responsabilidad en selects
- El feature de presupuesto USD×MEP (solo para Ama)

---

## Decisiones tomadas

| Decisión | Elección | Razón |
|---|---|---|
| Modelo de acceso | Una sola URL | Más limpio, evita confusión de qué URL usar |
| URL definitiva | `finanzas-dashboard-oncu.vercel.app` | Repo de Daniel ya tiene migración Supabase al día |
| Feature MEP | Solo para Ama | Daniel no tiene saldo USD que gestionar |

---

## Alcance

### 1. Identificación de usuario en runtime

**Mecanismo:** `supabaseSession.user.user_metadata.nombre`

- `USUARIO` pasa de `const` hardcodeado a `let` que se asigna al detectar sesión
- `PARTNER` se deriva: `USUARIO === "Daniel" ? "Ama" : "Daniel"`
- Requiere paso manual previo: setear `{ "nombre": "Daniel" }` y `{ "nombre": "Ama" }` en user_metadata de cada cuenta en el dashboard de Supabase

### 2. Strings dinámicos

Reemplazar todas las ocurrencias hardcodeadas en el HTML y JS:

| Hardcodeado | Dinámico |
|---|---|
| `"Compartidos con Ama"` | `"Compartidos con " + PARTNER` |
| `"Ama te debe"` | `PARTNER + " te debe"` |
| `"vos le debés a Ama"` | `"vos le debés a " + PARTNER` |
| `"De Ama"` en selects/filtros | `"De " + PARTNER` |
| Opción `"De Ama"` en select responsabilidad | `"De " + PARTNER` |

### 3. Constantes dinámicas por usuario

```
categResponsabilidad = ["Mío", "Compartido", "De " + PARTNER]

// Solo para Daniel:
CATS_INGRESO_REAL = ["Sueldo", "Otros Ingresos"]

// Solo para Ama:
CATS_INGRESO_ARS = ["Sueldo", "Otros Ingresos", "Intereses"]
CATS_EXCLUIR     = ["Cambio"]
```

### 4. Feature MEP (condicional para Ama)

Portar desde `finanzas-dashboard-ama`:

- Variable global `tipoCambioMEP = null`
- Función `fetchTipoCambioMEP()` que consulta `dolarapi.com/v1/dolares/bolsa`
- Se llama al abrir la pestaña Presupuesto (solo si `USUARIO === "Ama"`)
- `sueldoEfectivo` en presupuesto:
  - Daniel: `sueldo` (ARS puro, sin conversión)
  - Ama: `sueldo + (saldoUSD * tipoCambioMEP)`
- Sub-label del KPI "Disponible real" muestra desglose USD×MEP solo para Ama
- En `cargarResumenMes`: `_salBase` usa la misma lógica condicional

---

## Fuera de alcance

- Tema claro/oscuro — no se toca en esta iteración (Daniel queda dark-only)
- Repo de Ama (`finanzas-dashboard-ama`) — se deja como está, Ama usa la URL de Daniel
- Terceros usuarios — la lógica Daniel/Ama es suficiente, no se abstrae para N usuarios

---

## Pasos manuales previos a la implementación

1. En Supabase → Authentication → Users → click en Daniel → Edit → agregar en Raw User Meta Data:
   ```json
   { "nombre": "Daniel" }
   ```
2. Mismo para Ama:
   ```json
   { "nombre": "Ama" }
   ```

---

## Criterios de éxito

- Daniel abre el dashboard, ve "Compartidos con Ama", "Ama te debe", select con "De Ama"
- Ama abre el mismo URL, ve "Compartidos con Daniel", "Daniel te debe", select con "De Daniel"
- El presupuesto de Ama muestra el KPI USD×MEP; el de Daniel no lo muestra
- El GitHub Actions validate.yml sigue pasando
