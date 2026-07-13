#!/usr/bin/env node
// Harness liviano de tests para la lógica de reparto Mío/Compartido/De X — la parte
// más sutil del proyecto (ya generó bugs reales, ver CLAUDE.md sección 14).
//
// No usa ningún framework de test: extrae el JS inline de index.html (mismo patrón que
// el workflow "Validate"), lo corre en un sandbox de Node (vm) con stubs mínimos de
// document/window/navigator/localStorage, y llama directo a las funciones puras del
// archivo real — sin duplicar su lógica en un mock aparte, así el test se rompe si el
// código real cambia de comportamiento.
//
// Uso: node scripts/test-reparto.js

const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const path = require("path");

const INDEX_HTML = path.join(__dirname, "..", "index.html");

function extraerJSInline(html) {
  const re = /<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;
  const blocks = [];
  let m;
  while ((m = re.exec(html)) !== null) blocks.push(m[1]);
  if (!blocks.length) throw new Error("No se encontraron bloques <script> inline en index.html");
  return blocks.join("\n");
}

// Stubs mínimos: el análisis del archivo (ver commit) confirma que los únicos efectos
// secundarios a nivel top-level son 2 window.addEventListener(...) (nunca disparan,
// no despachamos eventos) y un `if ('serviceWorker' in navigator)`. Ninguna de las 8
// funciones bajo test toca el DOM.
function crearSandbox() {
  const localStorageStub = (() => {
    const store = {};
    return {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    };
  })();
  const noop = () => {};
  const elFalso = { style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop } };
  const documentStub = {
    addEventListener: noop,
    getElementById: () => elFalso,
    querySelector: () => elFalso,
    querySelectorAll: () => [],
    createElement: () => ({ ...elFalso, appendChild: noop }),
    documentElement: { dataset: {} },
  };
  const windowStub = { addEventListener: noop, innerWidth: 1024, matchMedia: () => ({ matches: false }) };
  const navigatorStub = { userAgent: "", share: undefined, vibrate: undefined };

  const sandbox = {
    console,
    document: documentStub,
    window: windowStub,
    navigator: navigatorStub,
    localStorage: localStorageStub,
    crypto: { randomUUID: () => "00000000-0000-0000-0000-000000000000" },
    fetch: () => Promise.reject(new Error("fetch no disponible en el harness de tests")),
    Chart: class {}, lucide: { createIcons: noop }, confetti: noop,
    supabase: { createClient: () => ({}) },
  };
  sandbox.globalThis = sandbox;
  return vm.createContext(sandbox);
}

function cargarFunciones(context) {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const src = extraerJSInline(html);
  new vm.Script(src, { filename: "index.html (inline script)" }).runInContext(context);
  const nombres = [
    "parsearDecimal", "getMesLiquidacion", "esTransferencia",
    "obtenerProporcionParaMes", "obtenerFactorCompartidoPropio",
    "_gastoCategoriaResponsable", "calcularProgresoMeta",
    "_calcularReembolsos",
  ];
  const fns = {};
  nombres.forEach((n) => {
    const v = vm.runInContext(n, context);
    if (typeof v !== "function") throw new Error(`"${n}" no está definida como función en index.html — ¿se renombró?`);
    fns[n] = v;
  });
  return fns;
}

// Los globals del proyecto (USUARIO, allTransac, tipoCambioMEP, proporcionesCompartidos...)
// se declaran con `let`/`const` en index.html. En un contexto de vm, esos bindings NO son
// propiedades del objeto sandbox (a diferencia de `var`/funciones) — asignar `context.X = v`
// directamente no los muta. Hay que correr una asignación simple (no un `let` nuevo) en el
// MISMO contexto, que sí resuelve contra el scope léxico ya declarado por el script principal.
function setGlobals(context, valores) {
  const asignaciones = Object.entries(valores)
    .map(([k, v]) => `${k} = ${JSON.stringify(v)};`)
    .join(" ");
  vm.runInContext(asignaciones, context);
}

