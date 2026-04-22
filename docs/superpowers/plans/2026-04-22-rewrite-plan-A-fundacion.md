# Rewrite Plan A — Fundación (Scaffold + Auth + Finance Logic)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold el nuevo proyecto Vite+React+TS con auth Supabase funcional, routing básico, y la lógica financiera pura (`lib/finance.ts`) con unit tests completos.

**Architecture:** Nuevo repo separado del `index.html` actual. Auth via Supabase `onAuthStateChange`. Lógica financiera extraída como funciones puras testeables con Vitest. El `index.html` original permanece en prod sin cambios durante todo este plan.

**Tech Stack:** Vite 6, React 19, TypeScript, React Router v7, Zustand, TanStack Query v5, Supabase JS v2, Vitest, CSS Modules.

---

## Archivos que se crean en este plan

```
finanzas-dashboard-v2/          ← nuevo directorio (hermano de finanzas-dashboard-live)
  src/
    api/
      supabase.ts               ← cliente tipado singleton
      transactions.ts           ← getAll, insert, remove
      categories.ts             ← getAll, insert, remove
      budget.ts                 ← get, save
    lib/
      finance.ts                ← computeNetByCategory, esTransferencia, getMesLiquidacion
      format.ts                 ← fmt, fmtMoneda, fmtFecha, fmtShort
    stores/
      authStore.ts              ← session, USUARIO, PARTNER, CATS_INGRESO_REAL
      uiStore.ts                ← filters, sort, modals, disclosure (skeleton)
    types/
      supabase.ts               ← generado por supabase CLI
      domain.ts                 ← Transaction, Category, Budget wrappers
    pages/
      LoginPage.tsx             ← formulario email+password
      PresupuestoPage.tsx       ← placeholder "Presupuesto — coming soon"
      TransaccionesPage.tsx     ← placeholder
      CompartidosPage.tsx       ← placeholder
      ConfigPage.tsx            ← placeholder
      ImportPage.tsx            ← placeholder
    components/
      layout/
        AppLayout.tsx           ← TopNav + BottomNav + <Outlet>
        TopNav.tsx              ← 4 tabs desktop
        BottomNav.tsx           ← 4 tabs mobile
        AuthGuard.tsx           ← redirige a /login si no hay sesión
    App.tsx                     ← router con rutas
    main.tsx                    ← mount point
    index.css                   ← variables CSS (copiadas de index.html)
  tests/
    lib/
      finance.test.ts           ← unit tests computeNetByCategory
      format.test.ts            ← unit tests fmt, fmtFecha
  package.json
  vite.config.ts
  tsconfig.json
  .env.local                    ← VITE_SUPABASE_URL + VITE_SUPABASE_KEY
```

---

## Task 1: Scaffold Vite + React + TS

**Files:**
- Create: `../finanzas-dashboard-v2/` (directorio raíz del nuevo proyecto)
- Create: `../finanzas-dashboard-v2/package.json`
- Create: `../finanzas-dashboard-v2/vite.config.ts`
- Create: `../finanzas-dashboard-v2/tsconfig.json`

- [ ] **Step 1.1: Crear proyecto con Vite**

Correr desde el directorio padre de `finanzas-dashboard-live`:
```bash
cd ~/Documents/ProyectosClaude
npm create vite@latest finanzas-dashboard-v2 -- --template react-ts
cd finanzas-dashboard-v2
npm install
```

- [ ] **Step 1.2: Instalar dependencias**

```bash
npm install @supabase/supabase-js@2 \
  react-router-dom@7 \
  @tanstack/react-query@5 \
  @tanstack/react-virtual@3 \
  zustand@5 \
  zod@3 \
  chart.js@4 \
  react-chartjs-2@5 \
  react-chartjs-2

npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 1.3: Configurar Vitest en vite.config.ts**

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
  },
})
```

- [ ] **Step 1.4: Crear tests/setup.ts**

```typescript
// tests/setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 1.5: Agregar scripts en package.json**

En `package.json`, asegurarse que scripts incluya:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

- [ ] **Step 1.6: Verificar que el scaffold funciona**

```bash
npm run dev
```
Esperado: Vite dev server en http://localhost:5173, página default de React.

- [ ] **Step 1.7: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Vite + React 19 + TypeScript + Vitest"
```

---

## Task 2: Variables de entorno y tipos Supabase

