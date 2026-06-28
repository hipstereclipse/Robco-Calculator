// ============================================================
//  _LIB.JS -- shared fragment inlined by tools/build.js into every
//  app that marks //@inject _LIB.JS. NOT a standalone app: it is a
//  block of declarations spliced inside each app's factory so that,
//  at runtime, only ONE app (and therefore one copy of these helpers)
//  is ever resident. Duplicated bytes cost card space, not RAM.
//
//  Provides: palette/geometry constants, number formatting, the
//  Pip-Boy drawing helpers, theming, the cross-app shared-state file
//  (CALCST), the mode-select menu, and the load()-swap navigation +
//  app bootstrap. Apps that also do math additionally inject _EVAL.JS.
// ============================================================
var W = 480, H = 320;                 // working coordinate space (tune to device)
var FG = 3, MID = 2, DIM = 1, BG = 0; // palette indices: bright / mid / dim / black

// Modes that exist as standalone apps + the file each lives in. The menu
// only offers what is actually installed and converted; expand in Phase 2.
var MODES = ["CALC", "VAC"];
var FILES = { CALC: "PIPCALC.JS", VAC: "PVAC.JS" };

var ST;                               // shared state (see initState); lives in CALCST
var field = 0;                        // selected field on a mode screen (0 = MODE tab)
var curMode = "CALC";                 // which mode THIS app is
var menuOpen = false, menuCur = 0;    // mode-select overlay

// ---------- helpers ----------
function wrap(v, n) { return ((v % n) + n) % n; }
function click() { try { Pip.audioBuiltin("COLUMN"); } catch (e) {} }
function ok()    { try { Pip.audioBuiltin("OK"); } catch (e) {} }
function collect() { try { if (typeof global !== "undefined" && global.gc) global.gc(); } catch (e) {} }

function sci(n, digits) {
  return n.toExponential(digits).replace(/(\.\d*?)0+e/, "$1e").replace(/\.e/, "e").replace(/e\+/, "e");
}
function eng(n, digits) {
  if (typeof n === "string") return n;
  if (isNaN(n)) return "ERR";
  if (!isFinite(n)) return n > 0 ? "INF" : "-INF";
  if (n === 0) return "0e0";
  var exp = Math.floor(Math.log(Math.abs(n)) / Math.LN10), m, s;
  exp = Math.floor(exp / 3) * 3;
  m = n / Math.pow(10, exp);
  s = m.toFixed(digits);
  if (Math.abs(parseFloat(s)) >= 1000) { exp += 3; m /= 1000; s = m.toFixed(digits); }
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") + "e" + exp;
}
function plainNum(s) {
  var ep = s.indexOf("e");
  if (ep < 0) return s;
  var c = s.slice(0, ep), e = parseInt(s.slice(ep + 1), 10), neg = c[0] === "-";
  if (neg) c = c.slice(1);
  var dp = c.indexOf("."), left = dp < 0 ? c.length : dp;
  var digits = c.replace(".", ""), p = left + e;
  while (digits.length > 1 && digits[0] === "0") digits = digits.slice(1);
  if (p <= 0) return (neg ? "-" : "") + "0." + new Array(-p + 1).join("0") + digits;
  if (p >= digits.length) return (neg ? "-" : "") + digits + new Array(p - digits.length + 1).join("0");
  return (neg ? "-" : "") + digits.slice(0, p) + "." + digits.slice(p);
}
function fitLeft(s, n) { s = "" + s; return s.length > n ? "<" + s.slice(s.length - n + 1) : s; }
function fitRight(s, n) { s = "" + s; return s.length > n ? s.slice(0, n - 1) + ">" : s; }
function fmt(n) {
  if (typeof n === "string") return n;
  if (isNaN(n)) return "ERR";
  if (!isFinite(n)) return n > 0 ? "INF" : "-INF";
  if (n === 0) return "0";
  var a = Math.abs(n);
  if (a < 1e-4 || a >= 1e10) return sci(n, 5);
  return "" + (Math.round(n * 1e8) / 1e8);
}
function convFmt(n) {
  if (typeof n === "string") return n;
  if (isNaN(n)) return "ERR";
  if (!isFinite(n)) return n > 0 ? "INF" : "-INF";
  if (n === 0) return "0";
  var a = Math.abs(n), s;
  if (a < 1e-3 || a >= 1e6) return sci(n, 5);
  s = "" + (Math.round(n * 1e8) / 1e8);
  return s.length > 11 ? sci(n, 5) : s;
}
function rawFmt(n) {
  if (typeof n === "string") return n;
  if (isNaN(n)) return "ERR";
  if (!isFinite(n)) return n > 0 ? "INF" : "-INF";
  if (n === 0) return "0.000000000000";
  var a = Math.abs(n), s;
  if (a < 1e-6 || a >= 1e9) s = plainNum(n.toPrecision(16));
  else s = n.toFixed(12);
  return s;
}

