---
name: Finanzas de Pareja
last_updated: 2026-07-02
---

# Finanzas de Pareja Strategy

## Target problem

Parejas que conviven y comparten gastos (a veces en más de una moneda, con sueldos distintos) hoy coordinan sus finanzas en una planilla compartida (Excel/Sheets) que cada uno edita a su manera — sin una fuente de verdad única y viva — y no existe una herramienta pensada desde cero para que dos personas lleven presupuesto, gastos con responsabilidad (Mío/Compartido/Del otro) y liquidación juntos.

## Our approach

Ganamos siendo la única herramienta que integra en un solo lugar, diseñada específicamente para pareja, el combo completo — presupuesto mensual, gastos compartidos con responsabilidad y liquidación, cuotas, inversiones y recurrentes — en vez de resolver una sola pieza (splitear gastos puntuales, o presupuesto mono-usuario). La apuesta es la integración como diferencial, no una feature aislada.

## Who it's for

**Primary:** Parejas que conviven y comparten gastos, con ingresos o aportes distintos entre sí (posiblemente en más de una moneda) - están contratando el producto para tener una única fuente de verdad viva de sus finanzas compartidas, sin pelear con versiones de una planilla.

## Key metrics

- **Parejas activas semanales** - workspaces con ambos miembros logueados y al menos una transacción cargada en la semana; mide adopción real de a dos, no solo de un miembro (Supabase).
- **Retención a 60 días** - % de workspaces nuevos que siguen activos 60 días después del alta; mide si de verdad reemplaza al Excel o es un intento abandonado (Supabase).
- **% de workspaces con ambos usuarios activos** - de las parejas activas, cuántas tienen a los dos miembros cargando datos (no solo uno); mide si el diferencial de "colaboración de pareja" se sostiene en la práctica (Supabase).
- **Costo de infra por pareja activa** - gasto Supabase + Vercel dividido por parejas activas del mes; mide si el objetivo de "que se pague solo" es alcanzable (facturación Supabase/Vercel).
- **Feedback cualitativo de las parejas piloto** - señal directa (¿lo siguen usando en vez del Excel?, ¿qué les falta?) de las primeras ~10 parejas, dado el bajo volumen inicial (conversación directa/encuesta).

## Tracks

### Multi-tenancy y aislamiento de datos

Introducir el concepto de "workspace de pareja" como unidad central del modelo de datos (hoy todo gira en torno a un usuario individual dentro de una sola instancia compartida Daniel/Ama), con RLS por workspace e invitación de partner. Iterativo sobre el código actual, sin reescritura.

_Why it serves the approach:_ Sin esta base técnica no hay producto para nadie más que Daniel y Ama; es el requisito mínimo que habilita todo lo demás sin bloquear el lanzamiento en una reescritura.

### Generalización regional

Sacar los supuestos hardcodeados de Argentina (ARS/USD, dólar MEP, formato de PDF de Galicia) y convertirlos en configuración por workspace (moneda base, fuentes de importación opcionales/desactivables).

_Why it serves the approach:_ El público objetivo son "parejas en general", no solo argentinas; sin esto el combo integrado no es usable fuera de Argentina y el mercado direccionable queda artificialmente chico.

### Onboarding y adquisición piloto

Flujo de invitación de pareja (segundo usuario se suma a un workspace existente), copy/landing que explique el ángulo diferencial (combo integrado pensado para pareja, no otra app de gastos individual), y reclutamiento manual de las primeras parejas piloto.

_Why it serves the approach:_ El objetivo de 12 meses (10 parejas o cubrir costos) depende de conseguir usuarios reales que prueben la colaboración de a dos, no solo de que el producto funcione técnicamente.

### Sustentabilidad de costos

Visibilidad de uso y costo por workspace a medida que se suman parejas (Supabase + Vercel), con límites o quotas razonables incluso en la fase gratuita.

_Why it serves the approach:_ El criterio de éxito explícito ("que pague Supabase") requiere saber desde el principio cuánto cuesta cada pareja activa, antes de que exista ningún plan pago.

## Not working on

- Reescritura completa de arquitectura (single-file HTML → React/Vite): existe un spec (`docs/superpowers/specs/2026-04-22-rewrite-react-vite-design.md`) pero se posterga hasta que el proyecto valide con usuarios reales.
- Monetización / planes pagos: primero conseguir las primeras parejas gratis; recién evaluar cobrar si el uso real lo confirma.
