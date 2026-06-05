// ─── RESPONSABILIDAD SELECT ────────────────────────────────────
function inicializarRespButtons() {
  const sel = document.getElementById("f-responsabilidad");
  if (!sel) return;
  const opciones = [
    { valor: "Mío",           label: "Solo mío" },
    { valor: "Compartido",    label: "Lo pagamos juntos" },
    { valor: "De " + PARTNER, label: "Lo pagó " + (PARTNER || "tu pareja") },
  ];
  sel.innerHTML = opciones.map(op =>
    `<option value="${op.valor}">${op.label}</option>`
  ).join("");
  sel.value = "Mío";
}

function seleccionarResp(valor) {
  const sel = document.getElementById("f-responsabilidad");
  if (sel) sel.value = valor;
}

function resetRespField() {
  seleccionarResp("Mío");
}

// ===== HEALTH SCORE =====
// ===== WALLETS / PATRIMONIO =====
// ===== SWIPE EN TRANSACCIONES =====
(function initSwipe() {
  let startX = 0, startY = 0, activeRow = null, committed = false;
  const THRESHOLD = 65, MAX = 90;

  document.addEventListener("touchstart", e => {
    const row = e.target.closest("#tbody-transacciones tr");
    if (!row || e.target.closest("button") || e.target.closest("select")) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    activeRow = row;
    committed = false;
    row.classList.add("swipe-row");
  }, { passive: true });

  document.addEventListener("touchmove", e => {
    if (!activeRow) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!committed && Math.abs(dy) > Math.abs(dx)) { activeRow = null; return; }
    committed = true;
    e.preventDefault();
    activeRow.classList.add("swiping");
    const clamped = Math.max(-MAX, Math.min(MAX, dx));
    activeRow.style.transform = `translateX(${clamped}px)`;
    activeRow.style.background = clamped < -20 ? "rgba(248,113,113,.08)" : clamped > 20 ? "rgba(52,211,153,.08)" : "";
  }, { passive: false });

  document.addEventListener("touchend", e => {
    if (!activeRow) return;
    const dx = e.changedTouches[0].clientX - startX;
    const row = activeRow;
    activeRow = null;
    row.classList.remove("swiping");
    row.style.transform = "";
    row.style.background = "";
    if (!committed) return;
    if (dx < -THRESHOLD) {
      const id = row.dataset.id || row.querySelector("[onclick*='eliminarTransaccion']")?.getAttribute("onclick")?.match(/'([^']+)'/)?.[1];
      if (id) eliminarTransaccion(id);
    } else if (dx > THRESHOLD) {
      const id = row.dataset.id || row.querySelector("[onclick*='abrirEditorTransaccion']")?.getAttribute("onclick")?.match(/'([^']+)'/)?.[1];
      if (id) abrirEditorTransaccion(id);
    }
  }, { passive: true });
})();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ===== PLAZOS FIJOS =====
let _plazosCache = [];

function _normalizarPlazo(p) {
  return { ...p, fechaInicio: p.fecha_inicio || p.fechaInicio, fechaVencimiento: p.fecha_vencimiento || p.fechaVencimiento };
}

async function loadPlazos() {
  const { data, error } = await supabaseClient
    .from('plazos_fijos').select('*').eq('usuario', USUARIO).order('created_at', { ascending: true });
  if (error) { console.error('loadPlazos:', error); return []; }
  _plazosCache = (data || []).map(_normalizarPlazo);
  return _plazosCache;
}

