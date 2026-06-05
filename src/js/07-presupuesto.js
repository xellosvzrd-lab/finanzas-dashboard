// ─── PRESUPUESTO ──────────────────────────────────────────────
let presupuestoActual = {}; // { categoria: monto }

function inicializarSelectoresPresupuesto() {
  const hoy   = new Date();
  const meses = [
    ["01","Enero"],["02","Febrero"],["03","Marzo"],["04","Abril"],
    ["05","Mayo"],["06","Junio"],["07","Julio"],["08","Agosto"],
    ["09","Septiembre"],["10","Octubre"],["11","Noviembre"],["12","Diciembre"]
  ];

  const selMes = document.getElementById("pres-mes");
  selMes.innerHTML = "";
  meses.forEach(([v,n]) => {
    const o = document.createElement("option");
    o.value = v; o.textContent = n;
    if (parseInt(v) === hoy.getMonth() + 1) o.selected = true;
    selMes.appendChild(o);
  });

  const selAnio = document.getElementById("pres-anio");
  selAnio.innerHTML = "";
  for (let y = hoy.getFullYear(); y >= hoy.getFullYear() - 3; y--) {
    const o = document.createElement("option");
    o.value = y; o.textContent = y;
    if (y === hoy.getFullYear()) o.selected = true;
    selAnio.appendChild(o);
  }
}

async function cargarPresupuesto() {
  const mes  = parseInt(document.getElementById("pres-mes").value);
  const anio = parseInt(document.getElementById("pres-anio").value);
  const fetchList = [
    supabaseClient.from('presupuesto').select('*').eq('mes', mes).eq('anio', anio)
  ];
  fetchList.push(fetchTipoCambioMEP());
  const [presRes] = await Promise.allSettled(fetchList);
  try {
    const { data, error } = presRes.value;
    if (error) throw error;
    presupuestoActual = {};
    data.forEach(d => { presupuestoActual[d.categoria] = d.porcentaje; });
  } catch(e) { console.warn("Error cargando presupuesto:", e); }
  renderPresupuesto();
  inicializarDisclosureMimes();
  await cargarCuotasActivas();
  _renderCuotasCard();
  _inicializarDisclosureCuotas();
  if (window.lucide) lucide.createIcons();
}

async function guardarPresupuesto() {
  const mes  = document.getElementById("pres-mes").value;
  const anio = document.getElementById("pres-anio").value;
  const msg  = document.getElementById("pres-msg");

  // Leer los inputs actuales de la tabla
  const items = [];
  document.querySelectorAll("#pres-tbody .pres-input").forEach(inp => {
    const cat = inp.dataset.cat;
    const val = parsearDecimal(inp.value);
    presupuestoActual[cat] = val;
    if (val > 0) items.push({ categoria: cat, presupuesto: val });
  });

  msg.innerHTML = "⏳ Guardando...";
  try {
    // Borrar presupuesto existente del mes/año y re-insertar
    const { error: delErr } = await supabaseClient
      .from('presupuesto').delete().eq('mes', mes).eq('anio', anio);
    if (delErr) throw delErr;
    if (items.length) {
      const rows = items.map(it => ({
        mes, anio, categoria: it.categoria, porcentaje: it.presupuesto,
        usuario: USUARIO, user_id: supabaseSession.user.id
      }));
      const { error: insErr } = await supabaseClient.from('presupuesto').insert(rows);
      if (insErr) throw insErr;
    }
    msg.innerHTML = `<span style="color:var(--green)">✅ Presupuesto guardado</span>`;
    renderPresupuesto();
  } catch(e) {
    msg.innerHTML = '<span style="color:var(--red)">❌ Error de conexión.</span>';
  }
  setTimeout(() => { msg.innerHTML = ""; }, 3500);
}

function sugerirPresupuestoDesdeHistorial() {
  const hoy = new Date();
  const meses = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ mes: d.getMonth() + 1, anio: d.getFullYear() });
  }
  const acum = {}, conteo = {};
  categGasto.forEach(c => { acum[c] = 0; conteo[c] = 0; });

  meses.forEach(({ mes, anio }) => {
    const dataMes  = allTransac.filter(t => { const { year, month } = getMesLiquidacion(t); return month === mes && year === anio; });
    const dataMesU = dataMes.filter(t => (t.usuario || "Daniel") === USUARIO);
    const sueldoARS = dataMesU
      .filter(t => t.tipo === "Ingreso" && CATS_INGRESO_REAL.includes(t.categoria) && (t.moneda || "ARS") === "ARS")
      .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
    const ingUSD = dataMesU.filter(t => t.tipo === "Ingreso" && !esTransferencia(t) && (t.moneda || "ARS") === "USD").reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
    const gasUSD = dataMesU.filter(t => t.tipo === "Gasto"   && !esTransferencia(t) && (t.moneda || "ARS") === "USD").reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
    const usdARS = USUARIO.toLowerCase() === "ama" && tipoCambioMEP ? (ingUSD - gasUSD) * tipoCambioMEP : 0;
    const sueldo = sueldoARS + usdARS;
    if (sueldo <= 0) return;

    categGasto.forEach(cat => {
      const gMio  = dataMesU.filter(t => t.tipo==="Gasto" && t.categoria===cat && (t.responsabilidad||"Mío")==="Mío" && !esTransferencia(t) && (t.moneda||"ARS")==="ARS").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
      const iMio  = dataMesU.filter(t => t.tipo==="Ingreso" && t.categoria===cat && (t.responsabilidad||"Mío")==="Mío" && !esTransferencia(t) && (t.moneda||"ARS")==="ARS").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
      const gComp = dataMes.filter(t => t.tipo==="Gasto" && t.categoria===cat && t.responsabilidad==="Compartido" && !esTransferencia(t) && (t.moneda||"ARS")==="ARS").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
      const iComp = dataMes.filter(t => t.tipo==="Ingreso" && t.categoria===cat && t.responsabilidad==="Compartido" && !esTransferencia(t) && (t.moneda||"ARS")==="ARS").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
      const gDeU  = dataMes.filter(t => t.tipo==="Gasto" && t.categoria===cat && t.responsabilidad==="De "+USUARIO && !esTransferencia(t) && (t.moneda||"ARS")==="ARS").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
      const iDeU  = dataMes.filter(t => t.tipo==="Ingreso" && t.categoria===cat && t.responsabilidad==="De "+USUARIO && !esTransferencia(t) && (t.moneda||"ARS")==="ARS").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
      const gastoCat = Math.max(0, gMio - iMio) + Math.max(0, gComp - iComp) * 0.5 + Math.max(0, gDeU - iDeU);
      acum[cat] += (gastoCat / sueldo) * 100;
      conteo[cat]++;
    });
  });

  let aplicados = 0;
  document.querySelectorAll("#pres-tbody .pres-input").forEach(inp => {
    const cat = inp.dataset.cat;
    if (!conteo[cat]) return;
    const promedio = acum[cat] / conteo[cat];
    if (promedio > 0.05) {
      inp.value = String(Math.round(promedio * 10) / 10).replace(".", ",");
      aplicados++;
    }
  });

  if (!aplicados) { showToast("⚠️ Sin datos en los últimos 3 meses", "error"); return; }
  actualizarKpisPres();
  showToast(`✅ Sugerencia aplicada (${aplicados} categorías). Revisá y guardá.`, "success");
}

