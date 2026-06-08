// ─── MODO CUOTAS ─────────────────────────────────────────────

let _cuotasMesRows = "";   // HTML cache para el modal de detalle

let _modoCuotas = false;
let _montoCuotaEditado = false;

function _actualizarMesLiqField(fuente) {
  const row       = document.getElementById("f-mes-liq-row");
  const inp       = document.getElementById("f-mes-liq");
  const err       = document.getElementById("f-mes-liq-err");
  const toggleRow = document.getElementById("f-cuotas-toggle-row");
  if (!row || !inp) return;
  if (_esFuenteTC(fuente)) {
    // En modo pago único: mostrar mes_liq. En modo cuotas: ocultarlo (el toggle lo maneja)
    if (!_modoCuotas) row.style.display = "";
    if (toggleRow) toggleRow.style.display = "";
  } else {
    row.style.display = "none";
    inp.value = "";
    if (err) err.textContent = "";
    if (toggleRow) toggleRow.style.display = "none";
    _setModoCuotas("unico");
  }
}

function _setModoCuotas(modo) {
  _modoCuotas = modo === "cuotas";
  const btnUnico   = document.getElementById("f-pago-unico");
  const btnCuotas  = document.getElementById("f-pago-cuotas");
  const fields     = document.getElementById("f-cuotas-fields");
  const mesLiqRow  = document.getElementById("f-mes-liq-row");
  const montoLabel = document.getElementById("f-monto-label");

  if (_modoCuotas) {
    btnUnico?.classList.remove("active");
    btnCuotas?.classList.add("active");
    if (fields) fields.style.display = "block";
    if (mesLiqRow) mesLiqRow.style.display = "none";
    if (montoLabel) montoLabel.textContent = "Monto total";
    const inp = document.getElementById("f-primer-mes-liq");
    if (inp && !inp.value) {
      const hoy = new Date();
      const sig = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
      inp.value = `${sig.getFullYear()}-${String(sig.getMonth() + 1).padStart(2, "0")}`;
    }
    _montoCuotaEditado = false;
    _recalcularMontoCuota();
    _actualizarBtnGuardar();
  } else {
    btnUnico?.classList.add("active");
    btnCuotas?.classList.remove("active");
    if (fields) fields.style.display = "none";
    const fuente = document.getElementById("f-fuente")?.value || "";
    if (mesLiqRow) mesLiqRow.style.display = _esFuenteTC(fuente) ? "" : "none";
    if (montoLabel) montoLabel.textContent = "Monto (ARS $)";
    _actualizarBtnGuardar();
  }
}

function _recalcularMontoCuota() {
  if (_montoCuotaEditado) return;
  const montoTotal = parsearDecimal(document.getElementById("f-monto")?.value);
  const n = parseInt(document.getElementById("f-cuotas-n")?.value) || 12;
  const inp  = document.getElementById("f-monto-cuota");
  const calc = document.getElementById("f-monto-cuota-calc");
  if (!inp || !montoTotal) {
    if (inp) inp.value = "";
    if (calc) calc.innerHTML = "";
    return;
  }
  const cuota = montoTotal / n;
  inp.value = cuota.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (calc) calc.innerHTML = `Calculado: <strong>${fmt(cuota)}</strong> × ${n}`;
  _actualizarBtnGuardar();
}

function _actualizarBtnGuardar() {
  const btn = document.getElementById("btn-guardar");
  if (!btn) return;
  if (_modoCuotas) {
    const n = parseInt(document.getElementById("f-cuotas-n")?.value) || 12;
    btn.textContent = `Guardar ${n} cuotas`;
  } else {
    btn.textContent = "Guardar";
  }
}

function _toggleCFT() {
  const checked = document.getElementById("f-cft-check")?.checked;
  const row = document.getElementById("f-cft-row");
  if (row) row.style.display = checked ? "" : "none";
}

function _setModoCuotasYNavegar() {
  navegarA("nueva");
  setTimeout(() => {
    const sel = document.getElementById("f-fuente");
    if (sel && !_esFuenteTC(sel.value)) {
      const tcOpt = [...sel.options].find(o => _esFuenteTC(o.value));
      if (tcOpt) { sel.value = tcOpt.value; _actualizarMesLiqField(sel.value); }
    }
    _setModoCuotas("cuotas");
  }, 80);
}