**Files:**
- Create: `src/types/supabase.ts`
- Create: `src/types/domain.ts`
- Create: `.env.local`

- [ ] **Step 2.1: Crear .env.local**

```bash
cat > .env.local << 'EOF'
VITE_SUPABASE_URL=https://eutarjfnlkcehhigqqxr.supabase.co
VITE_SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1dGFyamZubGtjZWhoaWdxcXhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MTA0MTQsImV4cCI6MjA5MTA4NjQxNH0._7-AO_9_12PumXjDfcAWkgKyS4s_kXZTxb8EKSdxlAg
EOF
```

Agregar `.env.local` al `.gitignore`.

- [ ] **Step 2.2: Instalar Supabase CLI y generar tipos**

```bash
npx supabase gen types typescript \
  --project-id eutarjfnlkcehhigqqxr \
  > src/types/supabase.ts
```

Esperado: archivo con interfaces `Database`, `Tables<'transacciones'>`, etc.

- [ ] **Step 2.3: Crear src/types/domain.ts**

```typescript
// src/types/domain.ts
import type { Tables } from './supabase'

export type Transaction = Tables<'transacciones'>
export type Category = Tables<'categorias'>
export type Budget = Tables<'presupuesto'>

// Valores canónicos de responsabilidad
export type Responsabilidad = 'Mío' | 'Compartido' | 'De Ama' | 'De Daniel'
export type Moneda = 'ARS' | 'USD'
export type TipoTransaccion = 'Gasto' | 'Ingreso'
```

- [ ] **Step 2.4: Commit**

```bash
git add src/types/ .env.local .gitignore
git commit -m "chore: Supabase types generados + domain types"
```

---

## Task 3: Cliente Supabase y API layer

**Files:**
- Create: `src/api/supabase.ts`
- Create: `src/api/transactions.ts`
- Create: `src/api/categories.ts`
- Create: `src/api/budget.ts`

- [ ] **Step 3.1: Crear src/api/supabase.ts**

```typescript
// src/api/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_KEY as string

export const supabase = createClient<Database>(url, key)
```

- [ ] **Step 3.2: Crear src/api/transactions.ts**

```typescript
// src/api/transactions.ts
import { supabase } from './supabase'
import type { Transaction } from '../types/domain'

export async function getTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transacciones')
    .select('*')
    .order('fecha', { ascending: false })
  if (error) throw error
  return data
}

export async function insertTransaction(
  tx: Omit<Transaction, 'id'> & { id?: string }
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transacciones')
    .insert(tx)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from('transacciones')
    .delete()
    .eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 3.3: Crear src/api/categories.ts**

```typescript
// src/api/categories.ts
import { supabase } from './supabase'
import type { Category } from '../types/domain'

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .order('valor')
  if (error) throw error
  return data
}

export async function insertCategory(
  cat: Omit<Category, 'id'>
): Promise<Category> {
  const { data, error } = await supabase
    .from('categorias')
    .insert(cat)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('categorias')
    .delete()
    .eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 3.4: Crear src/api/budget.ts**

```typescript
// src/api/budget.ts
import { supabase } from './supabase'
import type { Budget } from '../types/domain'

export async function getBudget(
  userId: string,
  year: number,
  month: number
): Promise<Budget[]> {
  const mes = String(month).padStart(2, '0')
  const { data, error } = await supabase
    .from('presupuesto')
    .select('*')
    .eq('user_id', userId)
    .eq('anio', year)
    .eq('mes', mes)
  if (error) throw error
  return data
}

export async function upsertBudget(items: Budget[]): Promise<void> {
  const { error } = await supabase
    .from('presupuesto')
    .upsert(items)
  if (error) throw error
}
```

- [ ] **Step 3.5: Verificar que TypeScript compila sin errores**

```bash
npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 3.6: Commit**

```bash
git add src/api/
git commit -m "feat: Supabase API layer — transactions, categories, budget"
```

---

## Task 4: Auth store (Zustand)

**Files:**
- Create: `src/stores/authStore.ts`

- [ ] **Step 4.1: Crear src/stores/authStore.ts**

```typescript
// src/stores/authStore.ts
import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'

const CATS_INGRESO_DANIEL = ['Sueldo', 'Otros Ingresos']
const CATS_INGRESO_AMA    = ['Sueldo', 'Otros Ingresos', 'Intereses']

interface AuthState {
  session: Session | null
  usuario: string
  partner: string
  catsIngresoReal: string[]
  setSession: (session: Session | null) => void
  setUsuario: (nombre: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  usuario: '',
  partner: '',
  catsIngresoReal: CATS_INGRESO_DANIEL,

  setSession: (session) => set({ session }),

  setUsuario: (nombre) => {
    const partner = nombre === 'Daniel' ? 'Ama' : 'Daniel'
    const catsIngresoReal = nombre === 'Ama'
      ? CATS_INGRESO_AMA
      : CATS_INGRESO_DANIEL
    set({ usuario: nombre, partner, catsIngresoReal })
  },

  clearAuth: () => {
    // Limpiar localStorage al logout
    Object.keys(localStorage)
      .filter((k) => k.startsWith('fp_'))
      .forEach((k) => localStorage.removeItem(k))
    set({ session: null, usuario: '', partner: '', catsIngresoReal: CATS_INGRESO_DANIEL })
  },
}))
```

- [ ] **Step 4.2: Commit**

```bash
git add src/stores/authStore.ts
git commit -m "feat: authStore con Zustand — usuario, partner, clearAuth"
```

---

## Task 5: UI store skeleton (Zustand)

**Files:**
- Create: `src/stores/uiStore.ts`

- [ ] **Step 5.1: Crear src/stores/uiStore.ts**

```typescript
// src/stores/uiStore.ts
import { create } from 'zustand'

