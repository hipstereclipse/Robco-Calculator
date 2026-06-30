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
var field = 1;                        // selected field (row) on a mode screen
var editing = false;                  // two-state field interaction (see bootMode):
                                      //   false = NAV  -> wheel/thumb scroll rows, the
                                      //                   selected row's LABEL blinks,
                                      //                   push selects/runs the row
                                      //   true  = EDIT -> wheel = +/-1 step / cycle,
                                      //                   thumb = step magnitude,
                                      //                   the selected row's VALUE blinks,
                                      //                   push returns to NAV
var editMag = 0;                      // EDIT numeric step exponent: the wheel adds
                                      // +/-1 * 10^editMag; the thumb dials editMag.
                                      // Reset to 0 (step 1) on entering EDIT.
var fieldKind = "num";                // kind of the currently selected field, refreshed
                                      // each redraw by bootMode: "num" | "enum" | "act"
var curMode = "CALC";                 // which mode THIS app is
var blinkOn = true;                   // cursor-style blink phase for the selected row
                                      // (the LABEL in NAV, the editable VALUE in EDIT);
                                      // toggled by a timer in finishBoot on device, stays
                                      // true off-device so previews/verify render steadily
var DRAW_R = 0.102, DRAW_G = 1, DRAW_B = 0.502;
var ORIG_SET_COLOR = null, ORIG_SET_FONT = null;
var APP_IDS = {
  CALC: "pipcalc",
  GRAPH: "pipgraph",
  CALCULUS: "pipcalculus",
  CIRC: "pipcirc",
  CONV: "pipconv",
  CONST: "pipconst",
  REF: "pipref",
  VAC: "pipvac",
  TAPE: "piptape"
};

// ---------- helpers ----------
function wrap(v, n) { return ((v % n) + n) % n; }
function click() { try { Pip.audioBuiltin("COLUMN"); } catch (e) {} }
function ok()    { try { Pip.audioBuiltin("OK"); } catch (e) {} }
function collect() { try { if (typeof global !== "undefined" && global.gc) global.gc(); } catch (e) {} }
function onDevice() { return typeof setInterval !== "undefined"; }

// ---------- numeric magnitude stepping (EDIT mode) ----------
// The wheel adds +/-1 unit at the current magnitude; the thumb dials that
// magnitude up/down by powers of ten. magStep() is the active step (10^editMag);
// numeric modes nudge their value by `dir * magStep()` on the wheel, and editMag
// resets to 0 (step 1) on entering EDIT so the wheel always starts at +/-1.
function magStep() { return Math.pow(10, editMag); }
function magBump(dir) {
  editMag += dir;
  if (editMag > 12) editMag = 12;
  if (editMag < -9) editMag = -9;
}

// Footer control legend for the generic tool screens: reflects whether the
// selected field is being navigated or edited, and (for numbers) the live step.
function navHint() {
  if (editing) {
    if (fieldKind === "enum") return "WHEEL CYCLE   PUSH DONE";
    if (fieldKind === "act") return "PUSH RUN";
    return "WHEEL +/-" + fmt(magStep()) + "   THUMB STEP   PUSH DONE";
  }
  return "WHEEL PICK   PUSH EDIT/RUN";
}

function fixed(n, digits) {
  var neg = n < 0, scale, whole, frac, s;
  if (neg) n = -n;
  scale = Math.pow(10, digits);
  whole = Math.floor(n);
  frac = Math.round((n - whole) * scale);
  if (frac >= scale) { whole++; frac -= scale; }
  s = "" + whole;
  if (digits > 0) {
    frac = "" + frac;
    while (frac.length < digits) frac = "0" + frac;
    s += "." + frac;
  }
  return (neg ? "-" : "") + s;
}
function trimFrac(s) {
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}
function sci(n, digits) {
  var neg, exp, m;
  if (typeof n === "string") return n;
  if (isNaN(n)) return "ERR";
  if (!isFinite(n)) return n > 0 ? "INF" : "-INF";
  if (n === 0) return "0e0";
  neg = n < 0;
  n = Math.abs(n);
  exp = Math.floor(Math.log(n) / Math.LN10);
  m = n / Math.pow(10, exp);
  m = Math.round(m * Math.pow(10, digits)) / Math.pow(10, digits);
  if (m >= 10) { m /= 10; exp++; }
  return (neg ? "-" : "") + trimFrac(fixed(m, digits)) + "e" + exp;
}
function eng(n, digits) {
  if (typeof n === "string") return n;
  if (isNaN(n)) return "ERR";
  if (!isFinite(n)) return n > 0 ? "INF" : "-INF";
  if (n === 0) return "0e0";
  var exp = Math.floor(Math.log(Math.abs(n)) / Math.LN10), m, s;
  exp = Math.floor(exp / 3) * 3;
  m = n / Math.pow(10, exp);
  s = fixed(m, digits);
  if (Math.abs(parseFloat(s)) >= 1000) { exp += 3; m /= 1000; s = fixed(m, digits); }
  return trimFrac(s) + "e" + exp;
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
  if (a < 1e-6 || a >= 1e9) s = plainNum(sci(n, 15));
  else s = fixed(n, 12);
  return s;
}

