// ─── COMPARTIDOS ──────────────────────────────────────────────
function inicializarSelectoresCompartidos() {
  const hoy   = new Date();
  const meses = [
    ["01","Enero"],["02","Febrero"],["03","Marzo"],["04","Abril"],
    ["05","Mayo"],["06","Junio"],["07","Julio"],["08","Agosto"],
    ["09","Septiembre"],["10","Octubre"],["11","Noviembre"],["12","Diciembre"]
  ];

  const selMes = document.getElementById("comp-mes");
  selMes.innerHTML = "";
  meses.forEach(([v,n]) => {
    const o = document.createElement("option");
    o.value = v; o.textContent = n;
    if (parseInt(v) === hoy.getMonth() + 1) o.selected = true;
    selMes.appendChild(o);
  });
  selMes.onchange = cargarCompartidos;

  const selAnio = document.getElementById("comp-anio");
  selAnio.innerHTML = "";
  for (let y = hoy.getFullYear(); y >= hoy.getFullYear() - 3; y--) {
    const o = document.createElement("option");
    o.value = y; o.textContent = y;
    if (y === hoy.getFullYear()) o.selected = true;
    selAnio.appendChild(o);
  }
  selAnio.onchange = cargarCompartidos;
}

// Calcula balance compartido del mes/año sin tocar DOM ni DB.
// + = PARTNER te debe | - = vos le debés a PARTNER
function _calcularBalanceCompartido(mes, anio) {
  const datos = allTransac.filter(t => {
    const { year, month } = getMesLiquidacion(t);
    return month === mes && year === anio && t.tipo === "Gasto";
  });
  const datosIng = allTransac.filter(t => {
    const { year, month } = getMesLiquidacion(t);
    return month === mes && year === anio && t.tipo === "Ingreso";
  });
  let compNetARS = 0, compNetUSD = 0;
  const addComp = (t, sign) => {
    const m = Math.abs(Number(t.monto)) / 2;
    if ((t.moneda || "ARS").toUpperCase() === "USD") compNetUSD += sign * m;
    else compNetARS += sign * m;
  };
  datos.filter(t => (t.responsabilidad || "Mío") === "Compartido").forEach(t =>
    addComp(t, (t.usuario || USUARIO) === PARTNER ? -1 : 1));
  datosIng.filter(t => (t.responsabilidad || "Mío") === "Compartido").forEach(t =>
    addComp(t, (t.usuario || USUARIO) === PARTNER ? 1 : -1));
  let aARS = 0, aUSD = 0, bARS = 0, bUSD = 0;
  datos.filter(t => (t.responsabilidad || "Mío") === "De " + PARTNER && (t.usuario || USUARIO) === USUARIO).forEach(t => {
    if ((t.moneda || "ARS").toUpperCase() === "USD") aUSD += Math.abs(Number(t.monto));
    else aARS += Math.abs(Number(t.monto));
  });
  datos.filter(t => (t.responsabilidad || "Mío") === "De " + USUARIO && (t.usuario || USUARIO) === PARTNER).forEach(t => {
    if ((t.moneda || "ARS").toUpperCase() === "USD") bUSD += Math.abs(Number(t.monto));
    else bARS += Math.abs(Number(t.monto));
  });
  return { balanceARS: compNetARS + aARS - bARS, balanceUSD: compNetUSD + aUSD - bUSD };
}

