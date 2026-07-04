// ─── IMPORTAR DATOS ───────────────────────────────────────────
let importFilas = []; // filas parseadas y validadas

function parsearImport() {
  const raw = document.getElementById("imp-textarea").value.trim();
  if (!raw) { showToast("Pegá datos primero", "error"); return; }

  // Detectar separador: Tab o ;
  const lineas = raw.split(/\r?\n/).filter(l => l.trim());
  const sep = lineas[0].includes("\t") ? "\t" : ";";

  const validas   = [];
  const errores   = [];
  const tbodyRows = [];

  lineas.forEach((linea, idx) => {
    const cols = linea.split(sep).map(c => c.trim());
    const [fechaRaw="", tipo="", categoria="", montoRaw="", descripcion="", resp="", fuente="", monedaRaw="", mesLiqRaw=""] = cols;

    const errList = [];

    // Validar fecha
    let fechaValida = "";
    if (fechaRaw) {
      const isSlash = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(fechaRaw);
      const isDash  = /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw);
      if (isSlash) {
        const [d,m,y] = fechaRaw.split("/");
        const year = y.length === 2 ? `20${y}` : y;
        fechaValida = `${year}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
      } else if (isDash) {
        fechaValida = fechaRaw;
      } else {
        errList.push("Fecha inválida");
      }
    } else {
      errList.push("Falta fecha");
    }

    // Validar tipo
    const tipoNorm = tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase();
    if (!["Gasto","Ingreso"].includes(tipoNorm)) errList.push("Tipo debe ser Gasto/Ingreso");

    // Validar categoría
    if (!categoria) errList.push("Falta categoría");

    // Validar monto
    const monto = parseFloat(montoRaw.replace(",",".").replace(/[^\d.]/g,""));
    if (isNaN(monto) || monto <= 0) errList.push("Monto inválido");

    // Normalizar responsabilidad
    const respNorm = resp || "Mío";
    const respVal  = ["Mío","Compartido","De Ama"].includes(respNorm) ? respNorm : "Mío";

    // Normalizar moneda
    const monedaUp = monedaRaw.toUpperCase().trim();
    const monedaVal = monedaUp === "USD" ? "USD" : "ARS";

    const fechaFinal = fechaValida || fechaRaw;
    const fila = {
      fecha: fechaFinal,
      tipo: tipoNorm,
      categoria,
      monto: isNaN(monto) ? 0 : monto,
      descripcion,
      responsabilidad: respVal,
      fuente,
      moneda: monedaVal,
      mes_liquidacion: _esFuenteTC(fuente)
        ? (/^\d{4}-(0[1-9]|1[0-2])$/.test(mesLiqRaw) ? mesLiqRaw : (fechaFinal ? fechaFinal.substring(0, 7) : null))
        : null,
      usuario: USUARIO,
      errores: errList
    };

    if (errList.length === 0) {
      validas.push(fila);
    } else {
      errores.push(fila);
    }

    // Fila de preview
    const rowClass = errList.length ? "row-error" : "";
    const tipoClass = tipoNorm === "Gasto" ? "tipo-gasto" : "tipo-ingreso";
    const monBadge = monedaVal === "USD"
      ? `<span class="badge-moneda usd">USD</span>`
      : `<span class="badge-moneda ars">ARS</span>`;
    tbodyRows.push(`
      <tr class="${rowClass}">
        <td>${idx + 1}</td>
        <td>${fechaRaw}</td>
        <td class="${tipoClass}">${tipoNorm}</td>
        <td>${categoria}</td>
        <td>${isNaN(monto) ? montoRaw : fmtMoneda(monto, monedaVal)}</td>
        <td>${descripcion || "—"}</td>
        <td>${respVal}</td>
        <td>${fuente || "—"}</td>
        <td>${monBadge}</td>
        <td>${errList.length ? `<span class="err-badge">⚠ ${errList.join(", ")}</span>` : "✅"}</td>
      </tr>`);
  });

  importFilas = validas;

  // Mostrar previsualización
  document.getElementById("imp-preview-tbody").innerHTML = tbodyRows.join("");
  document.getElementById("imp-preview-wrap").style.display = "block";

  const badge = document.getElementById("imp-badge");
  badge.textContent = `${lineas.length} filas (${validas.length} válidas, ${errores.length} con error)`;
  badge.className = "imp-badge-count" + (errores.length ? " has-errors" : "");

  // Stats de totales
  const totalGasto   = validas.filter(f => f.tipo === "Gasto").reduce((s,f) => s + Math.abs(Number(f.monto)), 0);
  const totalIngreso = validas.filter(f => f.tipo === "Ingreso").reduce((s,f) => s + Math.abs(Number(f.monto)), 0);
  document.getElementById("imp-stats").innerHTML =
    `<span>Gastos válidos: <strong>${validas.filter(f=>f.tipo==="Gasto").length}</strong> por <strong style="color:var(--red)">${fmt(totalGasto)}</strong></span>` +
    `<span>Ingresos válidos: <strong>${validas.filter(f=>f.tipo==="Ingreso").length}</strong> por <strong style="color:var(--green)">${fmt(totalIngreso)}</strong></span>`;

  const btn = document.getElementById("imp-confirm-btn");
  btn.disabled = validas.length === 0;
  btn.textContent = `✅ Importar ${validas.length} transacciones`;

  document.getElementById("imp-result-msg").style.display = "none";

  // Scroll a la preview
  document.getElementById("imp-preview-wrap").scrollIntoView({ behavior: "smooth" });
}

async function confirmarImport() {
  if (!importFilas.length) return;
  const btn = document.getElementById("imp-confirm-btn");
  btn.disabled = true;
  btn.textContent = "⏳ Importando...";

  const msgEl = document.getElementById("imp-result-msg");
  try {
    const rows = importFilas.map(({ errores: _, ...f }) => ({
      id: crypto.randomUUID(), ...f,
      categoria_id: _getCategoriaId(f.categoria, f.tipo),
      cuenta_id:    _getCuentaId(f.fuente),
      user_id: supabaseSession.user.id,
      workspace_id: miWorkspaceId()
    }));
    const { error } = await supabaseClient.from('transacciones').insert(rows);
    if (error) throw error;
    msgEl.style.display = "block";
    msgEl.className = "imp-result-msg ok";
    msgEl.textContent = `✅ ${importFilas.length} transacciones importadas`;
    showToast(`✅ ${importFilas.length} transacciones importadas`, "ok");
    await cargarTodasTransacciones();
    importFilas = [];
    btn.textContent = "✅ Importar transacciones";
  } catch (err) {
    msgEl.style.display = "block";
    msgEl.className = "imp-result-msg fail";
    msgEl.textContent = `❌ Error de conexión: ${err.message}`;
    btn.disabled = false;
    btn.textContent = `✅ Importar ${importFilas.length} transacciones`;
  }
}

function limpiarImport() {
  document.getElementById("imp-textarea").value = "";
  document.getElementById("imp-preview-wrap").style.display = "none";
  document.getElementById("imp-result-msg").style.display = "none";
  importFilas = [];
}

function descargarTemplateCSV() {
  const hoy  = new Date();
  const mes  = String(hoy.getMonth() + 1).padStart(2, "0");
  const anio = hoy.getFullYear();
  const fuenteEj = categFuentes[0]   || "Efectivo";
  const fuenteTC = categFuentesTC[0] || "";
  const catEj    = categGasto[0]     || "Alimentación";
  // mes_liquidacion: solo para TC y solo cuando la fecha de compra ≠ mes del resumen
  const lineas = [
    "fecha;tipo;categoria;monto;descripcion;responsabilidad;fuente;moneda;mes_liquidacion",
    `15/${mes}/${anio};Gasto;${catEj};4500;Ejemplo gasto;Mío;${fuenteEj};ARS;`,
    `01/${mes}/${anio};Ingreso;Sueldo;180000;Sueldo ${mes}/${anio};Mío;;ARS;`,
    fuenteTC
      ? `15/01/${anio};Gasto;${catEj};8000;Compra enero en TC;Mío;${fuenteTC};ARS;${anio}-${mes}`
      : `15/01/${anio};Gasto;${catEj};8000;Compra TC (mes_liq distinto);Mío;;ARS;${anio}-${mes}`,
  ];
  const blob = new Blob([lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `template-${anio}-${mes}.csv`; a.click();
  URL.revokeObjectURL(url);
}

