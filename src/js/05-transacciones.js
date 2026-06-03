// ─── MULTI-SELECT CATEGORÍAS ─────────────────────────────────
function toggleMultiSelect() {
  const panel = _el("fil-cat-panel");
  const btn   = _el("fil-cat-btn");
  const isOpen = panel.style.display !== "none";
  panel.style.display = isOpen ? "none" : "block";
  btn.classList.toggle("active", !isOpen);
  btn.setAttribute("aria-expanded", String(!isOpen));
}
function _cerrarMultiSelect() {
  const panel = _el("fil-cat-panel");
  const btn   = _el("fil-cat-btn");
  if (panel && panel.style.display !== "none") {
    panel.style.display = "none";
    btn.classList.remove("active");
    btn.setAttribute("aria-expanded", "false");
  }
}
function toggleTodasCats(checkbox) {
  document.querySelectorAll("#fil-cat-options input").forEach(i => i.checked = checkbox.checked);
  actualizarLabelCat();
  filtrarTabla();
}
function onCatChange() {
  const all = [...document.querySelectorAll("#fil-cat-options input")];
  const checked = all.filter(i => i.checked);
  const allBox = document.getElementById("fil-cat-all");
  allBox.checked = checked.length === all.length;
  allBox.indeterminate = checked.length > 0 && checked.length < all.length;
  actualizarLabelCat();
  filtrarTabla();
}
function actualizarLabelCat() {
  const all = [...document.querySelectorAll("#fil-cat-options input")];
  const checked = all.filter(i => i.checked);
  const label = document.getElementById("fil-cat-label");
  const btn   = document.getElementById("fil-cat-btn");
  if (checked.length === all.length || checked.length === 0) {
    label.textContent = "Todas las categorías";
    btn.classList.remove("active");
  } else if (checked.length === 1) {
    label.textContent = checked[0].value;
    btn.classList.add("active");
  } else {
    label.textContent = `${checked.length} categorías`;
    btn.classList.add("active");
  }
}
function inicializarCatOptions() {
  const el = document.getElementById("fil-cat-options");
  if (el.children.length > 0) return; // ya inicializado
  const cats = [...new Set(allTransac.filter(t => (t.usuario||"Daniel") === USUARIO).map(t => t.categoria))].sort();
  el.innerHTML = cats.map((c, i) => {
    const id = `fil-cat-opt-${i}`;
    return `<label class="multi-select-option" for="${id}"><input type="checkbox" id="${id}" value="${escapeHtml(c)}" checked onchange="onCatChange()"> ${escapeHtml(c)}</label>`;
  }).join("");
}
// Cerrar al click fuera o Escape
document.addEventListener("keydown", e => {
  if (e.key === "Escape") _cerrarMultiSelect();
});
document.addEventListener("click", e => {
  const wrap = e.target.closest(".multi-select-wrap");
  if (!wrap) _cerrarMultiSelect();
});

// ─── TABLA TRANSACCIONES ─────────────────────────────────────
function _resetFiltros() {
  const tipo   = document.getElementById("fil-tipo");
  const fuente = document.getElementById("fil-fuente");
  const resp   = document.getElementById("fil-resp");
  const buscar = document.getElementById("fil-buscar");
  if (tipo)   tipo.value   = "";
  if (fuente) fuente.value = "";
  if (resp)   resp.value   = "";
  if (buscar) buscar.value = "";
  // Reset multi-select categories to "Todas"
  const allBox = document.getElementById("fil-cat-all");
  if (allBox) { allBox.checked = true; toggleTodasCats(allBox); }
}

