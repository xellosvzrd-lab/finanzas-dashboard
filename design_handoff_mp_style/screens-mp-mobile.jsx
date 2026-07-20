// screens-mp-mobile.jsx — 4 páginas reales del repo (finanzas-dashboard-v2) con anatomía MP + verde glass
/* global React, IOSDevice, Icons, MES, CATS, TXN, CUOTAS, fmtARS, fmtUSD */

const MP_CATS = CATS.filter((c) => c.label !== 'Ahorro').map((c) => {
  const b = Math.round((c.pctSueldo / 100) * MES.sueldo);
  return { ...c, budget: b, used: Math.min(1, c.gastado / b), restante: b - c.gastado, pctReal: (c.gastado / MES.sueldo) * 100 };
});

// datos alineados al dominio real: responsabilidad Mío/Compartido/De X · fuente · fecha es-AR
const GASTOS_ROWS = [
  { tipo: 'G', cat: 'Mercado', desc: 'Coto — compra semanal', resp: 'Compartido', fuente: 'Galicia VISA', monto: -48900, mon: 'ARS', fecha: '02 jun 2026' },
  { tipo: 'I', cat: 'Sueldo', desc: 'Sueldo junio', resp: 'Mío', fuente: 'Galicia', monto: 1950000, mon: 'ARS', fecha: '01 jun 2026' },
  { tipo: 'G', cat: 'Alquiler', desc: 'Alquiler depto', resp: 'Compartido', fuente: 'Galicia', monto: -585000, mon: 'ARS', fecha: '01 jun 2026' },
  { tipo: 'G', cat: 'Comida y salidas', desc: 'Cena Don Julio', resp: 'Mío', fuente: 'Naranja X', monto: -62400, mon: 'ARS', fecha: '31 may 2026' },
  { tipo: 'I', cat: 'Freelance', desc: 'Proyecto web', resp: 'Mío', fuente: 'Wise', monto: 480, mon: 'USD', fecha: '30 may 2026' },
  { tipo: 'G', cat: 'Suscripciones', desc: 'Spotify + Netflix', resp: 'Mío', fuente: 'Galicia VISA', monto: -14800, mon: 'ARS', fecha: '29 may 2026' },
  { tipo: 'G', cat: 'Salud', desc: 'Farmacity', resp: 'De Ama', fuente: 'Galicia', monto: -23600, mon: 'ARS', fecha: '27 may 2026' },
];
const COMP_ROWS = [
  { cat: 'Alquiler', desc: 'Alquiler depto', chip: 'Pagué yo', fecha: '01 jun 2026', monto: 585000 },
  { cat: 'Mercado', desc: 'Coto — compra semanal', chip: 'Pagué yo', fecha: '02 jun 2026', monto: 48900 },
  { cat: 'Servicios', desc: 'Edesur + Metrogas', chip: 'Pagó Ama', fecha: '05 jun 2026', monto: 64300 },
  { cat: 'Transporte', desc: 'Nafta YPF', chip: 'Pagué yo', fecha: '28 may 2026', monto: 41200 },
  { cat: 'Salud', desc: 'Farmacity', chip: 'De Ama', fecha: '27 may 2026', monto: 23600 },
];
const CONFIG_GRUPOS = [
  ['Gastos', ['Alquiler', 'Mercado', 'Comida y salidas', 'Transporte', 'Servicios', 'Suscripciones', 'Salud']],
  ['Ingresos', ['Sueldo', 'Freelance']],
  ['Fuentes de pago', ['Galicia', 'Mercado Pago', 'Wise', 'Efectivo']],
  ['Fuentes con liquidación', ['Galicia VISA', 'Naranja X']],
];

