// ============================================================
//  _LIB.JS -- shared fragment inlined by tools/build.js into every
//  app that marks //@inject _LIB.JS. NOT a standalone app: it is a
//  block of declarations spliced inside each app's factory so that,
//  at runtime, only ONE app (and therefore one copy of these helpers)
//  is ever resident. Duplicated bytes cost card space, not RAM.
//
//  Each mode now ships as its OWN independent Pip launcher app (its
//  own APPINFO/*.info tile); there is no in-app MODE menu and no
//  cross-app load() navigation. Apps only share values (f(x), Ans,
//  mem, angle, history, a staged insert) through the CALCST
//  card file. Provides: geometry constants, number
//  formatting, Pip-Boy drawing helpers, the shared-state
//  file, and the app bootstrap. Apps that also do math additionally
//  inject _EVAL.JS.
// ============================================================
var W = 480, H = 320;                 // working coordinate space (tune to device)
var FG = 3, MID = 2, DIM = 1, BG = 0; // palette indices: bright / mid / dim / black
var SAFE_L = 24, SAFE_T = 12, SAFE_R = W - 24, SAFE_B = H - 14;
var CONTENT_L = SAFE_L + 8, CONTENT_R = SAFE_R - 8;
var TEXT_L = CONTENT_L + 6, TEXT_R = CONTENT_R - 6;

var ST;                               // shared state (see initState); lives in CALCST
var field = 1;                        // selected field on a mode screen
var curMode = "CALC";                 // which mode THIS app is
var PREV_PAL = null;                  // runtime palette, if getPalette() exists
var APP_IDS = {
  CALC: "PIPCALC",
  GRAPH: "PGRAPH",
  CALCULUS: "PCALCULUS",
  CIRC: "PCIRC",
  CONV: "PCONV",
  CONST: "PCONST",
  REF: "PREF",
  VAC: "PVAC",
  TAPE: "PTAPE"
};

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
function caps(s) { return ("" + s).toUpperCase(); }
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