function filtrarTabla() {
  const gen = ++_filtroGen;
  inicializarCatOptions();

  const mes    = _el("fil-mes").value;
  const anio   = _el("fil-anio").value;
  const tipo   = _el("fil-tipo").value;
  const fuente = _el("fil-fuente")?.value || "";
  const resp   = _el("fil-resp")?.value || "";
  const buscar = _el("fil-buscar").value.toLowerCase();
  const catsSelec = new Set(
    [...document.querySelectorAll("#fil-cat-options input:checked")].map(i => i.value)
  );
  const todasCats = catsSelec.size === 0 ||
    catsSelec.size === document.querySelectorAll("#fil-cat-options input").length;

  let datos = allTransac.filter(t => {
    if (_pendingDelete && t.id === _pendingDelete.id) return false;
    // Hide future installments (mes_liquidacion > current month)
    if (t.compra_id && t.mes_liquidacion) {
      const hoy = new Date();
      const mesActualStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
      if (t.mes_liquidacion > mesActualStr) return false;
    }
    const { year: tYear, month: tMonth } = getMesLiquidacion(t);
    const okUsuario = (t.usuario || "Daniel") === USUARIO;
    const okMes    = !mes    || tMonth === parseInt(mes);
    const okAnio   = !anio   || tYear  === parseInt(anio);
    const okTipo   = !tipo   || t.tipo === tipo;
    const okCat    = todasCats || catsSelec.has(t.categoria);
    const okFuente = !fuente || (t.fuente || "") === fuente;
    const okResp   = !resp   || (t.responsabilidad || "Mío") === resp;
    const okBus    = !buscar || (t.descripcion||"").toLowerCase().includes(buscar)
                             || t.categoria.toLowerCase().includes(buscar)
                             || (t.fuente||"").toLowerCase().includes(buscar);
    const okFecha  = !_filFechaExacta || t.fecha === _filFechaExacta;
    return okUsuario && okMes && okAnio && okTipo && okCat && okFuente && okResp && okBus && okFecha;
  });

  datos = _sortarDatos(datos);
  _actualizarSortUI();
  _guardarFiltros();

  // ── Subtotales ──
  const subIngARS = datos.filter(t=>t.tipo==="Ingreso"&&(t.moneda||"ARS")==="ARS").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
  const subGasARS = datos.filter(t=>t.tipo==="Gasto"  &&(t.moneda||"ARS")==="ARS").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
  const subIngUSD = datos.filter(t=>t.tipo==="Ingreso"&&(t.moneda||"ARS")==="USD").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
  const subGasUSD = datos.filter(t=>t.tipo==="Gasto"  &&(t.moneda||"ARS")==="USD").reduce((s,t)=>s+Math.abs(Number(t.monto)),0);
  const netoARS = subIngARS - subGasARS;
  const netoUSD = subIngUSD - subGasUSD;
  const hayUSDsub = subIngUSD > 0 || subGasUSD > 0;
  document.getElementById("sub-count").textContent = `${datos.length} transacción${datos.length!==1?"es":""}`;
  document.getElementById("sub-ingresos").textContent = fmt(subIngARS) + (subIngUSD>0?` + ${fmtMoneda(subIngUSD,"USD")}`:"");
  document.getElementById("sub-gastos").textContent   = fmt(subGasARS) + (subGasUSD>0?` + ${fmtMoneda(subGasUSD,"USD")}`:"");
  const netoEl = document.getElementById("sub-neto");
  const netoSigno = netoARS >= 0 ? "+" : "−";
  netoEl.textContent = netoSigno + " " + fmt(Math.abs(netoARS)) + (hayUSDsub?` / ${fmtMoneda(Math.abs(netoUSD),"USD")}`:"");
  netoEl.className = netoARS >= 0 ? "sub-neto-pos" : "sub-neto-neg";

  const tbody = _el("tabla-body");
  if (!datos.length) {
    requestAnimationFrame(() => {
      if (gen !== _filtroGen) return;
      tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state">Nada con ese filtro — probá ampliando la búsqueda</div></td></tr>';
    });
    return;
  }

  const respEmoji = {};
  const respColor = { "Mío": "var(--accent)", "Compartido": "var(--yellow)", ["De " + PARTNER]: "var(--accent)" };

  const html = datos.map((t, i) => {
    const r = t.responsabilidad || "Mío";
    const mon = t.moneda || "ARS";
    const monBadge = mon === "USD"
      ? `<span class="badge-moneda usd">USD</span>`
      : `<span class="badge-moneda ars">ARS</span>`;
    // Sub-etiqueta de liquidación: mostrar si TC con mes distinto, o badge pendiente si TC sin mes
    let fechaExtra = "";
    if (_esFuenteTC(t.fuente || "")) {
      if (t.mes_liquidacion && /^\d{4}-(0[1-9]|1[0-2])$/.test(t.mes_liquidacion)) {
        const fechaD  = new Date(t.fecha + "T12:00:00");
        const fechaYM = `${fechaD.getFullYear()}-${String(fechaD.getMonth()+1).padStart(2,"0")}`;
        if (t.mes_liquidacion !== fechaYM) {
          const [ly, lm] = t.mes_liquidacion.split("-").map(Number);
          const mesAbrev = new Date(ly, lm-1, 1).toLocaleDateString("es-AR", { month: "short" });
          fechaExtra = `<div class="fecha-liq-label">Liq. ${mesAbrev} ${ly}</div>`;
        }
      } else if (!t.mes_liquidacion) {
        fechaExtra = `<div class="fecha-liq-pendiente">Liq. pendiente</div>`;
      }
    }
    return `
    <tr style="--row-i:${Math.min(i, 16)}">
      <td style="color:var(--text-muted);font-size:.83rem;white-space:nowrap">${fmtFecha(t.fecha)}${fechaExtra}</td>
      <td class="col-hide-xs"><span class="badge badge-${t.tipo.toLowerCase()}">${t.tipo}</span></td>
      <td><span style="display:inline-flex;align-items:center;gap:.35rem"><span style="width:7px;height:7px;border-radius:50%;background:${_catColor(t.categoria)};flex-shrink:0;opacity:.85"></span>${escapeHtml(t.categoria)}</span></td>
      <td class="col-hide-sm" style="color:var(--text-muted);font-size:.83rem">${escapeHtml(t.fuente) || "—"}</td>
      <td class="col-hide-sm"><span style="color:${respColor[r]||'var(--text-muted)'};font-size:.85rem">${respEmoji[r]||""} ${escapeHtml(r)}</span></td>
      <td class="col-hide-sm" style="color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.descripcion) || "—"}${t.cuota_nro && t.cuota_total
          ? ` <span class="badge-cuota" role="button" tabindex="0"
                    data-compra-id="${t.compra_id}"
                    onclick="_abrirModalCuotas(this.dataset.compraId)"
                    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();_abrirModalCuotas(this.dataset.compraId)}"
                    title="Ver cuotas">[${t.cuota_nro}/${t.cuota_total}]</span>`
          : ""}</td>
      <td style="text-align:right;font-weight:600;white-space:nowrap;color:${t.tipo==="Ingreso"?"var(--green)":"var(--red)"}">${fmtMoneda(t.monto, mon)}</td>
      <td class="col-hide-xs">${monBadge}</td>
      <td style="white-space:nowrap">
        <button class="delete-btn" onclick="duplicarTransaccion('${t.id}')" title="Duplicar" aria-label="Duplicar transacción" style="margin-right:.2rem">${IC_COPY}</button>
        <button class="delete-btn" onclick="abrirEditorTransaccion('${t.id}')" title="Editar" aria-label="Editar transacción" style="margin-right:.2rem">${IC_EDIT}</button>
        <button class="delete-btn" onclick="eliminarTransaccion('${t.id}')" title="Eliminar" aria-label="Eliminar transacción">${IC_TRASH}</button>
      </td>
    </tr>`
  }).join("");
  requestAnimationFrame(() => {
    if (gen !== _filtroGen) return;
    tbody.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  });
}