// Muestra/oculta el campo mes_liquidacion en el modal de edición
function _actualizarEditMesLiqField(fuente) {
  const row = document.getElementById("edit-mes-liq-row");
  const inp = document.getElementById("edit-mes-liq");
  const err = document.getElementById("edit-mes-liq-err");
  if (!row || !inp) return;
  if (_esFuenteTC(fuente)) {
    row.style.display = "";
  } else {
    row.style.display = "none";
    inp.value = "";
    if (err) err.textContent = "";
  }
}

// Acepta tanto punto como coma como separador decimal (convención argentina: 1.234,56)
function parsearDecimal(val) {
  // Strip thousand-separator dots, then convert decimal comma to dot
  return parseFloat(String(val || 0).replace(/\./g, '').replace(',', '.')) || 0;
}

// Formatea el input de monto con separador de miles (punto) mientras se escribe
function formatearMiles(input) {
  const offsetFromEnd = input.value.length - (input.selectionStart || 0);
  const parts = input.value.replace(/\./g, '').split(',');
  parts[0] = (parts[0] || '').replace(/\D/g, '');
  if (parts[0]) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (parts.length > 1) parts[1] = parts[1].replace(/\D/g, '').substring(0, 2);
  input.value = parts.join(',');
  const newPos = Math.max(0, input.value.length - offsetFromEnd);
  try { input.setSelectionRange(newPos, newPos); } catch(e) {}
}

function toggleDesglose() {
  const el  = document.getElementById("pres-desglose");
  const btn = document.getElementById("btn-toggle-desglose");
  if (!el || !btn) return;
  const visible = el.style.display !== "none";
  el.style.display = visible ? "none" : "";
  btn.textContent  = visible ? "Ver desglose ▾" : "Ocultar desglose ▴";
  try { localStorage.setItem(USUARIO + "_disclosure_mimes", visible ? "0" : "1"); } catch(e) {}
}

// ─── CUOTAS ACTIVAS ───────────────────────────────────────────

async function cargarCuotasActivas() {
  const { data, error } = await supabaseClient
    .from("compras_cuotas")
    .select("*")
    .eq("usuario", USUARIO)
    .eq("estado", "activa")
    .order("created_at");
  comprasEnCuotas = error ? [] : (data || []);
}

