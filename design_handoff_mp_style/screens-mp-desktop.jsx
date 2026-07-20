// screens-mp-desktop.jsx — escritorio: páginas reales (Mi mes · Gastos) con shell MP (1/2)
/* global React, Icons, MpIcons, MP_CATS, MPDonut, GASTOS_ROWS, respChip, tipoBadge, MES, fmtARS, fmtUSD */

function MPShell({ active, children }) {
  const nav = [['Mi mes', MpIcons.cal], ['Transacciones', MpIcons.swap], ['Compartidos', Icons.users], ['Categorías', Icons.tag], ['Inversiones', Icons.spark], ['Resumen', Icons.chart]];
  return (
    <div className="glassui" style={{ width: 1280, height: '100%', minHeight: 880 }}>
      <div className="glass-wall" />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', padding: 16, gap: 16 }}>
        <div className="glass" style={{ width: 236, flex: 'none', borderRadius: 24, padding: 16, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 16px' }}>
            <div style={{ width: 32, height: 32, borderRadius: 999, background: 'linear-gradient(150deg,var(--brand),var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💰</div>
            <span style={{ fontWeight: 700, fontSize: 17 }}>Finanzas</span>
          </div>
          <div style={{ height: 44, borderRadius: 999, marginBottom: 14, background: 'linear-gradient(150deg,var(--brand),var(--brand-2))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 700, boxShadow: '0 6px 18px color-mix(in oklab,var(--brand) 45%,transparent)' }}>
            <Icons.plus s={18} sw={2.2} /> Nueva transacción
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {nav.map(([label, Ic], i) => {
              const on = label === active;
              return (
                <div key={i} className={on ? 'glass glass-strong' : ''} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 13, fontSize: 14, fontWeight: on ? 700 : 600, color: on ? 'var(--brand)' : 'var(--g-text-2)', boxShadow: on ? undefined : 'none', border: on ? undefined : 'none' }}>
                  {React.createElement(Ic, { s: 19 })}<span>{label}</span>
                </div>
              );
            })}
          </div>
          <div style={{ flex: 1 }} />
          <div className="glass glass-deep" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 16, boxShadow: 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: 999, background: 'linear-gradient(135deg,var(--info),var(--save))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>D</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>Daniel</div>
              <div style={{ fontSize: 11.5 }} className="g3">Partner: Ama</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--g-text-3)' }}>Salir</span>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}

function MPBand({ children, pad = '22px 26px' }) {
  return <div className="mp-head" style={{ borderRadius: 24, padding: pad, boxShadow: '0 14px 40px color-mix(in oklab, var(--brand) 30%, transparent)' }}>{children}</div>;
}

function MPPickerD() {
  return <div className="glass glass-strong" style={{ height: 40, borderRadius: 999, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700 }}>Jun · 2026 <Icons.chevD s={14} /></div>;
}

// ════════════════ MI MES · desktop (PresupuestoPage) ════════════════
function MiMesMPDesktop() {
  const segs = MP_CATS;
  const segTotal = segs.reduce((s, x) => s + x.gastado, 0);
  return (
    <MPShell active="Mi mes">
      <MPBand>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Saldo de junio <MpIcons.eye s={16} /></div>
            <div className="num" style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, marginTop: 2 }}>{fmtARS(MES.balance, { sign: true })}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <span className="mp-wpill num">↑ Ingresos {fmtARS(MES.ingresos)}</span>
              <span className="mp-wpill num">↓ Gastos {fmtARS(MES.gastos)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 22 }}>
            {[['Nueva', Icons.plus], ['Transac.', MpIcons.swap], ['Compartidos', Icons.users], ['Categorías', Icons.tag]].map(([label, Ic], i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                <span style={{ width: 52, height: 52, borderRadius: 999, background: 'rgba(255,255,255,0.18)', border: '0.5px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{React.createElement(Ic, { s: 22 })}</span>
                {label}
              </div>
            ))}
          </div>
        </div>
      </MPBand>

      {/* KPI reales: Ingresos · Gastos · Saldo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[['Ingresos', MES.ingresos, 'var(--pos)'], ['Gastos', MES.gastos, 'var(--neg)'], ['Saldo', MES.balance, MES.balance >= 0 ? 'var(--pos)' : 'var(--neg)']].map((s, i) => (
          <div key={i} className="glass" style={{ borderRadius: 20, padding: '15px 18px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }} className="g2">{s[0]}</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, marginTop: 5, color: s[2] }}>{fmtARS(s[1], { sign: s[0] === 'Saldo' })}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 14, flex: 1, minHeight: 0 }}>
        {/* desglose table real: Categoría · % Presup. · Gasto actual · % Real */}
        <div className="glass" style={{ borderRadius: 22, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '15px 20px 11px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Desglose por categoría</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand)' }}>Editar presupuesto</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr 1fr 0.5fr 1.3fr', padding: '8px 20px', borderTop: '0.5px solid var(--g-hair)', borderBottom: '0.5px solid var(--g-hair)', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' }} className="g3">
            <div>Categoría</div><div style={{ textAlign: 'right' }}>Presup. ($)</div><div style={{ textAlign: 'right' }}>Gasto actual</div><div style={{ textAlign: 'right' }}>%</div><div style={{ paddingLeft: 20 }}>Progreso</div>
          </div>
          {MP_CATS.slice(0, 6).map((c, i) => {
            const over = c.gastado > c.budget;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr 1fr 0.5fr 1.3fr', alignItems: 'center', padding: '10px 20px', borderBottom: '0.5px solid var(--g-hair)' }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.label}</div>
                <div className="num g2" style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700 }}>{fmtARS(c.budget)}</div>
                <div className="num" style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: over ? 'var(--neg)' : 'var(--g-text)' }}>{fmtARS(c.gastado)}</div>
                <div className="num g2" style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600 }}>{Math.round(c.used * 100)}%</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingLeft: 20 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 6, background: 'var(--g-hair)', overflow: 'hidden' }}><div style={{ width: `${c.used * 100}%`, height: '100%', borderRadius: 6, background: over ? 'var(--neg)' : 'linear-gradient(90deg,var(--brand),var(--brand-2))' }} /></div>
                  <span className="num g3" style={{ fontSize: 11.5, fontWeight: 700, width: 32, textAlign: 'right' }}>{Math.round(c.used * 100)}%</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <div className="glass" style={{ borderRadius: 20, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="mp-cava" style={{ width: 36, height: 36, fontSize: 16 }}>💵</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>Dólar MEP</div>
              <div className="num g3" style={{ fontSize: 12, fontWeight: 600 }}>Venta $1.292 · dolarapi</div>
            </div>
            <span className="num" style={{ fontSize: 12, fontWeight: 800, color: 'var(--pos)', background: 'color-mix(in oklab,var(--pos) 14%,transparent)', padding: '3px 9px', borderRadius: 999 }}>+0,3%</span>
          </div>
          <div className="glass" style={{ borderRadius: 20, padding: '13px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600 }} className="g3">🎯 Meta de ahorro · Vacaciones</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <div style={{ flex: 1, height: 8, borderRadius: 6, background: 'var(--g-hair)', overflow: 'hidden' }}><div style={{ width: '60%', height: '100%', borderRadius: 6, background: 'linear-gradient(90deg,var(--brand),var(--brand-2))' }} /></div>
              <span className="num" style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand)' }}>60%</span>
            </div>
            <div className="num g3" style={{ fontSize: 11.5, fontWeight: 600, marginTop: 5 }}>$2,4M de $4,0M · 💳 Cuotas: {fmtARS(CUOTAS.esteMes)}</div>
          </div>
          <div className="glass" style={{ borderRadius: 20, padding: 18, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, alignSelf: 'flex-start' }}>Gastos por categoría</div>
            <MPDonut segs={segs.map((c) => ({ value: c.gastado, color: c.color }))} size={158} thickness={21} center={<><div style={{ fontSize: 10, fontWeight: 600 }} className="g3">Gastos</div><div className="num" style={{ fontSize: 16, fontWeight: 700 }}>$1,3M</div></>} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              {[...segs].sort((a, b) => b.gastado - a.gastado).slice(0, 5).map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  <i style={{ width: 9, height: 9, borderRadius: 3, background: c.color, flex: 'none' }} />
                  <span style={{ flex: 1, fontWeight: 600 }}>{c.label}</span>
                  <span className="num g2" style={{ fontWeight: 700 }}>{Math.round(c.gastado / segTotal * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MPShell>
  );
}

// ════════════════ TRANSACCIONES · desktop (page-transacciones) ════════════════
function TransaccionesMPDesktop() {
  return (
    <MPShell active="Transacciones">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>Transacciones</h1>
        <div style={{ height: 40, borderRadius: 999, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, background: 'linear-gradient(150deg,var(--brand),var(--brand-2))', color: '#fff' }}><Icons.plus s={15} sw={2.4} /> Nueva</div>
      </div>
      {/* FilterBar real */}
      <div style={{ display: 'flex', gap: 10 }}>
        <MPPickerD />
        {['Tipo: gastos', 'Fuente: todas', 'Resp: todas'].map((t, i) => (
          <div key={i} className="glass" style={{ borderRadius: 999, padding: '10px 15px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--g-text-2)' }}>{t} <Icons.chevD s={13} /></div>
        ))}
        <div className="glass glass-strong" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, borderRadius: 999, padding: '0 16px' }}>
          <span className="g3"><Icons.search s={16} /></span><span style={{ fontSize: 13.5 }} className="g3">Buscar…</span>
        </div>
      </div>
      <div className="num g3" style={{ padding: '0 6px', fontSize: 12.5, fontWeight: 600 }}>
        <b style={{ color: 'var(--g-text)' }}>7</b> transacciones · Gastos <b style={{ color: 'var(--neg)' }}>$734,7k</b> · Ingresos <b style={{ color: 'var(--pos)' }}>$1,95M</b> · Neto <b className="num" style={{ color: 'var(--pos)', fontSize: 14.5 }}>{fmtARS(MES.balance, { sign: true })}</b>
      </div>
      <div className="glass" style={{ borderRadius: 22, overflow: 'hidden', flex: 1 }}>
        {GASTOS_ROWS.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 20px', borderTop: i ? '0.5px solid var(--g-hair)' : 'none' }}>
            {tipoBadge(t.tipo)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t.cat}</span>
              {t.desc && <span className="g3" style={{ fontSize: 13, fontWeight: 500 }}> · {t.desc}</span>}
            </div>
            {respChip(t.resp)}
            <span className="g3" style={{ fontSize: 12, fontWeight: 600, width: 96 }}>{t.fuente}</span>
            <span className="num" style={{ fontSize: 13.5, fontWeight: 700, width: 110, textAlign: 'right', color: t.tipo === 'I' ? 'var(--pos)' : 'var(--neg)' }}>{t.mon === 'USD' ? fmtUSD(t.monto) : fmtARS(t.monto, { sign: t.monto > 0 })}</span>
            <span className="num g3" style={{ fontSize: 12, fontWeight: 600, width: 86, textAlign: 'right' }}>{t.fecha}</span>
            <div style={{ display: 'flex', gap: 6, color: 'var(--g-text-3)' }}>
              <Icons.edit s={14} /><MpIcons.copy s={14} /><span style={{ color: 'var(--neg)', opacity: .7 }}><MpIcons.trash s={14} /></span>
            </div>
          </div>
        ))}
      </div>
    </MPShell>
  );
}

Object.assign(window, { MPShell, MPBand, MPPickerD, MiMesMPDesktop, TransaccionesMPDesktop });
