// lib.jsx — sample data (es-AR) + minimal stroke icons
/* global React */

// ── Sample month: Junio 2026 ───────────────────────────────────
const MES = {
  label: 'Junio 2026',
  sueldo: 1950000,
  ingresos: 2180000,        // sueldo + freelance
  gastos: 1412300,
  get balance() { return this.ingresos - this.gastos; },
  ahorroPct: 35,
  mep: 1292,                // ARS por USD (MEP)
  quedaMes: 537700,         // sueldo − gastado real (Mi mes)
  diasRestantes: 12,
  get porDia() { return Math.round(this.quedaMes / this.diasRestantes); },
  // campos reales de la app
  presupuestado: 1820000,   // de tu sueldo asignado a categorías
  get margenPlaneado() { return this.sueldo - this.presupuestado; },  // 130000
  get gastadoReal() { return this.sueldo - this.quedaMes; },          // 1.412.300
  gastoCompartido: 286400,  // 50% de gastos compartidos incluidos en gastado
  ahorroAcum: 2340000,      // total acumulado en categoría Ahorro
  compartidosSaldo: -23400, // saldo con Ama (negativo = le debés)
};

// categorías de gasto del mes — emoji + color semántico por familia
const CATS = [
  { emoji: '🏠', label: 'Alquiler',         value: 585000, pctSueldo: 30, gastado: 585000, color: 'var(--brand)' },
  { emoji: '🛒', label: 'Mercado',          value: 246800, pctSueldo: 14, gastado: 246800, color: 'var(--info)' },
  { emoji: '🍽️', label: 'Comida y salidas', value: 198400, pctSueldo: 10, gastado: 168900, color: 'var(--neg)' },
  { emoji: '🚗', label: 'Transporte',       value: 92500,  pctSueldo: 6,  gastado: 71200,  color: 'var(--save)' },
  { emoji: '💡', label: 'Servicios',        value: 144300, pctSueldo: 8,  gastado: 144300, color: 'var(--warn)' },
  { emoji: '📺', label: 'Suscripciones',    value: 38600,  pctSueldo: 3,  gastado: 38600,  color: 'var(--brand-2)' },
  { emoji: '💊', label: 'Salud',            value: 67900,  pctSueldo: 4,  gastado: 41700,  color: 'var(--pos)' },
  { emoji: '🐷', label: 'Ahorro',           value: 390000, pctSueldo: 20, gastado: 390000, color: 'var(--save)' },
];

// 12 meses (Jul 25 → Jun 26)
const YEAR = [
  { m: 'jul', inc: 1720000, exp: 1290000 },
  { m: 'ago', inc: 1760000, exp: 1410000 },
  { m: 'sep', inc: 1810000, exp: 1180000 },
  { m: 'oct', inc: 1850000, exp: 1520000 },
  { m: 'nov', inc: 1880000, exp: 1640000 },
  { m: 'dic', inc: 2340000, exp: 1980000 },
  { m: 'ene', inc: 1910000, exp: 1350000 },
  { m: 'feb', inc: 1940000, exp: 1290000 },
  { m: 'mar', inc: 1980000, exp: 1470000 },
  { m: 'abr', inc: 2020000, exp: 1380000 },
  { m: 'may', inc: 2090000, exp: 1440000 },
  { m: 'jun', inc: 2180000, exp: 1412300 },
];

// transacciones recientes
const TXN = [
  { d: '02/06', emoji: '🛒', cat: 'Mercado',     desc: 'Coto — compra semanal', src: 'Galicia VISA', who: 'Compartido', amt: -48900, cur: 'ARS', tipo: 'gasto' },
  { d: '01/06', emoji: '💼', cat: 'Sueldo',      desc: 'Sueldo junio',          src: 'Galicia',      who: 'Mío',        amt: 1950000, cur: 'ARS', tipo: 'ingreso' },
  { d: '01/06', emoji: '🏠', cat: 'Alquiler',    desc: 'Alquiler depto',        src: 'Transferencia',who: 'Compartido', amt: -585000, cur: 'ARS', tipo: 'gasto' },
  { d: '31/05', emoji: '🍽️', cat: 'Salidas',     desc: 'Cena Don Julio',        src: 'Naranja',      who: 'Mío',        amt: -62400,  cur: 'ARS', tipo: 'gasto' },
  { d: '30/05', emoji: '💻', cat: 'Freelance',   desc: 'Proyecto web',          src: 'Wise',         who: 'Mío',        amt: 480,     cur: 'USD', tipo: 'ingreso' },
  { d: '29/05', emoji: '📺', cat: 'Suscrip.',    desc: 'Spotify + Netflix',     src: 'Galicia VISA', who: 'Mío',        amt: -14800,  cur: 'ARS', tipo: 'gasto' },
  { d: '28/05', emoji: '🚗', cat: 'Transporte',  desc: 'Nafta YPF',             src: 'Naranja',      who: 'Compartido', amt: -41200,  cur: 'ARS', tipo: 'gasto' },
  { d: '27/05', emoji: '💊', cat: 'Salud',       desc: 'Farmacity',             src: 'Galicia',      who: 'De Ama',     amt: -23600,  cur: 'ARS', tipo: 'gasto' },
];