function _renderCuotasCard() {
  const card = document.getElementById("cuotas-card");
  if (!card) return;
  if (!comprasEnCuotas.length) { card.style.display = "none"; return; }

  const hoy = new Date();
  const mesActualStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const MESES_CORTOS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

  // Floor timeline: próximos 6 meses comenzando desde el mes actual
  const floorMeses = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    floorMeses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const floorByMes = Object.fromEntries(floorMeses.map(m => [m, 0]));

  let estesMes = 0, futuro = 0;
  const toComplete = [];

  const rows = comprasEnCuotas.map(c => {
    const cuotasTrans = allTransac.filter(t => t.compra_id === c.id);
    const pagadas        = cuotasTrans.filter(t => (t.mes_liquidacion || "") < mesActualStr).length;
    const pagadasDisplay = cuotasTrans.filter(t => (t.mes_liquidacion || "") <= mesActualStr).length;
    const factor  = c.responsabilidad === "Compartido" ? 0.5 : 1;

    if (pagadas >= c.cuotas_total) {
      toComplete.push(c.id);
      return null;
    }

    cuotasTrans.forEach(t => {
      const m = t.mes_liquidacion;
      if (!m) return;
      const monto = Number(t.monto) * factor;
      if (m === mesActualStr) estesMes += monto;
      else if (m > mesActualStr) futuro += monto;
      if (Object.prototype.hasOwnProperty.call(floorByMes, m)) floorByMes[m] += monto;
    });

    const ultima = cuotasTrans.find(t => Number(t.cuota_nro) === c.cuotas_total);
    let cierreStr = "";
    if (ultima?.mes_liquidacion) {
      const [cy, cm] = ultima.mes_liquidacion.split("-").map(Number);
      cierreStr = `${MESES_CORTOS[cm - 1]} ${String(cy).slice(2)}`;
    }

    const pct = Math.round((pagadasDisplay / c.cuotas_total) * 100);
    const esComp = c.responsabilidad === "Compartido";

    return `<div class="cuota-row" data-compra-id="${c.id}">
      <div class="cuota-row-header">
        <span class="cuota-desc">${escapeHtml(c.descripcion)}</span>
        ${esComp ? '<span class="cuota-badge-comp">compartido</span>' : ""}
        <button class="cuota-row-del-btn" onclick="_eliminarCompraCompleta('${c.id}')" title="Eliminar compra">✕</button>
      </div>
      <div class="cuota-progress-wrap">
        <div class="cuota-progress-bar">
          <div class="cuota-progress-fill" style="transform:scaleX(${(pct/100).toFixed(3)})"></div>
        </div>
        <span class="cuota-progress-label">${pagadasDisplay}/${c.cuotas_total}</span>
        <span class="cuota-progress-meta">${fmt(c.monto_cuota)}/mes${cierreStr ? ` · ${cierreStr}` : ""}</span>
      </div>
    </div>`;
  }).filter(Boolean);

  toComplete.forEach(id => {
    supabaseClient.from("compras_cuotas")
      .update({ estado: "completada" })
      .eq("id", id)
      .then(() => {});
    comprasEnCuotas = comprasEnCuotas.filter(c => c.id !== id);
  });

  if (!rows.length) { card.style.display = "none"; return; }

  card.style.display = "";
  const countLabel = `${rows.length} compra${rows.length !== 1 ? "s" : ""}`;
  document.getElementById("cuotas-count").textContent = countLabel;
  document.getElementById("cuotas-este-mes").textContent = fmt(estesMes);
  document.getElementById("cuotas-futuro").textContent   = fmt(futuro);
  const _scMes   = document.getElementById("mm-sc-cuotas-mes");
  const _scFut   = document.getElementById("mm-sc-cuotas-fut");
  const _scCount = document.getElementById("mm-sc-cuotas-count");
  if (_scMes)   _scMes.textContent   = fmt(estesMes);
  if (_scFut)   _scFut.textContent   = fmt(futuro);
  if (_scCount) _scCount.textContent = countLabel;
  _cuotasMesRows = rows.join("");
  document.getElementById("cuotas-rows").innerHTML = _cuotasMesRows;

  // Render floor timeline
  const floorEl = document.getElementById("cuotas-floor");
  if (floorEl) {
    const maxFloor = Math.max(...Object.values(floorByMes), 1);
    floorEl.innerHTML = floorMeses.map(m => {
      const mo = parseInt(m.split("-")[1]);
      const monto = floorByMes[m];
      const barH = monto > 0 ? Math.max(0.08, monto / maxFloor) : 0;
      const isCurrent = m === mesActualStr;
      return `<div class="cuotas-floor-col${isCurrent ? " current" : ""}">
        <span class="cuotas-floor-amount">${monto > 0 ? fmtShort(monto) : "—"}</span>
        <div class="cuotas-floor-bar-wrap">
          <div class="cuotas-floor-bar-fill" style="transform:scaleY(${barH.toFixed(3)})"></div>
        </div>
        <span class="cuotas-floor-label">${MESES_CORTOS[mo - 1]}</span>
      </div>`;
    }).join("");
  }

  if (window.lucide) lucide.createIcons();
}

function toggleCuotasCard() {
  const bodyWrap = document.getElementById("cuotas-body-wrap");
  const icon     = document.getElementById("cuotas-toggle-icon");
  if (!bodyWrap || !icon) return;
  const visible = bodyWrap.style.display !== "none";
  bodyWrap.style.display = visible ? "none" : "";
  icon.classList.toggle("open", !visible);
  // Update aria-expanded on the header div
  const header = document.querySelector(".cuotas-header");
  if (header) header.setAttribute("aria-expanded", String(!visible));
  try { localStorage.setItem(USUARIO + "_disclosure_cuotas", visible ? "0" : "1"); } catch(e) {}
}

function _inicializarDisclosureCuotas() {
  const saved = (() => {
    try { return localStorage.getItem(USUARIO + "_disclosure_cuotas"); } catch(e) { return null; }
  })();
  const bodyWrap = document.getElementById("cuotas-body-wrap");
  const icon     = document.getElementById("cuotas-toggle-icon");
  const header   = document.querySelector(".cuotas-header");
  if (!bodyWrap || !icon) return;
  if (saved === "0") {
    bodyWrap.style.display = "none";
    icon.classList.remove("open");
    if (header) header.setAttribute("aria-expanded", "false");
  } else {
    bodyWrap.style.display = "";
    icon.classList.add("open");
    if (header) header.setAttribute("aria-expanded", "true");
  }
}