// Some Pip builds treat h.setColor(0..3) as greyscale rather than palette
// indices. Keep drawing indexed in source, but map those four levels to the
// active Pip-Boy color while this app is resident.
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
  if (!c) c = [0.102, 1, 0.502];
  DRAW_R = c[0]; DRAW_G = c[1]; DRAW_B = c[2];
  updateRenderCompatColor();
}
// Espruino's Graphics.setColor(r,g,b) docs: "On devices with low flash
// memory, r must be an integer representing the color in the current bit
// depth ... g and b are ignored" -- passing 3 floats through (the old
// approach) silently lost the theme color on any such build, and a
// near-zero float r (DIM/MID levels) truncates straight to 0 = black. Avoid
// the ambiguity entirely: precompute each of the 4 levels into a single
// native packed-color integer via h.toColor() once (in updateRenderCompatColor,
// whenever the theme changes) and have the wrapper hand that integer to
// origColor as a single arg -- the one form the docs guarantee works on every
// bit depth/flash configuration.
function installRenderCompat() {
  if (!onDevice() || typeof h === "undefined" || !h) return;
  var compat = h._pipCalcCompat || (h._pipCalcCompat = {});
  if (h.setColor && h.setColor !== compat.colorWrapper) {
    compat.origColor = h.setColor;
    compat.colorWrapper = function (a) {
      var c = h._pipCalcCompat || compat;
      if (arguments.length === 1 && typeof a === "number" && a >= 0 && a <= 3) {
        var k = a | 0;
        if (c.levels && c.levels[k] != null) { try { return c.origColor.call(h, c.levels[k]); } catch (e) {} }
        var l = k === 0 ? 0 : k === 1 ? 0.34 : k === 2 ? 0.67 : 1;
        try { return c.origColor.call(h, (c.r == null ? DRAW_R : c.r) * l, (c.g == null ? DRAW_G : c.g) * l, (c.b == null ? DRAW_B : c.b) * l); } catch (e2) {}
        try { return c.origColor.call(h, k); } catch (e3) {}
      }
      try { return c.origColor.apply(h, arguments); } catch (e4) { return h; }
    };
    h.setColor = compat.colorWrapper;
  }
  if (h.setFont && h.setFont !== compat.fontWrapper) {
    compat.origFont = h.setFont;
    compat.fontWrapper = function (name, size) {
      var c = h._pipCalcCompat || compat;
      try { return c.origFont.call(h, name, size); }
      catch (e) {
        try { return c.origFont.call(h, "6x8"); }
        catch (e2) { try { return h.setFontVector ? h.setFontVector(22) : h; } catch (e3) { return h; } }
      }
    };
    h.setFont = compat.fontWrapper;
  }
}
function updateRenderCompatColor() {
  try {
    if (typeof h === "undefined" || !h || !h._pipCalcCompat) return;
    var c = h._pipCalcCompat;
    c.r = DRAW_R; c.g = DRAW_G; c.b = DRAW_B;
    c.levels = null;
    if (!h.toColor) return;                            // no native packer -- wrapper falls back to raw floats
    var levels = [], ok = true;
    for (var k = 0; k < 4; k++) {
      var l = k === 0 ? 0 : k === 1 ? 0.34 : k === 2 ? 0.67 : 1;
      try { levels[k] = h.toColor(DRAW_R * l, DRAW_G * l, DRAW_B * l); }
      catch (e) { ok = false; break; }
    }
    if (ok) c.levels = levels;
  } catch (e2) {}
}
function restoreRenderCompat() {
  var compat;
  try {
    if (typeof h === "undefined" || !h || !h._pipCalcCompat) return;
    compat = h._pipCalcCompat;
    if (compat.origColor && h.setColor === compat.colorWrapper) h.setColor = compat.origColor;
    if (compat.origFont && h.setFont === compat.fontWrapper) h.setFont = compat.origFont;
    try { delete h._pipCalcCompat; } catch (e2) { h._pipCalcCompat = null; }
  } catch (e) {}
}
// ---------- shared state (survives across apps via the CALCST card file) ----------
function loadState() { try { var s = require("Storage").read("CALCST"); if (s) return JSON.parse(s); } catch (e) {} return null; }
function saveState() { try { if (ST) require("Storage").write("CALCST", JSON.stringify(ST)); } catch (e) {} }
function initState() {
  ST = loadState() || {};
  if (ST.fx == null) ST.fx = "sin(x)";
  if (ST.ans == null) ST.ans = 0;
  if (ST.mem == null) ST.mem = 0;
  if (ST.ang == null) ST.ang = "RAD";
  if (ST.msg == null) ST.msg = "";
  if (!ST.hist || !ST.hist.unshift) ST.hist = [];
  installRenderCompat();
  applyPipPalette();
  return ST;
}