function cargarCompartidos() {
  const mes  = parseInt(document.getElementById("comp-mes").value);
  const anio = parseInt(document.getElementById("comp-anio").value);
  const CATS = [...new Set([...categGasto, ...categIngreso])].sort();

  // Filtrar transacciones del mes/año seleccionado — gastos para compPorCat y reembolsos
  const datos = allTransac.filter(t => {
    const { year, month } = getMesLiquidacion(t);
    return month === mes && year === anio && t.tipo === "Gasto";
  });
  // Ingresos del mes — los compartidos reducen lo que se debe
  const datosIngresos = allTransac.filter(t => {
    const { year, month } = getMesLiquidacion(t);
    return month === mes && year === anio && t.tipo === "Ingreso";
  });

  // ── COMPARTIDOS ──────────────────────────────────────────────
  // Gastos Compartido ÷ 2 suman; Ingresos Compartido ÷ 2 restan (son reintegros de la otra parte)
  // Separados por moneda: ARS y USD
  const compPorCatARS = {}, compPorCatUSD = {};
  CATS.forEach(cat => {
    compPorCatARS[cat] = { daniel: 0, ama: 0 };
    compPorCatUSD[cat] = { daniel: 0, ama: 0 };
  });

  datos.filter(t => (t.responsabilidad || "Mío") === "Compartido").forEach(t => {
    const cat    = t.categoria;
    const moneda = (t.moneda || "ARS").toUpperCase();
    const map    = moneda === "USD" ? compPorCatUSD : compPorCatARS;
    if (!map[cat]) map[cat] = { daniel: 0, ama: 0 };
    const m = Math.abs(Number(t.monto));
    if ((t.usuario || USUARIO) === PARTNER) {
      map[cat].ama += m / 2;
    } else {
      map[cat].daniel += m / 2;
    }
  });

  // Restar ingresos compartidos (reintegros) — reducen el neto por categoría
  datosIngresos.filter(t => (t.responsabilidad || "Mío") === "Compartido").forEach(t => {
    const cat    = t.categoria;
    const moneda = (t.moneda || "ARS").toUpperCase();
    const map    = moneda === "USD" ? compPorCatUSD : compPorCatARS;
    if (!map[cat]) map[cat] = { daniel: 0, ama: 0 };
    const m = Math.abs(Number(t.monto));
    if ((t.usuario || USUARIO) === PARTNER) {
      map[cat].ama -= m / 2;
    } else {
      map[cat].daniel -= m / 2;
    }
  });

  // ── REEMBOLSOS ───────────────────────────────────────────────
  // Sección A: Daniel pagó por Ama ("De Ama" de Daniel) → Ama le debe a Daniel
  // Sección B: Ama pagó por Daniel ("De Daniel" de Ama) → Daniel le debe a Ama
  const reembA_ARS = {}, reembA_USD = {};
  const reembB_ARS = {}, reembB_USD = {};

  datos.filter(t => (t.responsabilidad || "Mío") === "De " + PARTNER && (t.usuario || USUARIO) === USUARIO).forEach(t => {
    const cat = t.categoria, mon = (t.moneda || "ARS").toUpperCase();
    if (mon === "USD") { reembA_USD[cat] = (reembA_USD[cat]||0) + Math.abs(Number(t.monto)); }
    else               { reembA_ARS[cat] = (reembA_ARS[cat]||0) + Math.abs(Number(t.monto)); }
  });

  datos.filter(t => (t.responsabilidad || "Mío") === "De " + USUARIO && (t.usuario || USUARIO) === PARTNER).forEach(t => {
    const cat = t.categoria, mon = (t.moneda || "ARS").toUpperCase();
    if (mon === "USD") { reembB_USD[cat] = (reembB_USD[cat]||0) + Math.abs(Number(t.monto)); }
    else               { reembB_ARS[cat] = (reembB_ARS[cat]||0) + Math.abs(Number(t.monto)); }
  });

  // ── RENDERIZAR TABLA COMPARTIDOS (ARS + USD separados) ───────
  // Usar todas las claves del mapa (no solo CATS) para incluir categorías del otro usuario
  const filasCompARS = Object.entries(compPorCatARS).map(([cat,v]) => ({ cat, ...v })).filter(r => r.daniel !== 0 || r.ama !== 0).sort((a,b) => a.cat.localeCompare(b.cat));
  const filasCompUSD = Object.entries(compPorCatUSD).map(([cat,v]) => ({ cat, ...v })).filter(r => r.daniel !== 0 || r.ama !== 0).sort((a,b) => a.cat.localeCompare(b.cat));

  const totalCompDanielARS = filasCompARS.reduce((s,r) => s + r.daniel, 0);
  const totalCompAmaARS    = filasCompARS.reduce((s,r) => s + r.ama,    0);
  const totalCompNetARS    = totalCompDanielARS - totalCompAmaARS;

  const totalCompDanielUSD = filasCompUSD.reduce((s,r) => s + r.daniel, 0);
  const totalCompAmaUSD    = filasCompUSD.reduce((s,r) => s + r.ama,    0);
  const totalCompNetUSD    = totalCompDanielUSD - totalCompAmaUSD;

  // Función auxiliar que genera las filas de una moneda dada
  function buildCompRows(filas, monedaFilter) {
    return filas.map(r => {
      const net        = r.daniel - r.ama;
      const txsGasto   = datos.filter(t => t.categoria === r.cat && (t.responsabilidad || "Mío") === "Compartido" && (t.moneda || "ARS").toUpperCase() === monedaFilter);
      const txsIngreso = datosIngresos.filter(t => t.categoria === r.cat && (t.responsabilidad || "Mío") === "Compartido" && (t.moneda || "ARS").toUpperCase() === monedaFilter);
      const txsAll     = [...txsGasto, ...txsIngreso];
      const drillId    = "comp-drill-" + r.cat.replace(/\s+/g,"_") + "-" + monedaFilter;
      const drillRows  = txsAll.map(t => {
        const m         = Math.abs(Number(t.monto));
        const esAma     = (t.usuario || "Daniel").toLowerCase() === "ama";
        const esGasto   = t.tipo === "Gasto";
        const signo     = esGasto ? "+" : "−";
        const color     = esGasto ? "var(--accent)" : "var(--green)";
        const tipoLabel = esGasto ? "Gasto" : "Ingreso";
        return `<tr style="background:var(--bg1);">
          <td colspan="2" style="padding:.2rem .8rem;font-size:.76rem;color:var(--text-muted);">
            <span style="color:${color};font-size:.7rem;">[${tipoLabel}]</span> ${fmtFecha(t.fecha)} — ${escapeHtml(t.descripcion||"—")}
          </td>
          <td style="padding:.2rem .8rem;font-size:.76rem;text-align:right;color:var(--text-muted);">Bruto: ${fmtMoneda(m, monedaFilter)}</td>
          <td style="padding:.2rem .8rem;font-size:.76rem;text-align:right;color:${color};">
            ${signo}${fmtMoneda(m/2, monedaFilter)} ${esAma ? "("+PARTNER+")" : "("+USUARIO+")"}
          </td>
        </tr>`;
      }).join("");
      const liqBtn = monedaFilter === "ARS" && net !== 0
        ? `<button onclick="event.stopPropagation();abrirLiquidar('${r.cat.replace(/'/g,"\\'")}',${Math.abs(net)},'${net>0?"Ingreso":"Gasto"}')"
             style="margin-left:.5rem;padding:.15rem .5rem;font-size:.7rem;border-radius:4px;border:1px solid var(--border);background:var(--bg2);color:var(--text-muted);cursor:pointer;vertical-align:middle">Liquidar</button>`
        : "";
      const _catEmo = getCatEmoji(r.cat);
      return `<tr style="cursor:pointer;" onclick="const d=document.getElementById('${drillId}');d.style.display=d.style.display==='none'?'table-row':'none'">
        <td><span style="display:inline-flex;align-items:center;gap:.4rem"><span style="font-size:1rem;width:22px;text-align:center">${_catEmo}</span>${r.cat}</span> <span style="color:var(--text-muted);font-size:.72rem;">(${txsAll.length} tx) ▾</span></td>
        <td style="text-align:right;color:${r.daniel !== 0 ? 'var(--text)' : 'var(--text-muted)'}">${r.daniel !== 0 ? fmtMoneda(r.daniel, monedaFilter) : "—"}</td>
        <td style="text-align:right;color:${r.ama !== 0 ? 'var(--text-muted)' : 'var(--text-muted)'}">${r.ama !== 0 ? fmtMoneda(r.ama, monedaFilter) : "—"}</td>
        <td style="text-align:right;font-weight:700;color:${net>0?"var(--yellow)":"var(--green)"}">${fmtMoneda(Math.abs(net), monedaFilter)}${liqBtn}</td>
      </tr>
      <tr id="${drillId}" style="display:none;">
        <td colspan="4" style="padding:0;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:var(--bg2);">
              <th colspan="2" style="padding:.25rem .8rem;font-size:.72rem;color:var(--text-muted);text-align:left;font-weight:400;">Fecha — Descripción</th>
              <th style="padding:.25rem .8rem;font-size:.72rem;color:var(--text-muted);text-align:right;font-weight:400;">Monto bruto</th>
              <th style="padding:.25rem .8rem;font-size:.72rem;color:var(--text-muted);text-align:right;font-weight:400;">Parte (÷2)</th>
            </tr></thead>
            <tbody>${drillRows}</tbody>
          </table>
        </td>
      </tr>`;
    }).join("");
  }

  const tbodyComp = document.getElementById("comp-tabla-compartidos");
  if (!filasCompARS.length && !filasCompUSD.length) {
    tbodyComp.innerHTML = '<tr><td colspan="4"><div class="empty-state" style="padding:1.5rem">Sin gastos compartidos este mes ✓</div></td></tr>';
  } else {
    let htmlComp = "";
    if (filasCompARS.length > 0) {
      htmlComp += `<tr style="background:var(--bg2);"><td colspan="4" style="padding:.4rem .8rem;font-size:.74rem;color:var(--text-muted);font-weight:600;letter-spacing:.05em;">🇦🇷 PESOS (ARS)</td></tr>`;
      htmlComp += buildCompRows(filasCompARS, "ARS");
    }
    if (filasCompUSD.length > 0) {
      if (filasCompARS.length > 0) htmlComp += `<tr><td colspan="4" style="height:.4rem;background:var(--bg);padding:0;"></td></tr>`;
      htmlComp += `<tr style="background:var(--bg2);"><td colspan="4" style="padding:.4rem .8rem;font-size:.74rem;color:var(--text-muted);font-weight:600;letter-spacing:.05em;">🇺🇸 DÓLARES (USD)</td></tr>`;
      htmlComp += buildCompRows(filasCompUSD, "USD");
    }
    tbodyComp.innerHTML = htmlComp;
  }

  const tfootComp = document.getElementById("comp-foot-compartidos");
  let tfootHtml = "";
  if (filasCompARS.length > 0) {
    tfootHtml += `<tr class="comp-tfoot-row">
      <td><strong>TOTAL ARS</strong></td>
      <td style="text-align:right">${fmt(totalCompDanielARS)}</td>
      <td style="text-align:right">${totalCompAmaARS > 0 ? fmt(totalCompAmaARS) : "—"}</td>
      <td style="text-align:right" class="comp-tfoot-total">${fmt(totalCompNetARS)}</td>
    </tr>`;
  }
  if (filasCompUSD.length > 0) {
    tfootHtml += `<tr class="comp-tfoot-row">
      <td><strong>TOTAL USD</strong></td>
      <td style="text-align:right">${fmtMoneda(totalCompDanielUSD,"USD")}</td>
      <td style="text-align:right">${totalCompAmaUSD > 0 ? fmtMoneda(totalCompAmaUSD,"USD") : "—"}</td>
      <td style="text-align:right" class="comp-tfoot-total">${fmtMoneda(totalCompNetUSD,"USD")}</td>
    </tr>`;
  }
  tfootHtml += `<tr style="font-size:.73rem;color:var(--text-muted)">
    <td colspan="2">Pagado Daniel</td>
    <td>Pagado Ama</td>
    <td style="text-align:right">Total a cobrar</td>
  </tr>`;
  tfootComp.innerHTML = tfootHtml;

  // ── RENDERIZAR TABLA REEMBOLSOS ──────────────────────────────
  // Totales por moneda (usados también en el balance final)
  const totalA_ARS = Object.values(reembA_ARS).reduce((s,v)=>s+v,0);
  const totalA_USD = Object.values(reembA_USD).reduce((s,v)=>s+v,0);
  const totalB_ARS = Object.values(reembB_ARS).reduce((s,v)=>s+v,0);
  const totalB_USD = Object.values(reembB_USD).reduce((s,v)=>s+v,0);

  // Unión de categorías por moneda (como la tabla de compartidos)
  const catsReembARS = [...new Set([...Object.keys(reembA_ARS), ...Object.keys(reembB_ARS)])];
  const catsReembUSD = [...new Set([...Object.keys(reembA_USD), ...Object.keys(reembB_USD)])];

  const tbodyReemb = document.getElementById("comp-tabla-reembolsos");

  if (!catsReembARS.length && !catsReembUSD.length) {
    tbodyReemb.innerHTML = '<tr><td colspan="4"><div class="empty-state" style="padding:1.5rem">Sin reembolsos este mes</div></td></tr>';
  } else {
    const fmtR = (v, mon) => mon === "USD" ? fmtMoneda(v,"USD") : fmt(v);
    const buildReembRows = (cats, mapA, mapB, mon) => cats.map(cat => {
      const daniel = mapA[cat] || 0;
      const ama    = mapB[cat] || 0;
      const net    = daniel - ama;
      const netColor = net > 0 ? "var(--yellow)" : net < 0 ? "var(--green)" : "var(--text-muted)";
      const _re = getCatEmoji(cat);
      return `<tr>
        <td><span style="display:inline-flex;align-items:center;gap:.4rem"><span style="font-size:1rem;width:22px;text-align:center">${_re}</span>${cat}</span></td>
        <td style="text-align:right;color:${daniel>0?"var(--accent)":"var(--text-muted)"}">${daniel>0?fmtR(daniel,mon):"—"}</td>
        <td style="text-align:right;color:${ama>0?"var(--yellow)":"var(--text-muted)"}">${ama>0?fmtR(ama,mon):"—"}</td>
        <td style="text-align:right;font-weight:700;color:${netColor}">${net!==0?fmtR(Math.abs(net),mon):"—"}</td>
      </tr>`;
    }).join("");
    let htmlR = "";
    if (catsReembARS.length) {
      if (catsReembUSD.length) htmlR += `<tr style="background:var(--bg2);"><td colspan="4" style="padding:.4rem .8rem;font-size:.74rem;color:var(--text-muted);font-weight:600;letter-spacing:.05em;">🇦🇷 PESOS (ARS)</td></tr>`;
      htmlR += buildReembRows(catsReembARS, reembA_ARS, reembB_ARS, "ARS");
    }
    if (catsReembUSD.length) {
      if (catsReembARS.length) htmlR += `<tr><td colspan="4" style="height:.4rem;background:var(--bg);padding:0;"></td></tr>`;
      htmlR += `<tr style="background:var(--bg2);"><td colspan="4" style="padding:.4rem .8rem;font-size:.74rem;color:var(--text-muted);font-weight:600;letter-spacing:.05em;">🇺🇸 DÓLARES (USD)</td></tr>`;
      htmlR += buildReembRows(catsReembUSD, reembA_USD, reembB_USD, "USD");
    }
    tbodyReemb.innerHTML = htmlR;
  }

  const tfootReemb = document.getElementById("comp-foot-reembolsos");
  let tfootR = "";
  const netReembARS = totalA_ARS - totalB_ARS;
  const netReembUSD = totalA_USD - totalB_USD;
  if (catsReembARS.length) {
    tfootR += `<tr class="comp-tfoot-row">
      <td><strong>TOTAL ARS</strong></td>
      <td style="text-align:right">${totalA_ARS>0?fmt(totalA_ARS):"—"}</td>
      <td style="text-align:right">${totalB_ARS>0?fmt(totalB_ARS):"—"}</td>
      <td style="text-align:right" class="comp-tfoot-total">${fmt(netReembARS)}</td>
    </tr>`;
  }
  if (catsReembUSD.length) {
    tfootR += `<tr class="comp-tfoot-row">
      <td><strong>TOTAL USD</strong></td>
      <td style="text-align:right">${totalA_USD>0?fmtMoneda(totalA_USD,"USD"):"—"}</td>
      <td style="text-align:right">${totalB_USD>0?fmtMoneda(totalB_USD,"USD"):"—"}</td>
      <td style="text-align:right" class="comp-tfoot-total">${fmtMoneda(netReembUSD,"USD")}</td>
    </tr>`;
  }
  tfootR += `<tr style="font-size:.73rem;color:var(--text-muted)">
    <td colspan="2">Daniel pagó por Ama</td>
    <td>Ama pagó por Daniel</td>
    <td style="text-align:right">Saldo neto</td>
  </tr>`;
  tfootReemb.innerHTML = tfootR;

  // ── BALANCE FINAL ────────────────────────────────────────────
  // Perspectiva de Daniel: ¿cuánto le debe Ama (neto)?
  // compNet = daniel - ama → + = Ama debe; reembA = Daniel pagó por Ama (+); reembB = Ama pagó por Daniel (-)
  const balanceFinalARS = totalCompNetARS + totalA_ARS - totalB_ARS;
  const balanceFinalUSD = totalCompNetUSD + totalA_USD - totalB_USD;

  const balEl  = document.getElementById("comp-balance-valor");
  const balSub = document.getElementById("comp-balance-sub");

  const hayUSD = filasCompUSD.length > 0 || catsReembUSD.length > 0;
  const estaAMano = balanceFinalARS === 0 && balanceFinalUSD === 0;
  balEl.textContent = estaAMano
    ? "¡A mano!"
    : fmt(Math.abs(balanceFinalARS)) + (hayUSD && balanceFinalUSD !== 0 ? " + " + fmtMoneda(Math.abs(balanceFinalUSD), "USD") : "");
  balEl.className = "comp-balance-value " + (estaAMano ? "a-mano" : balanceFinalARS >= 0 ? "positivo" : "negativo");
  if (estaAMano) _confettiBrief({ count: 40, colors: ["#5A8C6B", "#C8845A", "#EDE8E3"] });

  const desglose = [];
  if (totalCompNetARS > 0) desglose.push(`Compartidos ARS: ${fmt(totalCompNetARS)}`);
  if (totalA_ARS > 0)      desglose.push(`Reembolsos ARS: ${fmt(totalA_ARS)}`);
  if (totalCompNetUSD > 0) desglose.push(`Compartidos USD: ${fmtMoneda(totalCompNetUSD,"USD")}`);
  if (totalA_USD > 0)      desglose.push(`Reembolsos USD: ${fmtMoneda(totalA_USD,"USD")}`);

  const debeAma = balanceFinalARS > 0 || balanceFinalUSD > 0;
  const vosDebés = balanceFinalARS < 0 || balanceFinalUSD < 0;

  if (debeAma && !vosDebés) {
    balSub.textContent = `✅ ${PARTNER} te debe — ${desglose.join(" + ")}`;
  } else if (vosDebés && !debeAma) {
    const partes = [];
    if (balanceFinalARS < 0) partes.push(fmt(Math.abs(balanceFinalARS)));
    if (balanceFinalUSD < 0) partes.push(fmtMoneda(Math.abs(balanceFinalUSD), "USD"));
    balSub.textContent = `⚠️ Vos le debés ${partes.join(" + ")} a ${PARTNER}`;
  } else if (debeAma || vosDebés) {
    balSub.textContent = `⚖️ Deudas mixtas — ${desglose.join(" | ")}`;
  } else {
    balSub.textContent = "✅ Están a mano — sin deuda pendiente";
  }
  // ── CONTRIBUCIÓN DEL MES ─────────────────────────────────────
  const contribCard = document.getElementById("comp-contrib");
  if (contribCard) {
    const totalAmbos = totalCompDanielARS + totalCompAmaARS;
    if (totalAmbos > 0.01) {
      const pctU = Math.max(0, Math.min(1, totalCompDanielARS / totalAmbos));
      const pctP = Math.max(0, Math.min(1, totalCompAmaARS   / totalAmbos));
      const _s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      const _w = (id, pct) => { const el = document.getElementById(id); if (el) el.style.width = (pct * 100).toFixed(1) + "%"; };
      _w("comp-fairness-bar-a", pctU);
      _w("comp-fairness-bar-b", pctP);
      _s("comp-fairness-a",     Math.round(pctU * 100) + "%");
      _s("comp-fairness-b",     Math.round(pctP * 100) + "%");
      _s("comp-fairness-a-amt", fmt(totalCompDanielARS));
      _s("comp-fairness-b-amt", fmt(totalCompAmaARS));
      _s("comp-contrib-total",  fmt(totalAmbos));
      _s("comp-contrib-name-a", USUARIO);
      _s("comp-contrib-name-b", PARTNER);
      contribCard.style.display = "";
    } else {
      contribCard.style.display = "none";
    }
  }

  // ── SETTLEMENT ITEMS para "Saldar todo" ──────────────────────
  _settlementItems = [];
  filasCompARS.forEach(r => {
    const net = r.daniel - r.ama;
    if (Math.abs(net) > 0.01) _settlementItems.push({ cat: r.cat, monto: Math.abs(net), tipo: net > 0 ? "Ingreso" : "Gasto", moneda: "ARS" });
  });
  filasCompUSD.forEach(r => {
    const net = r.daniel - r.ama;
    if (Math.abs(net) > 0.01) _settlementItems.push({ cat: r.cat, monto: Math.abs(net), tipo: net > 0 ? "Ingreso" : "Gasto", moneda: "USD" });
  });
  catsReembARS.forEach(cat => {
    const net = (reembA_ARS[cat] || 0) - (reembB_ARS[cat] || 0);
    if (Math.abs(net) > 0.01) _settlementItems.push({ cat, monto: Math.abs(net), tipo: net > 0 ? "Ingreso" : "Gasto", moneda: "ARS" });
  });
  catsReembUSD.forEach(cat => {
    const net = (reembA_USD[cat] || 0) - (reembB_USD[cat] || 0);
    if (Math.abs(net) > 0.01) _settlementItems.push({ cat, monto: Math.abs(net), tipo: net > 0 ? "Ingreso" : "Gasto", moneda: "USD" });
  });
  // Detect if month was already settled
  const mesComp  = parseInt(document.getElementById("comp-mes").value);
  const anioComp = parseInt(document.getElementById("comp-anio").value);
  const yaLiquidado = allTransac.some(t =>
    t.descripcion === "Liquidación" &&
    (t.usuario || "Daniel") === USUARIO &&
    (() => { const { year, month } = getMesLiquidacion(t); return month === mesComp && year === anioComp; })()
  );

  const saldarBtn    = document.getElementById("comp-saldar-btn");
  const badgeEl      = document.getElementById("comp-saldado-badge");
  const undoBtn      = document.getElementById("comp-undo-btn");
  const registrarBtn = document.getElementById("comp-registrar-btn");
  const hayDeuda = !yaLiquidado && _settlementItems.length > 0;
  if (saldarBtn)    saldarBtn.style.display    = hayDeuda ? "" : "none";
  if (registrarBtn) registrarBtn.style.display = hayDeuda ? "" : "none";
  if (badgeEl)      badgeEl.style.display      = yaLiquidado ? "" : "none";
  if (undoBtn)      undoBtn.style.display      = yaLiquidado ? "" : "none";

  inicializarDisclosureCompartidos();
}

