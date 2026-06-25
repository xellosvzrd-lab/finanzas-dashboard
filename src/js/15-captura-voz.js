/* ============================================================
   15-captura-voz.js — Captura de transacciones por voz
   Web Speech API (es-AR). Pre-llena el form de #page-nueva.
   No modifica funciones existentes de transacciones; solo las invoca.
   ============================================================ */

var _vozReconocedor = null;
var _vozEscuchando = false;

// ── Sinónimos hablados → valor canónico de la lista ──────────
var _VOZ_SINONIMOS_CATEG = {
  'super': 'Alimentación', 'supermercado': 'Alimentación', 'mercado': 'Alimentación',
  'verduleria': 'Alimentación', 'verdulería': 'Alimentación', 'carniceria': 'Alimentación',
  'panaderia': 'Alimentación', 'almacen': 'Alimentación',
  'delivery': 'Delivery', 'rappi': 'Delivery', 'pedidos': 'Delivery',
  'uber': 'Transporte', 'taxi': 'Transporte', 'colectivo': 'Transporte',
  'nafta': 'Transporte', 'combustible': 'Transporte', 'estacionamiento': 'Transporte',
  'farmacia': 'Salud', 'medico': 'Salud', 'médico': 'Salud', 'doctor': 'Salud',
  'cafe': 'Salud', 'café': 'Salud', // se puede reubicar según categorías del usuario
  'luz': 'Servicios', 'agua': 'Servicios', 'gas': 'Servicios', 'internet': 'Servicios',
  'alquiler': 'Alquiler', 'expensas': 'Alquiler',
  'sueldo': 'Sueldo', 'salario': 'Sueldo',
  'ropa': 'Indumentaria', 'zapatillas': 'Indumentaria',
};

var _VOZ_SINONIMOS_FUENTE = {
  'debito': 'Débito', 'débito': 'Débito', 'tarjeta de debito': 'Débito',
  'credito': 'Crédito', 'crédito': 'Crédito', 'tarjeta': 'Crédito', 'tarjeta de credito': 'Crédito',
  'efectivo': 'Efectivo', 'efe': 'Efectivo', 'cash': 'Efectivo', 'plata': 'Efectivo',
  'mercado pago': 'Mercado Pago', 'mp': 'Mercado Pago',
  'transferencia': 'Transferencia',
};

// Tabla de números en palabras (español, hasta 999.999)
var _VOZ_UNIDADES = {
  'cero':0,'un':1,'uno':1,'una':1,'dos':2,'tres':3,'cuatro':4,'cinco':5,
  'seis':6,'siete':7,'ocho':8,'nueve':9,'diez':10,'once':11,'doce':12,
  'trece':13,'catorce':14,'quince':15,'dieciseis':16,'diecisiete':17,
  'dieciocho':18,'diecinueve':19,'veinte':20,'veintiuno':21,'veintidos':22,
  'veintitres':23,'veinticuatro':24,'veinticinco':25,'veintiseis':26,
  'veintisiete':27,'veintiocho':28,'veintinueve':29,
  'treinta':30,'cuarenta':40,'cincuenta':50,'sesenta':60,'setenta':70,
  'ochenta':80,'noventa':90,
  'cien':100,'ciento':100,'doscientos':200,'doscientas':200,
  'trescientos':300,'trescientas':300,'cuatrocientos':400,'cuatrocientas':400,
  'quinientos':500,'quinientas':500,'seiscientos':600,'seiscientas':600,
  'setecientos':700,'setecientas':700,'ochocientos':800,'ochocientas':800,
  'novecientos':900,'novecientas':900,
};

// ── Helpers ──────────────────────────────────────────────────

