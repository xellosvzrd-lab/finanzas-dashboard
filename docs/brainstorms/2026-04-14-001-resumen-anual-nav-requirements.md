# Resumen y Anual en el Nav Principal

**Fecha:** 2026-04-14  
**Estado:** Aprobado para implementación

---

## Problema

`page-resumen` (KPIs mensuales + gráficos) y `page-anual` (análisis por año) existen en el HTML pero no tienen acceso desde el nav principal. Son las páginas de análisis más potentes del dashboard y el usuario no puede acceder a ellas sin conocer el código.

## Solución acordada

Agregar **"Resumen"** como 5to tab en el nav principal (desktop topnav + mobile bottom-nav). Dentro de `page-resumen`, agregar un botón **"Ver análisis anual →"** que navega a `page-anual`.

## Comportamiento esperado

### Navegación desktop (topnav)
```
Mi mes | Transacciones | Compartidos | Categorías | Resumen
```
- El indicador deslizante (`.topnav-indicator`) se posiciona correctamente sobre "Resumen"
- Clic en "Resumen" llama `cargarResumenMes()` y activa el tab

### Navegación mobile (bottom-nav)
- 5to ítem con ícono de gráfico de barras y label "Resumen"
- Animación `bnIconPop` al activarse (igual que los otros)
- ID: `bn-resumen`

### Botón "Ver análisis anual" en page-resumen
- Ubicación: en el `page-header` de Resumen, junto a los selectores de mes/año
- Acción: `navegarA('anual')`
- Estilo: `btn btn-ghost` (discreto, no compite con el selector)

## Cambios técnicos requeridos

### HTML
| Ubicación | Cambio |
|---|---|
| `.topnav-tabs` (~línea 1469) | Agregar 5to `<button class="nav-item">` para Resumen |
| `#bottom-nav` (~línea 1488) | Agregar `<button class="bn-item" id="bn-resumen">` con SVG de barras |
| `page-resumen` page-header | Agregar `<button onclick="navegarA('anual')">Ver análisis anual →</button>` |

### JavaScript
| Ubicación | Cambio |
|---|---|
| `_navOrder` (~línea 4485) | Agregar `resumen: 4` |
| `navMap` en `navegarA` (~línea 4518) | Agregar `resumen: 4` |
| Array de bn-ids en `navegarA` (~línea 4525) | Agregar `"bn-resumen"` |
| `bnMap` en `navegarA` (~línea 4529) | Agregar `resumen: "bn-resumen"` |
| Triggers de carga en `navegarA` (~línea 4537) | Agregar `if (pagina === "resumen") cargarResumenMes();` |

## Fuera de scope
- No cambiar el contenido de `page-resumen` ni `page-anual`
- No mover `page-anual` al nav principal (accesible solo desde Resumen)
- No cambiar el orden de los tabs existentes

## Notas
- `poblarSelectoresFecha()` ya inicializa `sel-mes-resumen` y `sel-anio-resumen` — no requiere cambios
- `cargarResumenMes()` ya es llamada por los selectores `onchange` — solo falta el trigger al navegar