// ─── LIQUIDACIÓN DE COMPARTIDOS ───────────────────────────────
let _liqPendiente = null; // { cat, monto, tipo }
let _settlementItems = []; // { cat, monto, tipo, moneda } — para saldar todo
let chartSparklines = {};
let _lastHeatmapMes = null;
let _filFechaExacta = null;
let _accionesRefreshTimer = null;
let _accionesLabelTimer  = null;
let _filtroDebounce      = null;
const _$ = {};  // element cache — populated lazily
function _el(id) { return _$[id] || (_$[id] = document.getElementById(id)); }
let _filtroGen = 0;  // generation counter — increments on every filtrarTabla() call
let _accionesUltimaActualizacion = null; // "YYYY-MM-DD" — set by heatmap click, cleared on manual filter change

function abrirLiquidar(cat, monto, tipo) {
  _liqPendiente = { cat, monto, tipo };
  const esIngreso = tipo === "Ingreso";
  document.getElementById("liq-titulo").textContent =
    `Liquidar — ${cat}`;
  document.getElementById("liq-subtitulo").textContent =
    esIngreso
      ? `Registrar cobro de ${fmt(monto)} de ${PARTNER}`
      : `Registrar pago de ${fmt(monto)} a ${PARTNER}`;
  // Poblar fuentes (incluye tarjetas de crédito)
  const sel = document.getElementById("liq-fuente");
  sel.innerHTML = [...categFuentes, ...categFuentesTC].map(f => `<option value="${f}">${f}</option>`).join("");
  const modal = document.getElementById("liq-modal");
  modal.style.display = "flex";
}