// ---------- durable calculation tape (survives power-off / OOM crashes) ----------
// An append-only StorageFile on the device card. CALC appends one line per "="
// the instant it is evaluated, so results are persisted immediately rather than
// only when the app closes cleanly; TAPE reads them back across reboots. Every
// call is guarded -- if the file API is unavailable the apps still run and fall
// back to the in-RAM ST.hist. Lines are "expr\tvalue".
var TAPE_FILE = "CALCTAPE", TAPE_MAX = 100;
function tapeLog(s, v) {
  try { require("Storage").open(TAPE_FILE, "a").write(s + "\t" + v + "\n"); } catch (e) {}
}
function tapeReadAll() {                                 // -> oldest-first array of {s, v}
  var out = [], f, line, t;
  try {
    f = require("Storage").open(TAPE_FILE, "r");
    line = f.readLine();
    while (line) {
      t = line.indexOf("\t");
      if (t >= 0) out.push({ s: line.slice(0, t), v: parseFloat(line.slice(t + 1)) });
      line = f.readLine();
    }
  } catch (e) {}
  return out;
}
function tapeTrim(list) {                                // rewrite the log to `list` (oldest-first)
  try {
    require("Storage").open(TAPE_FILE, "r").erase();
    var f = require("Storage").open(TAPE_FILE, "a");
    for (var i = 0; i < list.length; i++) f.write(list[i].s + "\t" + list[i].v + "\n");
  } catch (e) {}
}
function tapeErase() { try { require("Storage").open(TAPE_FILE, "r").erase(); } catch (e) {} }

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
  h.drawLine(SAFE_L + 5, SAFE_T + 38, SAFE_L + 13, SAFE_T + 38);
  h.drawLine(SAFE_R - 13, SAFE_T + 38, SAFE_R - 5, SAFE_T + 38);
  h.drawLine(SAFE_L + 5, SAFE_B - 28, SAFE_L + 13, SAFE_B - 28);
  h.drawLine(SAFE_R - 13, SAFE_B - 28, SAFE_R - 5, SAFE_B - 28);
}
function drawGlassWear() {
}
// Font helpers. Monofonto23 is the only font we rely on for headings/rows;
// the footer and compact readouts drop to a small font so they stop colliding
// with the rounded bezel. setFont is wrapped on device (installRenderCompat),
// so an unavailable name degrades gracefully instead of throwing.
function bigFont() { h.setFont("Monofonto23"); }
function smallFont() { h.setFont("6x8"); }
function beginScreen(title, status) {
  h.reset().clear().setColor(FG).setFont("Monofonto23");
  drawScanlines();
  h.setColor(DIM);
  drawCorners(SAFE_L, SAFE_T, SAFE_R, SAFE_B, 14);
  drawHardware();
  // Two zones only: brand left, mode/status right. A centred title here
  // collided with the brand on the device's wide font, so the mode name is
  // shown right-aligned (status when the mode supplies one, else the title).
  h.setColor(MID).setFontAlign(-1, -1).drawString("ROBCO TERMLINK", TEXT_L, SAFE_T + 4);
  // Right-align to TEXT_R, not CONTENT_R: CONTENT_R sits on the corner rivet
  // column, so a long mode name used to print straight through the rivet.
  h.setColor(FG).setFontAlign(1, -1).drawString(caps(status || title || curMode), TEXT_R, SAFE_T + 4);
  h.setColor(DIM).drawLine(CONTENT_L, 33, CONTENT_R, 33);
}
function panel(x0, y0, x1, y1, label) {
  h.setColor(DIM).drawLine(x0, y0, x1, y0);
  h.drawLine(x0, y1, x1, y1);
  if (label) h.setColor(FG).setFontAlign(-1, -1).drawString("> " + caps(label), x0 + 10, y0 + 4);
  h.setColor(FG);
}
// A section divider with an optional legend below it. The legend occupies a
// full ~23px text line, so callers must start their first content row at least
// ~30px below y (see the readout blocks in the mode apps).
function section(label, y) {
  h.setColor(DIM).drawLine(CONTENT_L, y, CONTENT_R, y);
  if (label) h.setColor(FG).setFontAlign(-1, -1).drawString("> " + caps(label), TEXT_L, y + 6);
  h.setColor(FG);
}
// Control legend, drawn as a dim status strip in the small font so it clears
// the rounded bottom corners instead of overflowing into them. A thin rule
// separates it from the readout above.
function footer(s) {
  h.setColor(DIM).drawLine(CONTENT_L, H - 32, CONTENT_R, H - 32);
  smallFont();
  h.setColor(MID).setFontAlign(0, 0).drawString(fitRight(caps(s), 56), W / 2, H - 21);
  bigFont();
}
// A label/value field row. The label (context) is ALWAYS drawn bright so every
// row is readable whether or not it is selected -- earlier builds dimmed the
// label of unselected rows to MID, which on the device read as "blank until you
// land on it". Selection adds a ">" caret and an underline. Which half blinks
// signals the interaction state (see bootMode): in NAV the LABEL blinks (you are
// choosing which row to act on); after a push the row is in EDIT and the VALUE
// blinks (the wheel/thumb now change it). Off-device blinkOn stays true so both
// halves render steadily for previews/verify.
function row(label, val, y, sel) {
  if (sel) {
    h.setColor(DIM).drawLine(CONTENT_L, y + 21, CONTENT_R, y + 21);
    var litLabel = editing || blinkOn;       // NAV: blink label; EDIT: keep it lit
    var litVal = editing ? blinkOn : true;   // EDIT: blink value; NAV: keep it lit
    if (litLabel) {
      h.setColor(FG).setFontAlign(-1, -1).drawString(">", TEXT_L - 4, y);
      h.drawString(fitRight(caps(label), 12), TEXT_L + 16, y);
    }
    if (litVal) h.setColor(FG).setFontAlign(1, -1).drawString(fitLeft(val, 21), TEXT_R, y);
  } else {
    h.setColor(FG).setFontAlign(-1, -1).drawString(fitRight(caps(label), 13), TEXT_L, y);
    h.setFontAlign(1, -1).drawString(fitLeft(val, 22), TEXT_R, y);
  }
  h.setColor(FG);
}
function miniRow(label, val, y) {
  h.setColor(FG).setFontAlign(-1, -1).drawString(fitRight(caps(label), 8), TEXT_L, y);
  h.setFontAlign(1, -1).drawString(fitLeft(val, 27), TEXT_R, y);
}
// Label/value readout row meant to be drawn in the small font (caller switches
// with smallFont()): the small glyphs let the full label and a long value
// share one line without the 8-char truncation miniRow needs at heading size.
// Both halves are drawn bright -- the readout label is the only context for the
// number on the right, so dimming it (as older builds did) left the value
// looking unlabelled on the device.
function outRow(label, val, y) {
  h.setColor(FG).setFontAlign(-1, -1).drawString(fitRight(caps(label), 22), TEXT_L, y);
  h.setFontAlign(1, -1).drawString(fitLeft(val, 30), TEXT_R, y);
}

