const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const outputPath = process.argv[2] || path.join(root, "screenshots", "_screen_ops.json");
const appPath = path.join(root, "APPS", "PIPCALC.JS");
const source = fs.readFileSync(appPath, "utf8");

let ops = [];
const handlers = {};

function cloneOps() {
  return JSON.parse(JSON.stringify(ops));
}

function record(type, data) {
  ops.push(Object.assign({ type }, data));
}

const h = {
  color: 3,
  font: "Monofonto23",
  alignX: -1,
  alignY: -1,
  reset() {
    this.color = 3;
    this.font = "Monofonto23";
    this.alignX = -1;
    this.alignY = -1;
    return this;
  },
  clear() {
    ops = [{ type: "clear" }];
    return this;
  },
  setColor(color) {
    this.color = color;
    return this;
  },
  setFont(font) {
    this.font = font;
    return this;
  },
  setFontAlign(x, y) {
    this.alignX = x;
    this.alignY = y;
    return this;
  },
  drawString(text, x, y) {
    record("text", {
      text: String(text),
      x,
      y,
      color: this.color,
      alignX: this.alignX,
      alignY: this.alignY,
      font: this.font,
    });
    return this;
  },
  fillRect(x0, y0, x1, y1) {
    record("fillRect", { x0, y0, x1, y1, color: this.color });
    return this;
  },
  drawRect(x0, y0, x1, y1) {
    record("drawRect", { x0, y0, x1, y1, color: this.color });
    return this;
  },
  drawLine(x0, y0, x1, y1) {
    record("drawLine", { x0, y0, x1, y1, color: this.color });
    return this;
  },
  toColor(r, g, b) {
    return [r, g, b];
  },
};

const Pip = {
  on(name, handler) {
    handlers[name] = handler;
  },
  removeListener(name) {
    delete handlers[name];
  },
  audioBuiltin() {},
  setPalette() {},
};

const context = {
  console,
  h,
  Pip,
  Math,
  Uint16Array,
  isNaN,
  isFinite,
};

const factory = vm.runInNewContext(source, context, { filename: appPath });
if (typeof factory !== "function") {
  throw new Error("PIPCALC.JS did not evaluate to an app factory function.");
}
factory();

const GRID = [
  ["2nd", "MODE", "DRG", "AC", "DEL", ">f"],
  ["sin", "cos", "tan", "asin", "acos", "atan"],
  ["sinh", "cosh", "tanh", "ln", "log", "exp"],
  ["sqrt", "cbrt", "abs", "pi", "e", "x"],
  ["7", "8", "9", "(", ")", "^"],
  ["4", "5", "6", "!", "/", "*"],
  ["1", "2", "3", "+", "-", "EE"],
  ["0", ".", "=", "Ans", "MR", "M+"],
];

let calcRow = 0;
let calcCol = 0;

function wrap(v, n) {
  return ((v % n) + n) % n;
}

function knob1(dir) {
  handlers.knob1(dir);
}

function knob2(dir) {
  handlers.knob2(dir);
}

function findKey(label) {
  for (let r = 0; r < GRID.length; r++) {
    for (let c = 0; c < GRID[r].length; c++) {
      if (GRID[r][c] === label) return { r, c };
    }
  }
  throw new Error(`No calculator key named ${label}`);
}

function pressCalc(label) {
  const pos = findKey(label);
  const dr = pos.r - calcRow;
  const dc = pos.c - calcCol;
  if (dr) {
    knob1(dr);
    calcRow = wrap(calcRow + dr, GRID.length);
  }
  if (dc) {
    knob2(dc);
    calcCol = wrap(calcCol + dc, GRID[0].length);
  }
  knob1(0);
}

const screens = [];
function capture(name, title, description) {
  screens.push({
    name,
    title,
    description,
    width: 480,
    height: 320,
    ops: cloneOps(),
  });
}

// Build one real tape entry and leave the calculator on its evaluated state.
["2", "+", "3", "*", "4", "="].forEach(pressCalc);
capture("01-calc-result", "CALC", "Framed RobCo keypad with a completed expression.");

pressCalc("MODE");
knob1(1);
capture("02-graph", "GRAPH", "Pip-OS trace grid plotting the shared f(x).");
knob1(-1);

knob2(1);
knob1(1);
capture("03-calculus", "CALCULUS", "Dim terminal controls for slope, area, root, and extrema.");
knob1(-1);

knob2(1);
knob1(1);
capture("04-circuit", "CIRC", "Workbench readouts inside the Pip-Boy status frame.");
knob1(-1);

knob2(1);
knob1(1);
capture("05-converter", "CONV", "Unit conversion panel with readout staging.");
knob1(-1);

knob2(1);
knob1(1);
capture("06-constants", "CONST", "Indexed constants in the RobCo data-bank style.");
knob1(-1);

knob2(1);
knob1(1);
knob2(6);
knob1(1);
knob2(1);
capture("07-rules", "REF", "Formula cards with 3D projection views.");
knob1(-2);

knob2(1);
knob1(1);
capture("08-vacuum", "VAC", "Nitrogen vacuum telemetry with Pip-OS readouts.");
knob1(-1);

knob2(1);
knob1(2);
capture("09-tape", "TAPE", "Calculation tape in the terminal log frame.");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  JSON.stringify(
    {
      generatedFrom: path.relative(root, appPath).replace(/\\/g, "/"),
      generatedAt: new Date().toISOString(),
      screens,
    },
    null,
    2,
  ),
);

console.log(`Captured ${screens.length} preview screens to ${outputPath}`);