function cerrarLiquidar() {
  document.getElementById("liq-modal").style.display = "none";
  _liqPendiente = null;
  const btn = document.getElementById("liq-confirmar-btn");
  if (btn) btn.onclick = confirmarLiquidar;
}

function abrirSaldarTodo() {
  if (!_settlementItems.length) return;
  document.getElementById("liq-titulo").textContent = "Saldar todo el mes";
  document.getElementById("liq-subtitulo").textContent =
    `Se crearán ${_settlementItems.length} transacción(es) — una por categoría`;
  const sel = document.getElementById("liq-fuente");
  sel.innerHTML = [...(categFuentes||[]), ...(categFuentesTC||[])].map(f => `<option value="${f}">${f}</option>`).join("");
  const btn = document.getElementById("liq-confirmar-btn");
  if (btn) btn.onclick = confirmarSaldarTodo;
  document.getElementById("liq-modal").style.display = "flex";
}

async function confirmarSaldarTodo() {
  const fuente = document.getElementById("liq-fuente").value;
  const mes    = parseInt(document.getElementById("comp-mes").value);
  const anio   = parseInt(document.getElementById("comp-anio").value);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const fecha  = `${anio}-${String(mes).padStart(2,"0")}-${String(ultimoDia).padStart(2,"0")}`;
  document.getElementById("liq-modal").style.display = "none";
  const btn = document.getElementById("liq-confirmar-btn");
  if (btn) btn.onclick = confirmarLiquidar;
  let ok = 0, fail = 0;
  for (const item of _settlementItems) {
    try {
      const { data, error } = await supabaseClient
        .from("transacciones")
        .insert({
          id: crypto.randomUUID(),
          fecha, tipo: item.tipo, categoria: item.cat, monto: item.monto,
          descripcion: "Liquidación",
          responsabilidad: "Mío",
          fuente, moneda: item.moneda,
          usuario: USUARIO,
          categoria_id: _getCategoriaId(item.cat, item.tipo),
          cuenta_id:    _getCuentaId(fuente),
          user_id: supabaseSession.user.id
        })
        .select().single();
      if (error) throw error;
      allTransac.push({ ...data, monto: parseFloat(data.monto) });
      ok++;
    } catch(e) { fail++; }
  }
  _settlementItems = [];
  if (fail === 0) {
    _confettiBrief({ count: 80 });
    showToast(`🎉 ${ok} liquidación(es) — ¡quedaron a mano!`, "ok");
  } else {
    showToast(`⚠️ ${ok} OK · ${fail} error(es)`, "error");
  }
  cargarCompartidos();
}

