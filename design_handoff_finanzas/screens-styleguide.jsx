// screens-styleguide.jsx — design system spec cards
/* global React, Donut, HBars, MonthBars, Spark, Ring, Bar, CATS, YEAR, Icons, fmtARS */

const SGWrap = ({ title, kicker, children, pad = 30 }) => (
  <div className="fin" style={{ padding: pad, display: 'flex', flexDirection: 'column', gap: 22, overflow: 'hidden' }}>
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand)' }}>{kicker}</div>
      <h2 style={{ fontSize: 26, marginTop: 6 }}>{title}</h2>
    </div>
    {children}
  </div>
);

const Swatch = ({ color, name, val, ink = '#fff' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
    <div style={{ height: 56, borderRadius: 14, background: color, border: '1px solid var(--line)', display: 'flex', alignItems: 'flex-end', padding: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: ink, opacity: .85 }} className="num">{val}</span>
    </div>
    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-dim)' }}>{name}</span>
  </div>
);

// ── PALETTE ─────────────────────────────────────────────────────
function SGPalette() {
  return (
    <SGWrap kicker="Sistema · 01" title="Paleta">
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-dim)' }}>Marca · acento</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Swatch color="var(--brand)"   name="Violeta" val="L .74 · H 300" />
          <Swatch color="var(--brand-2)" name="Violeta 2" val="L .78 · H 330" />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-dim)' }}>Semánticos <span className="faint" style={{ fontWeight: 500 }}>· misma L/C, varía el tono</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          <Swatch color="var(--pos)"  name="Ingreso" val="H152" />
          <Swatch color="var(--neg)"  name="Gasto" val="H25" />
          <Swatch color="var(--info)" name="Info" val="H252" />
          <Swatch color="var(--save)" name="Ahorro" val="H195" />
          <Swatch color="var(--warn)" name="Aviso" val="H75" ink="#3a2a00" />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-dim)' }}>Neutros tibios <span className="faint" style={{ fontWeight: 500 }}>· según modo activo</span></div>
        <div style={{ display: 'flex', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
          {['var(--bg)', 'var(--elev)', 'var(--surface)', 'var(--surface-2)', 'var(--surface-3)', 'var(--text-faint)', 'var(--text-dim)', 'var(--text)'].map((c, i) => (
            <div key={i} style={{ flex: 1, height: 48, background: c }} />
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>Fondo → superficies → texto. Todos con un sutil tinte violeta, nada gris puro.</div>
      </div>
    </SGWrap>
  );
}

// ── TYPE ────────────────────────────────────────────────────────
function SGType() {
  return (
    <SGWrap kicker="Sistema · 02" title="Tipografía">
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Schibsted Grotesk</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 2 }}>Títulos · números</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-text)', fontSize: 15, fontWeight: 700 }}>Hanken Grotesk</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 2 }}>Texto · UI · etiquetas</div>
        </div>
      </div>
      <hr className="divider" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="num" style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em' }}>$537.700</div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Display · 52 / 700 · tabular-nums</div>
        <h3 style={{ fontSize: 28, fontWeight: 600 }}>Resumen del mes</h3>
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Título · 28 / 600</div>
        <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-dim)' }}>Cada peso ya está dividido — esto es lo que te corresponde a vos este mes. Texto base 15 / 400.</div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand)' }}>Etiqueta</span>
          <span className="num" style={{ fontSize: 18, fontWeight: 600 }}>0123456789</span>
        </div>
      </div>
    </SGWrap>
  );
}

// ── COMPONENTS ──────────────────────────────────────────────────
function Toggle({ on }) {
  return (
    <div style={{ width: 44, height: 26, borderRadius: 999, background: on ? 'var(--brand)' : 'var(--surface-3)', padding: 3, display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: '.2s' }}>
      <div style={{ width: 20, height: 20, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
    </div>
  );
}
function SGComponents() {
  return (
    <SGWrap kicker="Sistema · 03" title="Componentes">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-primary">+ Anotar gasto</button>
        <button className="btn btn-ghost">Importar</button>
        <span className="chip on">Gastos</span>
        <span className="chip">Ingresos</span>
        <span className="chip">Compartido</span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: '11px 14px', color: 'var(--text-faint)' }}>
          <Icons.search s={17} /><span style={{ fontSize: 14 }}>Buscar transacción…</span>
        </div>
        <Toggle on />
      </div>
      {/* list row */}
      <div className="card" style={{ borderRadius: 16, overflow: 'hidden' }}>
        {[['🛒', 'Coto — semanal', 'Compartido · Galicia VISA', -48900], ['💼', 'Sueldo junio', 'Mío · Galicia', 1950000]].map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{r[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{r[1]}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>{r[2]}</div>
            </div>
            <div className={'num ' + (r[3] > 0 ? 'pos' : '')} style={{ fontSize: 15, fontWeight: 700 }}>{fmtARS(r[3], { sign: true })}</div>
          </div>
        ))}
      </div>
      {/* KPI mini + progress */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-faint)', fontWeight: 600 }}>Ahorro del mes</div>
          <div className="num" style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>35%</div>
          <div style={{ marginTop: 10 }}><Bar value={0.35} color="var(--save)" /></div>
        </div>
        <div className="card" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
          <Ring value={0.62} color="var(--brand)" size={56} thickness={7}><span className="num" style={{ fontSize: 13, fontWeight: 700 }}>62%</span></Ring>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--text-faint)', fontWeight: 600 }}>Presupuesto</div>
            <div className="num" style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>usado</div>
          </div>
        </div>
      </div>
    </SGWrap>
  );
}

// ── DATA-VIZ ────────────────────────────────────────────────────
function SGDataviz() {
  const segs = CATS.slice(0, 6).map((c) => ({ label: c.label, value: c.value, color: c.color }));
  return (
    <SGWrap kicker="Sistema · 04" title="Visualización de datos">
      <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
        <Donut segments={segs} size={150} thickness={20} center={
          <><div style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600 }}>Gastos</div>
            <div className="num" style={{ fontSize: 19, fontWeight: 700 }}>$1.41M</div></>
        } />
        <div style={{ flex: 1 }}>
          <HBars rows={CATS.slice(0, 4).map((c) => ({ label: `${c.emoji} ${c.label}`, value: c.value, color: c.color }))} />
        </div>
      </div>
      <hr className="divider" />
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)' }}>Ingresos vs gastos · 12 meses</span>
          <span style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-faint)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--pos)' }} />Ingresos</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--neg)' }} />Gastos</span>
          </span>
        </div>
        <MonthBars data={YEAR} height={120} />
      </div>
      <hr className="divider" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-faint)', fontWeight: 600, marginBottom: 6 }}>Evolución del balance</div>
          <Spark points={YEAR.map((y) => y.inc - y.exp)} w={300} h={54} color="var(--brand)" />
        </div>
      </div>
    </SGWrap>
  );
}

Object.assign(window, { SGPalette, SGType, SGComponents, SGDataviz });
