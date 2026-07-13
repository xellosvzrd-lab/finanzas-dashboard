// screens-key.jsx — desktop shell + Resumen
/* global React, Icons, MES, CATS, YEAR, TXN, CUOTAS, fmtARS, fmtUSD, Donut, HBars, MonthBars, Spark, Bar */

// ── Desktop shell: sidebar + topbar ─────────────────────────────
const NAV = [
  ['Mi mes', Icons.home], ['Resumen', Icons.chart], ['Transacciones', Icons.list],
  ['Compartidos', Icons.users], ['Categorías', Icons.tag], ['Inversiones', Icons.spark],
];
function Shell({ active, title, subtitle, actions, children, W = 1280, H = 880 }) {
  return (
    <div className="fin" style={{ width: W, height: H, display: 'flex', overflow: 'hidden' }}>
      {/* sidebar */}
      <div style={{ width: 232, flex: 'none', borderRight: '1px solid var(--line)', background: 'var(--elev)', display: 'flex', flexDirection: 'column', padding: '22px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 22px' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(150deg,var(--brand),var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💰</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>Finanzas</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {NAV.map(([label, Ic], i) => {
            const on = label === active;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                background: on ? 'var(--brand-soft)' : 'transparent', color: on ? 'var(--brand)' : 'var(--text-dim)', fontWeight: on ? 700 : 600, fontSize: 14.5 }}>
                {React.createElement(Ic, { s: 19 })}<span>{label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderTop: '1px solid var(--line)' }}>
          <div style={{ width: 34, height: 34, borderRadius: 999, background: 'linear-gradient(135deg,var(--info),var(--save))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>D</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Daniel</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Plan compartido · Ama</div>
          </div>
        </div>
      </div>

      {/* main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '24px 30px 18px', borderBottom: '1px solid var(--line)' }}>
          <div>
            <h1 style={{ fontSize: 27 }}>{title}</h1>
            {subtitle && <div style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 4 }}>{subtitle}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{actions}</div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', padding: '22px 30px' }}>{children}</div>
      </div>
    </div>
  );
}

const MonthPill = () => (
  <div className="chip" style={{ background: 'var(--surface-2)', color: 'var(--text)', fontWeight: 700, fontSize: 13.5, padding: '9px 14px' }}>
    <span style={{ color: 'var(--text-faint)' }}>‹</span> Junio 2026 <span style={{ color: 'var(--text-faint)' }}>›</span>
  </div>
);

// ── KPI card ────────────────────────────────────────────────────
function Kpi({ label, value, delta, deltaPos, spark, color }) {
  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>{label}</span>
        {delta != null && (
          <span style={{ fontSize: 12, fontWeight: 700, color: deltaPos ? 'var(--pos)' : 'var(--neg)', background: deltaPos ? 'var(--pos-soft)' : 'var(--neg-soft)', padding: '3px 8px', borderRadius: 999 }}>{deltaPos ? '↑' : '↓'} {delta}</span>
        )}
      </div>
      <div className="num" style={{ fontSize: 28, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
      {spark && <div style={{ marginTop: 6 }}><Spark points={spark} w={200} h={34} color={color || 'var(--brand)'} /></div>}
    </div>
  );
}

// ── RESUMEN ─────────────────────────────────────────────────────
function Resumen({ dark }) {
  const segs = CATS.filter((c) => c.label !== 'Ahorro').map((c) => ({ label: c.label, value: c.value, color: c.color }));
  const segTotal = segs.reduce((s, x) => s + x.value, 0);
  const top = [...CATS].sort((a, b) => b.value - a.value).slice(0, 5);
  return (
    <Shell active="Resumen" title="Resumen del mes" subtitle="Junio 2026 · cómo venís hasta hoy"
      actions={<><span style={{ fontSize: 13, color: 'var(--brand)', fontWeight: 600 }}>Ver análisis anual →</span><MonthPill /><button className="btn btn-primary"><Icons.plus s={16} sw={2.2} /> Anotar</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, height: '100%' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          <Kpi label="Ingresos" value={fmtARS(MES.ingresos)} delta="4%" deltaPos spark={YEAR.map((y) => y.inc)} color="var(--pos)" />
          <Kpi label="Gastos" value={fmtARS(MES.gastos)} delta="2%" deltaPos spark={YEAR.map((y) => y.exp)} color="var(--neg)" />
          <Kpi label="Balance" value={fmtARS(MES.balance, { sign: true })} delta="11%" deltaPos spark={YEAR.map((y) => y.inc - y.exp)} color="var(--brand)" />
          <Kpi label="Ahorro" value={MES.ahorroPct + '%'} delta="3pts" deltaPos spark={[28, 31, 26, 33, 30, 35]} color="var(--save)" />
        </div>

        {/* mid row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr 1fr', gap: 14, flex: 1, minHeight: 0 }}>
          {/* donut */}
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Gastos por categoría</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
              <Donut segments={segs} size={150} thickness={20} center={<><div style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600 }}>Gastos</div><div className="num" style={{ fontSize: 18, fontWeight: 700 }}>$1,37M</div></>} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {segs.slice(0, 5).map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                    <i style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flex: 'none' }} />
                    <span style={{ flex: 1, color: 'var(--text-dim)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
                    <span className="num" style={{ fontWeight: 700, color: 'var(--text-faint)' }}>{Math.round(s.value / segTotal * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* balance gauge */}
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Ingresos vs Gastos</div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}><span className="muted" style={{ fontWeight: 600 }}>Ingresos</span><span className="num pos" style={{ fontWeight: 700 }}>{fmtARS(MES.ingresos)}</span></div>
                <Bar value={1} color="var(--pos)" h={10} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}><span className="muted" style={{ fontWeight: 600 }}>Gastos</span><span className="num neg" style={{ fontWeight: 700 }}>{fmtARS(MES.gastos)}</span></div>
                <Bar value={MES.gastos / MES.ingresos} color="var(--neg)" h={10} />
              </div>
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Balance</span>
                <span className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand)' }}>{fmtARS(MES.balance, { sign: true })}</span>
              </div>
            </div>
          </div>
          {/* top gastos */}
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Top gastos del mes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, flex: 1 }}>
              {top.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{c.emoji}</div>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{c.label}</span>
                  <span className="num" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-dim)' }}>{fmtARS(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* monthly evolution */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Evolución mensual · últimos 12 meses</span>
            <span style={{ display: 'flex', gap: 16, fontSize: 12.5, color: 'var(--text-faint)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--pos)' }} />Ingresos</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--neg)' }} />Gastos</span>
            </span>
          </div>
          <MonthBars data={YEAR} height={120} />
        </div>
      </div>
    </Shell>
  );
}