// ─── ANILLO DE PROGRESO DEL PRESUPUESTO ───────────────────────
function renderPresupuestoRing(totalGasto, sueldo, totalPres) {
  const el = document.getElementById("pres-ring-container");
  if (!el) return;
  if (sueldo === 0 && totalPres === 0) { el.innerHTML = ""; return; }

  const R    = 68;
  const circ = +(2 * Math.PI * R).toFixed(2);
  const off  = +(circ / 4).toFixed(2);   // empieza en la cima

  const pctG = sueldo > 0 ? Math.min(totalGasto / sueldo, 1) : 0;
  const pctP = sueldo > 0 ? Math.min(totalPres  / sueldo, 1) : 0;

  const ringColor = pctG >= 1 ? "var(--red)" : pctG >= 0.8 ? "var(--yellow)" : "var(--green)";
  const hexColor  = pctG >= 1 ? "#f87171"    : pctG >= 0.8 ? "#fbbf24"       : "#34d399";

  const dG = +(pctG * circ).toFixed(2);
  const dP = +(pctP * circ).toFixed(2);

  const pctGastStr = (pctG * 100).toFixed(0) + "%";
  const disponible = sueldo - totalGasto;
  const alertHtml  = disponible < 0
    ? `<div class="pres-ring-alert">⚠️ Gastado ${fmt(Math.abs(disponible))} más del sueldo</div>`
    : `<div class="pres-ring-alert-ok">✅ Margen disponible: ${fmt(disponible)}</div>`;

  el.innerHTML = `
    <div class="pres-ring-card">
      <svg width="160" height="160" viewBox="0 0 160 160" style="flex-shrink:0">
        <defs>
          <filter id="ring-glow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <!-- Track -->
        <circle cx="80" cy="80" r="${R}" fill="none" stroke="rgba(45,41,38,0.08)" stroke-width="13"/>
        <!-- Presupuestado (dim) -->
        <circle cx="80" cy="80" r="${R}" fill="none" stroke="${hexColor}" stroke-opacity=".2"
          stroke-width="13" stroke-dasharray="${dP} ${circ-dP}"
          stroke-dashoffset="${off}" stroke-linecap="round" transform="rotate(0 80 80)"/>
        <!-- Gastado (sólido + glow) -->
        <circle cx="80" cy="80" r="${R}" fill="none" stroke="${hexColor}"
          stroke-width="13" stroke-dasharray="${dG} ${circ-dG}"
          stroke-dashoffset="${off}" stroke-linecap="round"
          filter="url(#ring-glow)"
          style="transition:stroke-dasharray .8s cubic-bezier(0.34,1.1,0.64,1)"/>
        <!-- Centro -->
        <text x="80" y="74" text-anchor="middle" fill="#2D2926"
              font-size="22" font-weight="800" font-family="'Bricolage Grotesque',system-ui,sans-serif">${pctGastStr}</text>
        <text x="80" y="93" text-anchor="middle" fill="#8C7B72"
              font-size="11" font-family="'Libre Franklin',system-ui,sans-serif">del sueldo</text>
      </svg>
      <div class="pres-ring-stats">
        <div class="pres-ring-stat">
          <span class="pres-ring-stat-label"><span class="pres-status-dot" style="background:var(--green)"></span>Sueldo</span>
          <span class="pres-ring-stat-val" style="color:var(--green)">${fmt(sueldo)}</span>
        </div>
        <div class="pres-ring-stat">
          <span class="pres-ring-stat-label"><span class="pres-status-dot" style="background:var(--accent)"></span>Presupuestado</span>
          <span class="pres-ring-stat-val" style="color:var(--accent)">${fmt(totalPres)} <small style="color:var(--text-muted);font-weight:400">(${(pctP*100).toFixed(0)}%)</small></span>
        </div>
        <div class="pres-ring-stat">
          <span class="pres-ring-stat-label"><span class="pres-status-dot" style="background:${ringColor}"></span>Gastado efectivo</span>
          <span class="pres-ring-stat-val" style="color:${ringColor}">${fmt(totalGasto)} <small style="color:var(--text-muted);font-weight:400">(${pctGastStr})</small></span>
        </div>
        ${alertHtml}
      </div>
    </div>`;
}

function esTransferencia(t) {
  return CATS_TRANSFERENCIA.includes(t.categoria);
}

function montoEfectivoGasto(t) {
  if (t.tipo !== "Gasto") return 0;
  const resp = t.responsabilidad || "Mío";
  const m = Math.abs(Number(t.monto));
  if (resp === "De " + PARTNER)    return 0;
  if (resp === "Compartido") return m / 2;
  return m; // "Mío"
}

function destroyPresupuestoCharts() {
  Object.values(chartSparklines).forEach(c => c && c.destroy());
  chartSparklines = {};
  _lastHeatmapMes = null;
}

function buildMonthlyData(nMeses) {
  const hoy = new Date();
  const result = [];
  for (let i = nMeses - 1; i >= 0; i--) {
    let m = hoy.getMonth() + 1 - i;
    let y = hoy.getFullYear();
    while (m <= 0) { m += 12; y--; }
    const dataMes = allTransac.filter(t => {
      const { year, month } = getMesLiquidacion(t);
      return month === m && year === y;
    });
    const dataUsuario = dataMes.filter(t => (t.usuario || "Daniel") === USUARIO);
    const sueldo = dataUsuario
      .filter(t => t.tipo === "Ingreso" && CATS_INGRESO_REAL.includes(t.categoria) && (t.moneda || "ARS") === "ARS")
      .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
    const gastado = categGasto
      .filter(c => !esTransferencia({ categoria: c }))
      .reduce((total, cat) => {
        const mio  = dataUsuario.filter(t => t.tipo==="Gasto" && t.categoria===cat && (t.responsabilidad||"Mío")==="Mío" && !esTransferencia(t) && (t.moneda||"ARS")==="ARS").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
        const comp = dataMes.filter(t => t.tipo==="Gasto" && t.categoria===cat && t.responsabilidad==="Compartido" && !esTransferencia(t) && (t.moneda||"ARS")==="ARS").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
        return total + mio + comp * 0.5;
      }, 0);
    result.push({ m, y, sueldo, gastado });
  }
  return result;
}