// Runtime palettes default to white on some Pip builds unless an app provides
// indexed colors. Use the Pip-Boy setting when discoverable; fall back to green.
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
function themeColor(v) {
  var s, n, r, g, b, x;
  if (!v && v !== 0) return null;
  if (typeof v === "string") {
    s = v.toUpperCase();
    if (s.indexOf("AMBER") >= 0 || s.indexOf("ORANGE") >= 0) return [1, 0.714, 0.259];
    if (s.indexOf("BLUE") >= 0) return [0.18, 0.812, 1];
    if (s.indexOf("WHITE") >= 0) return [0.773, 1, 1];
    if (s.indexOf("GREEN") >= 0) return [0.102, 1, 0.502];
    if (s[0] === "#") s = s.slice(1);
    if (s.indexOf("0X") === 0) s = s.slice(2);
    if (/^[0-9]+$/.test(s)) return themeColor(parseInt(s, 10));
    if (s.length >= 6) {
      n = parseInt(s.slice(0, 6), 16);
      if (!isNaN(n)) return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    return null;
  }
  if (typeof v === "number") {
    x = v < 0 ? v + 4294967296 : v;
    r = (x >>> 24) & 255; g = (x >>> 16) & 255; b = (x >>> 8) & 255;
    if (r || g || b) return [r / 255, g / 255, b / 255];
    return null;
  }
  if (v.length >= 3 && typeof v[0] === "number" && typeof v[1] === "number" && typeof v[2] === "number") {
    r = v[0]; g = v[1]; b = v[2];
    if (r > 1 || g > 1 || b > 1) { r /= 255; g /= 255; b /= 255; }
    return [r, g, b];
  }
  if (typeof v === "object") {
    return themeColor(v.uPipboyColor || v.pipboyColor || v.pipBoyColor || v.hudColor || v.uiColor || v.color || v.theme || v.phosphor || v.settings || v.config || v.options || v.prefs || v.preferences || v.display || v.hud || v.ui || v.colors || v.colours || v.pipboy || v.pipBoy || (v.r != null ? [v.r, v.g, v.b] : null));
  }
  return null;
}
function settingColor() {
  var S, names, i, raw, c;
  try {
    if (Pip.getPalette && !PREV_PAL) PREV_PAL = Pip.getPalette();
    names = ["uPipboyColor", "pipboyColor", "pipBoyColor", "hudColor", "uiColor", "color", "theme", "phosphor", "settings", "config", "options", "prefs", "preferences"];
    for (i = 0; i < names.length; i++) { c = themeColor(Pip[names[i]]); if (c) return c; }
    if (Pip.getTheme) { c = themeColor(Pip.getTheme()); if (c) return c; }
    if (Pip.getColor) { c = themeColor(Pip.getColor()); if (c) return c; }
  } catch (e) {}
  try {
    S = require("Storage");
    names = ["PIPST", "PIPSET", "PIPCFG", "PIPCONF", "PIPSETTINGS", "CONFIG", "SETTINGS", "settings"];
    for (i = 0; i < names.length; i++) {
      raw = S.read(names[i]);
      if (raw) { try { raw = JSON.parse(raw); } catch (_) {} c = themeColor(raw); if (c) return c; }
    }
  } catch (e2) {}
  return null;
}
function applyPipPalette() {
  var c = settingColor();
  try {
    if (c) Pip.setPalette(buildPalette(c[0], c[1], c[2]));
    else if (PREV_PAL) Pip.setPalette(PREV_PAL);
    else Pip.setPalette(buildPalette(0.102, 1, 0.502));
  } catch (e) {}
}
// ---------- shared state (survives across apps via the CALCST card file) ----------
function loadState() { try { var s = require("Storage").read("CALCST"); if (s) return JSON.parse(s); } catch (e) {} return null; }
function saveState() { try { require("Storage").write("CALCST", JSON.stringify(ST)); } catch (e) {} }
function initState() {
  ST = loadState() || {};
  if (ST.fx == null) ST.fx = "sin(x)";
  if (ST.ans == null) ST.ans = 0;
  if (ST.mem == null) ST.mem = 0;
  if (ST.ang == null) ST.ang = "RAD";
  if (ST.msg == null) ST.msg = "";
  if (!ST.hist) ST.hist = [];
  applyPipPalette();
  return ST;
}

// ============================================================
//  DRAWING
// ============================================================
function drawScanlines() {
  h.setColor(FG);
}
function drawCorners(x0, y0, x1, y1, n) {
  h.drawLine(x0, y0 + n, x0, y0); h.drawLine(x0, y0, x0 + n, y0);
  h.drawLine(x1 - n, y0, x1, y0); h.drawLine(x1, y0, x1, y0 + n);
  h.drawLine(x0, y1 - n, x0, y1); h.drawLine(x0, y1, x0 + n, y1);
  h.drawLine(x1 - n, y1, x1, y1); h.drawLine(x1, y1 - n, x1, y1);
}
function rivet(x, y) {
  h.drawRect(x - 2, y - 2, x + 2, y + 2);
  h.drawLine(x - 3, y, x + 3, y);
}
function drawHardware() {
  h.setColor(DIM);
  rivet(SAFE_L + 8, SAFE_T + 8); rivet(SAFE_R - 8, SAFE_T + 8);
  rivet(SAFE_L + 8, SAFE_B - 8); rivet(SAFE_R - 8, SAFE_B - 8);
  for (var y = SAFE_T + 52; y < SAFE_B - 42; y += 34) {
    h.drawLine(SAFE_L + 3, y, SAFE_L + 11, y);
    h.drawLine(SAFE_R - 11, y, SAFE_R - 3, y);
  }
}
function drawGlassWear() {
}
function beginScreen(title, status) {
  h.reset().clear().setColor(FG).setFont("Monofonto23");
  drawScanlines();
  h.setColor(DIM).drawRect(SAFE_L - 4, SAFE_T - 4, SAFE_R + 4, SAFE_B + 4);
  h.setColor(DIM).drawRect(SAFE_L, SAFE_T, SAFE_R, SAFE_B);
  drawCorners(SAFE_L, SAFE_T, SAFE_R, SAFE_B, 14);
  drawHardware();
  h.setColor(FG).setFontAlign(-1, -1).drawString("ROBCO TERMLINK", TEXT_L, SAFE_T);
  h.setColor(MID).setFontAlign(0, -1).drawString(caps(title), W / 2, SAFE_T);
  h.setFontAlign(1, -1).drawString(caps(status || curMode), CONTENT_R, SAFE_T);
  h.setColor(DIM).drawLine(CONTENT_L, 32, CONTENT_R, 32);
}
function panel(x0, y0, x1, y1, label) {
  h.setColor(DIM).drawRect(x0, y0, x1, y1);
  drawCorners(x0, y0, x1, y1, 8);
  if (label) h.setColor(FG).setFontAlign(-1, -1).drawString("[" + caps(label) + "]", x0 + 10, y0 + 4);
  h.setColor(FG);
}
function section(label, y) {
  h.setColor(DIM).drawLine(CONTENT_L, y, CONTENT_R, y);
  if (label) h.setColor(FG).setFontAlign(-1, -1).drawString("[" + caps(label) + "]", TEXT_L, y + 8);
  h.setColor(FG);
}
function footer(s) {
  h.setColor(FG).setFontAlign(0, 0).drawString(fitRight(caps(s), 42), W / 2, H - 20);
}
function row(label, val, y, sel) {
  if (sel) {
    h.setColor(DIM).drawRect(CONTENT_L, y - 1, CONTENT_R, y + 21);
    h.setColor(FG).setFontAlign(-1, -1).drawString(">", TEXT_L - 4, y);
    h.setFontAlign(-1, -1).drawString(fitRight(caps(label), 12), TEXT_L + 16, y);
    h.setFontAlign(1, -1).drawString(fitLeft(val, 21), TEXT_R, y);
  } else {
    h.setColor(MID).setFontAlign(-1, -1).drawString(fitRight(caps(label), 13), TEXT_L, y);
    h.setColor(FG).setFontAlign(1, -1).drawString(fitLeft(val, 22), TEXT_R, y);
  }
  h.setColor(FG);
}
function miniRow(label, val, y) {
  h.setColor(MID).setFontAlign(-1, -1).drawString(fitRight(caps(label), 8), TEXT_L, y);
  h.setColor(FG).setFontAlign(1, -1).drawString(fitLeft(val, 27), TEXT_R, y);
}

// ============================================================
//  BOOTSTRAP
//  finishBoot wires knob handlers + draw + remove and returns the Pip
//  app object. bootMode is the generic shell every NON-CALC mode uses:
//  fields 1..N are the mode's controls;
//  it delegates to the mode's draw/knob2/press. CALC supplies its own
//  keypad handlers and calls finishBoot directly.
// ============================================================
function finishBoot(k1, k2, redraw) {
  function paint() {
    try { redraw(); }
    catch (e) {
      try {
        h.reset().clear().setColor(FG);
        if (h.setFontAlign) h.setFontAlign(-1, -1);
        h.drawString("ERR: " + ("" + ((e && e.message) || e)).slice(0, 36), TEXT_L, 40);
      } catch (_) {}
    }
  }
  paint();
  var h1 = function (d) { k1(d); paint(); };
  var h2 = function (d) { k2(d); paint(); };
  Pip.on("knob1", h1);
  Pip.on("knob2", h2);
  collect();
  return {
    id: APP_IDS[curMode] || "PIPCALC", notDefault: true, fullscreen: true,
    remove: function () {
      saveState();                                                    // flush shared state on close
      Pip.removeListener("knob1", h1);
      Pip.removeListener("knob2", h2);
      collect();
    }
  };
}
function bootMode(spec) {
  curMode = spec.mode; field = 1;
  function redraw() { spec.draw(field); }
  function maxField() { return Math.max(1, spec.fieldCount() - 1); }
  function wrapField(v) { return 1 + wrap(v - 1, maxField()); }
  function k1(dir) {
    if (dir === 0) { spec.press(field); ok(); }
    else { field = wrapField(field + dir); click(); }
  }
  function k2(dir) {
    if (!dir) return;
    spec.knob2(field, dir);
    click();
  }
  return finishBoot(k1, k2, redraw);
}