async function deshacerLiquidacion() {
  const mes  = parseInt(document.getElementById("comp-mes").value);
  const anio = parseInt(document.getElementById("comp-anio").value);
  const txsLiq = allTransac.filter(t =>
    t.descripcion === "Liquidación" &&
    (t.usuario || "Daniel") === USUARIO &&
    (() => { const { year, month } = getMesLiquidacion(t); return month === mes && year === anio; })()
  );
  if (!txsLiq.length) return;
  let ok = 0, fail = 0;
  for (const t of txsLiq) {
    try {
      const { error } = await supabaseClient.from("transacciones").delete().eq("id", t.id);
      if (error) throw error;
      const idx = allTransac.findIndex(x => x.id === t.id);
      if (idx !== -1) allTransac.splice(idx, 1);
      ok++;
    } catch(e) { fail++; }
  }
  if (fail === 0) showToast(`↩ ${ok} liquidación(es) eliminada(s)`, "ok");
  else showToast(`⚠️ ${ok} OK · ${fail} error(es)`, "error");
  cargarCompartidos();
}

async function confirmarLiquidar() {
  if (!_liqPendiente) return;
  const { cat, monto, tipo } = _liqPendiente;
  const fuente = document.getElementById("liq-fuente").value;
  const mes  = parseInt(document.getElementById("comp-mes").value);
  const anio = parseInt(document.getElementById("comp-anio").value);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const fecha = `${anio}-${String(mes).padStart(2,"0")}-${String(ultimoDia).padStart(2,"0")}`;

  cerrarLiquidar();
  try {
    const { data, error } = await supabaseClient
      .from('transacciones')
      .insert({
        id: crypto.randomUUID(),
        fecha, tipo, categoria: cat, monto,
        descripcion: "Liquidación",
        responsabilidad: "Mío",
        fuente, moneda: "ARS",
        usuario: USUARIO,
        categoria_id: _getCategoriaId(cat, tipo),
        cuenta_id:    _getCuentaId(fuente),
        user_id: supabaseSession.user.id
      })
      .select().single();
    if (error) throw error;
    allTransac.push({ ...data, monto: parseFloat(data.monto) });
    showToast(`✅ ${tipo} de ${fmt(monto)} registrado`, "ok");
    if (navigator.vibrate) navigator.vibrate(50);
  } catch(e) {
    showToast(`❌ Error: ${e.message}`, "error");
  }
}