// ============================================================
//  BOOTSTRAP
//  finishBoot wires knob handlers + draw + remove and returns the Pip
//  app object. bootMode is the generic shell every NON-CALC mode uses.
//  It runs a two-state interaction over fields 1..N (see `editing`):
//    NAV   wheel/thumb scroll the selected field; PUSH selects it -- an
//          "act" field runs its action immediately (spec.act), any other
//          field enters EDIT.
//    EDIT  wheel = spec.edit(field,dir) (a "num" field nudges by magStep(),
//          an "enum" field cycles); thumb dials the step magnitude (editMag)
//          for a "num" field, or cycles an "enum"; PUSH returns to NAV.
//  spec: { mode, fieldCount(), draw(field), kind(field)->"num"|"enum"|"act",
//          edit(field,dir), act(field), mag(field,dir)?, navThumb(field,dir)? }.
//  mag (optional) overrides the thumb in EDIT for modes whose magnitude isn't a
//  power-of-ten step (GRAPH dials zoom/pan coarsely). navThumb (optional) lets a
//  mode use the thumb during NAV for a per-field toggle (VAC dials each row's
//  display unit); without it the thumb just scrolls the selection like the
//  wheel. CALC supplies its own keypad handlers and calls finishBoot directly.
// ============================================================
function finishBoot(k1, k2, redraw) {
  var removed = false, blinkTimer = null;
  function paint() {
    try { redraw(); }
    catch (e) {
      try {
        h.reset().clear().setColor(FG);
        if (h.setFontAlign) h.setFontAlign(-1, -1);
        h.drawString("ERR: " + ("" + ((e && e.message) || e)).slice(0, 36), TEXT_L, 40);
      } catch (_) {}
    }
    if (onDevice()) { try { if (h.flip) h.flip(); } catch (e2) {} }
  }
  paint();
  var h1 = function (d) { blinkOn = true; k1(d); paint(); };   // any input relights the
  var h2 = function (d) { blinkOn = true; k2(d); paint(); };   // value so it never edits while dark
  Pip.on("knob1", h1);
  Pip.on("knob2", h2);
  // Cursor-style blink for the selected row's editable value: toggle the phase
  // and repaint on a timer. Device-only (guarded by onDevice) so the headless
  // preview/verify harness keeps blinkOn=true and renders a steady value.
  if (onDevice()) {
    try { blinkTimer = setInterval(function () { blinkOn = !blinkOn; paint(); }, 520); } catch (e3) { blinkTimer = null; }
  }
  collect();
  return {
    id: APP_IDS[curMode] || "pipcalc", notDefault: true, fullscreen: true,
    remove: function () {
      if (removed) return;
      removed = true;
      if (blinkTimer) { try { clearInterval(blinkTimer); } catch (e4) {} blinkTimer = null; }
      saveState();                                                    // flush shared state on close
      Pip.removeListener("knob1", h1);
      Pip.removeListener("knob2", h2);
      restoreRenderCompat();
      h1 = h2 = k1 = k2 = redraw = null;
      ST = null;
      collect();
    }
  };
}
function bootMode(spec) {
  curMode = spec.mode; field = 1; editing = false;
  function kindOf(f) { return spec.kind ? spec.kind(f) : "num"; }
  function redraw() { fieldKind = kindOf(field); spec.draw(field); }
  function maxField() { return Math.max(1, spec.fieldCount()); }
  function wrapField(v) { return 1 + wrap(v - 1, maxField()); }
  // edit/act run arithmetic on user-dialled inputs; guard them so a stray throw
  // (e.g. a degenerate solve) surfaces in the footer instead of bubbling out of
  // the Pip event handler and wedging the app.
  function k1(dir) {                                   // WHEEL: scroll rows / +/-1 edit
    if (dir === 0) {                                   // PUSH
      if (editing) { editing = false; ok(); return; } // EDIT -> NAV
      if (kindOf(field) === "act") { try { spec.act(field); } catch (e) { ST.msg = "ERR"; } ok(); }
      else { editing = true; editMag = 0; ok(); }     // NAV -> EDIT (num/enum), step = 1
    } else {
      if (editing) { try { spec.edit(field, dir); } catch (e) { ST.msg = "ERR"; } }
      else field = wrapField(field + dir);
      click();
    }
  }
  function k2(dir) {                                   // THUMB: step magnitude / nav helper
    if (!dir) return;
    if (editing) {
      if (spec.mag) { try { spec.mag(field, dir); } catch (e) { ST.msg = "ERR"; } }
      else if (kindOf(field) === "num") magBump(dir); // dial the wheel's step x10
      else { try { spec.edit(field, dir); } catch (e) { ST.msg = "ERR"; } } // enum: cycle
    } else if (spec.navThumb) { try { spec.navThumb(field, dir); } catch (e) { ST.msg = "ERR"; } }
    else field = wrapField(field + dir);
    click();
  }
  return finishBoot(k1, k2, redraw);
}