// ── MI MES (desktop) — todos los campos reales con jerarquía ────
function MiMesDesktop({ dark }) {
  const dias = MES.diasRestantes;
  const cats = CATS.filter((c) => c.label !== 'Ahorro').map((c) => {
    const b = Math.round((c.pctSueldo / 100) * MES.sueldo);
    return { ...c, budget: b, used: Math.min(1, c.gastado / b), restante: b - c.gastado };
  });
  const ledger = [
    ['Sueldo', MES.sueldo, 'ingresos del mes', 'var(--text)'],
    ['Presupuestado', MES.presupuestado, 'de tu sueldo asignado', 'var(--text)'],
    ['Gastado', MES.gastadoReal, `incluye ${fmtARS(MES.gastoCompartido)} de compartidos`, 'var(--neg)'],
    ['Margen planeado', MES.margenPlaneado, 'sueldo − presupuestado', 'var(--save)'],
  ];
  return (
    <Shell active="Mi mes" title="Mi mes" subtitle="Junio 2026 · cuánto te queda para gastar"
      actions={<><MonthPill /><button className="btn btn-ghost"><Icons.spark s={15} /> Sugerir</button><button className="btn btn-primary">Guardar presupuesto</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
        {/* row 1: hero + desglose del sueldo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
          {/* hero contenido */}
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--r-lg)', padding: '24px 28px', color: '#fff',
            background: 'linear-gradient(140deg, var(--brand) 0%, var(--brand-2) 100%)',
            boxShadow: '0 18px 44px color-mix(in oklab, var(--brand) 38%, transparent)' }}>
            <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: 999, right: -70, top: -90, background: 'rgba(255,255,255,.16)' }} />
            <div style={{ fontSize: 14.5, fontWeight: 600, opacity: .92, position: 'relative' }}>💸 Lo que te queda para gastar</div>
            <div className="num" style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.02, marginTop: 6, position: 'relative' }}>{fmtARS(MES.quedaMes)}</div>
            <div style={{ fontSize: 13.5, opacity: .9, marginTop: 5, position: 'relative' }}>Sueldo {fmtARS(MES.sueldo)} − gastado real {fmtARS(MES.gastadoReal)}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, position: 'relative' }}>
              {[['Por día', fmtARS(MES.porDia)], ['Saldo USD', fmtUSD(MES.quedaMes / MES.mep)], ['Días', `${dias}`]].map((b, i) => (
                <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,.16)', borderRadius: 14, padding: '11px 14px', backdropFilter: 'blur(4px)' }}>
                  <div style={{ fontSize: 11.5, opacity: .85, fontWeight: 600 }}>{b[0]}</div>
                  <div className="num" style={{ fontSize: 19, fontWeight: 700, marginTop: 2 }}>{b[1]}</div>
                </div>
              ))}
            </div>
          </div>
          {/* desglose del sueldo (ledger) */}
          <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>Desglose del sueldo</div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
              {ledger.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '9px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r[0]}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{r[2]}</div>
                  </div>
                  <span className="num" style={{ fontSize: 17, fontWeight: 700, color: r[3] }}>{fmtARS(r[1])}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* row 2: secondary stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            ['🐷', 'Ahorro acumulado', fmtARS(MES.ahorroAcum), 'var(--save)', `${MES.ahorroPct}% del sueldo este mes`],
            ['🫶', 'Compartidos con Ama', fmtARS(Math.abs(MES.compartidosSaldo)), 'var(--neg)', MES.compartidosSaldo < 0 ? 'le debés a Ama' : 'Ama te debe'],
            ['💳', 'Cuotas este mes', fmtARS(CUOTAS.esteMes), 'var(--text)', `${CUOTAS.compras.length} compras activas`],
            ['📅', 'Comprometido futuro', fmtARS(CUOTAS.futuro), 'var(--warn)', 'en próximos meses'],
          ].map((s, i) => (
            <div key={i} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{s[0]}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-faint)', fontWeight: 600 }}>{s[1]}</span>
              </div>
              <div className="num" style={{ fontSize: 21, fontWeight: 700, color: s[3] }}>{s[2]}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 2 }}>{s[4]}</div>
            </div>
          ))}
        </div>

        {/* row 3: presupuesto por categoría (tabla con % sueldo) */}
        <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
          <div style={{ padding: '16px 22px 12px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Presupuesto por categoría</span>
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>los valores se ingresan como % del sueldo</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 1fr 1fr 1.4fr', padding: '9px 22px', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            <div>Categoría</div><div style={{ textAlign: 'right' }}>% Sueldo</div><div style={{ textAlign: 'right' }}>Gastado</div><div style={{ textAlign: 'right' }}>Restante</div><div style={{ paddingLeft: 20 }}>Progreso</div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {cats.slice(0, 6).map((c, i) => {
              const over = c.gastado > c.budget;
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 1fr 1fr 1.4fr', alignItems: 'center', padding: '11px 22px', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{c.emoji}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.label}</span>
                  </div>
                  <div className="num" style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--text-dim)' }}>{c.pctSueldo}%</div>
                  <div className="num" style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--text-dim)' }}>{fmtARS(c.gastado)}</div>
                  <div className="num" style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: over ? 'var(--neg)' : 'var(--text)' }}>{fmtARS(c.restante)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingLeft: 20 }}>
                    <div style={{ flex: 1 }}><Bar value={c.used} color={over ? 'var(--neg)' : c.color} h={6} /></div>
                    <span className="num" style={{ fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 700, width: 32, textAlign: 'right' }}>{Math.round(c.used * 100)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Shell>
  );
}

Object.assign(window, { Shell, MonthPill, Kpi, Resumen, MiMesDesktop });