// ─── MODAL GESTIÓN DE CUOTAS ──────────────────────────────────

let _cuotaModalCompraId = null;
let _cuotaModalIndex = 0;

function _abrirModalCuotas(compraId) {
  if (!comprasEnCuotas.length) return;
  if (compraId) {
    _cuotaModalIndex = comprasEnCuotas.findIndex(c => c.id === compraId);
    if (_cuotaModalIndex < 0) _cuotaModalIndex = 0;
  } else {
    _cuotaModalIndex = 0;
  }
  _cuotaModalCompraId = comprasEnCuotas[_cuotaModalIndex].id;
  _renderModalCuotas(_cuotaModalCompraId);
  document.getElementById("cuotas-modal-overlay").classList.add("open");
}

function _navModalCuotas(dir) {
  _cuotaModalIndex = (_cuotaModalIndex + dir + comprasEnCuotas.length) % comprasEnCuotas.length;
  _cuotaModalCompraId = comprasEnCuotas[_cuotaModalIndex].id;
  _renderModalCuotas(_cuotaModalCompraId);
}

function _cerrarModalCuotas() {
  document.getElementById("cuotas-modal-overlay").classList.remove("open");
  _cuotaModalCompraId = null;
}

function _renderModalCuotas(compraId) {
  const c = comprasEnCuotas.find(x => x.id === compraId);
  if (!c) return;

  const hoy = new Date();
  const mesActualStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const MESES_CORTOS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

  const cuotasTrans = allTransac
    .filter(t => t.compra_id === compraId)
    .sort((a, b) => (Number(a.cuota_nro) || 0) - (Number(b.cuota_nro) || 0));

  const pagadas  = cuotasTrans.filter(t => (t.mes_liquidacion || "") <= mesActualStr).length;
  const restante = cuotasTrans
    .filter(t => (t.mes_liquidacion || "") > mesActualStr)
    .reduce((s, t) => s + Number(t.monto), 0);
  const pct = c.cuotas_total > 0 ? Math.round((pagadas / c.cuotas_total) * 100) : 0;

  const navEl = document.getElementById("cuotas-modal-nav");
  if (navEl) {
    if (comprasEnCuotas.length > 1) {
      navEl.style.display = "flex";
      document.getElementById("cuotas-modal-nav-label").textContent =
        `${_cuotaModalIndex + 1} / ${comprasEnCuotas.length}`;
    } else {
      navEl.style.display = "none";
    }
  }

  document.getElementById("cuotas-modal-title").textContent = c.descripcion;
  document.getElementById("cuotas-modal-meta").textContent =
    `${c.fuente} · ${c.responsabilidad} · ${c.moneda}`;
  document.getElementById("cuotas-modal-progress-label").textContent =
    `${pagadas} de ${c.cuotas_total} pagadas`;
  document.getElementById("cuotas-modal-restante").textContent =
    restante > 0 ? `${fmt(restante)} restantes` : "Completada";
  document.getElementById("cuotas-modal-progress-fill").style.transform = `scaleX(${(pct / 100).toFixed(3)})`;

  const listHTML = cuotasTrans.map(t => {
    const [ly, lm] = (t.mes_liquidacion || "").split("-").map(Number);
    const mesStr = (lm && ly) ? `${MESES_CORTOS[lm - 1]} ${ly}` : (t.mes_liquidacion || "—");
    const pagada = (t.mes_liquidacion || "") <= mesActualStr;
    return `<div class="cuota-list-row">
      <span class="cuota-list-mes">${mesStr}</span>
      <span>${fmtMoneda(Number(t.monto), t.moneda || "ARS")}</span>
      <span class="cuota-list-estado ${pagada ? "pagada" : "pendiente"}">${pagada ? "✅" : "⏳"}</span>
    </div>`;
  }).join("");

  document.getElementById("cuotas-modal-list").innerHTML = listHTML;
  document.getElementById("cuotas-modal-msg").textContent = "";

  const hasFuture = cuotasTrans.some(t => (t.mes_liquidacion || "") > mesActualStr);
  const btnCancelar = document.getElementById("cuotas-modal-btn-cancelar");
  if (btnCancelar) btnCancelar.style.display = hasFuture ? "" : "none";
}