// ─── NAVEGACIÓN ───────────────────────────────────────────────
// ─── VISTA ANUAL ─────────────────────────────────────────────
let chartAnualBarras = null;

function _poblarAnioAnual() {
  const sel = document.getElementById("anual-anio");
  if (sel.options.length) return; // ya poblado
  const hoy = new Date();
  for (let y = hoy.getFullYear(); y >= hoy.getFullYear() - 4; y--) {
    const o = document.createElement("option");
    o.value = y; o.textContent = y;
    if (y === hoy.getFullYear()) o.selected = true;
    sel.appendChild(o);
  }
}

function cargarAnual() {
  _poblarAnioAnual();
  const anio = parseInt(document.getElementById("anual-anio").value);
  const MESES_LABEL = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  // Transacciones ARS del año (para chart + tabla ARS)
  const txsAnioARS = allTransac.filter(t => {
    const { year } = getMesLiquidacion(t);
    return year === anio
      && (t.usuario || "Daniel") === USUARIO
      && !esTransferencia(t)
      && (t.moneda || "ARS") === "ARS";
  });

  // Transacciones USD del año (para tabla USD)
  const txsAnioUSD = allTransac.filter(t => {
    const { year } = getMesLiquidacion(t);
    return year === anio
      && (t.usuario || "Daniel") === USUARIO
      && !esTransferencia(t)
      && (t.moneda || "ARS") === "USD";
  });

  // Agrupar ARS por mes (1-12)
  const byMes = {};
  for (let m = 1; m <= 12; m++) byMes[m] = { ingresos: 0, gastos: 0, cats: {} };

  txsAnioARS.forEach(t => {
    const { month: m } = getMesLiquidacion(t);
    const monto = Math.abs(Number(t.monto));
    if (t.tipo === "Ingreso" && CATS_INGRESO_REAL.includes(t.categoria)) {
      byMes[m].ingresos += monto;
    } else if (t.tipo === "Gasto") {
      byMes[m].gastos += monto;
      byMes[m].cats[t.categoria] = (byMes[m].cats[t.categoria] || 0) + monto;
    }
  });

  // Totales ARS anuales
  const totalIng   = Object.values(byMes).reduce((s,m) => s + m.ingresos, 0);
  const totalGas   = Object.values(byMes).reduce((s,m) => s + m.gastos,   0);
  const balance    = totalIng - totalGas;
  const tasaAhorro = totalIng > 0 ? ((balance / totalIng) * 100) : 0;

  // Totales USD anuales
  const totalIngUSD = txsAnioUSD.filter(t => t.tipo === "Ingreso" && CATS_INGRESO_REAL.includes(t.categoria))
    .reduce((s,t) => s + Math.abs(Number(t.monto)), 0);
  const totalGasUSD = txsAnioUSD.filter(t => t.tipo === "Gasto")
    .reduce((s,t) => s + Math.abs(Number(t.monto)), 0);

  // ── KPIs ──
  const kpiEl    = document.getElementById("anual-kpis");
  const kpiColor = (v) => v >= 0 ? "var(--green)" : "var(--red)";
  let kpiHtml = `
    <div class="kpi-card"><div class="kpi-label">Ingresos ${anio} (ARS)</div><div class="kpi-value" style="color:var(--green)">${fmt(totalIng)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Gastos ${anio} (ARS)</div><div class="kpi-value" style="color:var(--red)">${fmt(totalGas)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Balance neto</div><div class="kpi-value" style="color:${kpiColor(balance)}">${balance>=0?"+":""}${fmt(balance)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Tasa de ahorro</div><div class="kpi-value" style="color:${kpiColor(tasaAhorro)}">${tasaAhorro.toFixed(1)}%</div></div>
  `;
  if (totalGasUSD > 0 || totalIngUSD > 0) {
    const balUSD = totalIngUSD - totalGasUSD;
    kpiHtml += `<div class="kpi-card"><div class="kpi-label">Balance USD ${anio}</div><div class="kpi-value" style="color:${kpiColor(balUSD)}">${balUSD>=0?"+":""}${fmtMoneda(Math.abs(balUSD),"USD")}</div><div class="kpi-sub" style="font-size:.74rem;color:var(--text-muted);margin-top:.2rem;">↑ ${fmtMoneda(totalIngUSD,"USD")} · ↓ ${fmtMoneda(totalGasUSD,"USD")}</div></div>`;
  }
  kpiEl.innerHTML = kpiHtml;

  // ── Gráfico barras por mes (ARS) ──
  const ctx = document.getElementById("chart-anual-barras");
  if (chartAnualBarras) chartAnualBarras.destroy();
  chartAnualBarras = new Chart(ctx, {
    data: {
      labels: MESES_LABEL,
      datasets: [
        { type:"bar", label:"Ingresos ARS", data: Object.values(byMes).map(m=>m.ingresos),
          backgroundColor:"rgba(52,211,153,0.7)", borderRadius:5 },
        { type:"bar", label:"Gastos ARS",   data: Object.values(byMes).map(m=>m.gastos),
          backgroundColor:"rgba(248,113,113,0.7)", borderRadius:5 }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:"#8C7B72", font:{size:12} } } },
      scales:{
        x:{ ticks:{color:"#8C7B72"}, grid:{color:"rgba(45,41,38,0.06)"} },
        y:{ ticks:{color:"#8C7B72", callback:v=>fmtShort(v)}, grid:{color:"rgba(45,41,38,0.06)"} }
      }
    }
  });

  // ── Tabla de categorías ARS ──
  const catTotals = {};
  const catMeses  = {};
  for (let m = 1; m <= 12; m++) {
    Object.entries(byMes[m].cats).forEach(([cat, total]) => {
      catTotals[cat] = (catTotals[cat] || 0) + total;
      catMeses[cat]  = (catMeses[cat]  || 0) + 1;
    });
  }
  const sortedCats = Object.entries(catTotals).sort((a,b) => b[1]-a[1]);

  // ── Tabla de categorías USD ──
  const catTotalsUSD = {};
  const catMesesUSD  = {};
  txsAnioUSD.filter(t => t.tipo === "Gasto").forEach(t => {
    const { month: m } = getMesLiquidacion(t);
    const monto = Math.abs(Number(t.monto));
    catTotalsUSD[t.categoria] = (catTotalsUSD[t.categoria] || 0) + monto;
    if (!catMesesUSD[t.categoria]) catMesesUSD[t.categoria] = new Set();
    catMesesUSD[t.categoria].add(m);
  });
  const sortedCatsUSD = Object.entries(catTotalsUSD).sort((a,b) => b[1]-a[1]);

  const tbody = document.getElementById("anual-tbody");
  if (!sortedCats.length && !sortedCatsUSD.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">Sin datos para ${anio}</div></td></tr>`;
    return;
  }

  const sepStyle = `style="background:var(--bg2);padding:.35rem .8rem;font-size:.73rem;color:var(--text-muted);font-weight:600;letter-spacing:.05em;"`;
  let html = "";

  if (sortedCats.length) {
    if (sortedCatsUSD.length) html += `<tr><td colspan="5" ${sepStyle}>🇦🇷 PESOS (ARS)</td></tr>`;
    html += sortedCats.map(([cat, total]) => {
      const meses = catMeses[cat];
      const prom  = total / meses;
      const pct   = totalGas > 0 ? ((total / totalGas) * 100).toFixed(1) : "0.0";
      return `<tr>
        <td>${cat}</td>
        <td style="text-align:right;font-weight:600;color:var(--red)">${fmt(total)}</td>
        <td style="text-align:right;color:var(--text-muted)">${meses}</td>
        <td style="text-align:right;color:var(--text-muted)">${fmt(prom)}</td>
        <td style="text-align:right;color:var(--text-muted)">${pct}%</td>
      </tr>`;
    }).join("");
  }

  if (sortedCatsUSD.length) {
    if (sortedCats.length) html += `<tr><td colspan="5" style="height:.4rem;background:var(--bg);padding:0;"></td></tr>`;
    html += `<tr><td colspan="5" ${sepStyle}>🇺🇸 DÓLARES (USD)</td></tr>`;
    html += sortedCatsUSD.map(([cat, total]) => {
      const meses = catMesesUSD[cat].size;
      const prom  = total / meses;
      const pct   = totalGasUSD > 0 ? ((total / totalGasUSD) * 100).toFixed(1) : "0.0";
      return `<tr>
        <td>${cat}</td>
        <td style="text-align:right;font-weight:600;color:var(--red)">${fmtMoneda(total,"USD")}</td>
        <td style="text-align:right;color:var(--text-muted)">${meses}</td>
        <td style="text-align:right;color:var(--text-muted)">${fmtMoneda(prom,"USD")}</td>
        <td style="text-align:right;color:var(--text-muted)">${pct}%</td>
      </tr>`;
    }).join("");
  }

  tbody.innerHTML = html;
}