function renderKpiSparklines(monthly) {
  const sparkCfg = (data, color) => ({
    type: "line",
    data: { labels: data.map((_,i) => i), datasets: [{ data, borderColor: color, borderWidth: 1.5, fill: true, backgroundColor: color.replace("rgb","rgba").replace(")",",0.1)"), tension: 0.4, pointRadius: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } }
  });
  const pairs = [
    ["spark-sueldo",  monthly.map(d => d.sueldo),  "rgb(52,211,153)"],
    ["spark-gastado", monthly.map(d => d.gastado), "rgb(248,113,113)"],
  ];
  pairs.forEach(([id, data, color]) => {
    const el = document.getElementById(id);
    if (!el) return;
    chartSparklines[id] = new Chart(el, sparkCfg(data, color));
  });
}

function irATransaccionesDia(anio, mes, dia) {
  const pad = n => String(n).padStart(2, "0");
  _filFechaExacta = `${anio}-${pad(mes)}-${pad(dia)}`;
  const selMes = document.getElementById("fil-mes");
  const selAnio = document.getElementById("fil-anio");
  if (selMes) selMes.value = mes;
  if (selAnio) selAnio.value = anio;
  navegarA("transacciones");
  filtrarTabla();
}

function renderHeatmapMes() {
  const filMes  = parseInt(document.getElementById("pres-mes")?.value || 0);
  const filAnio = parseInt(document.getElementById("pres-anio")?.value || 0);
  if (!filMes || !filAnio) return;
  _lastHeatmapMes = `${filMes}-${filAnio}`;
  const el = document.getElementById("heatmap-mes");
  if (!el) return;
  const byDay = {};
  allTransac.forEach(t => {
    const { year, month } = getMesLiquidacion(t);
    if (month !== filMes || year !== filAnio) return;
    if (t.tipo !== "Gasto") return;
    if ((t.usuario || "Daniel") !== USUARIO) return;
    if ((t.moneda || "ARS") !== "ARS") return;
    if (esTransferencia(t)) return;
    const d = parseInt((t.fecha || "").split("-")[2] || 0);
    if (d) byDay[d] = (byDay[d] || 0) + Math.abs(Number(t.monto));
  });
  const maxG = Math.max(...Object.values(byDay), 1);
  const daysInMonth = new Date(filAnio, filMes, 0).getDate();
  const offset = (new Date(filAnio, filMes - 1, 1).getDay() + 6) % 7;
  const hoy = new Date();
  const isCurrentMonth = filMes === hoy.getMonth() + 1 && filAnio === hoy.getFullYear();
  const MESES = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  // Stats para el header
  const topDay = Object.entries(byDay).sort((a,b) => b[1]-a[1])[0];
  const daysWithSpend = Object.keys(byDay).length;
  const statHtml = topDay
    ? `${daysWithSpend} días activos · pico <strong>${fmt(topDay[1])}</strong> el día ${topDay[0]}`
    : "Sin gastos este mes";

  let html = `<div class="heatmap-top">
    <span class="heatmap-top-title">Actividad diaria · ${MESES[filMes]} ${filAnio}</span>
    <span class="heatmap-top-stat">${statHtml}</span>
  </div>`;
  html += `<div class="heatmap-cal">`;
  html += ["L","M","M","J","V","S","D"].map(d => `<div class="heatmap-header">${d}</div>`).join("");
  for (let i = 0; i < offset; i++) html += `<div class="heatmap-day heatmap-empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const g = byDay[d] || 0;
    const heat = g > 0 ? Math.max(0.12, (g / maxG)).toFixed(2) : 0;
    const isToday = isCurrentMonth && d === hoy.getDate();
    const clickable = g > 0 ? ` heatmap-clickable` : "";
    const onclick = g > 0 ? ` onclick="irATransaccionesDia(${filAnio},${filMes},${d})"` : "";
    const cls = `heatmap-day${isToday ? " heatmap-today" : ""}${g === 0 ? " heatmap-zero" : ""}${clickable}`;
    const label = g > 0
      ? `Día ${d}: ${fmt(g)} en gastos`
      : `Día ${d}: sin gastos`;
    const a11y = g > 0
      ? ` role="button" tabindex="0" aria-label="${label}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();irATransaccionesDia(${filAnio},${filMes},${d})}"`
      : ` aria-label="${label}" aria-disabled="true"`;
    const heatNum = parseFloat(heat);
    const heatText = heatNum > 0.45 ? 'rgba(255,252,249,.92)' : 'rgba(50,32,20,.75)';
    const heatStyle = heat > 0 ? `--heat:${heat};--heat-text:${heatText}` : `--heat:0`;
    html += `<div class="${cls}" style="${heatStyle}"${onclick}${a11y}>${d}</div>`;
  }
  html += `</div>`;
  el.innerHTML = html;
}

function renderPresupuesto() {
  destroyPresupuestoCharts();
  const mes  = parseInt(document.getElementById("pres-mes").value);
  const anio = parseInt(document.getElementById("pres-anio").value);

  // Todas las transacciones del mes (ambos usuarios, necesario para el cálculo Compartido)
  const dataMes = allTransac.filter(t => {
    const { year, month } = getMesLiquidacion(t);
    return month === mes && year === anio;
  });
  // Solo las transacciones de Daniel (para "Mío" y KPI sueldo)
  // Excluir Liquidaciones — son transferencias de balance compartido, no gastos/ingresos reales
  const dataMesDaniel = dataMes.filter(t => (t.usuario || "Daniel") === USUARIO && t.descripcion !== "Liquidación");
  const dataMesSinLiq = dataMes.filter(t => t.descripcion !== "Liquidación");

  // Sueldo KPI = ingresos reales del usuario (ARS)
  const sueldo = dataMesDaniel
    .filter(t => t.tipo === "Ingreso" && CATS_INGRESO_REAL.includes(t.categoria)
             && (t.moneda || "ARS") === "ARS")
    .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
  // Para Ama: sueldoEfectivo incluye saldo USD × MEP
  const ingresosUSDPres = dataMesDaniel
    .filter(t => t.tipo === "Ingreso" && !esTransferencia(t) && (t.moneda || "ARS") === "USD")
    .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
  const gastosUSDPres = dataMesDaniel
    .filter(t => t.tipo === "Gasto" && !esTransferencia(t) && (t.moneda || "ARS") === "USD")
    .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
  const saldoUSDPres = ingresosUSDPres - gastosUSDPres;
  const usdEnARSPres = USUARIO.toLowerCase() === "ama" && tipoCambioMEP ? saldoUSDPres * tipoCambioMEP : 0;
  const sueldoEfectivo = sueldo + usdEnARSPres;

  // Gasto efectivo por categoría usando lógica de responsabilidad:
  //   "Mío" gastos Daniel           → 100%
  //   "Compartido" gastos (todos)   → base compartida, neteada con ingresos Compartido, × 50%
  //   "De Ama" gastos Daniel        → 0% (excluido)
  //   "Mío" ingresos Daniel         → restan al gasto (reintegros propios)
  const gastoPorCat = {};
  let surplusTotal = 0;
  categGasto.forEach(cat => {
    // Gastos "Mío" de Daniel → 100% (neteado con ingresos "Mío")
    const gastosMio = dataMesDaniel
      .filter(t => t.tipo === "Gasto" && t.categoria === cat
               && (t.responsabilidad || "Mío") === "Mío"
               && !esTransferencia(t) && (t.moneda || "ARS") === "ARS")
      .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
    const ingresosMio = dataMesDaniel
      .filter(t => t.tipo === "Ingreso" && t.categoria === cat
               && (t.responsabilidad || "Mío") === "Mío"
               && !esTransferencia(t) && (t.moneda || "ARS") === "ARS")
      .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);

    // Gastos "Compartido" de ambos usuarios → base compartida
    const gastosComp = dataMesSinLiq
      .filter(t => t.tipo === "Gasto" && t.categoria === cat
               && t.responsabilidad === "Compartido"
               && !esTransferencia(t) && (t.moneda || "ARS") === "ARS")
      .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);

    // Ingresos "Compartido" de ambos usuarios → reducen la base compartida
    const ingresosComp = dataMesSinLiq
      .filter(t => t.tipo === "Ingreso" && t.categoria === cat
               && t.responsabilidad === "Compartido"
               && !esTransferencia(t) && (t.moneda || "ARS") === "ARS")
      .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);

    // Gastos "De [usuario]" del partner → 100% del usuario (partner pagó por él)
    const deJGasto = dataMesSinLiq
      .filter(t => t.tipo === "Gasto" && t.categoria === cat
               && t.responsabilidad === "De " + USUARIO
               && !esTransferencia(t) && (t.moneda || "ARS") === "ARS")
      .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
    const deJIngreso = dataMesSinLiq
      .filter(t => t.tipo === "Ingreso" && t.categoria === cat
               && t.responsabilidad === "De " + USUARIO
               && !esTransferencia(t) && (t.moneda || "ARS") === "ARS")
      .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);

    const netMio  = gastosMio - ingresosMio;
    const netComp = gastosComp - ingresosComp;
    const netDeJ  = deJGasto - deJIngreso;
    surplusTotal += Math.max(0, -netMio) + Math.max(0, -netComp) * 0.5 + Math.max(0, -netDeJ);
    gastoPorCat[cat] = Math.max(0, netMio) + Math.max(0, netComp) * 0.5 + Math.max(0, netDeJ);
  });

  // Totales KPI — presupuestoActual[cat] almacena % (0–100), se convierte a monto según sueldoEfectivo
  const totalPresARS = categGasto.reduce((s, c) => s + ((presupuestoActual[c] || 0) / 100) * sueldoEfectivo, 0);
  const totalGasto   = categGasto.reduce((s, c) => s + (gastoPorCat[c] || 0), 0);
  const disponible   = sueldoEfectivo - totalPresARS;

  // ── ALERTAS DE TENDENCIA ─────────────────────────────────────
  (function renderTendencias() {
    const prevMes  = mes === 1 ? 12 : mes - 1;
    const prevAnio = mes === 1 ? anio - 1 : anio;
    const dataPrev = allTransac.filter(t => {
      const { year, month } = getMesLiquidacion(t);
      return month === prevMes && year === prevAnio;
    });
    const dataPrevUsuario = dataPrev.filter(t => (t.usuario || "Daniel") === USUARIO);
    const prevGastoPorCat = {};
    categGasto.forEach(cat => {
      const gastosMio   = dataPrevUsuario.filter(t => t.tipo==="Gasto" && t.categoria===cat && (t.responsabilidad||"Mío")==="Mío" && !esTransferencia(t) && (t.moneda||"ARS")==="ARS").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
      const ingresosMio = dataPrevUsuario.filter(t => t.tipo==="Ingreso" && t.categoria===cat && (t.responsabilidad||"Mío")==="Mío" && !esTransferencia(t) && (t.moneda||"ARS")==="ARS").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
      const gastosComp  = dataPrev.filter(t => t.tipo==="Gasto" && t.categoria===cat && t.responsabilidad==="Compartido" && !esTransferencia(t) && (t.moneda||"ARS")==="ARS").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
      const ingresosComp= dataPrev.filter(t => t.tipo==="Ingreso" && t.categoria===cat && t.responsabilidad==="Compartido" && !esTransferencia(t) && (t.moneda||"ARS")==="ARS").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
      const deJGasto    = dataPrev.filter(t => t.tipo==="Gasto" && t.categoria===cat && t.responsabilidad==="De "+USUARIO && !esTransferencia(t) && (t.moneda||"ARS")==="ARS").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
      const deJIngreso  = dataPrev.filter(t => t.tipo==="Ingreso" && t.categoria===cat && t.responsabilidad==="De "+USUARIO && !esTransferencia(t) && (t.moneda||"ARS")==="ARS").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
      const netComp = Math.max(0, gastosComp - ingresosComp);
      prevGastoPorCat[cat] = Math.max(0, gastosMio - ingresosMio) + netComp * 0.5 + Math.max(0, deJGasto - deJIngreso);
    });

    const umbralARS = 1000;
    const umbralPct = 0.15;
    const alertas = categGasto.map(cat => {
      const actual = gastoPorCat[cat] || 0;
      const prev   = prevGastoPorCat[cat] || 0;
      if (actual < umbralARS && prev < umbralARS) return null;
      if (prev === 0) return actual > umbralARS ? { cat, delta: 1, actual, _isNew: true } : null;
      const pct = (actual - prev) / prev;
      if (Math.abs(pct) < umbralPct) return null;
      return { cat, delta: pct, actual };
    }).filter(Boolean).sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 4);

    const el = document.getElementById("pres-tendencias");
    if (!el) return;
    if (!alertas.length) { el.style.display = "none"; return; }
    const chips = alertas.map(a => {
      const isNew  = a.delta === 1 && (a._isNew || false);
      const pctStr = a._isNew ? "Nuevo" : (a.delta > 0 ? "+" : "") + Math.round(a.delta * 100) + "%";
      const cls    = a.delta > 0 ? "up" : "down";
      const icon   = a.delta > 0 ? "🔺" : "🔻";
      return `<span class="tendencia-chip ${cls}">${icon} ${a.cat} ${pctStr}</span>`;
    }).join("");
    el.style.display = "";
    el.innerHTML = `<div class="tendencias-label">Tendencias vs mes anterior</div><div class="tendencia-chips">${chips}</div>`;
  })();

  // KPIs con animación count-up
  const kpiTotal = document.getElementById("pres-kpi-total");
  kpiTotal.style.color = totalPresARS > sueldoEfectivo && sueldoEfectivo > 0 ? "var(--red)" : "var(--accent)";
  animateKPI(kpiTotal, totalPresARS, fmt);

  animateKPI(document.getElementById("pres-kpi-sueldo"), sueldoEfectivo, fmt);
  const sublSueldo = document.getElementById("pres-kpi-sueldo-sub");
  if (sublSueldo) {
    sublSueldo.textContent = USUARIO.toLowerCase() === "ama" && tipoCambioMEP && saldoUSDPres !== 0
      ? `ARS + ${fmtMoneda(Math.abs(saldoUSDPres),"USD")}×$${fmt(tipoCambioMEP).replace(/[^0-9,.]/g,"")} MEP`
      : "ingresos del mes";
  }
  animateKPI(document.getElementById("pres-kpi-gastado"), totalGasto, fmt);

  const kpiDisp = document.getElementById("pres-kpi-disponible");
  kpiDisp.className = "kpi-value " + (disponible >= 0 ? "balance-pos" : "expense");
  animateKPI(kpiDisp, Math.abs(disponible), v => (disponible < 0 ? "-" : "") + fmt(v));

  const saldoReal = sueldoEfectivo - totalGasto + surplusTotal;
  const kpiSaldoReal = document.getElementById("pres-kpi-saldo-real");
  if (kpiSaldoReal) {
    kpiSaldoReal.className = "kpi-value " + (saldoReal >= 0 ? "balance-pos" : "expense");
    animateKPI(kpiSaldoReal, Math.abs(saldoReal), v => (saldoReal < 0 ? "-" : "") + fmt(v));
  }
  const heroBar = document.getElementById("pres-hero-bar");
  if (heroBar && sueldoEfectivo > 0) {
    const pctUsado = Math.min(totalGasto / sueldoEfectivo, 1);
    heroBar.style.transform = `scaleX(${Math.min(pctUsado, 1).toFixed(3)})`;
    heroBar.className = "kpi-hero-bar-fill " + (pctUsado < 0.8 ? "bar-ok" : pctUsado < 1 ? "bar-warn" : "bar-over");
    const heroSub = document.getElementById("pres-kpi-saldo-real-sub");
    if (heroSub) heroSub.textContent = `Sueldo − Gastado real · ${Math.round(pctUsado * 100)}% usado`;
  }

  // KPI Saldo en USD (ambos usuarios si hay MEP)
  const mepCard = document.getElementById("pres-kpi-mep-card");
  if (mepCard) {
    if (tipoCambioMEP > 0 && saldoReal !== 0) {
      const saldoUSD = saldoReal / tipoCambioMEP;
      const mepVal = document.getElementById("pres-kpi-mep-val");
      const mepSub = document.getElementById("pres-kpi-mep-sub");
      if (mepVal) {
        mepVal.textContent = fmtMoneda(Math.abs(saldoUSD), "USD");
        mepVal.className = "kpi-value " + (saldoUSD >= 0 ? "balance-pos" : "expense");
      }
      if (mepSub) mepSub.textContent = `MEP $${fmt(tipoCambioMEP).replace(/[^0-9,.]/g,"")}`;
      mepCard.style.display = "";
    } else {
      mepCard.style.display = "none";
    }
  }

  const kpiDiario = document.getElementById("pres-kpi-diario");
  if (kpiDiario) {
    const hoy = new Date();
    const esEsteMes = mes === hoy.getMonth() + 1 && anio === hoy.getFullYear();
    if (esEsteMes && saldoReal > 0) {
      const diasRestantes = new Date(anio, mes, 0).getDate() - hoy.getDate() + 1;
      const gastoDiario = saldoReal / diasRestantes;
      kpiDiario.className = "kpi-value balance-pos";
      animateKPI(kpiDiario, gastoDiario, fmt);
      document.getElementById("pres-kpi-diario-sub").textContent = `Real disponible ÷ ${diasRestantes}d restantes`;
    } else {
      kpiDiario.textContent = "—";
      kpiDiario.className = "kpi-value";
      document.getElementById("pres-kpi-diario-sub").textContent = saldoReal <= 0 ? "Sin margen disponible" : "Mes histórico";
    }
  }

  const subDisp = document.getElementById("pres-kpi-disponible-sub");
  if (subDisp) {
    subDisp.textContent = "Sueldo − Presupuestado";
  }

  // KPI "Ahorro" categoría — mes actual + acumulado total
  const ahorroMesCat = dataMesDaniel
    .filter(t => t.categoria === "Ahorro" && !esTransferencia(t))
    .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
  const ahorroAcumCat = allTransac
    .filter(t => (t.usuario || "Daniel") === USUARIO && t.categoria === "Ahorro" && !esTransferencia(t))
    .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
  const kpiAhorroCat = document.getElementById("kpi-ahorro-cat");
  if (kpiAhorroCat) {
    animateKPI(kpiAhorroCat, ahorroMesCat, fmt);
    document.getElementById("kpi-ahorro-cat-sub").textContent = `total acumulado: ${fmt(ahorroAcumCat)}`;
  }

  // Desktop Mi mes — Desglose del sueldo + stat cards
  (function() {
    const _s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    _s('mm-dl-sueldo',  fmt(sueldoEfectivo));
    _s('mm-dl-gastado', fmt(totalGasto));
    _s('mm-dl-presup',  fmt(totalPresARS));
    const totalPct = categGasto.reduce((s, c) => s + (presupuestoActual[c] || 0), 0);
    _s('mm-dl-presup-sub', totalPct.toFixed(0) + '% del sueldo');
    const margen = sueldoEfectivo - totalPresARS;
    const mEl = document.getElementById('mm-dl-margen');
    if (mEl) { mEl.textContent = fmt(Math.abs(margen)); mEl.style.color = margen >= 0 ? 'var(--save)' : 'var(--neg)'; }
    _s('mm-sc-ahorro',     fmt(ahorroMesCat));
    _s('mm-sc-ahorro-sub', 'acumulado: ' + fmt(ahorroAcumCat));
    const partnerEl = document.getElementById('mm-sc-comp-partner');
    if (partnerEl) partnerEl.textContent = PARTNER;
  })();

  const subTotal = document.getElementById("pres-kpi-total-sub");
  if (subTotal) {
    const totalPct = categGasto.reduce((s, c) => s + (presupuestoActual[c] || 0), 0);
    subTotal.textContent = totalPct.toFixed(0) + "% del sueldo asignado";
  }

  // Anillo de progreso total
  renderPresupuestoRing(totalGasto, sueldoEfectivo, totalPresARS);

  // Tabla
  const tbody = document.getElementById("pres-tbody");
  // Pacing: días transcurridos vs días del mes (solo mes actual)
  const hoyPacing = new Date();
  const esEsteMesPacing = mes === hoyPacing.getMonth() + 1 && anio === hoyPacing.getFullYear();
  const daysPct = esEsteMesPacing ? hoyPacing.getDate() / new Date(anio, mes, 0).getDate() : null;

  tbody.innerHTML = categGasto.map(cat => {
    const pct_sueldo = presupuestoActual[cat] || 0;     // % guardado
    const pres       = (pct_sueldo / 100) * sueldoEfectivo;     // monto ARS calculado
    const gasto      = gastoPorCat[cat]       || 0;
    const rest  = pres - gasto;
    const pct   = pres > 0 ? (gasto / pres) * 100 : 0;

    const isZero  = pres === 0 && gasto === 0;
    const isOver  = pres > 0 && gasto > pres;
    const isWarn  = !isOver && pres > 0 && pct >= 80;
    const isOk    = pres > 0 && pct < 80;
    const rowCls  = isZero ? "pres-row-zero" : isOver ? "pres-row-over" : isWarn ? "pres-row-warn" : isOk ? "pres-row-ok" : "";

    const dotColor  = isOver ? "var(--red)" : isWarn ? "var(--yellow)" : pres > 0 ? "var(--green)" : "var(--border2)";
    const barClass  = isOver ? "bar-over" : isWarn ? "bar-warn" : "bar-ok";
    const restColor = isOver ? "var(--red)" : isWarn ? "var(--yellow)" : "var(--green)";

    // Pacing badge — solo mes actual, solo si hay presupuesto y sueldo
    let pacingHtml = "";
    if (daysPct !== null && pres > 0 && sueldoEfectivo > 0) {
      const spendPct = gasto / pres; // 0-1+
      const threshold = Math.min(daysPct + 0.10, 1);
      if (spendPct > 1)          pacingHtml = `<span class="pres-pacing over">Excedido</span>`;
      else if (spendPct > threshold) pacingHtml = `<span class="pres-pacing warn">Cuidado</span>`;
      else                           pacingHtml = `<span class="pres-pacing ok">En track</span>`;
    }

    const gastoStr = gasto > 0
      ? `<span style="color:${isOver ? "var(--red)" : "var(--text)"};font-weight:600">${fmt(gasto)}</span>`
      : `<span style="color:var(--text-muted)">—</span>`;

    const restStr = pres > 0
      ? `<span style="color:${restColor};font-weight:600">${rest < 0 ? "−"+fmt(Math.abs(rest)) : fmt(rest)}</span>`
      : `<span style="color:var(--text-muted)">—</span>`;

    const barHtml = pres > 0
      ? `<div class="pres-bar-wrap">
           <div class="pres-bar-bg">
             <div class="pres-bar-fill ${barClass}" style="--bar-w:${Math.min(pct,100).toFixed(1)}%"></div>
           </div>
           <span class="pres-bar-pct" style="color:${dotColor}">${pct.toFixed(0)}%</span>
         </div>`
      : gasto > 0
        ? `<span style="color:var(--text-muted);font-size:.78rem">Sin presupuesto</span>`
        : "";

    const catEmoji = getCatEmoji(cat, '');
    return `<tr class="${rowCls}">
      <td><span style="display:inline-flex;align-items:center;gap:7px">${catEmoji ? `<span style="font-size:1.05rem;width:24px;text-align:center">${catEmoji}</span>` : `<span class="pres-status-dot" style="background:${dotColor}"></span>`}<span>${cat}</span></span>${pacingHtml}</td>
      <td style="text-align:right">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:.3rem">
          <input type="text" inputmode="decimal" class="pres-input" data-cat="${cat}"
                 value="${pct_sueldo > 0 ? String(pct_sueldo).replace('.', ',') : ''}" placeholder="—"
                 style="max-width:68px" oninput="actualizarKpisPres()">
          <span style="color:var(--text-muted);font-size:.8rem">%</span>
        </div>
        <span class="pres-monto-live" style="color:var(--text-muted);font-size:.71rem;display:block;text-align:right;margin-top:.1rem">${sueldo > 0 && pct_sueldo > 0 ? fmt(pres) : ''}</span>
      </td>
      <td style="text-align:right">${gastoStr}</td>
      <td style="text-align:right">${restStr}</td>
      <td>${barHtml}</td>
    </tr>`;
  }).join("");

  // Footer de totales
  const tfoot = document.getElementById("pres-tfoot");
  if (tfoot) {
    const totalPctAsig = categGasto.reduce((s, c) => s + (presupuestoActual[c] || 0), 0);
    const totalRest    = totalPresARS - totalGasto;
    const totalEjec    = totalPresARS > 0 ? (totalGasto / totalPresARS * 100).toFixed(0) : 0;
    tfoot.innerHTML = `<tr class="pres-tfoot-row">
      <td><strong>TOTAL</strong></td>
      <td style="text-align:right"><strong>${totalPctAsig.toFixed(0)}% <small style="color:var(--text-muted);font-weight:400">(${fmt(totalPresARS)})</small></strong></td>
      <td style="text-align:right"><strong style="color:var(--red)">${fmt(totalGasto)}</strong></td>
      <td style="text-align:right"><strong style="color:${totalRest>=0?"var(--green)":"var(--red)"}">${totalRest<0?"−":""}${fmt(Math.abs(totalRest))}</strong></td>
      <td><strong style="color:var(--text-muted)">${totalEjec}% ejecutado</strong></td>
    </tr>`;
  }

  // KPI: balance compartido
  (function() {
    const card   = document.getElementById("pres-kpi-compartido-card");
    if (!card) return;
    const { balanceARS, balanceUSD } = _calcularBalanceCompartido(mes, anio);
    if (Math.abs(balanceARS) < 1 && Math.abs(balanceUSD) < 0.01) { card.style.display = "none"; return; }
    card.style.display = "";
    const valEl   = document.getElementById("pres-kpi-compartido-val");
    const subEl   = document.getElementById("pres-kpi-compartido-sub");
    const labelEl = document.getElementById("pres-kpi-compartido-label");
    const parts = [];
    if (Math.abs(balanceARS) >= 1) parts.push(fmt(Math.abs(balanceARS)));
    if (Math.abs(balanceUSD) >= 0.01) parts.push(fmtMoneda(Math.abs(balanceUSD), "USD"));
    if (valEl) valEl.textContent = parts.join(" + ");
    const teDeben = balanceARS > 0 || (balanceARS === 0 && balanceUSD > 0);
    if (teDeben && balanceUSD >= 0 && balanceARS >= 0) {
      if (valEl) valEl.className = "kpi-value balance-pos";
      if (labelEl) labelEl.textContent = `${PARTNER} te debe`;
    } else if (!teDeben && balanceUSD <= 0 && balanceARS <= 0) {
      if (valEl) valEl.className = "kpi-value expense";
      if (labelEl) labelEl.textContent = `Le debés a ${PARTNER}`;
    } else {
      if (valEl) valEl.className = "kpi-value";
      if (labelEl) labelEl.textContent = "Compartidos";
    }
    if (subEl) subEl.textContent = "Ver detalle en Compartidos";
    // Stat card desktop
    const scVal = document.getElementById('mm-sc-comp-val');
    const scLbl = document.getElementById('mm-sc-comp-label');
    if (scVal) { scVal.textContent = parts.join(' + '); scVal.style.color = teDeben ? 'var(--pos)' : 'var(--neg)'; }
    if (scLbl) scLbl.textContent = teDeben ? `${PARTNER} te debe` : `Le debés a ${PARTNER}`;
    // Sync cuotas count to stat card sub
    const cuotasCount = document.getElementById('mm-sc-cuotas-count');
    if (cuotasCount) {
      const c = document.getElementById('cuotas-count');
      if (c) cuotasCount.textContent = c.textContent;
    }
  })();

  // Hero Cálida + categorías
  _renderMMHero(saldoReal, sueldoEfectivo, totalGasto, mes, anio);
  _renderMMCats(gastoPorCat, sueldoEfectivo);

  // Sprint 2 — heatmap + sparklines (después de HTML escrito)
  renderHeatmapMes();
  const monthly = buildMonthlyData(6);
  renderKpiSparklines(monthly);
}

function _renderMMHero(saldoReal, sueldoEfectivo, totalGasto, mes, anio) {
  const $ = id => document.getElementById(id);
  const heroAmt = $("mm-hero-amount");
  if (heroAmt) heroAmt.textContent = fmt(Math.max(0, saldoReal));
  const heroSub = $("mm-hero-sub");
  if (heroSub) heroSub.textContent = `Sueldo ${fmt(sueldoEfectivo)} − gastado real ${fmt(totalGasto)}`;

  const hoy = new Date();
  const esEsteMes = mes === hoy.getMonth() + 1 && anio === hoy.getFullYear();

  const diasRestantes = esEsteMes
    ? Math.max(1, new Date(anio, mes, 0).getDate() - hoy.getDate() + 1)
    : 0;

  const statDiario = $("mm-stat-diario");
  if (statDiario) {
    if (esEsteMes && saldoReal > 0) {
      statDiario.textContent = fmt(Math.round(saldoReal / diasRestantes));
    } else {
      statDiario.textContent = "—";
    }
  }

  const statDias = $("mm-stat-dias");
  if (statDias) {
    statDias.textContent = esEsteMes ? diasRestantes + " días" : "—";
  }

  const statUSD = $("mm-stat-usd");
  if (statUSD) {
    if (tipoCambioMEP > 0 && saldoReal > 0) {
      statUSD.textContent = "U$S " + Math.round(saldoReal / tipoCambioMEP).toLocaleString("es-AR");
    } else {
      statUSD.textContent = "—";
    }
  }

  const qsIng = $("mm-qs-ingresos");
  if (qsIng) qsIng.textContent = fmt(sueldoEfectivo);

  const qsGas = $("mm-qs-gastos");
  if (qsGas) qsGas.textContent = fmt(totalGasto);

  const qsAho = $("mm-qs-ahorro");
  if (qsAho && sueldoEfectivo > 0) {
    const pct = Math.round(Math.max(0, (sueldoEfectivo - totalGasto) / sueldoEfectivo) * 100);
    qsAho.textContent = pct + "%";
  }
}

const _CAT_EMOJI = {
  'Alquiler':'🏠','Mercado':'🛒','Supermercado':'🛒',
  'Comida':'🍽️','Salidas':'🍽️','Comida y salidas':'🍽️','Restaurantes':'🍽️',
  'Transporte':'🚗','Nafta':'⛽','Auto':'🚗',
  'Servicios':'💡','Suscripciones':'📺',
  'Salud':'💊','Médico':'💊','Farmacia':'💊',
  'Ahorro':'🐷','Inversiones':'📈',
  'Ropa':'👔','Tecnología':'💻','Electrónica':'💻',
  'Entretenimiento':'🎮','Viajes':'✈️',
  'Educación':'📚','Mascotas':'🐾',
  'Gym':'🏋️','Deporte':'🏋️',
  'Limpieza':'🧹','Hogar':'🏠',
};

let _userCatEmojis = null;

function _loadUserCatEmojis() {
  try {
    _userCatEmojis = JSON.parse(localStorage.getItem(USUARIO + "_cat_emojis") || "{}");
  } catch { _userCatEmojis = {}; }
}

function getCatEmoji(cat, fallback) {
  if (_userCatEmojis === null) _loadUserCatEmojis();
  return _userCatEmojis[cat] || _CAT_EMOJI[cat] || fallback || '💳';
}

function setCatEmoji(cat, emoji) {
  if (_userCatEmojis === null) _loadUserCatEmojis();
  if (emoji) _userCatEmojis[cat] = emoji;
  else delete _userCatEmojis[cat];
  localStorage.setItem(USUARIO + "_cat_emojis", JSON.stringify(_userCatEmojis));
}

function _renderMMCats(gastoPorCat, sueldoEfectivo) {
  const cont = document.getElementById("mm-cats-card");
  if (!cont) return;

  const rows = categGasto
    .map(cat => {
      const gasto = gastoPorCat[cat] || 0;
      const presARS = ((presupuestoActual[cat] || 0) / 100) * sueldoEfectivo;
      return { cat, gasto, presARS };
    })
    .filter(r => r.gasto > 0 || r.presARS > 0)
    .sort((a, b) => b.gasto - a.gasto)
    .slice(0, 5);

  if (!rows.length) { cont.innerHTML = '<div style="padding:1rem;color:var(--text-faint);font-size:.88rem">Sin gastos registrados</div>'; return; }

  cont.innerHTML = rows.map(({ cat, gasto, presARS }) => {
    const emoji = getCatEmoji(cat, '📌');
    const used = presARS > 0 ? Math.min(gasto / presARS, 1) : 0;
    const pctNum = Math.round(used * 100);
    const restante = presARS > 0 ? presARS - gasto : 0;
    const barColor = used >= 1 ? 'var(--neg)' : used >= 0.8 ? 'var(--warn)' : 'var(--brand)';
    const pctColor = used >= 1 ? 'var(--neg)' : used >= 0.8 ? 'var(--warn)' : 'var(--text-dim)';
    const restText = presARS > 0
      ? (restante >= 0 ? `Quedan ${fmt(restante)}` : `Excedido ${fmt(Math.abs(restante))}`)
      : fmt(gasto);
    return `<div class="mm-cat-row">
      <div class="mm-cat-top">
        <div class="mm-cat-icon">${emoji}</div>
        <div style="flex:1">
          <div class="mm-cat-name">${cat}</div>
          <div class="mm-cat-rest">${restText}</div>
        </div>
        ${presARS > 0 ? `<div class="mm-cat-pct" style="color:${pctColor}">${pctNum}%</div>` : ''}
      </div>
      ${presARS > 0 ? `<div class="mm-cat-bar-wrap"><div class="mm-cat-bar-track"><div class="mm-cat-bar-fill" style="width:${Math.min(pctNum,100)}%;background:${barColor}"></div></div></div>` : ''}
    </div>`;
  }).join('');
}

// Actualiza solo los KPIs al cambiar un input (sin re-renderizar la tabla)
function actualizarKpisPres() {
  const mes  = parseInt(document.getElementById("pres-mes").value);
  const anio = parseInt(document.getElementById("pres-anio").value);

  const dataMes = allTransac.filter(t => {
    const { year, month } = getMesLiquidacion(t);
    return month === mes && year === anio;
  });
  const dataMesDaniel = dataMes.filter(t => (t.usuario || "Daniel") === USUARIO && t.descripcion !== "Liquidación");
  const dataMesSinLiq = dataMes.filter(t => t.descripcion !== "Liquidación");

  const sueldo = dataMesDaniel
    .filter(t => t.tipo === "Ingreso" && CATS_INGRESO_REAL.includes(t.categoria)
             && (t.moneda || "ARS") === "ARS")
    .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
  const ingUSDKpi = dataMesDaniel
    .filter(t => t.tipo === "Ingreso" && !esTransferencia(t) && (t.moneda || "ARS") === "USD")
    .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
  const gasUSDKpi = dataMes
    .filter(t => t.tipo === "Gasto" && !esTransferencia(t) && (t.moneda || "ARS") === "USD")
    .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
  const usdEnARSKpi = USUARIO.toLowerCase() === "ama" && tipoCambioMEP ? (ingUSDKpi - gasUSDKpi) * tipoCambioMEP : 0;
  const sueldoEfectivo = sueldo + usdEnARSKpi;

  const gastoPorCat = {};
  let surplusTotal = 0;
  categGasto.forEach(cat => {
    const gastosMio = dataMesDaniel
      .filter(t => t.tipo === "Gasto" && t.categoria === cat
               && (t.responsabilidad || "Mío") === "Mío"
               && !esTransferencia(t) && (t.moneda || "ARS") === "ARS")
      .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
    const ingresosMio = dataMesDaniel
      .filter(t => t.tipo === "Ingreso" && t.categoria === cat
               && (t.responsabilidad || "Mío") === "Mío"
               && !esTransferencia(t) && (t.moneda || "ARS") === "ARS")
      .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
    const gastosComp = dataMesSinLiq
      .filter(t => t.tipo === "Gasto" && t.categoria === cat
               && t.responsabilidad === "Compartido"
               && !esTransferencia(t) && (t.moneda || "ARS") === "ARS")
      .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
    const ingresosComp = dataMesSinLiq
      .filter(t => t.tipo === "Ingreso" && t.categoria === cat
               && t.responsabilidad === "Compartido"
               && !esTransferencia(t) && (t.moneda || "ARS") === "ARS")
      .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
    const deJGastoP = dataMesSinLiq
      .filter(t => t.tipo === "Gasto" && t.categoria === cat
               && t.responsabilidad === "De " + USUARIO
               && !esTransferencia(t) && (t.moneda || "ARS") === "ARS")
      .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
    const deJIngresoP = dataMesSinLiq
      .filter(t => t.tipo === "Ingreso" && t.categoria === cat
               && t.responsabilidad === "De " + USUARIO
               && !esTransferencia(t) && (t.moneda || "ARS") === "ARS")
      .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
    const netMio  = gastosMio - ingresosMio;
    const netComp = gastosComp - ingresosComp;
    const netDeJ  = deJGastoP - deJIngresoP;
    surplusTotal += Math.max(0, -netMio) + Math.max(0, -netComp) * 0.5 + Math.max(0, -netDeJ);
    gastoPorCat[cat] = Math.max(0, netMio) + Math.max(0, netComp) * 0.5 + Math.max(0, netDeJ);
  });

  // Los inputs almacenan porcentajes (0–100); se convierte a monto con el sueldo
  let totalPctPres = 0;
  document.querySelectorAll("#pres-tbody .pres-input").forEach(inp => {
    const pct = parsearDecimal(inp.value);
    totalPctPres += pct;
    // Actualizar importe en vivo junto al input
    const liveEl = inp.closest("td") && inp.closest("td").querySelector(".pres-monto-live");
    if (liveEl) liveEl.textContent = (pct > 0 && sueldoEfectivo > 0) ? fmt((pct / 100) * sueldoEfectivo) : "";
  });
  const totalPresARS = (totalPctPres / 100) * sueldoEfectivo;

  const totalGasto = categGasto.reduce((s, c) => s + (gastoPorCat[c] || 0), 0);
  const disponible = sueldoEfectivo - totalPresARS;

  const kpiTotal = document.getElementById("pres-kpi-total");
  kpiTotal.textContent = fmt(totalPresARS);
  kpiTotal.style.color = totalPresARS > sueldoEfectivo && sueldoEfectivo > 0 ? "var(--red)" : "var(--accent)";

  document.getElementById("pres-kpi-gastado").textContent = fmt(totalGasto);

  const kpiDisp = document.getElementById("pres-kpi-disponible");
  kpiDisp.textContent = fmt(disponible);
  kpiDisp.className = "kpi-value " + (disponible >= 0 ? "balance-pos" : "expense");

  const saldoReal = sueldoEfectivo - totalGasto + surplusTotal;
  const kpiSaldoReal = document.getElementById("pres-kpi-saldo-real");
  if (kpiSaldoReal) {
    kpiSaldoReal.textContent = fmt(saldoReal);
    kpiSaldoReal.className = "kpi-value " + (saldoReal >= 0 ? "balance-pos" : "expense");
  }
  const heroBar2 = document.getElementById("pres-hero-bar");
  if (heroBar2 && sueldoEfectivo > 0) {
    const pctUsado2 = Math.min(totalGasto / sueldoEfectivo, 1);
    heroBar2.style.transform = `scaleX(${Math.min(pctUsado2, 1).toFixed(3)})`;
    heroBar2.className = "kpi-hero-bar-fill " + (pctUsado2 < 0.8 ? "bar-ok" : pctUsado2 < 1 ? "bar-warn" : "bar-over");
    const heroSub2 = document.getElementById("pres-kpi-saldo-real-sub");
    if (heroSub2) heroSub2.textContent = `Sueldo − Gastado real · ${Math.round(pctUsado2 * 100)}% usado`;
  }

  const kpiDiario2 = document.getElementById("pres-kpi-diario");
  if (kpiDiario2) {
    const hoy = new Date();
    const esEsteMes = mes === hoy.getMonth() + 1 && anio === hoy.getFullYear();
    if (esEsteMes && saldoReal > 0) {
      const diasRestantes = new Date(anio, mes, 0).getDate() - hoy.getDate() + 1;
      kpiDiario2.textContent = fmt(saldoReal / diasRestantes);
      kpiDiario2.className = "kpi-value balance-pos";
      document.getElementById("pres-kpi-diario-sub").textContent = `Real disponible ÷ ${diasRestantes}d restantes`;
    } else {
      kpiDiario2.textContent = "—";
      kpiDiario2.className = "kpi-value";
      document.getElementById("pres-kpi-diario-sub").textContent = saldoReal <= 0 ? "Sin margen disponible" : "Mes histórico";
    }
  }

  const subTotal = document.getElementById("pres-kpi-total-sub");
  if (subTotal) {
    subTotal.textContent = totalPctPres.toFixed(0) + "% del sueldo asignado";
  }
}