const now = new Date()

interface Filters {
  mes: number
  anio: number
  tipo: 'Gasto' | 'Ingreso' | ''
  fuente: string
  resp: string
  buscar: string
  cats: string[]
}

interface SortState {
  col: string
  dir: 'asc' | 'desc'
}

interface UIState {
  filters: Filters
  sort: SortState
  editandoId: string | null
  disclosureMimes: boolean
  disclosureCompartidos: boolean
  setFilters: (partial: Partial<Filters>) => void
  setSort: (sort: SortState) => void
  setEditando: (id: string | null) => void
  setDisclosure: (key: 'mimes' | 'compartidos', value: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  filters: {
    mes: now.getMonth() + 1,
    anio: now.getFullYear(),
    tipo: 'Gasto',
    fuente: '',
    resp: '',
    buscar: '',
    cats: [],
  },
  sort: { col: 'fecha', dir: 'desc' },
  editandoId: null,
  disclosureMimes: true,
  disclosureCompartidos: false,

  setFilters: (partial) =>
    set((s) => ({ filters: { ...s.filters, ...partial } })),
  setSort: (sort) => set({ sort }),
  setEditando: (id) => set({ editandoId: id }),
  setDisclosure: (key, value) =>
    set(key === 'mimes'
      ? { disclosureMimes: value }
      : { disclosureCompartidos: value }),
}))
```

- [ ] **Step 5.2: Commit**

```bash
git add src/stores/uiStore.ts
git commit -m "feat: uiStore skeleton — filtros, sort, disclosure"
```

---

## Task 6: lib/format.ts

**Files:**
- Create: `src/lib/format.ts`
- Create: `tests/lib/format.test.ts`

- [ ] **Step 6.1: Escribir tests primero (TDD)**

```typescript
// tests/lib/format.test.ts
import { describe, it, expect } from 'vitest'
import { fmt, fmtMoneda, fmtFecha, fmtShort } from '../../src/lib/format'

describe('fmt', () => {
  it('formatea ARS con separadores argentinos', () => {
    expect(fmt(1234.56)).toBe('$\u202F1.234,56')
    // Nota: usa non-breaking space como separador de miles en es-AR
  })
  it('formatea cero', () => {
    expect(fmt(0)).toBe('$\u202F0,00')
  })
  it('formatea negativos', () => {
    expect(fmt(-500)).toContain('500')
  })
})

describe('fmtMoneda', () => {
  it('ARS usa fmt normal', () => {
    expect(fmtMoneda(1000, 'ARS')).toContain('1.000')
  })
  it('USD usa formato U$S', () => {
    expect(fmtMoneda(100, 'USD')).toBe('U$S 100,00')
  })
})

describe('fmtShort', () => {
  it('miles', () => {
    expect(fmtShort(1200)).toBe('$1,2k')
  })
  it('millones', () => {
    expect(fmtShort(1500000)).toBe('$1,5M')
  })
  it('menor a mil', () => {
    expect(fmtShort(500)).toContain('500')
  })
})

