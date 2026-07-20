// screens-extra.jsx — Categorías + Inversiones (desktop)
/* global React, Shell, MonthPill, Icons, MES, CATS, INV, CUOTAS, fmtARS, fmtUSD, Bar, Donut */

const budgetOf = (c) => Math.round((c.pctSueldo / 100) * MES.sueldo);

// ════════════════════════ CATEGORÍAS ════════════════════════
const FUENTES = [
  { emoji: '🏦', name: 'Galicia', tipo: 'Caja de ahorro', color: 'var(--info)' },
  { emoji: '💳', name: 'Galicia VISA', tipo: 'Crédito · cierra 22', color: 'var(--brand)' },
  { emoji: '🟠', name: 'Naranja X', tipo: 'Crédito · cierra 15', color: 'var(--warn)' },
  { emoji: '💵', name: 'Mercado Pago', tipo: 'Billetera', color: 'var(--save)' },
  { emoji: '🌐', name: 'Wise', tipo: 'USD', color: 'var(--pos)' },
];

function Categorias({ dark }) {
  return (
    <Shell active="Categorías" title="Categorías y fuentes" subtitle="Cómo se organiza tu plata · presupuesto por % del sueldo"
      actions={<><button className="btn btn-ghost"><Icons.edit s={15} /> Editar</button><button className="btn btn-primary"><Icons.plus s={16} sw={2.2} /> Nueva categoría</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 18, height: '100%' }}>
        {/* categorías grid */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Categorías de gasto</span>
            <span style={{ fontSize: 13, color: 'var(--text-faint)', fontWeight: 600 }}>Presupuesto total: <span className="num" style={{ color: 'var(--text)', fontWeight: 700 }}>{fmtARS(MES.sueldo)}</span></span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, gridAutoRows: 'min-content', overflow: 'hidden' }}>
            {CATS.map((c, i) => {
              const b = budgetOf(c);
              const used = Math.min(1, c.gastado / b);
              const over = c.gastado > b;
              return (
                <div key={i} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{c.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700 }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>{c.pctSueldo}% del sueldo</div>
                    </div>
                    <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: over ? 'var(--neg)' : 'var(--text-faint)' }}>{Math.round(used * 100)}%</span>
                  </div>
                  <Bar value={used} color={over ? 'var(--neg)' : c.color} h={7} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9, fontSize: 12.5 }}>
                    <span className="num" style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{fmtARS(c.gastado)}</span>
                    <span className="num" style={{ color: 'var(--text-faint)', fontWeight: 600 }}>de {fmtARS(b)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* fuentes / tarjetas */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Fuentes y tarjetas</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginBottom: 16 }}>De dónde sale cada movimiento</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FUENTES.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{f.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{f.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>{f.tipo}</div>
                </div>
                <i style={{ width: 10, height: 10, borderRadius: 3, background: f.color }} />
              </div>
            ))}
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 14, width: '100%' }}><Icons.plus s={15} sw={2.2} /> Agregar fuente</button>
          <div style={{ flex: 1 }} />
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-faint)', fontWeight: 600 }}>Asignado del sueldo</span>
              <span className="num" style={{ fontWeight: 700 }}>100%</span>
            </div>
            <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
              {CATS.map((c, i) => <div key={i} style={{ flex: c.pctSueldo, background: c.color }} />)}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ════════════════════════ INVERSIONES ════════════════════════
