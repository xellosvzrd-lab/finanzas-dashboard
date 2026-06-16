// ─── THEME TOGGLE ─────────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
  html.dataset.theme = next;
  localStorage.setItem('fin-theme', next);
  const sun  = document.getElementById('theme-icon-sun');
  const moon = document.getElementById('theme-icon-moon');
  if (sun)  sun.style.display  = next === 'dark' ? '' : 'none';
  if (moon) moon.style.display = next === 'dark' ? 'none' : '';
}

// ─── TOAST ────────────────────────────────────────────────────
function showToast(msg, tipo) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast toast-${tipo} show`;
  setTimeout(() => { t.className = "toast"; }, 3000);
}

// ─── SPARKLINES ───────────────────────────────────────────────
// Dibuja un mini gráfico SVG de línea dentro del contenedor dado
function renderSparklineSVG(containerId, values, color) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const W = 120, H = 34;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (W - pad * 2) + pad;
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const ptsStr  = pts.join(" ");
  // Polygon para el área rellena (cierra el path por abajo)
  const polyPts = `${pad},${H} ${ptsStr} ${(W-pad).toFixed(1)},${H}`;
  const uid = containerId.replace(/[^a-z]/gi, "");
  el.innerHTML = `
    <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg-${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="${polyPts}" fill="url(#sg-${uid})"/>
      <polyline points="${ptsStr}" fill="none" stroke="${color}" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${pts[pts.length-1].split(',')[0]}" cy="${pts[pts.length-1].split(',')[1]}"
              r="2.5" fill="${color}"/>
    </svg>`;
}

// Calcula los últimos N meses de KPIs desde allTransac y renderiza sparklines
function renderSparklines(curMes, curAnio) {
  const NMONTHS = 6;
  const seriesIng = [], seriesGas = [], seriesBal = [], seriesAho = [];

  for (let offset = -(NMONTHS - 1); offset <= 0; offset++) {
    const d    = new Date(curAnio, curMes - 1 + offset, 1);
    const m    = d.getMonth() + 1;
    const y    = d.getFullYear();
    const all  = allTransac.filter(t => {
      const { year: ty, month: tm } = getMesLiquidacion(t);
      return tm === m && ty === y;
    });
    const mine = all.filter(t => (t.usuario || "Daniel") === USUARIO);
    const ing  = mine.filter(t => t.tipo === "Ingreso" && !esTransferencia(t)
                   && CATS_INGRESO_REAL.includes(t.categoria) && (t.moneda || "ARS") === "ARS")
                 .reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
    // Gastos efectivos simplificados para sparkline (misma fórmula del resumen)
    const g = (arr, tipo, resp) => arr.filter(t =>
      !esTransferencia(t) && t.tipo === tipo
      && (resp === "Mío" ? (t.responsabilidad || "Mío") === "Mío" : t.responsabilidad === resp)
      && (t.moneda || "ARS") === "ARS"
    ).reduce((s, t) => s + Math.abs(Number(t.monto)), 0);
    const gas = Math.max(0, g(mine, "Gasto", "Mío")         - g(mine, "Ingreso", "Mío"))
              + Math.max(0, g(all,  "Gasto", "Compartido")   - g(all,  "Ingreso", "Compartido")) * 0.5
              + Math.max(0, g(all,  "Gasto", "De Daniel")    - g(all,  "Ingreso", "De Daniel"));
    const bal  = ing - gas;
    const aho  = ing > 0 ? (bal / ing) * 100 : 0;
    seriesIng.push(ing);
    seriesGas.push(gas);
    seriesBal.push(bal);
    seriesAho.push(aho);
  }

  renderSparklineSVG("spark-ingresos", seriesIng, "#34d399");
  renderSparklineSVG("spark-gastos",   seriesGas, "#f87171");
  renderSparklineSVG("spark-balance",  seriesBal, "#C8845A");
  renderSparklineSVG("spark-ahorro",   seriesAho, "#fbbf24");
}

// ─── ANIMACIÓN KPI ────────────────────────────────────────────
// Anima un elemento de texto contando desde 0 hasta el valor destino
function animateKPI(el, toValue, fmtFn, duration = 680) {
  const start = performance.now();
  const from  = 0;
  function step(now) {
    const t    = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);          // cubic ease-out
    el.textContent = fmtFn(Math.round(from + (toValue - from) * ease));
    if (t < 1) requestAnimationFrame(step);
    else        el.textContent = fmtFn(toValue);  // valor exacto al final
  }
  requestAnimationFrame(step);
}
function animatePct(el, toValue, duration = 680) {
  const start = performance.now();
  function step(now) {
    const t    = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = (toValue * ease).toFixed(1) + "%";
    if (t < 1) requestAnimationFrame(step);
    else        el.textContent = toValue + "%";
  }
  requestAnimationFrame(step);
}

// ─── FORMATEO ─────────────────────────────────────────────────
function fmt(n) {
  const s = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
  return (n < 0 ? "−" : "") + "$" + s;
}
function fmtMoneda(n, moneda) {
  if (moneda === "USD") {
    return "U$S " + new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
  }
  return fmt(n);
}
function fmtShort(n) {
  if (n >= 1_000_000) return "$" + (n/1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return "$" + (n/1_000).toFixed(0) + "k";
  return "$" + n;
}
function fmtFecha(s) {
  const d = new Date(s + "T12:00:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}
// Retorna { year, month } (month base-1) para asignación de mes presupuestario.
// Para tarjetas de crédito usa mes_liquidacion si está presente y es válido;
// para el resto (o como fallback) usa la fecha de la transacción.
function getMesLiquidacion(t) {
  if (t.mes_liquidacion && /^\d{4}-(0[1-9]|1[0-2])$/.test(t.mes_liquidacion)) {
    const [y, m] = t.mes_liquidacion.split('-').map(Number);
    return { year: y, month: m };
  }
  const d = new Date(t.fecha + 'T12:00:00');
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
// Retorna true si la fuente dada es de tipo tarjeta de crédito (FUENTE_TC)
function _esFuenteTC(fuente) {
  return !!fuente && categFuentesTC.includes(fuente);
}

// Muestra/oculta el campo mes_liquidacion en el formulario de nueva transacción