describe('fmtFecha', () => {
  it('formatea YYYY-MM-DD en español', () => {
    const result = fmtFecha('2026-04-22')
    expect(result).toContain('22')
    expect(result.toLowerCase()).toContain('abr')
    expect(result).toContain('2026')
  })
  it('maneja string vacío', () => {
    expect(fmtFecha('')).toBe('—')
  })
})
```

- [ ] **Step 6.2: Correr tests — verificar que fallan**

```bash
npm test tests/lib/format.test.ts
```
Esperado: FAIL — "Cannot find module '../../src/lib/format'"

- [ ] **Step 6.3: Implementar src/lib/format.ts**

```typescript
// src/lib/format.ts
const arsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function fmt(n: number): string {
  return arsFormatter.format(n)
}

export function fmtMoneda(n: number, moneda: 'ARS' | 'USD'): string {
  if (moneda === 'USD') {
    return `U$S ${n.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
  return fmt(n)
}

export function fmtShort(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`
  if (abs >= 1_000)     return `$${(n / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}k`
  return fmt(n)
}

export function fmtFecha(s: string): string {
  if (!s) return '—'
  const d = new Date(s + 'T12:00:00')
  return dateFormatter.format(d)
}
```

- [ ] **Step 6.4: Correr tests — verificar que pasan**

```bash
npm test tests/lib/format.test.ts
```
Esperado: PASS (4 test suites, todos verdes). Ajustar strings exactos del formatter si el entorno usa separadores ligeramente distintos.

- [ ] **Step 6.5: Commit**

```bash
git add src/lib/format.ts tests/lib/format.test.ts
git commit -m "feat: lib/format.ts — fmt, fmtMoneda, fmtShort, fmtFecha con tests"
```

---

## Task 7: lib/finance.ts — lógica financiera pura

Este es el core del plan. Reemplaza las 5 copias duplicadas de `computeNetByCategory` del `index.html` original.

**Files:**
- Create: `src/lib/finance.ts`
- Create: `tests/lib/finance.test.ts`

- [ ] **Step 7.1: Escribir tests primero (TDD)**

Los fixtures están basados en el comportamiento documentado en el `index.html` original (sección 14 de CLAUDE.md).

```typescript
// tests/lib/finance.test.ts
import { describe, it, expect } from 'vitest'
import {
  computeNetByCategory,
  esTransferencia,
  getMesLiquidacion,
  parsearDecimal,
} from '../../src/lib/finance'
import type { Transaction } from '../../src/types/domain'

// Helper para crear transacciones de test
function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    fecha: '2026-04-01',
    tipo: 'Gasto',
    categoria: 'Alimentación',
    monto: 1000,
    descripcion: '',
    usuario: 'Daniel',
    responsabilidad: 'Mío',
    fuente: 'Débito',
    moneda: 'ARS',
    mes_liquidacion: null,
    user_id: 'user-daniel',
    ...overrides,
  } as Transaction
}

