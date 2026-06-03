// ─── RESUMEN MES ─────────────────────────────────────────────
async function cargarResumenMes() {
  const mes  = document.getElementById("sel-mes-resumen").value;
  const anio = document.getElementById("sel-anio-resumen").value;

  // Todas las transacciones del mes (ambos usuarios — necesario para Comp y "De Daniel")
  const dataMesAll = allTransac.filter(t => {
    const { year, month } = getMesLiquidacion(t);
    return month === parseInt(mes) && year === parseInt(anio);
  });
  // Solo las de Daniel (para KPI ingresos y drill-down)
  const datos = dataMesAll.filter(t => (t.usuario || "Daniel") === USUARIO);

  // ── INGRESOS: solo categorías de ingreso real del usuario ─────
  const ingresosARS = datos.filter(t => t.tipo === "Ingreso" && !esTransferencia(t)
    && CATS_INGRESO_REAL.includes(t.categoria) && (t.moneda || "ARS") === "ARS")
    .reduce((s,t) => s + Math.abs(Number(t.monto)), 0);
  const ingresosUSD = datos.filter(t => t.tipo === "Ingreso" && !esTransferencia(t)
    && CATS_INGRESO_REAL.includes(t.categoria) && (t.moneda || "ARS") === "USD")
    .reduce((s,t) => s + Math.abs(Number(t.monto)), 0);

  // ── GASTOS REALES por categoría (lógica de responsabilidad) ──
  // "Mío" Daniel         → 100%  (neto: gastos − ingresos Mío)
  // "Compartido" todos   → 50%   (neto: gastos − ingresos Compartido de ambos)
  // "De Daniel" de Ama   → 100%  (Ama pagó por Daniel; Daniel le debe)
  // "De Ama" Daniel      → 0%    (excluido — Ama reimbolsará)
  const catMapARS = {}, catMapUSD = {};
  const allExpCats = [...new Set(dataMesAll
    .filter(t => !esTransferencia(t) && !CATS_INGRESO_REAL.includes(t.categoria))
    .map(t => t.categoria))];

  allExpCats.forEach(cat => {
    ["ARS", "USD"].forEach(mon => {
      // Helper: suma montos de arr filtrado por tipo, responsabilidad y moneda
      const g = (arr, tipo, resp) => arr.filter(t =>
        !esTransferencia(t) && t.tipo === tipo && t.categoria === cat
        && (resp === "Mío" ? (t.responsabilidad || "Mío") === "Mío" : t.responsabilidad === resp)
        && (t.moneda || "ARS") === mon
      ).reduce((s, t) => s + Math.abs(Number(t.monto)), 0);

      const real =
        Math.max(0, g(datos,      "Gasto",   "Mío")        - g(datos,      "Ingreso", "Mío"))
      + Math.max(0, g(dataMesAll, "Gasto",   "Compartido") - g(dataMesAll, "Ingreso", "Compartido")) * 0.5
      + Math.max(0, g(dataMesAll, "Gasto",   "De Daniel")  - g(dataMesAll, "Ingreso", "De Daniel"));

      if (real > 0) (mon === "USD" ? catMapUSD : catMapARS)[cat] = real;
    });
  });

  const sortedCatsARS = Object.entries(catMapARS).sort((a,b) => b[1] - a[1]);
  const sortedCatsUSD = Object.entries(catMapUSD).sort((a,b) => b[1] - a[1]);
  const gastosNetARS  = sortedCatsARS.reduce((s,[,v]) => s + v, 0);
  const gastosNetUSD  = sortedCatsUSD.reduce((s,[,v]) => s + v, 0);

  const ingresos = ingresosARS;
  const gastos   = gastosNetARS;
  const balance  = ingresos - gastos;
  const ahorro   = ingresos > 0 ? ((balance / ingresos) * 100).toFixed(1) : 0;

  animateKPI(document.getElementById("kpi-ingresos"), ingresos, fmt);
  animateKPI(document.getElementById("kpi-gastos"),   gastos,   fmt);

  const balEl = document.getElementById("kpi-balance");
  balEl.className = "kpi-value " + (balance >= 0 ? "balance-pos" : "balance-neg");
  animateKPI(balEl, Math.abs(balance), v => (balance < 0 ? "-" : "") + fmt(v));

  animatePct(document.getElementById("kpi-ahorro"), parseFloat(ahorro));

  const ingTxCount = datos.filter(t => t.tipo === "Ingreso" && !esTransferencia(t)
    && CATS_INGRESO_REAL.includes(t.categoria)).length;
  const ingSubParts = [`${ingTxCount} transacciones`];
  if (ingresosUSD > 0) ingSubParts.push(`+ ${fmtMoneda(ingresosUSD,"USD")} USD`);
  document.getElementById("kpi-ingresos-sub").textContent = ingSubParts.join(" · ");

  const gasSubParts = ["Mío 100% · Comp 50% · Reembolsos Ama"];
  if (gastosNetUSD > 0) gasSubParts.push(`+ ${fmtMoneda(gastosNetUSD,"USD")} USD`);
  document.getElementById("kpi-gastos-sub").textContent = gasSubParts.join(" · ");

  const balSubParts = [balance >= 0 ? "Superávit 🎉" : "Déficit ⚠️"];
  if (ingresosUSD > 0 || gastosNetUSD > 0) {
    const balUSD = ingresosUSD - gastosNetUSD;
    balSubParts.push(`Balance USD: ${fmtMoneda(Math.abs(balUSD),"USD")} ${balUSD >= 0 ? "✅" : "⚠️"}`);
  }
  // Proyección al cierre del mes — solo mes en curso, días 3–26
  {
    const hoy = new Date();
    const mesVista = parseInt(mes), anioVista = parseInt(anio);
    const dia = hoy.getDate();
    const diasEnMes = new Date(anioVista, mesVista, 0).getDate();
    if (mesVista === hoy.getMonth() + 1 && anioVista === hoy.getFullYear()
        && dia >= 3 && dia < diasEnMes - 3 && gastos > 0) {
      const proyGastos  = Math.round((gastos / dia) * diasEnMes);
      const proyBalance = ingresos - proyGastos;
      const signo = proyBalance >= 0 ? "+" : "";
      balSubParts.push(`Proyección al ${diasEnMes}: ${signo}${fmt(proyBalance)}`);
    }
  }
  document.getElementById("kpi-balance-sub").textContent = balSubParts.join(" · ");

  // ── Tendencia vs mes anterior ──────────────────────────────
  {
    const prevMesNum  = parseInt(mes) === 1 ? 12 : parseInt(mes) - 1;
    const prevAnioNum = parseInt(mes) === 1 ? parseInt(anio) - 1 : parseInt(anio);
    const MESES_CORTO = ["","ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    const prevLabel   = MESES_CORTO[prevMesNum];

    const prevDataAll = allTransac.filter(t => {
      const { year, month } = getMesLiquidacion(t);
      return month === prevMesNum && year === prevAnioNum;
    });
    const prevDatos = prevDataAll.filter(t => (t.usuario || "Daniel") === USUARIO);

    const prevIngresos = prevDatos.filter(t => t.tipo === "Ingreso" && !esTransferencia(t)
      && CATS_INGRESO_REAL.includes(t.categoria) && (t.moneda || "ARS") === "ARS")
      .reduce((s,t) => s + Math.abs(Number(t.monto)), 0);

    const prevAllExpCats = [...new Set(prevDataAll
      .filter(t => !esTransferencia(t) && !CATS_INGRESO_REAL.includes(t.categoria))
      .map(t => t.categoria))];
    const prevCatMapARS = {};
    prevAllExpCats.forEach(cat => {
      const gp = (arr, tipo, resp) => arr.filter(t =>
        !esTransferencia(t) && t.tipo === tipo && t.categoria === cat
        && (resp === "Mío" ? (t.responsabilidad || "Mío") === "Mío" : t.responsabilidad === resp)
        && (t.moneda || "ARS") === "ARS"
      ).reduce((s,t) => s + Math.abs(Number(t.monto)), 0);
      const real =
        Math.max(0, gp(prevDatos,    "Gasto","Mío")       - gp(prevDatos,   "Ingreso","Mío"))
      + Math.max(0, gp(prevDataAll,  "Gasto","Compartido")- gp(prevDataAll, "Ingreso","Compartido")) * 0.5
      + Math.max(0, gp(prevDataAll,  "Gasto","De Daniel") - gp(prevDataAll, "Ingreso","De Daniel"));
      if (real > 0) prevCatMapARS[cat] = real;
    });
    const prevGastos  = Object.values(prevCatMapARS).reduce((s,v) => s+v, 0);
    const prevBalance = prevIngresos - prevGastos;
    const prevAhorro  = prevIngresos > 0 ? (prevBalance / prevIngresos * 100) : 0;

    const _tendencia = (cur, prev, label, invertirColor) => {
      if (!prev && !cur) return "";
      if (!prev) return `<span class="kpi-trend flat">— primer mes con datos</span>`;
      const pct  = Math.round((cur - prev) / Math.abs(prev) * 100);
      const sube = pct > 0;
      const cls  = pct === 0 ? "flat" : (sube !== invertirColor ? "up" : "down");
      const icon = pct === 0 ? "=" : sube ? "▲" : "▼";
      return `<span class="kpi-trend ${cls}">${icon} ${pct > 0 ? "+" : ""}${pct}% vs ${label}</span>`;
    };

    document.getElementById("kpi-ingresos-trend").innerHTML = _tendencia(ingresos, prevIngresos, prevLabel, false);
    document.getElementById("kpi-gastos-trend").innerHTML   = _tendencia(gastos,   prevGastos,   prevLabel, true);  // más gasto → rojo
    document.getElementById("kpi-balance-trend").innerHTML  = _tendencia(balance,  prevBalance,  prevLabel, false);
    const ahorroNum = parseFloat(ahorro);
    document.getElementById("kpi-ahorro-trend").innerHTML   = _tendencia(ahorroNum, prevAhorro,  prevLabel, false);
  }

  // KPI "Ama te debe" — acumulado total (no filtrado por mes)
  const amaDebeTotalMes = allTransac
    .filter(t => t.tipo === "Gasto" && (t.responsabilidad || "Mío") === "De Ama")
    .reduce((s,t) => s + Math.abs(Number(t.monto)), 0);
  const amaKpi = document.getElementById("kpi-ama-debe");
  if (amaKpi) {
    animateKPI(amaKpi, amaDebeTotalMes, fmt);
    document.getElementById("kpi-ama-debe-sub").textContent =
      amaDebeTotalMes > 0 ? `${allTransac.filter(t=>t.tipo==="Gasto"&&(t.responsabilidad||"Mío")==="De Ama").length} gastos pendientes de reintegro` : "Sin gastos pendientes ✅";
  }

  renderCatChart(sortedCatsARS);
  renderDonutChart(ingresos, gastos, balance);
  renderTopGastos(sortedCatsARS, sortedCatsUSD, datos, ingresos);

  // Sparklines — últimos 6 meses
  renderSparklines(parseInt(mes), parseInt(anio));

  // Banner "Ama te debe" — chips por categoría
  const amaDebeCats = {};
  allTransac.filter(t => t.tipo === "Gasto" && (t.responsabilidad || "Mío") === "De Ama")
    .forEach(t => { amaDebeCats[t.categoria] = (amaDebeCats[t.categoria] || 0) + Math.abs(Number(t.monto)); });
  const topCats = Object.entries(amaDebeCats).sort((a,b) => b[1]-a[1]).slice(0, 4);
  const catsEl  = document.getElementById("ama-debe-cats");
  if (catsEl) {
    catsEl.innerHTML = topCats.length
      ? topCats.map(([cat, val]) =>
          `<span class="ama-chip"><span class="ama-chip-label">${cat}</span>${fmt(val)}</span>`
        ).join("")
      : "";
  }
}

// ─── GRÁFICO BARRAS CATEGORÍAS ────────────────────────────────
function renderCatChart(sortedCats) {
  const ctx = document.getElementById("chart-cat");
  if (chartCat) chartCat.destroy();
  if (!sortedCats.length) {
    ctx.getContext("2d").clearRect(0,0,ctx.width,ctx.height);
    return;
  }
  chartCat = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sortedCats.map(([k]) => k),
      datasets: [{
        data: sortedCats.map(([,v]) => v),
        backgroundColor: PALETTE,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 700, easing: "easeOutQuart" },
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: ctx => " " + fmt(ctx.raw) } }
      },
      scales: {
        x: { grid: { color: _C.grid }, ticks: { color: _C.muted, font: { size: 11, family: "'Libre Franklin', system-ui" } } },
        y: { grid: { color: _C.grid }, ticks: { color: _C.muted, font: { family: "'Libre Franklin', system-ui" },
          callback: v => fmtShort(v) } }
      }
    }
  });
}