const MIc = ({ d, s = 18, sw = 1.8 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>{d}</svg>
);
const MpIcons = {
  eye:  (p) => <MIc {...p} d={<><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.8" /></>} />,
  swap: (p) => <MIc {...p} d={<><path d="M7 4v13M3.5 7.5 7 4l3.5 3.5" /><path d="M17 20V7M13.5 16.5 17 20l3.5-3.5" /></>} />,
  cal:  (p) => <MIc {...p} d={<><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></>} />,
  trash:(p) => <MIc {...p} d={<><path d="M4 6.5h16M9.5 6V4a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 4v2M6 6.5l1 13a1.8 1.8 0 0 0 1.8 1.5h6.4a1.8 1.8 0 0 0 1.8-1.5l1-13" /></>} />,
  copy: (p) => <MIc {...p} d={<><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>} />,
};

function MPWrap({ children }) {
  return (
    <IOSDevice width={402} height={874} dark>
      <div className="glassui" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="glass-wall" />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          <style>{`.mpcol > *{flex-shrink:0}`}</style>
          <div className="mpcol" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          {children}
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

// nav real: bottom nav 4 items + CTA central (navegarA('nueva')) — Inversiones y Resumen solo desktop
function MPNav({ active = 'mes' }) {
  const items = [['mes', 'Mi mes', MpIcons.cal], ['transac', 'Transac.', MpIcons.swap], ['add'], ['comp', 'Compart.', Icons.users], ['cat', 'Categ.', Icons.tag]];
  return (
    <div style={{ position: 'sticky', bottom: 0, marginTop: 'auto' }}>
      <div className="glass glass-strong" style={{ borderRadius: '24px 24px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '9px 10px 26px' }}>
        {items.map((it, i) => it[0] === 'add' ? (
          <div key={i} style={{ width: 52, height: 52, borderRadius: 999, marginTop: -30, background: 'linear-gradient(150deg,var(--brand),var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 20px color-mix(in oklab,var(--brand) 55%,transparent), inset 1px 1px 0 rgba(255,255,255,0.4)' }}><Icons.plus s={24} sw={2.2} /></div>
        ) : (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 64, color: it[0] === active ? 'var(--brand)' : 'var(--g-text-3)' }}>
            {React.createElement(it[2], { s: 21 })}
            <span style={{ fontSize: 10, fontWeight: 700 }}>{it[1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MPHead({ children, padBottom = 20 }) {
  return <div className="mp-head" style={{ padding: `62px 20px ${padBottom}px` }}>{children}</div>;
}

function MPGreeting({ right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <div className="mp-avatar">D</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 700 }}>Hola, Daniel</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>Junio 2026</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>{right}</div>
    </div>
  );
}

// picker Mes/Año del repo como pill
function MPPicker() {
  return <span className="mp-wpill num">Jun · 2026 <Icons.chevD s={13} /></span>;
}

function MPDonut({ segs, size = 112, thickness = 16, center }) {
  const total = segs.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2, c = 2 * Math.PI * r, gap = 3;
  let acc = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--g-hair)" strokeWidth={thickness} />
        {segs.map((s, i) => {
          const frac = s.value / total, len = Math.max(0, frac * c - gap), off = -acc * c;
          acc += frac;
          return <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeLinecap="round" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={off} />;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>{center}</div>
    </div>
  );
}

const respChip = (resp) => (
  <span style={{ fontSize: 10, fontWeight: 700, color: resp === 'Compartido' ? 'var(--brand)' : resp.startsWith('De') ? 'var(--info)' : 'var(--g-text-3)', background: resp === 'Compartido' ? 'color-mix(in oklab,var(--brand) 16%,transparent)' : resp.startsWith('De') ? 'color-mix(in oklab,var(--info) 14%,transparent)' : 'var(--g-hair)', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>{resp}</span>
);
const tipoBadge = (t) => (
  <span className="num" style={{ width: 24, height: 24, borderRadius: 8, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800, color: t === 'G' ? 'var(--neg)' : 'var(--pos)', background: t === 'G' ? 'color-mix(in oklab,var(--neg) 14%,transparent)' : 'color-mix(in oklab,var(--pos) 14%,transparent)' }}>{t}</span>
);

// ════════════════ MI MES (PresupuestoPage) ════════════════
function MiMesMP() {
  const segs = MP_CATS;
  const segTotal = segs.reduce((s, x) => s + x.gastado, 0);
  return (
    <MPWrap>
      <MPHead padBottom={64}>
        <MPGreeting right={<MPPicker />} />
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
            Saldo de junio <MpIcons.eye s={16} />
          </div>
          <div className="num" style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, marginTop: 4 }}>{fmtARS(MES.balance, { sign: true })}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <span className="mp-wpill num">↑ Ingresos {fmtARS(MES.ingresos)}</span>
            <span className="mp-wpill num">↓ Gastos {fmtARS(MES.gastos)}</span>
          </div>
        </div>
      </MPHead>

      {/* acciones = las 4 rutas reales */}
      <div className="glass glass-strong" style={{ margin: '-44px 16px 0', borderRadius: 22, padding: '15px 10px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[['Nueva', Icons.plus], ['Transac.', MpIcons.swap], ['Compartidos', Icons.users], ['Categorías', Icons.tag]].map(([label, Ic], i) => (
          <div key={i} className="mp-action"><span className="ico">{React.createElement(Ic, { s: 22 })}</span>{label}</div>
        ))}
      </div>

      {/* KPI cuotas + meta de ahorro (features reales de Mi mes) */}
      <div style={{ display: 'flex', gap: 10, margin: '12px 16px 0' }}>
        <div className="glass" style={{ flex: 1, borderRadius: 18, padding: '11px 13px' }}>
          <div style={{ fontSize: 11, fontWeight: 600 }} className="g3">💳 Cuotas del mes</div>
          <div className="num" style={{ fontSize: 16.5, fontWeight: 700, marginTop: 4 }}>{fmtARS(CUOTAS.esteMes)}</div>
        </div>
        <div className="glass" style={{ flex: 1.3, borderRadius: 18, padding: '11px 13px' }}>
          <div style={{ fontSize: 11, fontWeight: 600 }} className="g3">🎯 Meta · Vacaciones</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 6, background: 'var(--g-hair)', overflow: 'hidden' }}><div style={{ width: '60%', height: '100%', borderRadius: 6, background: 'linear-gradient(90deg,var(--brand),var(--brand-2))' }} /></div>
            <span className="num" style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--brand)' }}>60%</span>
          </div>
          <div className="num g3" style={{ fontSize: 10.5, fontWeight: 600, marginTop: 3 }}>$2,4M / $4,0M</div>
        </div>
      </div>

      {/* donut gastos por categoría */}
      <div className="glass" style={{ margin: '12px 16px 0', borderRadius: 20, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
        <MPDonut segs={segs.map((c) => ({ value: c.gastado, color: c.color }))} center={<><div style={{ fontSize: 10, fontWeight: 600 }} className="g3">Gastos</div><div className="num" style={{ fontSize: 14.5, fontWeight: 700 }}>$1,3M</div></>} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[...segs].sort((a, b) => b.gastado - a.gastado).slice(0, 4).map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              <i style={{ width: 9, height: 9, borderRadius: 3, background: c.color, flex: 'none' }} />
              <span style={{ flex: 1, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
              <span className="num g2" style={{ fontWeight: 700 }}>{Math.round(c.gastado / segTotal * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* desglose: % Presup · Gasto actual · % Real */}
      <div style={{ padding: '14px 20px 7px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.02em' }}>Ver desglose</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand)' }}>Editar presupuesto</span>
      </div>
      <div className="glass" style={{ margin: '0 16px', borderRadius: 20, overflow: 'hidden', flex: 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr 0.9fr 0.5fr', padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', borderBottom: '0.5px solid var(--g-hair)' }} className="g3">
          <div>Categoría</div><div style={{ textAlign: 'right' }}>Presup.</div><div style={{ textAlign: 'right' }}>Gasto</div><div style={{ textAlign: 'right' }}>%</div>
        </div>
        {MP_CATS.slice(0, 3).map((c, i) => {
          const over = c.gastado > c.budget;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr 0.9fr 0.5fr', alignItems: 'center', padding: '9px 14px', borderTop: i ? '0.5px solid var(--g-hair)' : 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</div>
              <div className="num g2" style={{ textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{fmtARS(c.budget)}</div>
              <div className="num" style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: over ? 'var(--neg)' : 'var(--g-text)' }}>{fmtARS(c.gastado)}</div>
              <div className="num g2" style={{ textAlign: 'right', fontSize: 12, fontWeight: 600 }}>{Math.round(c.used * 100)}%</div>
            </div>
          );
        })}
      </div>

      <MPNav active="mes" />
    </MPWrap>
  );
}

// ════════════════ TRANSACCIONES (page-transacciones) ════════════════
function TransaccionesMP() {
  return (
    <MPWrap>
      <MPHead padBottom={16}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>Transacciones</div>
          <span className="mp-wbtn" style={{ padding: '8px 15px', fontSize: 13 }}>+ Nueva</span>
        </div>
        <div style={{ marginTop: 13, display: 'flex', alignItems: 'center', gap: 9, borderRadius: 14, padding: '11px 14px', background: 'rgba(255,255,255,0.18)', border: '0.5px solid rgba(255,255,255,0.3)' }}>
          <Icons.search s={17} /><span style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>Buscar…</span>
        </div>
      </MPHead>

      {/* FilterBar real: mes/año · tipo · fuente · responsabilidad */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0', flexWrap: 'wrap' }}>
        {[['Jun · 2026', true], ['Tipo: gastos', false], ['Fuente: todas', false], ['Resp: todas', false]].map(([t, on], i) => (
          <div key={i} className="glass" style={{ borderRadius: 999, padding: '7px 13px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
            background: on ? 'color-mix(in oklab,var(--brand) 22%, transparent)' : undefined,
            color: on ? 'var(--brand)' : 'var(--g-text-2)' }}>{t} <Icons.chevD s={12} /></div>
        ))}
      </div>
      {/* barra de subtotales real (.tabla-subtotal / #sub-neto) */}
      <div className="glass" style={{ margin: '10px 16px', borderRadius: 16, padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }} className="g3">Neto del período</div>
          <div className="num" style={{ fontSize: 21, fontWeight: 800, color: 'var(--pos)' }}>{fmtARS(MES.balance, { sign: true })}</div>
        </div>
        <div className="num g3" style={{ fontSize: 11.5, fontWeight: 600, textAlign: 'right' }}>7 transac.<br /><span style={{ color: 'var(--neg)' }}>↓ $734,7k</span> · <span style={{ color: 'var(--pos)' }}>↑ $1,95M</span></div>
      </div>

      <div className="glass" style={{ margin: '0 16px', borderRadius: 20, overflow: 'hidden', flex: 'none' }}>
        {GASTOS_ROWS.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i ? '0.5px solid var(--g-hair)' : 'none' }}>
            {tipoBadge(t.tipo)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.cat}{t.desc && <span className="g3" style={{ fontWeight: 500 }}> · {t.desc}</span>}</div>
              <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }} className="g3">{t.fecha} · {t.fuente} {respChip(t.resp)}</div>
            </div>
            <div style={{ textAlign: 'right', flex: 'none' }}>
              <div className="num" style={{ fontSize: 13.5, fontWeight: 700, color: t.tipo === 'I' ? 'var(--pos)' : 'var(--g-text)' }}>{t.mon === 'USD' ? fmtUSD(t.monto) : fmtARS(t.monto, { sign: t.monto > 0 })}</div>
            </div>
          </div>
        ))}
      </div>
      <MPNav active="transac" />
    </MPWrap>
  );
}

// ════════════════ COMPARTIDOS (page-compartidos) ════════════════
function CompartidosMP() {
  return (
    <MPWrap>
      <MPHead padBottom={24}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>Compartidos</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MPPicker />
            <div style={{ display: 'flex' }}>
              <div className="mp-avatar" style={{ width: 32, height: 32, fontSize: 12.5 }}>D</div>
              <div className="mp-avatar" style={{ width: 32, height: 32, fontSize: 12.5, marginLeft: -9, background: 'rgba(255,255,255,0.35)' }}>A</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.78)' }}>Balance del mes · Le debés a Ama</div>
          <div className="num" style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 2 }}>{fmtARS(23400)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>Debés pagarle {fmtARS(23400)} a Ama</div>
        </div>
      </MPHead>

      <div style={{ padding: '14px 20px 7px', fontSize: 14, fontWeight: 700 }}>Gastos compartidos de junio</div>
      <div className="glass" style={{ margin: '0 16px', borderRadius: 20, overflow: 'hidden', flex: 'none' }}>
        {COMP_ROWS.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: i ? '0.5px solid var(--g-hair)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.cat}{r.desc && <span className="g3" style={{ fontWeight: 500 }}> · {r.desc}</span>}</div>
              <div style={{ fontSize: 11, marginTop: 2 }} className="g3">{r.fecha}</div>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
              color: r.chip === 'Pagué yo' ? 'var(--brand)' : r.chip === 'Pagó Ama' ? 'var(--brand-2)' : 'var(--info)',
              background: r.chip === 'Pagué yo' ? 'color-mix(in oklab,var(--brand) 15%,transparent)' : r.chip === 'Pagó Ama' ? 'color-mix(in oklab,var(--brand-2) 18%,transparent)' : 'color-mix(in oklab,var(--info) 14%,transparent)' }}>{r.chip}</span>
            <span className="num" style={{ fontSize: 13.5, fontWeight: 700, width: 84, textAlign: 'right', color: r.chip.startsWith('De') || r.chip === 'Pagó Ama' ? 'var(--info)' : 'var(--g-text)' }}>{fmtARS(r.monto)}</span>
          </div>
        ))}
      </div>
      <MPNav active="comp" />
    </MPWrap>
  );
}