describe('computeNetByCategory', () => {
  const params = { user: 'Daniel', partner: 'Ama', month: 4, year: 2026 }

  it('gasto Mío cuenta 100%', () => {
    const txs = [makeTx({ categoria: 'Comida', monto: 1000, responsabilidad: 'Mío' })]
    const result = computeNetByCategory(txs, params)
    expect(result['Comida']).toBe(1000)
  })

  it('gasto Compartido cuenta 50%', () => {
    const txs = [makeTx({ categoria: 'Alquiler', monto: 2000, responsabilidad: 'Compartido' })]
    const result = computeNetByCategory(txs, params)
    expect(result['Alquiler']).toBe(1000)
  })

  it('gasto De Ama cuenta 0% para Daniel', () => {
    // Daniel lo pagó por Ama — 0% costo de Daniel (Ama le debe)
    const txs = [makeTx({ categoria: 'Salud', monto: 500, responsabilidad: 'De Ama' })]
    const result = computeNetByCategory(txs, params)
    expect(result['Salud'] ?? 0).toBe(0)
  })

  it('gasto De Daniel (Ama lo pagó) cuenta 100% para Daniel', () => {
    const txs = [
      makeTx({ categoria: 'Ropa', monto: 800, responsabilidad: 'De Daniel', usuario: 'Ama' }),
    ]
    const result = computeNetByCategory(txs, params)
    expect(result['Ropa']).toBe(800)
  })

  it('ingreso Mío reduce el neto de la categoría', () => {
    const txs = [
      makeTx({ categoria: 'Sueldo', tipo: 'Ingreso', monto: 5000, responsabilidad: 'Mío' }),
      makeTx({ categoria: 'Comida', monto: 2000, responsabilidad: 'Mío' }),
    ]
    const result = computeNetByCategory(txs, params)
    expect(result['Comida']).toBe(2000)
    expect(result['Sueldo']).toBeLessThanOrEqual(0) // ingreso es negativo en net
  })

  it('neto nunca es negativo por categoría (Math.max 0)', () => {
    const txs = [
      makeTx({ categoria: 'Comida', monto: 100, responsabilidad: 'Mío' }),
      makeTx({ categoria: 'Comida', tipo: 'Ingreso', monto: 500, responsabilidad: 'Mío' }),
    ]
    const result = computeNetByCategory(txs, params)
    expect(result['Comida']).toBe(0)
  })

  it('filtra por mes y año', () => {
    const txs = [
      makeTx({ categoria: 'Comida', monto: 1000, fecha: '2026-04-15' }),
      makeTx({ categoria: 'Comida', monto: 999, fecha: '2026-03-15' }), // mes anterior
    ]
    const result = computeNetByCategory(txs, params)
    expect(result['Comida']).toBe(1000) // solo el de abril
  })

  it('excluye moneda USD del cálculo ARS', () => {
    const txs = [
      makeTx({ categoria: 'Comida', monto: 1000, moneda: 'ARS' }),
      makeTx({ categoria: 'Comida', monto: 50, moneda: 'USD' }),
    ]
    const result = computeNetByCategory(txs, params)
    expect(result['Comida']).toBe(1000) // USD no se suma sin conversión
  })
})

describe('esTransferencia', () => {
  it('Internas es transferencia', () => {
    expect(esTransferencia('Internas')).toBe(true)
  })
  it('Alimentación no es transferencia', () => {
    expect(esTransferencia('Alimentación')).toBe(false)
  })
  it('case insensitive', () => {
    expect(esTransferencia('internas')).toBe(true)
  })
})

describe('getMesLiquidacion', () => {
  it('retorna mes de la fecha si no hay mes_liquidacion', () => {
    const tx = makeTx({ fecha: '2026-04-15', mes_liquidacion: null })
    expect(getMesLiquidacion(tx)).toBe('2026-04')
  })
  it('retorna mes_liquidacion si existe', () => {
    const tx = makeTx({ fecha: '2026-03-15', mes_liquidacion: '2026-04' })
    expect(getMesLiquidacion(tx)).toBe('2026-04')
  })
})

describe('parsearDecimal', () => {
  it('acepta punto', () => {
    expect(parsearDecimal('1234.56')).toBe(1234.56)
  })
  it('acepta coma argentina', () => {
    expect(parsearDecimal('1234,56')).toBe(1234.56)
  })
  it('retorna 0 para vacío', () => {
    expect(parsearDecimal('')).toBe(0)
  })
  it('retorna 0 para null/undefined', () => {
    expect(parsearDecimal(null as unknown as string)).toBe(0)
  })
})
```

- [ ] **Step 7.2: Correr tests — verificar que fallan**

```bash
npm test tests/lib/finance.test.ts
```
Esperado: FAIL — "Cannot find module '../../src/lib/finance'"

- [ ] **Step 7.3: Implementar src/lib/finance.ts**

```typescript
// src/lib/finance.ts
import type { Transaction } from '../types/domain'

const CATS_TRANSFERENCIA = ['internas']

export function esTransferencia(categoria: string): boolean {
  return CATS_TRANSFERENCIA.includes(categoria.toLowerCase())
}

export function parsearDecimal(val: string | number | null | undefined): number {
  return parseFloat(String(val ?? 0).replace(',', '.')) || 0
}

export function getMesLiquidacion(tx: Transaction): string {
  if (tx.mes_liquidacion && /^\d{4}-(0[1-9]|1[0-2])$/.test(tx.mes_liquidacion)) {
    return tx.mes_liquidacion
  }
  return tx.fecha.slice(0, 7) // YYYY-MM
}

interface SummaryParams {
  user: string
  partner: string
  month: number
  year: number
}

interface CategoryBuckets {
  gastoMio: number
  ingMio: number
  gastoComp: number
  ingComp: number
  gastoDe: number    // gasto "De [partner]" pagado por partner, costo 100% para user
  ingDe: number
  gastoDeOtro: number // gasto "De [user]" pagado por user, costo 0% para user
  ingDeOtro: number
}