// ─── GRÁFICO DONUT ────────────────────────────────────────────
function renderDonutChart(ingresos, gastos, balance) {
  const ctx = document.getElementById("chart-donut");
  if (chartDonut) chartDonut.destroy();
  chartDonut = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Ingresos","Gastos"],
      datasets: [{
        data: [ingresos, gastos],
        backgroundColor: [_C.greenA75, _C.redA75],
        borderColor: [_C.greenA90, _C.redA90],
        borderWidth: 2,
        hoverOffset: 10,
        hoverBackgroundColor: [_C.green, _C.red],
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "70%",
      animation: { duration: 800, easing: "easeOutQuart" },
      plugins: {
        legend: { position: "bottom", labels: { color: _C.muted, padding: 16, font:{ size:12, family: "'Libre Franklin', system-ui" }, usePointStyle: true } },
        tooltip: { callbacks: {
          label: ctx => " " + fmt(ctx.raw),
          afterLabel: ctx => ctx.dataIndex === 0
            ? ` Ahorro: ${ingresos > 0 ? ((balance/ingresos)*100).toFixed(1) : 0}%`
            : ` Balance: ${fmt(balance)}`
        }}
      }
    }
  });
  // Actualizar texto central
  const centerEl = document.getElementById("donut-center-val");
  if (centerEl) {
    centerEl.textContent = fmt(Math.abs(balance));
    centerEl.style.color = balance >= 0 ? "var(--accent)" : "var(--red)";
  }
}