async function _cancelarCuotasAnticipadamente() {
  const id = _cuotaModalCompraId;
  if (!id) return;

  const hoy = new Date();
  const mesActualStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const cuotasFuturas = allTransac.filter(t =>
    t.compra_id === id && (t.mes_liquidacion || "") > mesActualStr
  );

  if (!cuotasFuturas.length) {
    document.getElementById("cuotas-modal-msg").textContent = "No hay cuotas futuras para cancelar.";
    return;
  }

  const ok = confirm(`Se eliminarán ${cuotasFuturas.length} cuotas pendientes. ¿Continuar?`);
  if (!ok) return;

  const btnCancelar = document.getElementById("cuotas-modal-btn-cancelar");
  if (btnCancelar) { btnCancelar.disabled = true; btnCancelar.textContent = "Cancelando..."; }

  try {
    const { error: errDel } = await supabaseClient
      .from("transacciones")
      .delete()
      .eq("compra_id", id)
      .gt("mes_liquidacion", mesActualStr);
    if (errDel) throw errDel;

    const { error: errUpd } = await supabaseClient
      .from("compras_cuotas")
      .update({ estado: "cancelada" })
      .eq("id", id);
    if (errUpd) throw errUpd;

    await Promise.all([cargarTodasTransacciones(), cargarCuotasActivas()]);
    _renderApp();
    _cerrarModalCuotas();
    showToast("Cuotas restantes canceladas", "ok");

  } catch(e) {
    document.getElementById("cuotas-modal-msg").textContent = `Error: ${e.message}`;
    if (btnCancelar) { btnCancelar.disabled = false; btnCancelar.textContent = "Cancelar anticipadamente"; }
  }
}

async function _eliminarCompraCompleta(compraId) {
  const id = compraId || _cuotaModalCompraId;
  const c  = comprasEnCuotas.find(x => x.id === id);
  if (!id || !c) return;

  const hoy = new Date();
  const mesActualStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const cuotasTrans  = allTransac.filter(t => t.compra_id === id);
  const pasadas      = cuotasTrans.filter(t => (t.mes_liquidacion || "") < mesActualStr).length;
  const futuras      = cuotasTrans.filter(t => (t.mes_liquidacion || "") > mesActualStr).length;
  const estesMesN    = cuotasTrans.filter(t => (t.mes_liquidacion || "") === mesActualStr).length;

  let aviso = `Eliminar "${c.descripcion}" borrará ${cuotasTrans.length} transacciones en total`;
  if (pasadas)   aviso += `\n• ${pasadas} cuota${pasadas !== 1 ? "s" : ""} ya liquidada${pasadas !== 1 ? "s" : ""} (afecta historial)`;
  if (estesMesN) aviso += `\n• ${estesMesN} cuota del mes actual`;
  if (futuras)   aviso += `\n• ${futuras} cuota${futuras !== 1 ? "s" : ""} futura${futuras !== 1 ? "s" : ""}`;
  aviso += "\n\n¿Confirmar eliminación completa?";

  if (!confirm(aviso)) return;

  const btn = document.getElementById("cuotas-modal-btn-eliminar");
  if (btn) { btn.disabled = true; btn.textContent = "Eliminando..."; }

  try {
    const { error: errDel } = await supabaseClient
      .from("transacciones").delete().eq("compra_id", id);
    if (errDel) throw errDel;

    const { error: errComp } = await supabaseClient
      .from("compras_cuotas").delete().eq("id", id);
    if (errComp) throw errComp;

    await Promise.all([cargarTodasTransacciones(), cargarCuotasActivas()]);
    _renderApp();
    _cerrarModalCuotas();
    showToast(`"${c.descripcion}" eliminada`, "ok");

  } catch(e) {
    document.getElementById("cuotas-modal-msg").textContent = `Error: ${e.message}`;
    if (btn) { btn.disabled = false; btn.textContent = "Eliminar"; }
  }
}

function _abrirEditarCompra() {
  const id = _cuotaModalCompraId;
  const c  = comprasEnCuotas.find(x => x.id === id);
  if (!c) return;
  const desc = prompt("Nueva descripción:", c.descripcion);
  if (desc === null) return;
  if (!desc.trim()) { alert("La descripción no puede estar vacía."); return; }
  _guardarEdicionCompra(id, desc.trim());
}