export function computeNetByCategory(
  transactions: Transaction[],
  { user, partner, month, year }: SummaryParams
): Record<string, number> {
  const mesStr = `${year}-${String(month).padStart(2, '0')}`
  const deUser = `De ${user}`
  const dePartner = `De ${partner}`

  // Filtrar por mes efectivo (usando mes_liquidacion para TC)
  const txsMes = transactions.filter((t) => {
    const mesEfectivo = getMesLiquidacion(t)
    return mesEfectivo === mesStr && t.moneda === 'ARS' && !esTransferencia(t.categoria)
  })

  // Acumular por categoría
  const buckets: Record<string, CategoryBuckets> = {}

  for (const t of txsMes) {
    const cat = t.categoria
    if (!buckets[cat]) {
      buckets[cat] = {
        gastoMio: 0, ingMio: 0,
        gastoComp: 0, ingComp: 0,
        gastoDe: 0, ingDe: 0,
        gastoDeOtro: 0, ingDeOtro: 0,
      }
    }

    const b = buckets[cat]
    const monto = t.monto
    const isGasto = t.tipo === 'Gasto'
    const resp = t.responsabilidad

    if (resp === 'Mío') {
      // Transacciones propias del usuario
      if (t.usuario === user) {
        isGasto ? (b.gastoMio += monto) : (b.ingMio += monto)
      }
    } else if (resp === 'Compartido') {
      isGasto ? (b.gastoComp += monto) : (b.ingComp += monto)
    } else if (resp === dePartner) {
      // Partner lo pagó pero es gasto de user — 100% costo user
      if (t.usuario === partner) {
        isGasto ? (b.gastoDe += monto) : (b.ingDe += monto)
      }
    } else if (resp === deUser) {
      // User lo pagó pero es gasto de partner — 0% costo user
      if (t.usuario === user) {
        isGasto ? (b.gastoDeOtro += monto) : (b.ingDeOtro += monto)
      }
    }
  }

  // Calcular neto por categoría
  const result: Record<string, number> = {}
  for (const [cat, b] of Object.entries(buckets)) {
    const netoMio    = Math.max(0, b.gastoMio    - b.ingMio)
    const netoComp   = Math.max(0, b.gastoComp   - b.ingComp) * 0.5
    const netoDe     = Math.max(0, b.gastoDe     - b.ingDe)
    // gastoDeOtro: user pagó pero 0% costo → no suma
    const total = netoMio + netoComp + netoDe
    if (total !== 0) result[cat] = total
  }

  return result
}
```

- [ ] **Step 7.4: Correr tests — verificar que pasan**

```bash
npm test tests/lib/finance.test.ts
```
Esperado: PASS (todos los tests verdes). Si alguno falla, revisar la lógica de responsabilidad contra CLAUDE.md sección 14.

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/finance.ts tests/lib/finance.test.ts
git commit -m "feat: lib/finance.ts — computeNetByCategory con 9 unit tests"
```

---

## Task 8: Auth flow — LoginPage + AuthGuard

**Files:**
- Create: `src/pages/LoginPage.tsx`
- Create: `src/components/layout/AuthGuard.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 8.1: Crear src/pages/LoginPage.tsx**

```tsx
// src/pages/LoginPage.tsx
import { useState } from 'react'
import { supabase } from '../api/supabase'
import { useAuthStore } from '../stores/authStore'