// ─── TOP GASTOS ───────────────────────────────────────────────
function renderTopGastos(sortedCatsARS, sortedCatsUSD, datos, salarioBase) {
  const el = document.getElementById("top-gastos-list");
  if (!sortedCatsARS.length && !sortedCatsUSD.length) {
    el.innerHTML = '<div class="empty-state">Sin gastos este mes — buen comienzo ✓</div>';
    return;
  }

  // Genera las filas HTML para un conjunto de categorías de una moneda dada
  function renderSeccion(cats, moneda) {
    const fmtVal = (v) => moneda === "USD" ? fmtMoneda(v, "USD") : fmt(v);
    const total  = cats.reduce((s,[,v]) => s + v, 0);
    return cats.map(([cat, val], i) => {
      const pct = total > 0 ? (val / total * 100).toFixed(1) : 0;
      // Badge de ejecución vs presupuesto (solo ARS, si hay presupuesto cargado)
      let presTag = "";
      if (moneda === "ARS" && salarioBase > 0) {
        const pctPres = presupuestoActual[cat] || 0;
        if (pctPres > 0) {
          const montoPres = (pctPres / 100) * salarioBase;
          const ejec = Math.round(val / montoPres * 100);
          const color  = ejec >= 100 ? "var(--red)"    : ejec >= 80 ? "var(--yellow)"    : "var(--green)";
          const dimBg  = ejec >= 100 ? "var(--red-dim)" : ejec >= 80 ? "var(--yellow-dim)" : "var(--green-dim)";
          const label  = ejec >= 100 ? `⚠️ ${ejec}%` : `${ejec}%`;
          presTag = `<span style="background:${dimBg};color:${color};border-radius:4px;padding:.1rem .35rem;font-size:.67rem;font-weight:700;margin-left:.35rem;white-space:nowrap;">${label} pres.</span>`;
        }
      }
      const txsCat = datos
        ? datos.filter(t => t.categoria === cat && !esTransferencia(t) && (t.moneda || "ARS").toUpperCase() === moneda)
        : [];
      const drillId = "drill-" + moneda + "-" + cat.replace(/\s+/g,"_");
      const drillRows = txsCat.map(t => {
        const esGasto = t.tipo === "Gasto";
        const bruto   = Math.abs(Number(t.monto));
        const efe     = esGasto ? bruto : -bruto;
        const resp    = t.responsabilidad || "Mío";
        const respTag = resp === "Compartido"
          ? `<span style="color:var(--yellow);font-size:.75rem;">Compartido</span>`
          : resp.startsWith("De ")
          ? `<span style="color:var(--accent);font-size:.75rem;">${escapeHtml(resp)}</span>`
          : "";
        const efeColor = efe >= 0 ? "var(--red)" : "var(--green)";
        const efeLabel = efe >= 0 ? fmtVal(bruto) : "−" + fmtVal(bruto);
        return `<tr>
          <td style="padding:.2rem .5rem;color:var(--text-muted);font-size:.78rem;">${fmtFecha(t.fecha)}</td>
          <td style="padding:.2rem .5rem;font-size:.78rem;">${esGasto ? "↑ Gasto" : "↓ Ingreso"}</td>
          <td style="padding:.2rem .5rem;font-size:.78rem;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.descripcion||"—")}</td>
          <td style="padding:.2rem .5rem;font-size:.78rem;text-align:right;">${fmtVal(bruto)}</td>
          <td style="padding:.2rem .5rem;font-size:.78rem;text-align:right;color:${efeColor};">${efeLabel} ${respTag}</td>
        </tr>`;
      }).join("");
      return `
      <div style="margin-bottom:.9rem;">
        <div style="display:flex;justify-content:space-between;margin-bottom:.3rem;font-size:.88rem;cursor:pointer;"
             onclick="document.getElementById('${drillId}').style.display=document.getElementById('${drillId}').style.display==='none'?'block':'none'">
          <span><span style="color:${PALETTE[i%PALETTE.length]};margin-right:.4rem;">●</span>${cat}${presTag}
            <span style="color:var(--text-muted);font-size:.72rem;margin-left:.3rem;">(${txsCat.length} tx) ▾</span>
          </span>
          <span style="color:var(--text-muted)">${fmtVal(val)} <span style="color:var(--red)">(${pct}%)</span></span>
        </div>
        <div style="background:var(--bg2);border-radius:4px;height:6px;overflow:hidden;margin-bottom:.3rem;">
          <div style="width:100%;height:100%;background:${PALETTE[i%PALETTE.length]};border-radius:4px;transform:scaleX(${(pct/100).toFixed(3)});transform-origin:left;transition:transform .5s;"></div>
        </div>
        <div id="${drillId}" style="display:none;background:var(--bg2);border-radius:6px;padding:.3rem;margin-top:.3rem;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>
              <th style="padding:.2rem .5rem;font-size:.72rem;color:var(--text-muted);text-align:left;">Fecha</th>
              <th style="padding:.2rem .5rem;font-size:.72rem;color:var(--text-muted);text-align:left;">Tipo</th>
              <th style="padding:.2rem .5rem;font-size:.72rem;color:var(--text-muted);text-align:left;">Descripción</th>
              <th style="padding:.2rem .5rem;font-size:.72rem;color:var(--text-muted);text-align:right;">Bruto</th>
              <th style="padding:.2rem .5rem;font-size:.72rem;color:var(--text-muted);text-align:right;">Neto</th>
            </tr></thead>
            <tbody>${drillRows}</tbody>
          </table>
        </div>
      </div>`;
    }).join("");
  }

  let html = "";
  if (sortedCatsARS.length) {
    html += `<div style="font-size:.75rem;font-weight:600;color:var(--text-muted);letter-spacing:.05em;margin-bottom:.6rem;padding-bottom:.3rem;border-bottom:1px solid var(--border);">🇦🇷 PESOS (ARS)</div>`;
    html += renderSeccion(sortedCatsARS, "ARS");
  }
  if (sortedCatsUSD.length) {
    if (sortedCatsARS.length) html += `<div style="margin-top:1rem;"></div>`;
    html += `<div style="font-size:.75rem;font-weight:600;color:var(--text-muted);letter-spacing:.05em;margin-bottom:.6rem;padding-bottom:.3rem;border-bottom:1px solid var(--border);">🇺🇸 DÓLARES (USD)</div>`;
    html += renderSeccion(sortedCatsUSD, "USD");
  }
  el.innerHTML = html;
}