function _vozNorm(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Intenta parsear un número en palabras desde el texto.
// Devuelve {valor, frase} o null.
function _vozMontoEnPalabras(texto) {
  var norm = _vozNorm(texto);
  // Intenta "X mil Y" primero, luego "mil Y", luego valores simples
  var patrones = [
    // "dos mil quinientos"
    /\b((?:dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\s+mil(?:\s+(?:cien(?:to)?|doscientos?|trescientos?|cuatrocientos?|quinientos?|seiscientos?|setecientos?|ochocientos?|novecientos?)?(?:\s+y\s+)?(?:veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)?(?:\s+y\s+)?(?:uno?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve)?))\b/,
    // "mil quinientos"
    /\b(mil(?:\s+(?:cien(?:to)?|doscientos?|trescientas?|cuatrocientos?|quinientos?|seiscientas?|setecientos?|ochocientas?|novecientos?)(?:\s+y\s+)?(?:veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)?(?:\s+y\s+)?(?:uno?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)?)?)\b/,
    // un número de palabra simple
    /\b(cien(?:to)?|doscientas?|trescientas?|cuatrocientas?|quinientas?|seiscientas?|setecientas?|ochocientas?|novecientas?|noventa|ochenta|setenta|sesenta|cincuenta|cuarenta|treinta|veintinueve|veintiocho|veintisiete|veintiseis|veinticinco|veinticuatro|veintitres|veintidos|veintiuno|veinte|diecinueve|dieciocho|diecisiete|dieciseis|quince|catorce|trece|doce|once|diez|nueve|ocho|siete|seis|cinco|cuatro|tres|dos|un[ao]?)\b/,
  ];

  for (var i = 0; i < patrones.length; i++) {
    var m = norm.match(patrones[i]);
    if (!m) continue;
    var frase = m[1].trim();
    var valor = _vozEvalPalabras(frase);
    if (valor > 0) return { valor: valor, frase: frase };
  }
  return null;
}

function _vozEvalPalabras(frase) {
  var partes = frase.replace(/\s+y\s+/g, ' ').split(/\s+/);
  var total = 0, actual = 0;
  for (var i = 0; i < partes.length; i++) {
    var p = partes[i];
    if (p === 'mil') {
      actual = actual || 1;
      total += actual * 1000;
      actual = 0;
    } else if (_VOZ_UNIDADES.hasOwnProperty(p)) {
      var v = _VOZ_UNIDADES[p];
      if (v >= 100) { actual += v; }
      else { actual += v; }
    }
  }
  return total + actual;
}

// Match case/tilde-insensitive contra lista + sinónimos. Devuelve valor canónico.
function _vozMatchLista(str, lista, sinonimos) {
  if (!lista || !lista.length) return null;
  var norm = _vozNorm(str);
  // Primero sinónimos (más específicos)
  if (sinonimos) {
    // ordenar por longitud descendente para que "tarjeta de credito" > "tarjeta"
    var sinoKeys = Object.keys(sinonimos).sort(function(a,b){ return b.length - a.length; });
    for (var i = 0; i < sinoKeys.length; i++) {
      var key = _vozNorm(sinoKeys[i]);
      if (norm.indexOf(key) !== -1) return sinonimos[sinoKeys[i]];
    }
  }
  // Luego match directo contra la lista
  var candidatos = lista.slice().sort(function(a,b){ return b.length - a.length; });
  for (var j = 0; j < candidatos.length; j++) {
    if (norm.indexOf(_vozNorm(candidatos[j])) !== -1) return candidatos[j];
  }
  return null;
}

// Capitaliza el nombre reconocido al canónico (USUARIO/PARTNER)
function _vozNombreCanonico(nombreNorm) {
  if (typeof USUARIO !== 'undefined' && _vozNorm(USUARIO) === nombreNorm) return USUARIO;
  if (typeof PARTNER !== 'undefined' && _vozNorm(PARTNER) === nombreNorm) return PARTNER;
  return nombreNorm.charAt(0).toUpperCase() + nombreNorm.slice(1);
}

// ── Parser principal (función pura, sin DOM) ─────────────────

function _vozParsear(textoOriginal) {
  var texto = _vozNorm(textoOriginal || '').trim();
  var resto = ' ' + texto + ' ';
  var out = { monto: null, tipo: 'Gasto', categoria: null,
              responsabilidad: null, fuente: null, descripcion: '' };

  function quitar(re) { resto = resto.replace(new RegExp('\\b' + re + '\\b', 'gi'), ' '); }

  // 1. MONTO: dígitos directos primero (incluye separadores de miles)
  var mNum = resto.match(/\b(\d{1,3}(?:[.\s]\d{3})*|\d+)(?:[,]\d+)?\b/);
  if (mNum) {
    var raw = mNum[0].replace(/[\s.]/g, '').replace(',', '.');
    out.monto = parseFloat(raw);
    quitar(mNum[0].replace(/[.]/g, '\\.').replace(/[\s]/g, '\\s'));
  } else {
    var pw = _vozMontoEnPalabras(resto);
    if (pw) { out.monto = pw.valor; resto = ' ' + resto.trim().replace(pw.frase, ' ') + ' '; }
  }

  // 2. TIPO
  if (/\b(ingreso|sueldo|cobr[eé]|me pagaron|deposit[eé])\b/.test(texto)) {
    out.tipo = 'Ingreso';
  }

  // 3. CATEGORÍA
  var cats = (out.tipo === 'Ingreso')
    ? (typeof categIngreso !== 'undefined' ? categIngreso : [])
    : (typeof categGasto   !== 'undefined' ? categGasto   : []);
  out.categoria = _vozMatchLista(resto, cats, _VOZ_SINONIMOS_CATEG);
  if (out.categoria) quitar(_vozNorm(out.categoria));

  // 4. RESPONSABILIDAD
  var usuNorm = typeof USUARIO !== 'undefined' ? _vozNorm(USUARIO) : '';
  var parNorm = typeof PARTNER !== 'undefined' ? _vozNorm(PARTNER) : '';
  if (/\b(compartido|juntos)\b/.test(resto)) {
    out.responsabilidad = 'Compartido';
    quitar('compartido'); quitar('juntos');
  } else if (/\bsolo\s+m[ií]o\b/.test(resto)) {
    out.responsabilidad = 'Mío';
    quitar('solo'); quitar('m[ií]o');
  } else if (/\bm[ií]o\b/.test(resto)) {
    out.responsabilidad = 'Mío';
    quitar('m[ií]o');
  } else if (parNorm && new RegExp('\\bde\\s+' + parNorm + '\\b').test(resto)) {
    out.responsabilidad = 'De ' + PARTNER;
    quitar('de\\s+' + parNorm);
  } else if (usuNorm && new RegExp('\\bde\\s+' + usuNorm + '\\b').test(resto)) {
    out.responsabilidad = 'De ' + USUARIO;
    quitar('de\\s+' + usuNorm);
  }

  // 5. FUENTE
  var fuentes = typeof categFuentes !== 'undefined' ? categFuentes : [];
  out.fuente = _vozMatchLista(resto, fuentes, _VOZ_SINONIMOS_FUENTE);
  if (out.fuente) quitar(_vozNorm(out.fuente));

  // 6. DESCRIPCIÓN: lo que queda
  out.descripcion = resto.replace(/\s+/g, ' ').trim();

  return out;
}

// ── Estados UI ───────────────────────────────────────────────

function _vozSetEstado(estado, texto, transcript) {
  var btn   = document.getElementById('btn-voz');
  var panel = document.getElementById('voz-status');
  var icon  = document.getElementById('voz-status-icon');
  var txt   = document.getElementById('voz-status-text');
  var tr    = document.getElementById('voz-transcript');
  if (!btn || !panel) return;

  btn.classList.toggle('listening', estado === 'listening');
  panel.classList.toggle('is-error', estado === 'error');

  if (estado === 'idle') { panel.hidden = true; return; }
  panel.hidden = false;

  var icons = { listening: '🔴', processing: '⏳', ready: '✅', error: '⚠️' };
  if (icon) icon.textContent = icons[estado] || '';
  if (txt)  txt.textContent  = texto || '';
  if (tr)   tr.textContent   = transcript ? ('"' + transcript + '"') : '';
}

// ── Ciclo de reconocimiento ──────────────────────────────────

function _vozSoportado() {
  return typeof window !== 'undefined' &&
         (window.SpeechRecognition || window.webkitSpeechRecognition);
}

function _vozInit() {
  var btn = document.getElementById('btn-voz');
  if (!btn) return;
  if (!_vozSoportado()) { btn.hidden = true; return; }
  btn.hidden = false;
}

function toggleCapturaVoz() {
  if (!_vozSoportado()) return;
  if (_vozEscuchando) { _vozDetener(); return; }
  _vozIniciar();
}

function _vozIniciar() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  _vozReconocedor = new SR();
  _vozReconocedor.lang            = 'es-AR';
  _vozReconocedor.continuous      = false;
  _vozReconocedor.interimResults  = false;
  _vozReconocedor.maxAlternatives = 1;

  _vozReconocedor.onstart = function() {
    _vozEscuchando = true;
    _vozSetEstado('listening', 'Escuchando… decí el gasto', '');
  };

  _vozReconocedor.onerror = function(e) {
    _vozEscuchando = false;
    var msg = 'No se pudo capturar. Probá de nuevo.';
    if (e && (e.error === 'not-allowed' || e.error === 'service-not-allowed')) {
      msg = 'Permiso de micrófono denegado. Habilitalo en el navegador.';
    } else if (e && e.error === 'no-speech') {
      msg = 'No te escuché. Tocá 🎤 y volvé a intentar.';
    } else if (e && e.error === 'network') {
      msg = 'Error de red. Revisá tu conexión.';
    }
    _vozSetEstado('error', msg, '');
  };

  _vozReconocedor.onend = function() { _vozEscuchando = false; };

  _vozReconocedor.onresult = function(e) {
    var transcript = (e.results[0][0].transcript || '').trim();
    _vozSetEstado('processing', 'Procesando…', transcript);
    _vozProcesarTranscript(transcript);
  };

  try { _vozReconocedor.start(); }
  catch(err) { _vozSetEstado('error', 'No se pudo iniciar el micrófono.', ''); }
}

function _vozDetener() {
  if (_vozReconocedor) { try { _vozReconocedor.stop(); } catch(e) {} }
  _vozEscuchando = false;
  _vozSetEstado('idle', '', '');
}

// ── Pre-llenado del formulario ───────────────────────────────

function _vozSetSelect(id, valor) {
  if (!valor) return false;
  var sel = document.getElementById(id);
  if (!sel) return false;
  var objetivo = _vozNorm(valor);
  for (var i = 0; i < sel.options.length; i++) {
    if (_vozNorm(sel.options[i].value) === objetivo ||
        _vozNorm(sel.options[i].text)  === objetivo) {
      sel.selectedIndex = i;
      return true;
    }
  }
  return false;
}

function _vozProcesarTranscript(transcript) {
  var p = _vozParsear(transcript);

  if (p.monto === null || isNaN(p.monto) || p.monto <= 0) {
    _vozSetEstado('error',
      'No detecté un monto. Probá: "quinientos super compartido débito".',
      transcript);
    return;
  }

  // Tipo
  if (typeof setTipo === 'function') setTipo(p.tipo);

  // Monto: usar coma decimal + formatearMiles como haría el usuario
  var inMonto = document.getElementById('f-monto');
  if (inMonto) {
    inMonto.value = String(p.monto).replace('.', ',');
    if (typeof formatearMiles === 'function') formatearMiles(inMonto);
  }

  // Categoría
  _vozSetSelect('f-categoria', p.categoria);

  // Responsabilidad (usar seleccionarResp si existe)
  if (p.responsabilidad) {
    if (typeof seleccionarResp === 'function') {
      seleccionarResp(p.responsabilidad);
    } else {
      _vozSetSelect('f-responsabilidad', p.responsabilidad);
    }
  }

  // Fuente
  _vozSetSelect('f-fuente', p.fuente);

  // Descripción (solo si quedó algo útil)
  var inDesc = document.getElementById('f-descripcion');
  if (inDesc && p.descripcion && p.descripcion.length > 1) {
    inDesc.value = p.descripcion;
  }

  // Resumen
  var partes = ['$' + p.monto];
  if (p.categoria) partes.push(p.categoria);
  if (p.fuente)    partes.push(p.fuente);
  _vozSetEstado('ready', 'Listo: ' + partes.join(' · ') + '. Revisá y guardá.', transcript);
}

// ── Inicialización ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() { _vozInit(); });