const _navOrder = { presupuesto: 0, transacciones: 1, compartidos: 2, config: 3, inversiones: 4, resumen: 5 };
let   _paginaActual = "presupuesto";

function _actualizarNavIndicator() {
  const indicator = document.getElementById("topnav-indicator");
  const active    = document.querySelector(".topnav .nav-item.active");
  if (!indicator || !active) return;
  const tabsEl = document.querySelector(".topnav-tabs");
  const tabsRect   = tabsEl.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  indicator.style.width     = activeRect.width + "px";
  indicator.style.transform = `translateX(${activeRect.left - tabsRect.left}px)`;
}

function navegarA(pagina) {
  // Reset cuotas mode when leaving Nueva page
  if (pagina !== "nueva" && typeof _modoCuotas !== "undefined" && _modoCuotas) {
    _setModoCuotas("unico");
    _montoCuotaEditado = false;
  }

  // Aliases para compatibilidad con código interno
  const alias = { mimes: "presupuesto", categorias: "config" };
  pagina = alias[pagina] || pagina;

  // Dirección para la transición de página
  const prevOrder = _navOrder[_paginaActual] ?? -1;
  const nextOrder = _navOrder[pagina] ?? -1;
  const goingBack = nextOrder !== -1 && prevOrder !== -1 && nextOrder < prevOrder;
  _paginaActual = pagina;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active", "dir-back"));
  const page = document.getElementById("page-" + pagina);
  if (page) {
    if (goingBack) page.classList.add("dir-back");
    page.classList.add("active");
  }

  // Top nav (desktop) — 4 tabs en orden: presupuesto, transacciones, compartidos, config
  const navMap = { presupuesto: 0, transacciones: 1, compartidos: 2, config: 3, inversiones: 4, resumen: 5 };
  document.querySelectorAll(".topnav .nav-item").forEach((n, i) => {
    n.classList.toggle("active", i === navMap[pagina]);
  });
  document.querySelectorAll(".sidebar .nav-item").forEach((n, i) => {
    n.classList.toggle("active", i === navMap[pagina]);
  });
  requestAnimationFrame(_actualizarNavIndicator);

  // Bottom nav (mobile)
  ["bn-presupuesto","bn-transacciones","bn-compartidos","bn-config","bn-inversiones","bn-resumen"].forEach(id => {
    document.getElementById(id)?.classList.remove("active");
  });
  const bnMap = {
    presupuesto: "bn-presupuesto",
    transacciones: "bn-transacciones",
    compartidos: "bn-compartidos",
    config: "bn-config",
    inversiones: "bn-inversiones",
    resumen: "bn-resumen"
  };
  if (bnMap[pagina]) document.getElementById(bnMap[pagina])?.classList.add("active");

  // Resetear filtros al volver a Transacciones
  if (pagina === "transacciones") _resetFiltros();

  // Cargar datos de la página destino
  if (pagina === "compartidos")  cargarCompartidos();
  if (pagina === "presupuesto")  cargarPresupuesto();
  if (pagina === "anual")        cargarAnual();
  if (pagina === "resumen")      { cargarResumenMes(); cargarEvolucion(); }
  if (pagina === "config")       renderizarConfig();
  if (pagina === "inversiones")  { inicializarDisclosureInversiones(); renderPlazos(); renderAcciones(); _iniciarAutoRefreshAcciones(); }

  // Ocultar FAB en la página de nueva transacción (ya tiene su propio botón de guardar)
  const fab = document.getElementById("btn-fab-nueva");
  if (fab) fab.style.display = pagina === "nueva" ? "none" : "";

  // Re-renderizar íconos Lucide tras navegación (contenido dinámico puede contener data-lucide)
  if (window.lucide) lucide.createIcons();

  closeSidebar();
  window.scrollTo(0, 0);
}