function Inversiones({ dark }) {
  const totalActivos = INV.activos.reduce((s, a) => s + a.val, 0);
  const totalPlazos = INV.plazos.reduce((s, p) => s + p.monto, 0);
  const patrimonio = totalActivos + totalPlazos;
  return (
    <Shell active="Inversiones" title="Inversiones" subtitle="Plazos fijos · activos · dólar"
      actions={<><MonthPill /><button className="btn btn-primary"><Icons.plus s={16} sw={2.2} /> Nueva inversión</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, height: '100%' }}>
        {/* patrimonio hero + breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
          <div className="card" style={{ padding: 22, position: 'relative', overflow: 'hidden', background: 'linear-gradient(150deg, var(--brand), var(--brand-2))', color: '#fff', border: 'none' }}>
            <div style={{ position: 'absolute', width: 160, height: 160, borderRadius: 999, right: -50, bottom: -60, background: 'rgba(255,255,255,.14)' }} />
            <div style={{ fontSize: 14, fontWeight: 600, opacity: .92 }}>💎 Patrimonio invertido</div>
            <div className="num" style={{ fontSize: 36, fontWeight: 700, marginTop: 8 }}>{fmtARS(patrimonio)}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', fontSize: 13, opacity: .92 }}>≈ {fmtUSD(patrimonio / MES.mep)} · <span style={{ fontWeight: 700 }}>+2,1% mes</span></div>
          </div>
          <div className="card" style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 22 }}>
            <Donut size={140} thickness={20} segments={[
              { label: 'Plazos', value: totalPlazos, color: 'var(--save)' },
              { label: 'Activos', value: totalActivos, color: 'var(--brand)' },
            ]} center={<><div style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600 }}>Asignación</div><div className="num" style={{ fontSize: 16, fontWeight: 700 }}>2 clases</div></>} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[['Plazos fijos', totalPlazos, 'var(--save)'], ['Activos & cripto', totalActivos, 'var(--brand)']].map((r, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: r[2] }} />{r[0]}</span>
                    <span className="num" style={{ fontWeight: 700, color: 'var(--text-dim)' }}>{fmtARS(r[1])}</span>
                  </div>
                  <Bar value={r[1] / patrimonio} color={r[2]} h={9} />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* two tables */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
          {/* plazos */}
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>🔒 Plazos fijos activos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {INV.plazos.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{p.banco}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>Vence {p.vence} · en {p.dias} días</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num" style={{ fontSize: 15, fontWeight: 700 }}>{fmtARS(p.monto)}</div>
                    <div className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--pos)' }}>{p.tna}% TNA</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
              <span style={{ color: 'var(--text-faint)', fontWeight: 600 }}>Interés estimado al vencer</span>
              <span className="num pos" style={{ fontWeight: 700 }}>+{fmtARS(64200)}</span>
            </div>
          </div>
          {/* activos */}
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📈 Activos & cripto</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.8fr', padding: '0 4px 10px', fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
              <div>Activo</div><div style={{ textAlign: 'right' }}>Valor</div><div style={{ textAlign: 'right' }}>24h</div>
            </div>
            {INV.activos.map((a, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.8fr', alignItems: 'center', padding: '13px 4px', borderTop: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{a.emoji}</span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{a.t}</div>
                    <div className="num" style={{ fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 600 }}>{a.q} u.</div>
                  </div>
                </div>
                <div className="num" style={{ textAlign: 'right', fontSize: 13.5, fontWeight: 700 }}>{fmtARS(a.val)}</div>
                <div className="num" style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: a.chg >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{a.chg >= 0 ? '+' : ''}{a.chg}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

Object.assign(window, { Categorias, Inversiones });

// ════════════════════════ NUEVA TRANSACCIÓN (form) ════════════════════════
const Field = ({ label, children, hint }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
    <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label}</label>
    {children}
    {hint && <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{hint}</span>}
  </div>
);
const inputStyle = {
  background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12,
  padding: '11px 14px', fontSize: 14, color: 'var(--text)', fontFamily: 'var(--font-text)', width: '100%', outline: 'none',
};
const Segmented = ({ options, value, colors }) => (
  <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 4 }}>
    {options.map((o, i) => {
      const on = o === value;
      const c = colors ? colors[i] : 'var(--brand)';
      return (
        <div key={i} style={{ flex: 1, textAlign: 'center', padding: '8px 6px', borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
          background: on ? `color-mix(in oklab, ${c} 16%, var(--surface))` : 'transparent',
          color: on ? c : 'var(--text-dim)', border: on ? `1px solid color-mix(in oklab, ${c} 35%, transparent)` : '1px solid transparent' }}>{o}</div>
      );
    })}
  </div>
);
const Select = ({ value }) => (
  <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <span style={{ color: value.startsWith('—') ? 'var(--text-faint)' : 'var(--text)' }}>{value}</span>
    <Icons.chevD s={16} />
  </div>
);

function NuevaTransaccion({ dark }) {
  const cuotaSel = 12;
  return (
    <Shell active="Transacciones" title="Nueva transacción" subtitle="Anotá un gasto o ingreso · se divide según corresponda" H={1080}
      actions={<button className="btn" style={{ background: 'var(--warn)', color: '#3a2a00' }}><Icons.list s={15} /> Carga múltiple</button>}>
      <div style={{ display: 'flex', justifyContent: 'center', height: '100%', overflow: 'hidden' }}>
        <div className="card" style={{ width: 760, padding: 28, display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '100%' }}>
          {/* row: tipo + moneda */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <Field label="Tipo"><Segmented options={['Gasto', 'Ingreso']} value="Gasto" colors={['var(--neg)', 'var(--pos)']} /></Field>
            <Field label="Moneda"><Segmented options={['🇦🇷 ARS', '🇺🇸 USD']} value="🇦🇷 ARS" /></Field>
          </div>
          {/* row: fecha + monto */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <Field label="Fecha"><div style={{ ...inputStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="num">04/06/2026</span><Icons.tag s={15} /></div></Field>
            <Field label="Monto (ARS $)"><div style={inputStyle}><span style={{ color: 'var(--text-faint)' }}>0,00</span></div></Field>
          </div>
          {/* row: categoría + división */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <Field label="Categoría"><Select value="🛒 Mercado" /></Field>
            <Field label="¿Cómo se divide?" hint="Mío → 100% · Compartido → 50% · De Ama → 0%"><Select value="Compartido (50/50)" /></Field>
          </div>
          {/* fuente */}
          <Field label="Fuente / Medio de pago"><Select value="💳 Galicia VISA" /></Field>
          {/* forma de pago */}
          <Field label="Forma de pago"><Segmented options={['Pago único', 'En cuotas']} value="En cuotas" /></Field>
          {/* cuotas detail */}
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Cuotas">
              <div style={{ display: 'flex', gap: 7 }}>
                {[3, 6, 9, 12, 18, 24].map((n) => (
                  <div key={n} style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                    background: n === cuotaSel ? 'var(--brand)' : 'var(--surface)', color: n === cuotaSel ? '#fff' : 'var(--text-dim)', border: '1px solid var(--line)' }} className="num">{n}</div>
                ))}
              </div>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Monto por cuota" hint="editable si tiene interés"><div style={inputStyle}><span className="num" style={{ color: 'var(--text-faint)' }}>—</span></div></Field>
              <Field label="1ra cuota se liquida en"><Select value="Julio 2026" /></Field>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Tiene interés (CFT)</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>activá si la financiación tiene costo</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 90 }}><div style={{ ...inputStyle, padding: '8px 12px' }}><span className="num" style={{ color: 'var(--text-faint)' }}>% anual</span></div></div>
                <div style={{ width: 44, height: 26, borderRadius: 999, background: 'var(--brand)', padding: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 999, background: '#fff' }} />
                </div>
              </div>
            </div>
          </div>
          {/* descripción */}
          <Field label="Descripción (opcional)"><div style={{ ...inputStyle, minHeight: 64 }}><span style={{ color: 'var(--text-faint)' }}>¿En qué gastaste o de dónde vino?</span></div></Field>
          {/* actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
            <button className="btn btn-primary" style={{ flex: 1 }}>Guardar transacción</button>
            <button className="btn btn-ghost">Cancelar</button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

Object.assign(window, { NuevaTransaccion });
