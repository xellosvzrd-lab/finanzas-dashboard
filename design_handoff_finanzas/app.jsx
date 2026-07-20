// app.jsx — assembles the canvas, theme toggle, sections
/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard, DCPostIt, Icons,
   SGPalette, SGType, SGComponents, SGDataviz,
   MiMesCalida, MiMesEditorial, MiMesGlass,
   Resumen, Transacciones, Compartidos,
   ResumenM, TransaccionesM, CompartidosM, Categorias, Inversiones, NuevaTransaccion */

function Toolbar({ theme, setTheme }) {
  const dark = theme === 'dark';
  return (
    <div style={{ position: 'fixed', top: 16, left: 0, right: 0, zIndex: 90, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', pointerEvents: 'none', fontFamily: "'Hanken Grotesk', system-ui, sans-serif" }}>
      <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 14, padding: '9px 14px', boxShadow: '0 4px 16px rgba(0,0,0,.1)' }}>
        <span style={{ fontSize: 18 }}>💰</span>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1a1426', lineHeight: 1.1 }}>Finanzas — Rediseño</div>
          <div style={{ fontSize: 11.5, color: '#8c84a0' }}>Guía de estilo · pantallas clave</div>
        </div>
      </div>
      <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 999, padding: 4, boxShadow: '0 4px 16px rgba(0,0,0,.1)' }}>
        {[['light', Icons.sun, 'Claro'], ['dark', Icons.moon, 'Oscuro']].map(([k, Ic, label]) => {
          const on = theme === k;
          return (
            <button key={k} onClick={() => setTheme(k)} style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', cursor: 'pointer',
              background: on ? '#141019' : 'transparent', color: on ? '#fff' : '#5b5370', borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: '.15s' }}>
              {React.createElement(Ic, { s: 15 })}{label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function App() {
  const [theme, setTheme] = React.useState(() => {
    try { return localStorage.getItem('fin-theme') || 'dark'; } catch { return 'dark'; }
  });
  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('fin-theme', theme); } catch {}
  }, [theme]);
  const dark = theme === 'dark';

  return (
    <>
      <Toolbar theme={theme} setTheme={setTheme} />
      <DesignCanvas>
        <DCSection id="sistema" title="Sistema visual" subtitle="Paleta · tipografía · componentes · datos — cambian con el modo claro/oscuro de arriba">
          <DCArtboard id="paleta" label="Paleta" width={520} height={540}><SGPalette /></DCArtboard>
          <DCArtboard id="tipo" label="Tipografía" width={480} height={540}><SGType /></DCArtboard>
          <DCArtboard id="comp" label="Componentes" width={540} height={600}><SGComponents /></DCArtboard>
          <DCArtboard id="viz" label="Visualización de datos" width={560} height={600}><SGDataviz /></DCArtboard>
        </DCSection>

        <DCSection id="mimes" title="Mi mes — 3 direcciones" subtitle="La pantalla estrella: «cuánto me queda para gastar este mes». Elegí una y la llevo a todo el producto.">
          <DCArtboard id="calida" label="A · Cálida  ★ recomendada" width={402} height={874}><MiMesCalida dark={dark} /></DCArtboard>
          <DCArtboard id="editorial" label="B · Editorial" width={402} height={874}><MiMesEditorial dark={dark} /></DCArtboard>
          <DCArtboard id="glass" label="C · Glass" width={402} height={874}><MiMesGlass dark={dark} /></DCArtboard>
          <DCPostIt top={120} right={-150} rotate={3} width={196}>La dirección «Cálida» combina lo personal con lo claro. Las otras dos son alternativas de carácter.</DCPostIt>
        </DCSection>

        <DCSection id="mobile" title="Mi mes aplicado al resto — mobile" subtitle="Dirección Cálida llevada a las pantallas que más usás desde el celu">
          <DCArtboard id="resumen-m" label="Resumen" width={402} height={874}><ResumenM dark={dark} /></DCArtboard>
          <DCArtboard id="txn-m" label="Movimientos" width={402} height={874}><TransaccionesM dark={dark} /></DCArtboard>
          <DCArtboard id="compartidos-m" label="Compartidos" width={402} height={874}><CompartidosM dark={dark} /></DCArtboard>
        </DCSection>

        <DCSection id="claves" title="Pantallas clave — escritorio" subtitle="Dirección Cálida en responsive de escritorio">
          <DCArtboard id="mimes-d" label="Mi mes (desktop)" width={1280} height={880}><MiMesDesktop dark={dark} /></DCArtboard>
          <DCArtboard id="resumen" label="Resumen" width={1280} height={880}><Resumen dark={dark} /></DCArtboard>
          <DCArtboard id="txn" label="Transacciones" width={1280} height={880}><Transacciones dark={dark} /></DCArtboard>
          <DCArtboard id="compartidos" label="Compartidos" width={1280} height={880}><Compartidos dark={dark} /></DCArtboard>
          <DCArtboard id="categorias" label="Categorías" width={1280} height={880}><Categorias dark={dark} /></DCArtboard>
          <DCArtboard id="inversiones" label="Inversiones" width={1280} height={880}><Inversiones dark={dark} /></DCArtboard>
          <DCArtboard id="nueva-txn" label="Nueva transacción" width={1280} height={1080}><NuevaTransaccion dark={dark} /></DCArtboard>
        </DCSection>
      </DesignCanvas>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