// compartidos con Ama
const SHARED = {
  balance: -23400,          // negativo = le debés a Ama
  rows: [
    { emoji: '🏠', cat: 'Alquiler',  daniel: 292500, ama: 292500, neto: 0 },
    { emoji: '🛒', cat: 'Mercado',   daniel: 88200,  ama: 35400,  neto: 26400 },
    { emoji: '🚗', cat: 'Transporte',daniel: 20600,  ama: 20600,  neto: 0 },
    { emoji: '💡', cat: 'Servicios', daniel: 31800,  ama: 72150,  neto: -40350 },
  ],
};

// inversiones
const INV = {
  plazos: [
    { banco: 'Galicia', monto: 1200000, tna: 38, vence: '18/06', dias: 15 },
    { banco: 'Mercado Pago', monto: 800000, tna: 41, vence: '02/07', dias: 29 },
  ],
  activos: [
    { emoji: '🇺🇸', t: 'CEDEAR AAPL', q: 12, val: 348000, chg: 2.4 },
    { emoji: '₿',  t: 'Bitcoin',     q: 0.018, val: 1240000, chg: -1.1 },
    { emoji: '💵', t: 'Dólar MEP',   q: 1850, val: 2390200, chg: 0.3 },
  ],
};

// cuotas activas
const CUOTAS = {
  esteMes: 86500,
  futuro: 312000,
  compras: [
    { emoji: '💻', desc: 'Notebook', cuota: '4/12', monto: 52000 },
    { emoji: '✈️', desc: 'Vuelo BRC', cuota: '2/6',  monto: 22400 },
    { emoji: '🛋️', desc: 'Sillón',    cuota: '7/9',  monto: 12100 },
  ],
};

// ── Stroke icons (UI chrome only — content uses emoji) ──────────
const Ic = ({ d, s = 18, sw = 1.8, fill = 'none' }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>{d}</svg>
);
const Icons = {
  home:   (p) => <Ic {...p} d={<><path d="M3 11l9-8 9 8" /><path d="M5 9.5V21h14V9.5" /></>} />,
  list:   (p) => <Ic {...p} d={<><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1" fill="currentColor" stroke="none"/></>} />,
  users:  (p) => <Ic {...p} d={<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6M17 20a5.2 5.2 0 0 0-3-4.7" /></>} />,
  tag:    (p) => <Ic {...p} d={<><path d="M3 3h7l11 11-7 7L3 10V3z" /><circle cx="7" cy="7" r="1.4" /></>} />,
  chart:  (p) => <Ic {...p} d={<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>} />,
  grid:   (p) => <Ic {...p} d={<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>} />,
  plus:   (p) => <Ic {...p} d={<path d="M12 5v14M5 12h14" />} />,
  search: (p) => <Ic {...p} d={<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>} />,
  bell:   (p) => <Ic {...p} d={<><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>} />,
  chevR:  (p) => <Ic {...p} d={<path d="M9 6l6 6-6 6" />} />,
  chevD:  (p) => <Ic {...p} d={<path d="M6 9l6 6 6-6" />} />,
  arrowU: (p) => <Ic {...p} d={<path d="M12 19V5M5 12l7-7 7 7" />} />,
  arrowD: (p) => <Ic {...p} d={<path d="M12 5v14M5 12l7 7 7-7" />} />,
  filter: (p) => <Ic {...p} d={<path d="M3 5h18l-7 8v6l-4 2v-8z" />} />,
  upload: (p) => <Ic {...p} d={<><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 20h16" /></>} />,
  sun:    (p) => <Ic {...p} d={<><circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v3M12 19.5v3M4.2 4.2l2 2M17.8 17.8l2 2M1.5 12h3M19.5 12h3M4.2 19.8l2-2M17.8 6.2l2-2"/></>} />,
  moon:   (p) => <Ic {...p} d={<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8z" />} />,
  wallet: (p) => <Ic {...p} d={<><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M17 15h.01"/></>} />,
  spark:  (p) => <Ic {...p} d={<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />} />,
  edit:   (p) => <Ic {...p} d={<><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></>} />,
};

Object.assign(window, { MES, CATS, YEAR, TXN, SHARED, INV, CUOTAS, Icons });