function run() {
  const context = crearSandbox();
  const fn = cargarFunciones(context);
  let pasados = 0;

  function test(nombre, cuerpo) {
    try {
      cuerpo();
      pasados++;
      console.log(`  ✅ ${nombre}`);
    } catch (e) {
      console.error(`  ❌ ${nombre}\n     ${e.message}`);
      process.exitCode = 1;
    }
  }

  console.log("parsearDecimal");
  test("acepta miles con punto y decimal con coma", () => {
    assert.strictEqual(fn.parsearDecimal("1.234,56"), 1234.56);
  });
  test("acepta coma sin miles", () => {
    assert.strictEqual(fn.parsearDecimal("1234,56"), 1234.56);
  });
  test("string vacío o null da 0", () => {
    assert.strictEqual(fn.parsearDecimal(""), 0);
    assert.strictEqual(fn.parsearDecimal(null), 0);
  });

  // Los objetos que devuelven las funciones bajo test vienen del realm del vm (su propio
  // Object.prototype) — assert.deepStrictEqual los trataría como no-iguales aunque tengan
  // los mismos campos. Comparamos campo a campo en vez de por identidad estructural estricta.
  function assertYearMonth(resultado, year, month) {
    assert.strictEqual(resultado.year, year);
    assert.strictEqual(resultado.month, month);
  }

  console.log("getMesLiquidacion");
  test("sin mes_liquidacion usa el mes de la fecha", () => {
    assertYearMonth(fn.getMesLiquidacion({ fecha: "2026-07-15" }), 2026, 7);
  });
  test("con mes_liquidacion válido, ese gana sobre la fecha (tarjetas de crédito)", () => {
    assertYearMonth(fn.getMesLiquidacion({ fecha: "2026-07-15", mes_liquidacion: "2026-08" }), 2026, 8);
  });
  test("último día del mes no se corre por huso horario", () => {
    assertYearMonth(fn.getMesLiquidacion({ fecha: "2026-01-31" }), 2026, 1);
  });

  console.log("obtenerFactorCompartidoPropio (sin sesión → siempre pctDaniel)");
  setGlobals(context, { proporcionesCompartidos: [], supabaseSession: null, workspaceMembers: [] });
  test("sin filas configuradas, default 50/50", () => {
    assert.strictEqual(fn.obtenerFactorCompartidoPropio(7, 2026), 0.5);
  });
  setGlobals(context, { proporcionesCompartidos: [{ mes: 7, anio: 2026, pct_daniel: 70 }] });
  test("con una fila para el mes exacto, la usa", () => {
    assert.strictEqual(fn.obtenerFactorCompartidoPropio(7, 2026), 0.7);
  });
  setGlobals(context, { proporcionesCompartidos: [{ mes: 5, anio: 2026, pct_daniel: 60 }] });
  test("hereda el último valor configurado hacia adelante en el tiempo", () => {
    assert.strictEqual(fn.obtenerFactorCompartidoPropio(7, 2026), 0.6);
  });
  setGlobals(context, { proporcionesCompartidos: [{ mes: 9, anio: 2026, pct_daniel: 80 }] });
  test("una fila configurada a futuro NO aplica retroactivamente", () => {
    assert.strictEqual(fn.obtenerFactorCompartidoPropio(7, 2026), 0.5);
  });

  console.log("_gastoCategoriaResponsable");
  setGlobals(context, { USUARIO: "Daniel" }); // CATS_TRANSFERENCIA es const (["Internas"]) — no hace falta tocarla
  test("neta Mío + Compartido×factor + De-USUARIO, cada uno contra sus propios ingresos", () => {
    const dataUsuario = [
      { categoria: "Super", tipo: "Gasto",    responsabilidad: "Mío", monto: 1000, moneda: "ARS" },
      { categoria: "Super", tipo: "Ingreso",  responsabilidad: "Mío", monto: 200,  moneda: "ARS" },
    ];
    const dataTodos = [
      ...dataUsuario,
      { categoria: "Super", tipo: "Gasto", responsabilidad: "Compartido",  monto: 500, moneda: "ARS" },
      { categoria: "Super", tipo: "Gasto", responsabilidad: "De Daniel",   monto: 300, moneda: "ARS" },
    ];
    const total = fn._gastoCategoriaResponsable("Super", "ARS", dataUsuario, dataTodos, 0.5);
    assert.strictEqual(total, 800 + 250 + 300);
  });
  test("categoría con un solo bucket (Compartido) no rompe — no depende de que exista Mío", () => {
    const total = fn._gastoCategoriaResponsable(
      "Luz", "ARS", [],
      [{ categoria: "Luz", tipo: "Gasto", responsabilidad: "Compartido", monto: 1000, moneda: "ARS" }],
      0.5
    );
    assert.strictEqual(total, 500);
  });
  test("un neto negativo (más ingreso que gasto) no resta del total, se clampea a 0", () => {
    const dataUsuario = [
      { categoria: "Reintegros", tipo: "Ingreso", responsabilidad: "Mío", monto: 500, moneda: "ARS" },
    ];
    const total = fn._gastoCategoriaResponsable("Reintegros", "ARS", dataUsuario, dataUsuario, 0.5);
    assert.strictEqual(total, 0);
  });

  console.log("calcularProgresoMeta");
  setGlobals(context, { USUARIO: "Daniel", tipoCambioMEP: 1000 });
  test("meta propia solo suma transacciones del usuario dueño, después de fecha_inicio", () => {
    const meta = { fecha_inicio: "2026-01-01", moneda: "ARS", monto_objetivo: 1000, compartida: false };
    setGlobals(context, {
      allTransac: [
        { usuario: "Daniel", categoria: "Ahorro", monto: 300, moneda: "ARS", fecha: "2026-02-01" },
        { usuario: "Daniel", categoria: "Ahorro", monto: 100, moneda: "ARS", fecha: "2025-12-01" }, // antes de fecha_inicio, excluido
        { usuario: "Ama",    categoria: "Ahorro", monto: 500, moneda: "ARS", fecha: "2026-02-01" }, // otro usuario, excluido (no compartida)
      ],
    });
    const { total } = fn.calcularProgresoMeta(meta);
    assert.strictEqual(total, 300);
  });
  test("meta compartida suma el aporte de ambos usuarios", () => {
    const meta = { fecha_inicio: "2026-01-01", moneda: "ARS", monto_objetivo: 1000, compartida: true };
    const { total } = fn.calcularProgresoMeta(meta);
    assert.strictEqual(total, 300 + 500);
  });
  test("convierte a la moneda de la meta usando tipoCambioMEP en vez de sumar 1:1", () => {
    const meta = { fecha_inicio: "2026-01-01", moneda: "USD", monto_objetivo: 10, compartida: false };
    setGlobals(context, {
      allTransac: [{ usuario: "Daniel", categoria: "Ahorro", monto: 5000, moneda: "ARS", fecha: "2026-02-01" }],
    });
    const { total } = fn.calcularProgresoMeta(meta); // 5000 ARS / 1000 MEP = 5 USD
    assert.strictEqual(total, 5);
  });
  test("sin cotización MEP disponible, excluye la transacción en otra moneda en vez de mezclar 1:1", () => {
    setGlobals(context, { tipoCambioMEP: null });
    const meta = { fecha_inicio: "2026-01-01", moneda: "USD", monto_objetivo: 10, compartida: false };
    const { total } = fn.calcularProgresoMeta(meta);
    assert.strictEqual(total, 0);
  });

  console.log("_calcularReembolsos");
  setGlobals(context, { USUARIO: "Daniel" });
  test("bug reportado: un Gasto 'De Ama' se netea con un Ingreso 'De Ama' de la misma categoría", () => {
    // Caso real reportado por Daniel: gasto de $23.333,17 responsabilidad "De Ama" y un
    // ingreso de $27.999,80 también "De Ama" en la misma categoría — antes del fix el
    // ingreso no se restaba nunca, quedaba el gasto entero sin netear.
    const gastos = [
      { categoria: "Salud", tipo: "Gasto", responsabilidad: "De Ama", usuario: "Daniel", monto: 23333.17, moneda: "ARS" },
    ];
    const ingresos = [
      { categoria: "Salud", tipo: "Ingreso", responsabilidad: "De Ama", usuario: "Daniel", monto: 27999.80, moneda: "ARS" },
    ];
    const { reembA_ARS } = fn._calcularReembolsos(gastos, ingresos, "Daniel", "Ama");
    const redondear = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
    assert.strictEqual(redondear(reembA_ARS["Salud"]), redondear(23333.17 - 27999.80));
  });
  test("Sección A (yo pagué por el otro) solo cuenta gastos/ingresos donde usuario === yo", () => {
    const gastos = [
      { categoria: "Salud", tipo: "Gasto", responsabilidad: "De Ama", usuario: "Daniel", monto: 1000, moneda: "ARS" },
      { categoria: "Salud", tipo: "Gasto", responsabilidad: "De Ama", usuario: "Ama",    monto: 500,  moneda: "ARS" }, // no debe contar en A
    ];
    const { reembA_ARS } = fn._calcularReembolsos(gastos, [], "Daniel", "Ama");
    assert.strictEqual(reembA_ARS["Salud"], 1000);
  });
  test("Sección B (el otro pagó por mí) neta gasto e ingreso igual que la Sección A", () => {
    const gastos = [
      { categoria: "Auto", tipo: "Gasto", responsabilidad: "De Daniel", usuario: "Ama", monto: 800, moneda: "ARS" },
    ];
    const ingresos = [
      { categoria: "Auto", tipo: "Ingreso", responsabilidad: "De Daniel", usuario: "Ama", monto: 300, moneda: "ARS" },
    ];
    const { reembB_ARS } = fn._calcularReembolsos(gastos, ingresos, "Daniel", "Ama");
    assert.strictEqual(reembB_ARS["Auto"], 500);
  });
  test("separa ARS y USD en mapas distintos", () => {
    const gastos = [
      { categoria: "Viaje", tipo: "Gasto", responsabilidad: "De Ama", usuario: "Daniel", monto: 100, moneda: "USD" },
    ];
    const { reembA_ARS, reembA_USD } = fn._calcularReembolsos(gastos, [], "Daniel", "Ama");
    assert.strictEqual(reembA_USD["Viaje"], 100);
    assert.strictEqual(reembA_ARS["Viaje"] || 0, 0);
  });

  console.log(`\n${pasados} test(s) pasados.`);
  if (process.exitCode) console.error("\nHay tests fallando — ver arriba.");
}

run();