// ─── SIDEBAR MOBILE ───────────────────────────────────────────
function toggleSidebar() {
  const drawer  = document.getElementById("mobile-drawer");
  const overlay = document.getElementById("sidebar-overlay");
  const icon    = document.getElementById("hamburger-icon");
  if (!drawer) return;
  const open = drawer.classList.toggle("open");
  if (overlay) overlay.classList.toggle("open", open);
  if (icon)    icon.textContent = open ? "✕" : "☰";
}
function closeSidebar() {
  const drawer = document.getElementById("mobile-drawer");
  if (drawer) drawer.classList.remove("open");
  document.getElementById("sidebar-overlay")?.classList.remove("open");
  const icon = document.getElementById("hamburger-icon");
  if (icon) icon.textContent = "☰";
}

// Mostrar/ocultar header mobile al cambiar tamaño de ventana (ej: rotación)
window.addEventListener("resize", () => {
  const mh = document.getElementById("mobile-header");
  if (!mh) return;
  // Solo aplica si el app está visible
  if (document.getElementById("app").style.display === "block") {
    mh.style.display = window.innerWidth <= 768 ? "flex" : "none";
    if (window.innerWidth > 768) closeSidebar(); // cerrar drawer si amplían pantalla
  }
  requestAnimationFrame(_actualizarNavIndicator);
});