async function renderPlazos() {
  const el = document.getElementById("plazo-lista");
  if (!el) return;
  _renderTotalesInversiones(0, 0);
  const plazos = await loadPlazos();
  if (!plazos.length) {
    el.innerHTML = `<div style="text-align:center;padding:2rem 1rem">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.75;margin-bottom:.6rem"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M7 6V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/><circle cx="12" cy="13" r="2"/></svg>
      <div style="font-size:.9rem;font-weight:700;color:var(--text);margin-bottom:.25rem">Sin plazos registrados</div>
      <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.8rem">Registrá tus plazos fijos y mirá el rendimiento estimado.</div>
      <button class="btn btn-primary" style="font-size:.82rem" onclick="abrirFormPlazo()">+ Agregar plazo fijo</button>
    </div>`;
    return;
  }
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  el.innerHTML = plazos.map(p => {
    const moneda = p.moneda || "ARS";
    const fmtP = v => moneda === "USD" ? fmtMoneda(v, "USD") : fmt(v);
    const venc = new Date(p.fechaVencimiento + "T00:00:00");
    const inicio = new Date(p.fechaInicio + "T00:00:00");
    const dias = Math.round((venc - inicio) / 86400000);
    const rend = p.monto * (p.tna / 100) * (dias / 365);
    const diffDias = Math.round((venc - hoy) / 86400000);
    const badge = diffDias < 0 ? "vencido" : diffDias === 0 ? "vence" : "vigente";
    const badgeTxt = diffDias < 0 ? "Vencido" : diffDias === 0 ? "Vence hoy" : `${diffDias}d restantes`;
    const progreso = diffDias < 0 ? 100 : Math.max(0, Math.min(100, Math.round(((hoy - inicio) / (venc - inicio)) * 100)));
    const barColor = badge === "vencido" ? "var(--text-muted)" : badge === "vence" ? "var(--yellow)" : "var(--accent)";
    return `<div class="plazo-card">
      <div class="plazo-header">
        <div>
          <div class="plazo-desc">${escapeHtml(p.descripcion)}</div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:.1rem">${fmtFecha(p.fechaInicio)} → ${fmtFecha(p.fechaVencimiento)}</div>
        </div>
        <span class="plazo-badge ${badge}">${badgeTxt}</span>
      </div>
      <div class="plazo-progress"><div class="plazo-progress-fill" style="transform:scaleX(${(progreso/100).toFixed(3)});background:${barColor}"></div></div>
      <div class="plazo-row"><span>Capital · TNA</span><strong>${fmtP(p.monto)} <span style="font-weight:400;color:var(--text-muted);font-size:.75rem">${moneda} · ${p.tna}%</span></strong></div>
      <div class="plazo-row"><span>Rendimiento estimado</span><strong style="color:var(--green)">+${fmtP(rend)}</strong></div>
      <div class="plazo-row"><span>Total al vencimiento</span><strong style="font-size:.88rem">${fmtP(p.monto + rend)}</strong></div>
      <div class="plazo-row" style="margin-top:.45rem;justify-content:flex-end">
        <div style="display:flex;gap:.4rem">
          <button class="cfg-del-btn" onclick="editarPlazo('${p.id}')" title="Editar" aria-label="Editar plazo" style="color:var(--accent)">✎</button>
          <button class="cfg-del-btn" onclick="eliminarPlazo('${p.id}')" title="Eliminar" aria-label="Eliminar plazo">✕</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

function _renderFormPlazo(p) {
  const hoy = new Date().toISOString().slice(0,10);
  const moneda = p?.moneda || "ARS";
  return `<div class="plazo-form">
    ${p ? `<input type="hidden" id="pf-id" value="${p.id}">` : ""}
    <input class="plazo-form-full" id="pf-desc" placeholder="Descripción (ej: Plazo Fijo Nación)" type="text" value="${escapeHtml(p?.descripcion || '')}">
    <input id="pf-monto" placeholder="Monto" type="text" inputmode="decimal" value="${p?.monto || ''}">
    <select id="pf-moneda" style="padding:.45rem .6rem;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:.85rem">
      <option value="ARS"${moneda==="ARS"?" selected":""}>ARS</option>
      <option value="USD"${moneda==="USD"?" selected":""}>USD</option>
    </select>
    <input id="pf-tna" placeholder="TNA %" type="text" inputmode="decimal" value="${p?.tna || ''}">
    <input id="pf-inicio" type="date" value="${p?.fechaInicio || hoy}">
    <input id="pf-venc" type="date" value="${p?.fechaVencimiento || ''}">
    <div class="plazo-form-full" style="display:flex;gap:.5rem;justify-content:flex-end">
      <button class="btn" style="font-size:.82rem" onclick="cerrarFormPlazo()">Cancelar</button>
      <button class="btn btn-primary" style="font-size:.82rem" onclick="guardarPlazo()">${p ? "Actualizar" : "Guardar"}</button>
    </div>
  </div>`;
}

function abrirFormPlazo() {
  const wrap = document.getElementById("plazo-form-wrap");
  if (!wrap) return;
  wrap.style.display = "";
  wrap.innerHTML = _renderFormPlazo(null);
}

function editarPlazo(id) {
  const plazo = _plazosCache.find(p => p.id === id);
  if (!plazo) return;
  const wrap = document.getElementById("plazo-form-wrap");
  if (!wrap) return;
  wrap.style.display = "";
  wrap.innerHTML = _renderFormPlazo(plazo);
  wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function cerrarFormPlazo() {
  const wrap = document.getElementById("plazo-form-wrap");
  if (wrap) { wrap.style.display = "none"; wrap.innerHTML = ""; }
}

async function guardarPlazo() {
  const desc   = document.getElementById("pf-desc")?.value.trim();
  const monto  = parsearDecimal(document.getElementById("pf-monto")?.value);
  const moneda = document.getElementById("pf-moneda")?.value || "ARS";
  const tna    = parsearDecimal(document.getElementById("pf-tna")?.value);
  const ini    = document.getElementById("pf-inicio")?.value;
  const venc   = document.getElementById("pf-venc")?.value;
  if (!desc || !monto || !tna || !ini || !venc) { showToast("⚠️ Completá todos los campos", "error"); return; }
  if (venc <= ini) { showToast("⚠️ Vencimiento debe ser posterior al inicio", "error"); return; }
  const editId = document.getElementById("pf-id")?.value;
  const row = { descripcion: desc, monto, moneda, tna, fecha_inicio: ini, fecha_vencimiento: venc, usuario: USUARIO, user_id: supabaseSession.user.id };
  let error;
  if (editId) {
    ({ error } = await supabaseClient.from('plazos_fijos').update(row).eq('id', editId));
  } else {
    ({ error } = await supabaseClient.from('plazos_fijos').insert(row));
  }
  if (error) { showToast("⚠️ Error al guardar", "error"); console.error(error); return; }
  cerrarFormPlazo();
  renderPlazos();
}

async function eliminarPlazo(id) {
  const { error } = await supabaseClient.from('plazos_fijos').delete().eq('id', id);
  if (error) { showToast("⚠️ Error al eliminar", "error"); return; }
  renderPlazos();
}

// ===== ACCIONES & CRIPTO =====
const _precioCache = {}; // símbolo → { precio, moneda, ts }

// CoinGecko IDs para cripto comunes
const _geckoIds = {
  BTC:'bitcoin', ETH:'ethereum', USDT:'tether', BNB:'binancecoin',
  SOL:'solana', XRP:'ripple', USDC:'usd-coin', ADA:'cardano',
  DOGE:'dogecoin', AVAX:'avalanche-2', MATIC:'matic-network',
  DOT:'polkadot', LINK:'chainlink', UNI:'uniswap', LTC:'litecoin',
  ALGO:'algorand', ATOM:'cosmos', NEAR:'near', OP:'optimism',
  ARB:'arbitrum', WLD:'worldcoin-wld'
};

let _accionesCache = [];

async function loadAcciones() {
  const { data, error } = await supabaseClient
    .from('acciones').select('*').eq('usuario', USUARIO).order('created_at', { ascending: true });
  if (error) { console.error('loadAcciones:', error); return []; }
  _accionesCache = data || [];
  return _accionesCache;
}

function _esCripto(simbolo) {
  // BTC-USD, ETH-USD, SOL-USD, etc.
  const base = simbolo.replace(/-USD$/i, "");
  return base in _geckoIds;
}

async function _fetchPrecioCripto(simbolo) {
  // Coinbase API — CORS OK, sin key
  const base = simbolo.replace(/-USD$/i, "").toUpperCase();
  const url = `https://api.coinbase.com/v2/prices/${base}-USD/spot`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("coinbase " + res.status);
  const data = await res.json();
  const precio = parseFloat(data?.data?.amount);
  if (!precio) throw new Error("no price");
  return { precio, moneda: "USD" };
}

async function _fetchPrecioAccion(simbolo) {
  // Vercel proxy → Yahoo Finance (evita CORS)
  const url = `/api/quote?symbol=${encodeURIComponent(simbolo)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("proxy " + res.status);
  const data = await res.json();
  if (!data.price) throw new Error("no price");
  return { precio: data.price, moneda: data.currency || "USD" };
}

async function _fetchPrecio(simbolo) {
  const cache = _precioCache[simbolo];
  if (cache && Date.now() - cache.ts < 5 * 60 * 1000) return cache;
  try {
    const result = _esCripto(simbolo)
      ? await _fetchPrecioCripto(simbolo)
      : await _fetchPrecioAccion(simbolo);
    if (!result) return null;
    _precioCache[simbolo] = { ...result, ts: Date.now() };
    return _precioCache[simbolo];
  } catch {
    return null;
  }
}

function _renderTotalesInversiones(accionesUSD, accionesARS) {
  const plazos    = _plazosCache;
  const plazosARS = plazos.filter(p => (p.moneda || "ARS") === "ARS").reduce((s,p) => s + p.monto, 0);
  const plazosUSD = plazos.filter(p => p.moneda === "USD").reduce((s,p) => s + p.monto, 0);
  const totalARS  = plazosARS + accionesARS;
  const totalUSD  = plazosUSD + accionesUSD;

  // Hero card
  const heroTotal = document.getElementById("inv-hero-total-ars");
  if (heroTotal) heroTotal.textContent = totalARS > 0 ? fmt(totalARS) : "—";
  const heroUSDWrap = document.getElementById("inv-hero-total-usd");
  const heroUSDVal  = document.getElementById("inv-hero-usd-val");
  if (heroUSDWrap && heroUSDVal) {
    if (totalUSD > 0) { heroUSDVal.textContent = fmtMoneda(totalUSD,"USD").replace("U$S ",""); heroUSDWrap.style.display = ""; }
    else               { heroUSDWrap.style.display = "none"; }
  }
  const heroSub = document.getElementById("inv-hero-sub");
  if (heroSub) heroSub.textContent = plazos.length > 0
    ? `${plazos.length} plazo${plazos.length !== 1 ? "s" : ""} fijo${plazos.length !== 1 ? "s" : ""} · cartera activos`
    : "Sumá tus inversiones para ver el total";

  // Allocation bars
  const grandTotal = totalARS + (totalUSD * (tipoCambioMEP || 1));
  const _pct = n => grandTotal > 0 ? Math.round(n / grandTotal * 100) : 0;
  const plazosTotal   = plazosARS + plazosUSD * (tipoCambioMEP || 1);
  const activosTotal  = accionesARS + accionesUSD * (tipoCambioMEP || 1);
  const pctPlazos  = _pct(plazosTotal);
  const pctActivos = _pct(activosTotal);
  const _s = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  const _w = (id,p) => { const e=document.getElementById(id); if(e) e.style.width=p+"%"; };
  _s("inv-alloc-plazos-val", plazosARS > 0 ? fmt(plazosARS) : "—");
  _s("inv-alloc-plazos-pct", pctPlazos + "%");
  _w("inv-alloc-bar-plazos", pctPlazos);
  _s("inv-alloc-act-val",    accionesARS > 0 ? fmt(accionesARS) : "—");
  _s("inv-alloc-act-pct",    pctActivos + "%");
  _w("inv-alloc-bar-activos", pctActivos);
  _s("inv-alloc-total",      grandTotal > 0 ? fmt(Math.round(grandTotal)) : "—");

  // Interest total
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const interesTotal = plazos.reduce((s,p) => {
    if ((p.moneda || "ARS") !== "ARS") return s;
    const venc = new Date(p.fechaVencimiento + "T00:00:00");
    const inicio = new Date(p.fechaInicio + "T00:00:00");
    const dias = Math.round((venc - inicio) / 86400000);
    return s + p.monto * (p.tna / 100) * (dias / 365);
  }, 0);
  const interesEl = document.getElementById("inv-interes-total");
  if (interesEl && interesTotal > 0) interesEl.textContent = `Interés estimado al vencer: +${fmt(Math.round(interesTotal))}`;

  // legacy div (vacío, JS lo usaba antes)
  const el = document.getElementById("inv-totales");
  if (el) el.innerHTML = "";
}

function _tiempoTranscurrido(ts) {
  if (!ts) return "";
  const seg = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seg < 60)  return `hace ${seg}s`;
  const min = Math.floor(seg / 60);
  return min < 60 ? `hace ${min}m` : `hace ${Math.floor(min/60)}h`;
}
function _iniciarAutoRefreshAcciones() {
  if (_accionesRefreshTimer) return;
  _accionesRefreshTimer = setInterval(() => {
    if (_paginaActual === "inversiones" && document.visibilityState === "visible") {
      Object.keys(_precioCache).forEach(k => delete _precioCache[k]);
      renderAcciones();
    }
  }, 60000);
  // Actualizar label de "hace Xs" cada 5s sin re-fetch
  if (!_accionesLabelTimer) {
    _accionesLabelTimer = setInterval(() => {
      const ts = document.getElementById("accion-ts");
      if (ts && _accionesUltimaActualizacion) ts.textContent = `Actualizado ${_tiempoTranscurrido(_accionesUltimaActualizacion)}`;
    }, 5000);
  }
}

async function renderAcciones() {
  const lista = document.getElementById("accion-lista");
  const totalEl = document.getElementById("accion-total");
  if (!lista) return;
  const acciones = await loadAcciones();

  _renderTotalesInversiones(0, 0); // render inmediato con valores de plazos

  if (!acciones.length) {
    lista.innerHTML = `<div style="text-align:center;padding:2rem 1rem">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.75;margin-bottom:.6rem"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/><line x1="3" y1="21" x2="21" y2="21"/></svg>
      <div style="font-size:.9rem;font-weight:700;color:var(--text);margin-bottom:.25rem">Sin acciones ni cripto</div>
      <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.8rem">Sumá tu cartera para ver cotizaciones en vivo.</div>
      <button class="btn btn-primary" style="font-size:.82rem" onclick="abrirFormAccion()">+ Agregar tenencia</button>
    </div>`;
    if (totalEl) totalEl.innerHTML = "";
    return;
  }

  lista.innerHTML = acciones.map(a => `
    <div class="plazo-card" id="accion-card-${a.id}">
      <div class="plazo-header">
        <div>
          <div class="plazo-desc">${escapeHtml(a.simbolo)}</div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:.1rem">${escapeHtml(a.nombre || "")} · ${a.cantidad} unidades</div>
        </div>
        <div class="accion-header-valor">
          <div class="accion-valor-num" id="accion-valor-${a.id}" style="color:var(--text-muted)">—</div>
          <div id="accion-pnl-${a.id}" style="display:${a.precio_compra ? '' : 'none'};text-align:right;margin-top:.2rem"><span class="accion-pnl" style="color:var(--text-muted)">P&amp;L —</span></div>
        </div>
      </div>
      <div class="plazo-row" id="accion-precio-${a.id}"><span>Cotización</span><strong style="color:var(--text-muted)">cargando…</strong></div>
      <div class="plazo-row" style="margin-top:.45rem;justify-content:flex-end">
        <div style="display:flex;gap:.4rem">
          <button class="cfg-del-btn" onclick="editarAccion('${a.id}')" title="Editar" aria-label="Editar tenencia" style="color:var(--accent)">✎</button>
          <button class="cfg-del-btn" onclick="eliminarAccion('${a.id}')" title="Eliminar" aria-label="Eliminar tenencia">✕</button>
        </div>
      </div>
    </div>`).join("");

  let totalUSD = 0, totalARS = 0;
  await Promise.all(acciones.map(async a => {
    const cotiz = await _fetchPrecio(a.simbolo);
    const precioEl = document.getElementById(`accion-precio-${a.id}`);
    const valorEl  = document.getElementById(`accion-valor-${a.id}`);
    if (!precioEl || !valorEl) return;
    if (!cotiz) {
      precioEl.innerHTML = `<span>Cotización</span><strong style="color:var(--red)">sin datos</strong>`;
      valorEl.innerHTML  = `<span>Valor actual</span><strong>—</strong>`;
      return;
    }
    const { precio, moneda } = cotiz;
    const valor = precio * a.cantidad;
    const fmtV = v => moneda === "ARS" ? fmt(v) : fmtMoneda(v, "USD");
    precioEl.innerHTML = `<span>Cotización</span><strong>${fmtV(precio)} <span style="font-size:.7rem;color:var(--text-muted)">${moneda}</span></strong>`;
    valorEl.innerHTML  = `<span class="accion-valor-num" style="color:var(--text);font-size:.88rem">${fmtV(valor)}</span>`;
    if (moneda === "ARS") totalARS += valor; else totalUSD += valor;
    const pnlEl = document.getElementById(`accion-pnl-${a.id}`);
    if (pnlEl && a.precio_compra && a.precio_compra > 0) {
      const ganancia = (precio - a.precio_compra) * a.cantidad;
      const pct = ((precio - a.precio_compra) / a.precio_compra) * 100;
      const cls = ganancia >= 0 ? "pos" : "neg";
      const signo = ganancia >= 0 ? "+" : "−";
      pnlEl.style.display = "";
      pnlEl.innerHTML = `<span class="accion-pnl ${cls}">${signo}${fmtV(Math.abs(ganancia))} · ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%</span>`;
    } else if (pnlEl) {
      pnlEl.style.display = "none";
    }
  }));

  _accionesUltimaActualizacion = Date.now();
  if (totalEl) {
    totalEl.innerHTML = `<span id="accion-ts" style="font-size:.7rem;color:var(--text-muted)">Actualizado ${_tiempoTranscurrido(_accionesUltimaActualizacion)}</span>`;
  }
  _renderTotalesInversiones(totalUSD, totalARS);
}

function _renderFormAccion(a) {
  const hint = `<div class="plazo-form-full" style="font-size:.72rem;color:var(--text-muted);padding:.1rem 0">
    Acciones argentinas: ticker + <strong>.BA</strong> (ej: GGAL.BA) · Cripto: ticker + <strong>-USD</strong> (ej: BTC-USD)
  </div>`;
  return `<div class="plazo-form">
    ${a ? `<input type="hidden" id="af-id" value="${a.id}">` : ""}
    <input id="af-simbolo" placeholder="Símbolo (ej: AAPL, BTC-USD, GGAL.BA)" type="text" class="plazo-form-full" style="text-transform:uppercase" value="${a?.simbolo || ''}" ${a ? 'readonly style="text-transform:uppercase;opacity:.6"' : ''}>
    <input id="af-cantidad" placeholder="Cantidad / tenencia" type="text" inputmode="decimal" value="${a?.cantidad || ''}">
    <input id="af-precio-compra" placeholder="Precio compra (opcional, para P&amp;L)" type="text" inputmode="decimal" value="${a?.precio_compra ?? ''}">
    <input id="af-nombre" placeholder="Nombre (opcional)" type="text" value="${escapeHtml(a?.nombre || '')}">
    ${a ? "" : hint}
    <div class="plazo-form-full" style="display:flex;gap:.5rem;justify-content:flex-end">
      <button class="btn" style="font-size:.82rem" onclick="cerrarFormAccion()">Cancelar</button>
      <button class="btn btn-primary" style="font-size:.82rem" onclick="guardarAccion()">${a ? "Actualizar" : "Guardar"}</button>
    </div>
  </div>`;
}

function abrirFormAccion() {
  const wrap = document.getElementById("accion-form-wrap");
  if (!wrap) return;
  wrap.style.display = "";
  wrap.innerHTML = _renderFormAccion(null);
}

function editarAccion(id) {
  const accion = _accionesCache.find(a => a.id === id);
  if (!accion) return;
  const wrap = document.getElementById("accion-form-wrap");
  if (!wrap) return;
  wrap.style.display = "";
  wrap.innerHTML = _renderFormAccion(accion);
  wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function cerrarFormAccion() {
  const wrap = document.getElementById("accion-form-wrap");
  if (wrap) { wrap.style.display = "none"; wrap.innerHTML = ""; }
}

async function guardarAccion() {
  const editId  = document.getElementById("af-id")?.value;
  const simbolo = (document.getElementById("af-simbolo")?.value || "").trim().toUpperCase();
  const cantidad = parsearDecimal(document.getElementById("af-cantidad")?.value);
  const nombre   = (document.getElementById("af-nombre")?.value || "").trim();
  const pcRaw    = (document.getElementById("af-precio-compra")?.value || "").trim();
  const precio_compra = pcRaw ? parsearDecimal(pcRaw) || null : null;
  if (!simbolo || !cantidad) { showToast("⚠️ Ingresá símbolo y cantidad", "error"); return; }
  let error;
  if (editId) {
    const accion = _accionesCache.find(a => a.id === editId);
    if (accion) delete _precioCache[accion.simbolo];
    ({ error } = await supabaseClient.from('acciones').update({ cantidad, nombre, precio_compra }).eq('id', editId));
  } else {
    ({ error } = await supabaseClient.from('acciones').insert({ simbolo, cantidad, nombre, precio_compra, usuario: USUARIO, user_id: supabaseSession.user.id }));
  }
  if (error) { showToast("⚠️ Error al guardar", "error"); console.error(error); return; }
  cerrarFormAccion();
  renderAcciones();
}

async function eliminarAccion(id) {
  const { error } = await supabaseClient.from('acciones').delete().eq('id', id);
  if (error) { showToast("⚠️ Error al eliminar", "error"); return; }
  renderAcciones();
}