// ════════════════ CATEGORÍAS (ConfigPage) ════════════════
function CategoriasMP() {
  return (
    <MPWrap>
      <MPHead padBottom={18}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>Categorías</div>
          <div className="mp-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>D</div>
        </div>
      </MPHead>
      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {CONFIG_GRUPOS.slice(0, 3).map(([label, items], gi) => (
          <div key={gi} className="glass" style={{ borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ padding: '12px 15px 8px', fontSize: 13.5, fontWeight: 700 }}>{label}</div>
            {items.slice(0, 4).map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 15px', borderTop: '0.5px solid var(--g-hair)' }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{it}</span>
                <span className="g3"><MpIcons.trash s={14} /></span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, padding: '9px 15px 12px', borderTop: '0.5px solid var(--g-hair)' }}>
              <div className="glass glass-deep" style={{ flex: 1, borderRadius: 11, padding: '8px 12px', fontSize: 12, boxShadow: 'none' }}><span className="g3">Nueva categoría de {label.toLowerCase()}…</span></div>
              <span className="mp-cava" style={{ width: 33, height: 33, color: 'var(--brand)' }}><Icons.plus s={16} sw={2.2} /></span>
            </div>
          </div>
        ))}
      </div>
      <MPNav active="cat" />
    </MPWrap>
  );
}

Object.assign(window, { MiMesMP, TransaccionesMP, CompartidosMP, CategoriasMP, MPDonut, MpIcons, MP_CATS, GASTOS_ROWS, COMP_ROWS, CONFIG_GRUPOS, respChip, tipoBadge });