// ---------- theming (best-effort; verify palette format on device) ----------
function buildPalette(rr, gg, bb) {
  var out = [];
  for (var p = 0; p < 4; p++) {
    var arr = new Uint16Array(16), dim = p >= 2 ? 0.7 : 1.0;
    for (var i = 0; i < 16; i++) {
      var f = Math.min(1, i / 3) * dim;
      arr[i] = h.toColor(rr * f, gg * f, bb * f);
    }
    out.push(arr);
  }
  return out;
}
function applyTheme() {
  try { Pip.setPalette(ST.th === "AMBER" ? buildPalette(1, 0.6, 0) : buildPalette(0.1, 1, 0.25)); } catch (e) {}
}

// ---------- shared state (survives load() via the CALCST card file) ----------
function loadState() { try { var s = require("Storage").read("CALCST"); if (s) return JSON.parse(s); } catch (e) {} return null; }
function saveState() { try { require("Storage").write("CALCST", JSON.stringify(ST)); } catch (e) {} }
function initState() {
  ST = loadState() || {};
  if (ST.fx == null) ST.fx = "sin(x)";
  if (ST.ans == null) ST.ans = 0;
  if (ST.mem == null) ST.mem = 0;
  if (ST.ang == null) ST.ang = "RAD";
  if (ST.th == null) ST.th = "GREEN";
  if (!ST.hist) ST.hist = [];
  applyTheme();
  return ST;
}

// ---------- load()-swap navigation ----------
function gotoMode(file) {
  saveState(); collect();
  try { load(file); return; } catch (e) {}
  try { load("APPS/" + file); return; } catch (e) {}
  try { if (typeof Pip !== "undefined" && Pip.load) { Pip.load(file); return; } } catch (e) {}
}

// ============================================================
//  DRAWING
// ============================================================
function drawScanlines() { h.setColor(FG); }
function drawCorners(x0, y0, x1, y1, n) {
  h.drawLine(x0, y0 + n, x0, y0); h.drawLine(x0, y0, x0 + n, y0);
  h.drawLine(x1 - n, y0, x1, y0); h.drawLine(x1, y0, x1, y0 + n);
  h.drawLine(x0, y1 - n, x0, y1); h.drawLine(x0, y1, x0 + n, y1);
  h.drawLine(x1 - n, y1, x1, y1); h.drawLine(x1, y1 - n, x1, y1);
}
function beginScreen(title, status) {
  h.reset().clear().setColor(FG).setFont("Monofonto23");
  drawScanlines();
  h.setColor(DIM).drawRect(10, 6, W - 10, H - 8);
  drawCorners(10, 6, W - 10, H - 8, 18);
  h.setColor(FG).setFontAlign(-1, -1).drawString("ROBCO", 18, 6);
  h.setColor(DIM).setFontAlign(-1, -1).drawString("PIP-OS", 86, 6);
  h.setColor(FG).setFontAlign(0, -1).drawString(title, W / 2, 6);
  h.setFontAlign(1, -1).drawString(status || curMode, W - 18, 6);
  h.setColor(DIM).drawLine(16, 27, W - 16, 27);
}
function panel(x0, y0, x1, y1, label) {
  h.setColor(DIM).drawRect(x0, y0, x1, y1);
  drawCorners(x0, y0, x1, y1, 8);
  if (label) h.setColor(FG).setFontAlign(-1, -1).drawString(label, x0 + 10, y0 + 4);
  h.setColor(FG);
}
function section(label, y) {
  h.setColor(DIM).drawLine(16, y, W - 16, y);
  if (label) h.setColor(FG).setFontAlign(-1, -1).drawString(label, 26, y + 8);
  h.setColor(FG);
}
function drawTab() {
  var sel = field === 0;
  h.setColor(DIM).drawLine(16, 54, W - 16, 54);
  if (sel) { h.setColor(FG).fillRect(18, 32, W - 18, 52); h.setColor(BG); }
  else h.setColor(MID);
  h.setFontAlign(-1, -1).drawString("MODE", 26, 33);
  if (!sel) h.setColor(FG);
  h.setFontAlign(1, -1).drawString(curMode, W - 26, 33);
  h.setColor(FG);
}
function footer(s) {
  h.setColor(DIM).drawLine(16, H - 31, W - 16, H - 31);
  h.setColor(FG).setFontAlign(0, 0).drawString(fitRight(s, 42), W / 2, H - 16);
}
function row(label, val, y, sel) {
  if (sel) {
    h.setColor(FG).fillRect(24, y - 1, W - 24, y + 21);
    h.setColor(BG).setFontAlign(-1, -1).drawString(">", 28, y);
    h.setFontAlign(-1, -1).drawString(fitRight(label, 12), 46, y);
    h.setFontAlign(1, -1).drawString(fitLeft(val, 23), W - 28, y);
  } else {
    h.setColor(MID).setFontAlign(-1, -1).drawString(fitRight(label, 13), 36, y);
    h.setColor(FG).setFontAlign(1, -1).drawString(fitLeft(val, 24), W - 28, y);
  }
  h.setColor(FG);
}
function miniRow(label, val, y) {
  h.setColor(MID).setFontAlign(-1, -1).drawString(fitRight(label, 8), 36, y);
  h.setColor(FG).setFontAlign(1, -1).drawString(fitLeft(val, 31), W - 28, y);
}