// ─── EVOLUCIÓN ────────────────────────────────────────────────
function cargarEvolucion() {
  // Misma lógica que cargarResumenMes:
  // Ingresos = solo categorías de ingreso real del usuario (ARS)
  // Gastos   = neto por categoría (gastos − reintegros de la misma cat)

  // 1. Agrupar transacciones por mes
  const monthTxs = {};
  allTransac.filter(t => !esTransferencia(t) && (t.usuario || "Daniel") === USUARIO).forEach(t => {
    const { year, month } = getMesLiquidacion(t);
    const k = year + "-" + String(month).padStart(2,"0");
    if (!monthTxs[k]) monthTxs[k] = [];
    monthTxs[k].push(t);
  });

  // 2. Calcular ingresos y gastos netos por mes (solo ARS para el gráfico principal)
  const map = {};
  Object.entries(monthTxs).forEach(([k, txs]) => {
    const ingresos = txs
      .filter(t => t.tipo === "Ingreso" && CATS_INGRESO_REAL.includes(t.categoria) && (t.moneda||"ARS") === "ARS")
      .reduce((s,t) => s + Math.abs(Number(t.monto)), 0);
    const catMap = {};
    txs.filter(t => (t.moneda||"ARS") === "ARS").forEach(t => {
      const m = Math.abs(Number(t.monto));
      if (t.tipo === "Gasto")        catMap[t.categoria] = (catMap[t.categoria]||0) + m;
      else if (t.tipo === "Ingreso") catMap[t.categoria] = (catMap[t.categoria]||0) - m;
    });
    const gastos = Object.values(catMap).filter(v => v > 0).reduce((s,v) => s + v, 0);
    map[k] = { ingresos, gastos };
  });

  // Últimos 12 meses
  const labels = [], ingArr = [], gasArr = [], balArr = [];
  let acum = 0;
  Object.keys(map).sort().slice(-12).forEach(k => {
    const [anio, mes] = k.split("-");
    const fechaLabel = new Date(parseInt(anio), parseInt(mes)-1, 1)
      .toLocaleString("es-AR", { month: "short", year: "2-digit" });
    labels.push(fechaLabel);
    ingArr.push(map[k].ingresos);
    gasArr.push(map[k].gastos);
    acum += map[k].ingresos - map[k].gastos;
    balArr.push(acum);
  });

  // Chart combo doble eje: barras ingresos/gastos + línea balance acumulado
  const ctxCombo = document.getElementById("chart-evol-combo");
  if (!ctxCombo) return;
  if (chartEvolCombo) chartEvolCombo.destroy();
  chartEvolCombo = new Chart(ctxCombo, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Ingresos", data: ingArr, type: "bar",
          backgroundColor: _C.greenA65, borderColor: _C.green,
          borderWidth: 1, borderRadius: 4, yAxisID: "y",
        },
        {
          label: "Gastos", data: gasArr, type: "bar",
          backgroundColor: _C.redA65, borderColor: _C.red,
          borderWidth: 1, borderRadius: 4, yAxisID: "y",
        },
        {
          label: "Balance acumulado", data: balArr, type: "line",
          borderColor: _C.accent, backgroundColor: _C.accentA13,
          fill: false, tension: 0.4, pointRadius: 3, pointBackgroundColor: _C.accent,
          yAxisID: "y1", borderWidth: 2,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 700, easing: "easeOutQuart" },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: _C.muted, font: { family: "'Libre Franklin', system-ui" } } },
        tooltip: { callbacks: { label: ctx => " " + fmt(ctx.raw) } }
      },
      scales: {
        x: { grid: { color: _C.grid }, ticks: { color: _C.muted, font: { family: "'Libre Franklin', system-ui" } } },
        y:  { position: "left",  grid: { color: _C.grid }, ticks: { color: _C.muted, font: { family: "'Libre Franklin', system-ui" }, callback: v => fmtShort(v) } },
        y1: { position: "right", grid: { drawOnChartArea: false }, ticks: { color: _C.accent, font: { family: "'Libre Franklin', system-ui" }, callback: v => fmtShort(v) } }
      }
    }
  });
}