// ─── EXPORTAR CSV ────────────────────────────────────────────
function exportarCSV() {
  const mes    = document.getElementById("fil-mes").value;
  const anio   = document.getElementById("fil-anio").value;
  const tipo   = document.getElementById("fil-tipo").value;
  const fuente = document.getElementById("fil-fuente")?.value || "";
  const resp   = document.getElementById("fil-resp")?.value || "";
  const buscar = document.getElementById("fil-buscar").value.toLowerCase();
  const catsSelec = new Set(
    [...document.querySelectorAll("#fil-cat-options input:checked")].map(i => i.value)
  );
  const todasCats = catsSelec.size === 0 ||
    catsSelec.size === document.querySelectorAll("#fil-cat-options input").length;

  const datos = allTransac.filter(t => {
    const { year: tYear, month: tMonth } = getMesLiquidacion(t);
    return (t.usuario || "Daniel") === USUARIO
      && (!mes    || tMonth === parseInt(mes))
      && (!anio   || tYear  === parseInt(anio))
      && (!tipo   || t.tipo === tipo)
      && (todasCats || catsSelec.has(t.categoria))
      && (!fuente || (t.fuente || "") === fuente)
      && (!resp   || (t.responsabilidad || "Mío") === resp)
      && (!buscar || (t.descripcion||"").toLowerCase().includes(buscar)
                  || t.categoria.toLowerCase().includes(buscar)
                  || (t.fuente||"").toLowerCase().includes(buscar));
  }).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

  if (!datos.length) { showToast("Sin datos para exportar", "err"); return; }

  const cols = ["Fecha","Tipo","Categoría","Monto","Moneda","Fuente","Responsabilidad","Descripción"];
  const esc  = v => `"${String(v ?? "").replace(/"/g,'""')}"`;
  const rows = datos.map(t => [
    t.fecha, t.tipo, t.categoria, t.monto, t.moneda || "ARS",
    t.fuente || "", t.responsabilidad || "Mío", t.descripcion || ""
  ].map(esc).join(","));

  const csv  = [cols.map(esc).join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  const tag  = (mes ? mes + "-" : "") + (anio || new Date().getFullYear());
  a.href = url; a.download = `finanzas-${USUARIO.toLowerCase()}-${tag}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast(`✅ ${datos.length} transacciones exportadas`, "ok");
}

// ─── ELIMINAR CON UNDO ────────────────────────────────────────
function eliminarTransaccion(id) {
  // Si hay una eliminación pendiente anterior, ejecutarla ya
  if (_pendingDelete) {
    clearTimeout(_pendingDelete.timeout);
    _ejecutarDelete(_pendingDelete.id);
  }
  _pendingDelete = { id, timeout: setTimeout(() => _ejecutarDelete(id), 5000) };
  filtrarTabla(); // oculta la fila inmediatamente (filtro por _pendingDelete.id)
  _showToastUndo("🗑️ Transacción eliminada", () => _cancelarDelete(id));
}

function _cancelarDelete(id) {
  if (_pendingDelete && _pendingDelete.id === id) {
    clearTimeout(_pendingDelete.timeout);
    _pendingDelete = null;
  }
  filtrarTabla();
  showToast("↩️ Eliminación cancelada", "ok");
}

async function _ejecutarDelete(id) {
  if (_pendingDelete && _pendingDelete.id === id) _pendingDelete = null;
  allTransac = allTransac.filter(t => t.id !== id);
  guardarCacheTransac();
  filtrarTabla();
  cargarResumenMes();
  cargarEvolucion();
  try {
    const { error } = await supabaseClient.from('transacciones').delete().eq('id', id);
    if (error) throw error;
  } catch(e) {
    showToast("❌ Error de conexión al eliminar", "err");
  }
}

function _showToastUndo(msg, onUndo) {
  const t = document.getElementById("toast");
  t.innerHTML = `<span style="flex:1">${msg}</span><button class="toast-undo-btn">↩ Deshacer</button><div class="toast-undo-bar"></div>`;
  t.className = "toast toast-err show";
  const tid = setTimeout(() => { t.className = "toast"; }, 5400);
  t.querySelector(".toast-undo-btn").onclick = () => {
    clearTimeout(tid);
    t.className = "toast";
    onUndo();
  };
}

// ─── DUPLICAR TRANSACCIÓN ─────────────────────────────────────
function duplicarTransaccion(id) {
  const t = allTransac.find(x => x.id === id);
  if (!t) return;
  navegarA("nueva");
  setTimeout(() => {
    setTipo(t.tipo);
    setMoneda(t.moneda || "ARS");
    document.getElementById("f-fecha").valueAsDate = new Date();
    document.getElementById("f-monto").value       = t.monto;
    document.getElementById("f-descripcion").value = t.descripcion || "";
    const selCat  = document.getElementById("f-categoria");
    const selFte  = document.getElementById("f-fuente");
    if (selCat)  selCat.value  = t.categoria;
    if (selFte)  selFte.value  = t.fuente || "";
    seleccionarResp(t.responsabilidad || "Mío");
    document.getElementById("f-monto").focus();
  }, 30);
  showToast("📋 Duplicado — revisá los datos antes de guardar", "ok");
}

// ─── EDITAR TRANSACCIÓN ───────────────────────────────────────
let editandoId   = null;
let editandoOrig = null; // copia original por si hay que hacer rollback

function abrirEditorTransaccion(id) {
  const t = allTransac.find(x => x.id === id);
  if (!t) return;
  editandoId   = id;
  editandoOrig = { ...t };

  document.getElementById("edit-fecha").value           = t.fecha;
  document.getElementById("edit-tipo").value            = t.tipo;
  document.getElementById("edit-moneda").value          = t.moneda || "ARS";
  document.getElementById("edit-monto").value           = Math.abs(Number(t.monto));
  document.getElementById("edit-responsabilidad").value = t.responsabilidad || "Mío";
  document.getElementById("edit-descripcion").value     = t.descripcion || "";

  const cats = t.tipo === "Gasto" ? categGasto : categIngreso;
  const selCat = document.getElementById("edit-categoria");
  selCat.innerHTML = cats.map(c => `<option value="${c}" ${c === t.categoria ? "selected" : ""}>${c}</option>`).join("");

  const selFuente = document.getElementById("edit-fuente");
  const todasFuentesEdit = [...categFuentes, ...categFuentesTC];
  selFuente.innerHTML = `<option value="">— Sin especificar —</option>` +
    todasFuentesEdit.map(f => `<option value="${f}" ${f === (t.fuente || "") ? "selected" : ""}>${f}</option>`).join("");
  selFuente.onchange = function() { _actualizarEditMesLiqField(this.value); };

  _actualizarEditMesLiqField(t.fuente || "");
  const editMesLiq = document.getElementById("edit-mes-liq");
  if (editMesLiq) editMesLiq.value = t.mes_liquidacion || "";

  document.getElementById("edit-tipo").onchange = function() {
    const cs = this.value === "Gasto" ? categGasto : categIngreso;
    selCat.innerHTML = cs.map(c => `<option value="${c}">${c}</option>`).join("");
  };

  const editMesLiqErr = document.getElementById("edit-mes-liq-err");
  if (editMesLiqErr) editMesLiqErr.textContent = "";
  document.getElementById("edit-msg").textContent = "";
  document.getElementById("edit-guardar-btn").disabled = false;
  document.getElementById("edit-guardar-btn").textContent = "Guardar cambios";
  document.getElementById("edit-overlay").classList.add("open");
  document.getElementById("edit-fecha").focus();
}

function cerrarEditorTransaccion() {
  document.getElementById("edit-overlay").classList.remove("open");
  editandoId   = null;
  editandoOrig = null;
}

async function guardarEdicionTransaccion() {
  const fecha  = document.getElementById("edit-fecha").value;
  const tipo   = document.getElementById("edit-tipo").value;
  const moneda = document.getElementById("edit-moneda").value;
  const monto  = parsearDecimal(document.getElementById("edit-monto").value);
  const cat    = document.getElementById("edit-categoria").value;
  const resp   = document.getElementById("edit-responsabilidad").value;
  const fuente = document.getElementById("edit-fuente").value;
  const desc   = document.getElementById("edit-descripcion").value;
  const mesLiq = _esFuenteTC(fuente) ? (document.getElementById("edit-mes-liq")?.value || "") : "";
  const msg    = document.getElementById("edit-msg");

  if (!fecha || isNaN(monto) || monto <= 0 || !cat) {
    msg.innerHTML = '<span style="color:var(--red)">Completá fecha, monto y categoría.</span>';
    return;
  }
  if (_esFuenteTC(fuente) && !mesLiq) {
    const err = document.getElementById("edit-mes-liq-err");
    if (err) err.textContent = "Seleccioná el mes de liquidación.";
    return;
  }

  const btn = document.getElementById("edit-guardar-btn");
  btn.disabled = true;
  btn.textContent = "⏳ Guardando...";
  msg.textContent = "";

  try {
    const { error } = await supabaseClient
      .from('transacciones')
      .update({ fecha, tipo, categoria: cat, monto, descripcion: desc, responsabilidad: resp, fuente, moneda,
                mes_liquidacion: mesLiq || null,
                categoria_id: _getCategoriaId(cat, tipo),
                cuenta_id:    _getCuentaId(fuente) })
      .eq('id', editandoId);
    if (error) {
      if (error.code === '42703' || error.message?.includes('mes_liquidacion')) {
        msg.innerHTML = '<span style="color:var(--red)">❌ Columna mes_liquidacion no encontrada. Ejecutá el SQL en Supabase primero.</span>';
        btn.disabled = false; btn.textContent = "Guardar cambios"; return;
      }
      throw error;
    }
    allTransac = allTransac.map(t =>
      t.id === editandoId
        ? { ...t, fecha, tipo, categoria: cat, monto, descripcion: desc, responsabilidad: resp, fuente, moneda,
            mes_liquidacion: mesLiq || null }
        : t
    );
    guardarCacheTransac();
    cerrarEditorTransaccion();
    filtrarTabla();
    cargarResumenMes();
    cargarEvolucion();
    showToast("✅ Guardado", "ok");
  } catch(e) {
    msg.innerHTML = '<span style="color:var(--red)">❌ Error de conexión al guardar</span>';
    btn.disabled = false;
    btn.textContent = "Guardar cambios";
  }
}

// ─── FORMULARIO NUEVA TRANSACCIÓN ─────────────────────────────
let tipoActual   = "Gasto";
let monedaActual = "ARS";

function setMoneda(m) {
  monedaActual = m;
  document.getElementById("btn-ars").className = "moneda-btn " + (m === "ARS" ? "active-ars" : "");
  document.getElementById("btn-usd").className = "moneda-btn " + (m === "USD" ? "active-usd" : "");
  document.getElementById("f-monto-label").textContent = m === "ARS" ? "Monto (ARS $)" : "Monto (USD U$S)";
}

function setTipo(tipo) {
  tipoActual = tipo;
  const btnG = document.getElementById("btn-gasto");
  const btnI = document.getElementById("btn-ingreso");
  btnG.className = "tipo-btn " + (tipo === "Gasto"    ? "active-expense" : "");
  btnI.className = "tipo-btn " + (tipo === "Ingreso"  ? "active-income"  : "");

  // Actualizar categorías
  const cats = tipo === "Gasto" ? categGasto : categIngreso;
  const sel  = document.getElementById("f-categoria");
  sel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join("");
}

async function guardarTransaccion() {
  if (_modoCuotas) { await guardarCompraEnCuotas(); return; }
  const fecha   = document.getElementById("f-fecha").value;
  const monto   = parsearDecimal(document.getElementById("f-monto").value);
  const cat     = document.getElementById("f-categoria").value;
  const desc    = document.getElementById("f-descripcion").value;
  const resp    = document.getElementById("f-responsabilidad")?.value || "Mío";
  const fuente  = document.getElementById("f-fuente")?.value || "";
  const mesLiq  = _esFuenteTC(fuente) ? (document.getElementById("f-mes-liq")?.value || "") : "";
  const msg   = document.getElementById("form-msg");

  if (!fecha || isNaN(monto) || monto <= 0 || !cat) {
    msg.innerHTML = '<span style="color:var(--red)">Completá fecha, monto y categoría.</span>';
    return;
  }
  if (_esFuenteTC(fuente) && !mesLiq) {
    const err = document.getElementById("f-mes-liq-err");
    if (err) err.textContent = "Seleccioná el mes de liquidación.";
    return;
  }

  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;
  btn.textContent = "⏳ Guardando...";
  msg.innerHTML = "";

  try {
    const { data, error } = await supabaseClient
      .from('transacciones')
      .insert({ id: crypto.randomUUID(), fecha, tipo: tipoActual, categoria: cat, monto, descripcion: desc,
                usuario: USUARIO, responsabilidad: resp, fuente, moneda: monedaActual,
                mes_liquidacion: mesLiq || null,
                categoria_id: _getCategoriaId(cat, tipoActual),
                cuenta_id:    _getCuentaId(fuente),
                user_id: supabaseSession.user.id })
      .select().single();
    if (error) {
      if (error.code === '42703' || error.message?.includes('mes_liquidacion')) {
        msg.innerHTML = '<span style="color:var(--red)">❌ Columna mes_liquidacion no encontrada. Ejecutá el SQL en Supabase primero.</span>';
        btn.disabled = false; btn.textContent = "Guardar"; return;
      }
      throw error;
    }
    allTransac.push({ ...data, monto: parseFloat(data.monto) });
    cargarResumenMes();
    cargarEvolucion();
    filtrarTabla();
    // Limpiar formulario completo
    document.getElementById("f-monto").value = "";
    document.getElementById("f-descripcion").value = "";
    document.getElementById("f-fecha").valueAsDate = new Date();
    const selCat  = document.getElementById("f-categoria");
    const selFte  = document.getElementById("f-fuente");
    if (selCat)  selCat.selectedIndex  = 0;
    if (selFte)  { selFte.selectedIndex = 0; _actualizarMesLiqField(""); }
    resetRespField();
    setTipo("Gasto");
    setMoneda("ARS");
    showToast("✅ Guardado", "ok");
    if (navigator.vibrate) navigator.vibrate(50);
    msg.innerHTML = '<span style="color:var(--green)">✅ Guardado correctamente.</span>';
    setTimeout(() => { msg.innerHTML = ""; }, 3000);
  } catch(e) {
    msg.innerHTML = `<span style="color:var(--red)">❌ ${escapeHtml(e.message || String(e))}</span>`;
  }

  btn.disabled = false;
  btn.textContent = "Guardar";
}

async function guardarCompraEnCuotas() {
  const btn = document.getElementById("btn-guardar");
  const msg = document.getElementById("form-msg");
  btn.disabled = true;
  if (msg) { msg.textContent = ""; msg.style.display = "none"; }

  const fecha           = document.getElementById("f-fecha")?.value || "";
  const categoria       = document.getElementById("f-categoria")?.value || "";
  const fuente          = document.getElementById("f-fuente")?.value || "";
  const responsabilidad = document.querySelector("#f-responsabilidad")?.value || "Mío";
  const moneda          = document.querySelector(".moneda-btn.active")?.dataset.val || "ARS";
  const descripcion     = document.getElementById("f-descripcion")?.value.trim() || "";
  const montoTotal      = parsearDecimal(document.getElementById("f-monto")?.value);
  const cuotasTotal     = parseInt(document.getElementById("f-cuotas-n")?.value) || 0;
  const montoCuota      = parsearDecimal(document.getElementById("f-monto-cuota")?.value);
  const primerMesLiq    = document.getElementById("f-primer-mes-liq")?.value || "";
  const cftPct          = document.getElementById("f-cft-check")?.checked
    ? parsearDecimal(document.getElementById("f-cft-pct")?.value) || null
    : null;

  // Validation
  const errs = [];
  if (!fecha)                                          errs.push("fecha");
  if (!categoria)                                      errs.push("categoría");
  if (!fuente)                                         errs.push("fuente");
  if (!descripcion)                                    errs.push("descripción");
  if (montoTotal <= 0)                                 errs.push("monto total");
  if (cuotasTotal < 2 || cuotasTotal > 60)             errs.push("cuotas (2–60)");
  if (montoCuota <= 0)                                 errs.push("monto por cuota");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(primerMesLiq)) errs.push("mes de primera cuota");

  if (errs.length) {
    if (msg) { msg.textContent = `Completá: ${errs.join(", ")}`; msg.style.display = "block"; }
    btn.disabled = false;
    _actualizarBtnGuardar();
    return;
  }

  btn.textContent = "Guardando...";

  try {
    // 1. Insert compra metadata
    const compraId = crypto.randomUUID();
    const { error: errCompra } = await supabaseClient.from("compras_cuotas").insert({
      id: compraId,
      usuario: USUARIO,
      descripcion,
      categoria,
      responsabilidad,
      fuente,
      moneda,
      monto_total: montoTotal,
      cuotas_total: cuotasTotal,
      monto_cuota: montoCuota,
      primer_mes_liq: primerMesLiq,
      cft_anual_pct: cftPct,
      user_id: supabaseSession.user.id
    });
    if (errCompra) throw errCompra;

    // 2. Generate N transaction rows (all upfront)
    const [anio0, mes0] = primerMesLiq.split("-").map(Number);
    const rows = Array.from({ length: cuotasTotal }, (_, i) => {
      const d = new Date(anio0, mes0 - 1 + i, 1);
      const mesLiq = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const nroStr = String(i + 1).padStart(2, "0");
      const totStr = String(cuotasTotal).padStart(2, "0");
      return {
        id: crypto.randomUUID(),
        fecha,
        tipo: "Gasto",
        categoria,
        monto: montoCuota,
        descripcion: `${descripcion} ${nroStr}/${totStr}`,
        usuario: USUARIO,
        responsabilidad,
        fuente,
        moneda,
        mes_liquidacion: mesLiq,
        compra_id: compraId,
        cuota_nro: i + 1,
        cuota_total: cuotasTotal,
        categoria_id: _getCategoriaId(categoria, "Gasto"),
        cuenta_id:    _getCuentaId(fuente),
        user_id: supabaseSession.user.id
      };
    });

    const { error: errTrans } = await supabaseClient.from("transacciones").insert(rows);
    if (errTrans) {
      // Rollback: delete compra so we don't have orphaned metadata
      await supabaseClient.from("compras_cuotas").delete().eq("id", compraId);
      throw errTrans;
    }

    // 3. Refresh local state
    await cargarTodasTransacciones();
    _renderApp();

    // 4. Toast with first settlement month name
    const [sigAnio, sigMes] = primerMesLiq.split("-").map(Number);
    const mesNombre = new Date(sigAnio, sigMes - 1, 1)
      .toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    showToast(`${cuotasTotal} cuotas registradas — próxima: ${mesNombre}`, "ok");

    // 5. Reset form to single-payment mode
    _montoCuotaEditado = false;
    _setModoCuotas("unico");
    document.getElementById("f-monto").value        = "";
    document.getElementById("f-descripcion").value  = "";
    document.getElementById("f-monto-cuota").value  = "";
    const calcEl = document.getElementById("f-monto-cuota-calc");
    if (calcEl) calcEl.innerHTML = "";
    const cftCheck = document.getElementById("f-cft-check");
    if (cftCheck) cftCheck.checked = false;
    const cftRow = document.getElementById("f-cft-row");
    if (cftRow) cftRow.style.display = "none";
    const cftPctInp = document.getElementById("f-cft-pct");
    if (cftPctInp) cftPctInp.value = "";
    const primerMesInp = document.getElementById("f-primer-mes-liq");
    if (primerMesInp) primerMesInp.value = "";
    if (msg) msg.style.display = "none";

  } catch(e) {
    if (msg) { msg.textContent = `Error: ${e.message}`; msg.style.display = "block"; }
  } finally {
    btn.disabled = false;
    _actualizarBtnGuardar();
  }
}

// ─── MODO RÁFAGA ──────────────────────────────────────────────
function abrirRafaga() {
  document.getElementById("rafaga-overlay").classList.add("open");
  document.getElementById("rafaga-msg").innerHTML = "";
  const tbody = document.getElementById("rafaga-tbody");
  if (tbody.children.length === 0) {
    agregarFilaRafaga();
    agregarFilaRafaga();
    agregarFilaRafaga();
  }
}

function cerrarRafaga() {
  document.getElementById("rafaga-overlay").classList.remove("open");
  const btn = document.getElementById("rafaga-guardar-btn");
  if (btn) btn.disabled = false;
}

function _optsCategRafaga(tipo) {
  const cats = tipo === "Ingreso" ? categIngreso : categGasto;
  return cats.map(c => `<option value="${c}">${c}</option>`).join("");
}

function _optsFuenteRafaga() {
  return '<option value="">— Sin especificar —</option>' +
    [...categFuentes, ...categFuentesTC].map(f => `<option value="${f}">${f}</option>`).join("");
}

function _rafagaActualizarMesLiq(sel) {
  const inp = sel.parentElement.querySelector(".rf-mes-liq");
  if (!inp) return;
  if (_esFuenteTC(sel.value)) {
    inp.style.display = "";
  } else {
    inp.style.display = "none";
    inp.value = "";
  }
}

function _optsRespRafaga() {
  return categResponsabilidad.map(r => `<option value="${r}">${r}</option>`).join("");
}

function agregarFilaRafaga() {
  const tbody = document.getElementById("rafaga-tbody");
  const idx   = tbody.children.length + 1;
  const hoy   = new Date().toISOString().slice(0, 10);
  const tr    = document.createElement("tr");
  tr.innerHTML = `
    <td style="color:var(--text-muted);text-align:center;font-size:.73rem;padding:.3rem .2rem">${idx}</td>
    <td><input type="date" class="rf-fecha" value="${hoy}" aria-label="Fecha fila ${idx}"></td>
    <td>
      <select class="rf-tipo" aria-label="Tipo fila ${idx}" onchange="this.closest('tr').querySelector('.rf-cat').innerHTML=_optsCategRafaga(this.value)">
        <option value="Gasto">Gasto</option>
        <option value="Ingreso">Ingreso</option>
      </select>
    </td>
    <td><select class="rf-cat" aria-label="Categoría fila ${idx}">${_optsCategRafaga("Gasto")}</select></td>
    <td><input type="text" inputmode="decimal" class="rf-monto" placeholder="0,00" aria-label="Monto fila ${idx}" oninput="formatearMiles(this)"></td>
    <td>
      <select class="rf-moneda" aria-label="Moneda fila ${idx}">
        <option value="ARS">🇦🇷 ARS</option>
        <option value="USD">🇺🇸 USD</option>
      </select>
    </td>
    <td><input type="text" class="rf-desc rafaga-desc" placeholder="Descripción opcional" aria-label="Descripción fila ${idx}"></td>
    <td><select class="rf-resp" aria-label="Responsabilidad fila ${idx}">${_optsRespRafaga()}</select></td>
    <td>
      <select class="rf-fuente" aria-label="Fuente fila ${idx}" onchange="_rafagaActualizarMesLiq(this)">${_optsFuenteRafaga()}</select>
      <input type="month" class="rf-mes-liq" style="display:none;margin-top:.3rem;width:100%" aria-label="Mes de liquidación fila ${idx}">
    </td>
    <td class="td-del"><button class="rafaga-del-btn" onclick="eliminarFilaRafaga(this)" title="Eliminar fila">✕</button></td>
  `;
  tbody.appendChild(tr);
  actualizarContadorRafaga();
}

function eliminarFilaRafaga(btn) {
  const tbody = document.getElementById("rafaga-tbody");
  if (tbody.children.length <= 1) return;
  btn.closest("tr").remove();
  Array.from(tbody.children).forEach((tr, i) => { tr.cells[0].textContent = i + 1; });
  actualizarContadorRafaga();
}

function actualizarContadorRafaga() {
  const n = document.getElementById("rafaga-tbody").children.length;
  document.getElementById("rafaga-count").textContent = `${n} fila${n !== 1 ? "s" : ""}`;
  document.getElementById("rafaga-guardar-btn").textContent = `Guardar todo (${n})`;
}

async function guardarRafaga() {
  const tbody = document.getElementById("rafaga-tbody");
  const msg   = document.getElementById("rafaga-msg");
  msg.innerHTML = "";

  const validas = [];
  let errores = 0;

  Array.from(tbody.children).forEach(tr => {
    const fecha  = tr.querySelector(".rf-fecha").value;
    const tipo   = tr.querySelector(".rf-tipo").value;
    const cat    = tr.querySelector(".rf-cat").value;
    const monto  = parsearDecimal(tr.querySelector(".rf-monto").value);
    const moneda = tr.querySelector(".rf-moneda").value;
    const desc   = tr.querySelector(".rf-desc").value.trim();
    const resp   = tr.querySelector(".rf-resp").value;
    const fuente = tr.querySelector(".rf-fuente").value;
    const mesLiqInp = tr.querySelector(".rf-mes-liq");
    const mesLiq = _esFuenteTC(fuente) ? (mesLiqInp?.value || "") : "";

    tr.classList.remove("rafaga-row-err");
    const err = [];
    if (!fecha) err.push("fecha");
    if (!cat)   err.push("categoría");
    if (isNaN(monto) || monto <= 0) err.push("monto");
    if (_esFuenteTC(fuente) && !mesLiq) err.push("mes liquidación");

    if (err.length) {
      errores++;
      tr.classList.add("rafaga-row-err");
    } else {
      validas.push({ fecha, tipo, categoria: cat, monto, descripcion: desc,
                     usuario: USUARIO, responsabilidad: resp, fuente, moneda,
                     mes_liquidacion: mesLiq || null });
    }
  });

  if (errores > 0) {
    msg.innerHTML = `<span style="color:var(--red)">⚠ ${errores} fila(s) con errores (marcadas). Completá fecha, categoría y monto.</span>`;
    return;
  }
  if (!validas.length) {
    msg.innerHTML = `<span style="color:var(--red)">No hay filas para guardar.</span>`;
    return;
  }

  const btn = document.getElementById("rafaga-guardar-btn");
  btn.disabled = true;
  btn.textContent = "⏳ Guardando...";

  try {
    const rows = validas.map(v => ({
      id: crypto.randomUUID(), ...v,
      categoria_id: _getCategoriaId(v.categoria, v.tipo),
      cuenta_id:    _getCuentaId(v.fuente),
      user_id: supabaseSession.user.id
    }));
    const { error } = await supabaseClient.from('transacciones').insert(rows);
    if (error) throw error;
    showToast(`✅ ${validas.length} transacciones guardadas`, "ok");
    cerrarRafaga();
    document.getElementById("rafaga-tbody").innerHTML = "";
    await cargarTodasTransacciones();
    _renderApp();
  } catch(e) {
    msg.innerHTML = `<span style="color:var(--red)">❌ Error de conexión: ${escapeHtml(e.message)}</span>`;
    btn.disabled = false;
    btn.textContent = `Guardar todo (${validas.length})`;
  }
}