// ============================================================
//  MODE-SELECT MENU (overlay; load()s the chosen app)
// ============================================================
function openMenu() { menuOpen = true; menuCur = MODES.indexOf(curMode); if (menuCur < 0) menuCur = 0; }
function menuK1(dir) { if (dir === 0) { var m = MODES[menuCur]; if (m === curMode) menuOpen = false; else gotoMode(FILES[m]); } else { menuCur = wrap(menuCur + dir, MODES.length); } }
function menuK2() { menuOpen = false; }
function drawMenu() {
  h.reset().clear().setColor(FG).setFont("Monofonto23");
  h.setColor(DIM).drawRect(10, 6, W - 10, H - 8);
  drawCorners(10, 6, W - 10, H - 8, 18);
  h.setColor(FG).setFontAlign(0, -1).drawString("SELECT MODE", W / 2, 12);
  h.setColor(DIM).drawLine(16, 40, W - 16, 40);
  var y0 = 56, lh = 26;
  for (var i = 0; i < MODES.length; i++) {
    var y = y0 + i * lh, sel = i === menuCur;
    if (sel) { h.setColor(FG).fillRect(40, y - 2, W - 40, y + 20); h.setColor(BG); } else h.setColor(FG);
    h.setFontAlign(-1, -1).drawString((MODES[i] === curMode ? "* " : "  ") + MODES[i], 56, y);
    h.setColor(FG);
  }
  footer("WHEEL:MOVE  PRESS:OPEN  THUMB:BACK");
}

// ============================================================
//  BOOTSTRAP
//  finishBoot wires the knob handlers + draw + remove and returns the
//  Pip app object. bootMode is the generic shell every NON-CALC mode
//  uses: field navigation, MODE-tab -> menu, delegate to the mode's
//  draw/knob2/press. CALC supplies its own handlers (keypad) and calls
//  finishBoot directly.
// ============================================================
function finishBoot(k1, k2, redraw) {
  Pip.on("knob1", k1);
  Pip.on("knob2", k2);
  redraw();
  collect();
  return {
    id: "PIPCALC", notDefault: true, fullscreen: true,
    remove: function () {
      saveState();                                                    // flush shared state on close
      Pip.removeListener("knob1", k1);
      Pip.removeListener("knob2", k2);
      try { Pip.setPalette(buildPalette(0.1, 1, 0.25)); } catch (e) {} // restore green on true exit
      collect();
    }
  };
}
function bootMode(spec) {
  curMode = spec.mode; field = 0;
  function redraw() { if (menuOpen) drawMenu(); else spec.draw(field); }
  function k1(dir) {
    if (menuOpen) { menuK1(dir); redraw(); return; }
    if (dir === 0) { if (field === 0) openMenu(); else { spec.press(field); ok(); } }
    else { field = wrap(field + dir, spec.fieldCount()); click(); }
    redraw();
  }
  function k2(dir) {
    if (menuOpen) { menuK2(); redraw(); return; }
    if (!dir) return;
    if (field !== 0) spec.knob2(field, dir);
    click(); redraw();
  }
  return finishBoot(k1, k2, redraw);
}