async function _guardarEdicionCompra(compraId, nuevaDesc) {
  const msg = document.getElementById("cuotas-modal-msg");
  try {
    const { error: errComp } = await supabaseClient
      .from("compras_cuotas")
      .update({ descripcion: nuevaDesc })
      .eq("id", compraId);
    if (errComp) throw errComp;

    const cuotasTrans = allTransac.filter(t => t.compra_id === compraId);
    const updates = cuotasTrans.map(t => {
      const nroStr = String(Number(t.cuota_nro) || 1).padStart(2, "0");
      const totStr = String(Number(t.cuota_total) || 1).padStart(2, "0");
      return supabaseClient
        .from("transacciones")
        .update({ descripcion: `${nuevaDesc} ${nroStr}/${totStr}` })
        .eq("id", t.id);
    });
    const results = await Promise.all(updates);
    const firstErr = results.find(r => r.error)?.error;
    if (firstErr) throw firstErr;

    await Promise.all([cargarTodasTransacciones(), cargarCuotasActivas()]);
    _renderApp();
    _renderModalCuotas(compraId);
    if (msg) msg.textContent = "✅ Guardado";

  } catch(e) {
    if (msg) msg.textContent = `Error: ${e.message}`;
  }
}

function inicializarDisclosureMimes() {
  const el  = document.getElementById("pres-desglose");
  const btn = document.getElementById("btn-toggle-desglose");
  if (!el || !btn) return;
  // Default: Daniel expandido, Ama colapsado. Override si hay valor guardado.
  const saved = localStorage.getItem(USUARIO + "_disclosure_mimes");
  const defaultExpanded = USUARIO.toLowerCase() !== "ama";
  const expanded = saved !== null ? saved === "1" : defaultExpanded;
  el.style.display  = expanded ? "" : "none";
  btn.textContent   = expanded ? "Ocultar desglose ▴" : "Ver desglose ▾";
}

function toggleDetalleCompartidos() {
  const el  = document.getElementById("comp-detalle");
  const btn = document.getElementById("btn-toggle-compartidos");
  if (!el || !btn) return;
  const visible = el.style.display !== "none";
  el.style.display = visible ? "none" : "";
  btn.textContent  = visible ? "Ver detalle ▾" : "Ocultar detalle ▴";
  try { localStorage.setItem(USUARIO + "_disclosure_compartidos", visible ? "0" : "1"); } catch(e) {}
}

function toggleInvSection(seccion) {
  const body = document.getElementById("inv-body-" + seccion);
  const arrow = document.getElementById("inv-toggle-" + seccion);
  if (!body) return;
  const visible = body.style.display !== "none";
  body.style.display = visible ? "none" : "";
  if (arrow) arrow.textContent = visible ? "▾" : "▴";
  try { localStorage.setItem(USUARIO + "_inv_" + seccion, visible ? "0" : "1"); } catch {}
  const hdr = document.getElementById("inv-hdr-" + seccion);
  if (hdr) hdr.setAttribute("aria-expanded", body.style.display !== "none" ? "true" : "false");
}

function inicializarDisclosureInversiones() {
  ["plazos", "acciones"].forEach(sec => {
    const body  = document.getElementById("inv-body-" + sec);
    const arrow = document.getElementById("inv-toggle-" + sec);
    if (!body) return;
    const saved = localStorage.getItem(USUARIO + "_inv_" + sec);
    const expanded = saved !== null ? saved === "1" : true;
    body.style.display = expanded ? "" : "none";
    if (arrow) arrow.textContent = expanded ? "▴" : "▾";
    const hdr = document.getElementById("inv-hdr-" + sec);
    if (hdr) hdr.setAttribute("aria-expanded", body.style.display !== "none" ? "true" : "false");
  });
}

function inicializarDisclosureCompartidos() {
  const el = document.getElementById("comp-detalle");
  if (el) el.style.display = "";
}

// ─── MODAL DETALLE CUOTAS MES ─────────────────────────────────

function verDetalleCuotasMes() {
  const overlay = document.getElementById("cuotas-mes-overlay");
  const body    = document.getElementById("cuotas-mes-body");
  if (!overlay || !body) return;
  body.innerHTML = _cuotasMesRows ||
    '<p style="padding:1rem;color:var(--text-muted);font-size:.88rem">Sin cuotas activas este mes.</p>';
  overlay.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function cerrarCuotasMesModal() {
  const overlay = document.getElementById("cuotas-mes-overlay");
  if (overlay) overlay.style.display = "none";
  document.body.style.overflow = "";
}

