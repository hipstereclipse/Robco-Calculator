const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { inlineSource } = require("./build");

const root = path.resolve(__dirname, "..");
const outputPath = process.argv[2] || path.join(root, "screenshots", "_screen_ops.json");
// Which directory to load apps from. "src" inlines the shared fragments the same
// way build.js does; "APPS" reads the already-inlined+minified build verbatim.
// verify-build.js runs this for both and diffs, proving they render identically.
const baseDir = process.argv[3] || "src";

// Each mode is now its own standalone app loaded independently (no in-app mode
// cycling), so we run each app in a fresh mocked runtime, seed the shared
// CALCST state file it reads, drive a few knob events, and snapshot the ops.
function appSource(name) {
  return baseDir === "src" ? inlineSource(name) : fs.readFileSync(path.join(root, baseDir, name), "utf8");
}

function makeRuntime(storage) {
  let ops = [];
  const handlers = {};
  function record(type, data) { ops.push(Object.assign({ type }, data)); }
  const h = {
    color: 3, font: "Monofonto23", alignX: -1, alignY: -1,
    reset() { this.color = 3; this.font = "Monofonto23"; this.alignX = -1; this.alignY = -1; return this; },
    clear() { ops = [{ type: "clear" }]; return this; },
    setColor(c) { this.color = c; return this; },
    setFont(f) { this.font = f; return this; },
    setFontAlign(x, y) { this.alignX = x; this.alignY = y; return this; },
    drawString(text, x, y) { record("text", { text: String(text), x, y, color: this.color, alignX: this.alignX, alignY: this.alignY, font: this.font }); return this; },
    fillRect(x0, y0, x1, y1) { record("fillRect", { x0, y0, x1, y1, color: this.color }); return this; },
    drawRect(x0, y0, x1, y1) { record("drawRect", { x0, y0, x1, y1, color: this.color }); return this; },
    drawLine(x0, y0, x1, y1) { record("drawLine", { x0, y0, x1, y1, color: this.color }); return this; },
    toColor(r, g, b) { return [r, g, b]; },
  };
  const Pip = {
    on(name, handler) { handlers[name] = handler; },
    removeListener(name) { delete handlers[name]; },
    audioBuiltin() {}, setPalette() {},
  };
  const context = {
    console, h, Pip, Math, Uint16Array, isNaN, isFinite,
    // load() hands off to another app; here we just record the requested file so
    // gotoMode() returns instead of actually swapping apps.
    load(file) { storage.__loaded = file; },
    require(name) {
      if (name === "Storage") {
        return {
          read(p) { return Object.prototype.hasOwnProperty.call(storage, p) ? storage[p] : undefined; },
          write(p, v) { storage[p] = String(v); },
        };
      }
      throw new Error("Cannot require module: " + name);
    },
  };
  return { context, handlers, storage, getOps: () => JSON.parse(JSON.stringify(ops)) };
}

function runApp(name, storage) {
  const rt = makeRuntime(storage);
  const factory = vm.runInNewContext(appSource(name), rt.context, { filename: name });
  if (typeof factory !== "function") throw new Error(name + " did not evaluate to an app factory function.");
  const app = factory();
  if (!app || typeof app.id !== "string") throw new Error(name + " did not return an app object with an id.");
  rt.app = app;
  return rt;
}

const GRID = [
  ["2nd", "THM", "DRG", "AC", "DEL", ">f"],
  ["sin", "cos", "tan", "asin", "acos", "atan"],
  ["sinh", "cosh", "tanh", "ln", "log", "exp"],
  ["sqrt", "cbrt", "abs", "pi", "e", "x"],
  ["7", "8", "9", "(", ")", "^"],
  ["4", "5", "6", "!", "/", "*"],
  ["1", "2", "3", "+", "-", "EE"],
  ["0", ".", "=", "Ans", "MR", "M+"],
];
function wrap(v, n) { return ((v % n) + n) % n; }
function findKey(label) {
  for (let r = 0; r < GRID.length; r++) for (let c = 0; c < GRID[r].length; c++) if (GRID[r][c] === label) return { r, c };
  throw new Error(`No calculator key named ${label}`);
}
// Drives the CALC keypad: move the cursor to a key (knob1=row, knob2=col) and press (knob1=0).
function calcDriver(handlers) {
  let row = 0, col = 0;
  return function press(label) {
    const pos = findKey(label), dr = pos.r - row, dc = pos.c - col;
    if (dr) { handlers.knob1(dr); row = wrap(row + dr, GRID.length); }
    if (dc) { handlers.knob2(dc); col = wrap(col + dc, 6); }
    handlers.knob1(0);
  };
}

const screens = [];
const appIds = [];
function capture(name, title, description, rt) {
  appIds.push(rt.app.id);
  screens.push({ name, title, description, width: 480, height: 320, ops: rt.getOps() });
}

function seedState(extra = {}) {
  return {
    CALCST: JSON.stringify(Object.assign({
      fx: "sin(x)",
      ans: 14,
      mem: 0,
      ang: "RAD",
      th: "GREEN",
      msg: "",
      hist: [{ s: "2+3*4 = 14", v: 14 }, { s: "sqrt(2) = 1.41421356", v: 1.41421356 }],
    }, extra)),
  };
}

// --- CALC: build a real expression in the standalone CALC app ---
const calc = runApp("PIPCALC.JS", {});
const press = calcDriver(calc.handlers);
["2", "+", "3", "*", "4", "="].forEach(press);
capture("01-calc-result", "CALC", "Framed RobCo keypad with a completed expression.", calc);

// --- Standalone applets, all reading shared CALCST state ---
capture("02-graph", "GRAPH", "Shared f(x) trace with zoom and pan controls.", runApp("PGRAPH.JS", seedState()));
capture("03-calculus", "CALCULUS", "Numeric value, slope, area, roots, and extrema.", runApp("PCALCULUS.JS", seedState()));
capture("04-circuit", "CIRCUIT", "Electronics workbench calculators and readouts.", runApp("PCIRC.JS", seedState()));
capture("05-converter", "CONVERT", "Engineering unit conversion with raw, scientific, and engineering formats.", runApp("PCONV.JS", seedState()));
capture("06-constants", "CONSTANTS", "Filtered math, physics, unit, and material constants.", runApp("PCONST.JS", seedState()));
capture("07-rules", "RULES", "Reference formulas and geometry cards.", runApp("PREF.JS", seedState()));
capture("08-vacuum", "VAC", "Nitrogen vacuum telemetry with Pip-OS readouts.", runApp("PVAC.JS", seedState({ ans: 1234.5 })));
capture("09-tape", "TAPE", "Calculation history and theme controls.", runApp("PTAPE.JS", seedState()));

const duplicateIds = appIds.filter((id, index) => appIds.indexOf(id) !== index);
if (duplicateIds.length) {
  throw new Error("App ids must be unique across launcher tiles; duplicated: " + Array.from(new Set(duplicateIds)).join(", "));
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  JSON.stringify(
    {
      generatedFrom: baseDir + "/ (standalone apps)",
      generatedAt: new Date().toISOString(),
      appIds,
      screens,
    },
    null,
    2,
  ),
);

console.log(`Captured ${screens.length} preview screens to ${outputPath}`);