export function LoginPage() {
  const [email, setEmail]       = useState(localStorage.getItem('fp_sb_email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { setSession, setUsuario } = useAuthStore()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    localStorage.setItem('fp_sb_email', email)
    setSession(data.session)

    const nombre = data.session?.user.user_metadata?.nombre as string | undefined
    if (nombre) setUsuario(nombre)
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: 320 }}>
        <h1>💰 Finanzas</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p style={{ color: 'var(--red)' }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar →'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 8.2: Crear src/components/layout/AuthGuard.tsx**

```tsx
// src/components/layout/AuthGuard.tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../api/supabase'
import { useAuthStore } from '../../stores/authStore'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, setSession, setUsuario } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    // Restaurar sesión existente
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        setSession(s)
        const nombre = s.user.user_metadata?.nombre as string | undefined
        if (nombre) setUsuario(nombre)
      } else {
        navigate('/login')
      }
    })

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) navigate('/login')
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!session) return null
  return <>{children}</>
}
```

- [ ] **Step 8.3: Crear páginas placeholder**

```tsx
// src/pages/PresupuestoPage.tsx
export function PresupuestoPage() {
  return <div style={{ padding: '2rem' }}><h2>Mi mes — coming in Plan B</h2></div>
}

// src/pages/TransaccionesPage.tsx
export function TransaccionesPage() {
  return <div style={{ padding: '2rem' }}><h2>Transacciones — coming in Plan B</h2></div>
}

// src/pages/CompartidosPage.tsx
export function CompartidosPage() {
  return <div style={{ padding: '2rem' }}><h2>Compartidos — coming in Plan C</h2></div>
}

// src/pages/ConfigPage.tsx
export function ConfigPage() {
  return <div style={{ padding: '2rem' }}><h2>Categorías — coming in Plan C</h2></div>
}
```

- [ ] **Step 8.4: Crear src/App.tsx con routing**

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthGuard } from './components/layout/AuthGuard'
import { LoginPage } from './pages/LoginPage'
import { PresupuestoPage } from './pages/PresupuestoPage'
import { TransaccionesPage } from './pages/TransaccionesPage'
import { CompartidosPage } from './pages/CompartidosPage'
import { ConfigPage } from './pages/ConfigPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 min
      gcTime:   30 * 60 * 1000,   // 30 min
    },
  },
})

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div style={{ paddingBottom: '62px' }}>
        {children}
      </div>
    </AuthGuard>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/presupuesto" element={<AppLayout><PresupuestoPage /></AppLayout>} />
          <Route path="/transacciones" element={<AppLayout><TransaccionesPage /></AppLayout>} />
          <Route path="/compartidos" element={<AppLayout><CompartidosPage /></AppLayout>} />
          <Route path="/config" element={<AppLayout><ConfigPage /></AppLayout>} />
          <Route path="*" element={<Navigate to="/presupuesto" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 8.5: Actualizar src/main.tsx**

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 8.6: Copiar variables CSS al src/index.css**

Abrir `~/Documents/ProyectosClaude/finanzas-dashboard-live/index.html` y copiar el bloque `:root { ... }` y `[data-theme="light"] { ... }` al `src/index.css`. Incluir también `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }` y las fuentes `@import` de Google Fonts.

- [ ] **Step 8.7: Verificar que el flujo de auth funciona**

```bash
npm run dev
```

1. Abrir http://localhost:5173
2. Debe redirigir a `/login`
3. Ingresar con credenciales de Daniel → debe redirigir a `/presupuesto` (placeholder)
4. Refrescar → debe mantenerse en `/presupuesto` (sesión persistida por Supabase)
5. Navegar a `/transacciones` directamente en URL → debe funcionar

- [ ] **Step 8.8: Commit**

```bash
git add src/
git commit -m "feat: auth flow — LoginPage, AuthGuard, routing skeleton con React Router v7"
```

---

## Task 9: Verificación final del Plan A

- [ ] **Step 9.1: Correr todos los tests**

```bash
npm test
```
Esperado: todos los tests de `format.test.ts` y `finance.test.ts` pasan. Sin tests fallidos.

- [ ] **Step 9.2: Verificar build de producción**

```bash
npm run build
```
Esperado: build exitoso sin errores de TypeScript.

- [ ] **Step 9.3: Verificar TypeScript estricto**

```bash
npx tsc --noEmit
```
Esperado: 0 errores.

- [ ] **Step 9.4: Commit final Plan A**

```bash
git add .
git commit -m "chore: Plan A completo — scaffold, auth, finance lib, format lib con tests"
```

---

## Entregables de Plan A

Al terminar este plan, el nuevo proyecto tiene:
- ✅ Scaffold Vite+React+TS funcionando
- ✅ Supabase typed client conectado
- ✅ Auth flow completo (login, sesión persistida, logout)
- ✅ Routing con React Router v7 (URLs funcionan, back-button funciona)
- ✅ `lib/finance.ts` — lógica financiera pura con 9 unit tests
- ✅ `lib/format.ts` — formateo con unit tests
- ✅ Stores Zustand (auth + UI skeleton)
- ✅ Páginas placeholder para Plan B y Plan C

**Siguiente paso:** Plan B — PresupuestoPage + TransaccionesPage con feature parity completa.
