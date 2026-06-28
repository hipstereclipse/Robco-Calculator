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
//  mem, angle, theme, history, a staged insert) through the CALCST
//  card file. Provides: palette/geometry constants, number
//  formatting, Pip-Boy drawing helpers, theming, the shared-state
//  file, on-device render compat, and the app bootstrap. Apps that
//  also do math additionally inject _EVAL.JS.
// ============================================================
var W = 480, H = 320;                 // working coordinate space (tune to device)
var FG = 3, MID = 2, DIM = 1, BG = 0; // palette indices: bright / mid / dim / black
var SAFE_L = 24, SAFE_T = 12, SAFE_R = W - 24, SAFE_B = H - 14;
var CONTENT_L = SAFE_L + 8, CONTENT_R = SAFE_R - 8;
var TEXT_L = CONTENT_L + 6, TEXT_R = CONTENT_R - 6;

var ST;                               // shared state (see initState); lives in CALCST
var field = 0;                        // selected field on a mode screen (0 = THEME tab)
var curMode = "CALC";                 // which mode THIS app is

// ---------- helpers ----------
function wrap(v, n) { return ((v % n) + n) % n; }
function click() { try { Pip.audioBuiltin("COLUMN"); } catch (e) {} }
function ok()    { try { Pip.audioBuiltin("OK"); } catch (e) {} }
function collect() { try { if (typeof global !== "undefined" && global.gc) global.gc(); } catch (e) {} }
function onDevice() { return typeof setInterval !== "undefined"; } // false under the Node harness

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
function toggleTheme() { ST.th = ST.th === "GREEN" ? "AMBER" : "GREEN"; applyTheme(); }

// ---------- on-device render compatibility ----------
//  On the real Pip framebuffer the graphics helper `h` takes RGB colours and
//  a single small index reads as near-black, so palette-index draws come out
//  blank. We capture the active theme colour from setPalette and remap
//  setColor(0..3) to scaled RGB in software, with a font fallback. Skipped
//  entirely under the Node preview harness (no setInterval there), so the
//  src/ and APPS/ renders stay byte-identical for verify-build.js.
var devBase = { r: 0.1, g: 1.0, b: 0.25 };
function dec565(v) { v = v | 0; return { r: ((v >> 11) & 31) / 31, g: ((v >> 5) & 63) / 63, b: (v & 31) / 31 }; }
function installDeviceCompat() {
  if (!onDevice() || typeof h === "undefined" || !h) return;
  if (h.setColor && !h.$c) {
    var s = h.setColor;
    h.setColor = function (a) {
      if (arguments.length === 1 && typeof a === "number" && a >= 0 && a <= 3) {
        var L = [0, 0.34, 0.67, 1][a | 0];
        try { return s.call(h, devBase.r * L, devBase.g * L, devBase.b * L); } catch (e) { return h; }
      }
      try { return s.apply(h, arguments); } catch (e) { return h; }
    };
    h.$c = 1;
  }
  if (typeof Pip !== "undefined" && Pip && Pip.setPalette && !Pip.$c) {
    var p = Pip.setPalette;
    Pip.setPalette = function (a) {
      try { if (a && a[0] && a[0].length > 3) { var c = dec565(a[0][a[0].length - 1]); devBase.r = c.r; devBase.g = c.g; devBase.b = c.b; } } catch (e) {}
      try { if (p) return p.call(Pip, a); } catch (e) {}
    };
    Pip.$c = 1;
  }
  if (h.setFont && !h.$f) {
    var f = h.setFont;
    h.setFont = function (n, z) {
      try { return f.call(h, n, z); }
      catch (e) { try { return f.call(h, "6x8"); } catch (e2) { try { return h.setFontVector ? h.setFontVector(22) : h; } catch (e3) { return h; } } }
    };
    h.$f = 1;
  }
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
  if (ST.th == null) ST.th = "GREEN";
  if (ST.msg == null) ST.msg = "";
  if (!ST.hist) ST.hist = [];
  installDeviceCompat();
  applyTheme();
  return ST;
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
  h.setColor(DIM).drawRect(SAFE_L, SAFE_T, SAFE_R, SAFE_B);
  drawCorners(SAFE_L, SAFE_T, SAFE_R, SAFE_B, 14);
  h.setColor(FG).setFontAlign(-1, -1).drawString("ROBCO", CONTENT_L, SAFE_T);
  h.setColor(DIM).setFontAlign(-1, -1).drawString("PIP-OS", CONTENT_L + 68, SAFE_T);
  h.setColor(FG).setFontAlign(0, -1).drawString(title, W / 2, SAFE_T);
  h.setFontAlign(1, -1).drawString(status || curMode, CONTENT_R, SAFE_T);
  h.setColor(DIM).drawLine(CONTENT_L, 32, CONTENT_R, 32);
}
function panel(x0, y0, x1, y1, label) {
  h.setColor(DIM).drawRect(x0, y0, x1, y1);
  drawCorners(x0, y0, x1, y1, 8);
  if (label) h.setColor(FG).setFontAlign(-1, -1).drawString(label, x0 + 10, y0 + 4);
  h.setColor(FG);
}
function section(label, y) {
  h.setColor(DIM).drawLine(CONTENT_L, y, CONTENT_R, y);
  if (label) h.setColor(FG).setFontAlign(-1, -1).drawString(label, TEXT_L, y + 8);
  h.setColor(FG);
}
// Field 0 of every mode app is the THEME toggle, drawn as the top tab.
function drawTab() {
  var sel = field === 0;
  h.setColor(DIM).drawLine(CONTENT_L, 56, CONTENT_R, 56);
  if (sel) { h.setColor(FG).fillRect(CONTENT_L, 34, CONTENT_R, 54); h.setColor(BG); }
  else h.setColor(MID);
  h.setFontAlign(-1, -1).drawString("THEME", TEXT_L, 35);
  if (!sel) h.setColor(FG);
  h.setFontAlign(1, -1).drawString(ST.th, TEXT_R, 35);
  h.setColor(FG);
}
function footer(s) {
  h.setColor(DIM).drawLine(CONTENT_L, H - 38, CONTENT_R, H - 38);
  h.setColor(FG).setFontAlign(0, 0).drawString(fitRight(s, 38), W / 2, H - 22);
}
function row(label, val, y, sel) {
  if (sel) {
    h.setColor(FG).fillRect(CONTENT_L, y - 1, CONTENT_R, y + 21);
    h.setColor(BG).setFontAlign(-1, -1).drawString(">", TEXT_L - 4, y);
    h.setFontAlign(-1, -1).drawString(fitRight(label, 12), TEXT_L + 16, y);
    h.setFontAlign(1, -1).drawString(fitLeft(val, 21), TEXT_R, y);
  } else {
    h.setColor(MID).setFontAlign(-1, -1).drawString(fitRight(label, 13), TEXT_L, y);
    h.setColor(FG).setFontAlign(1, -1).drawString(fitLeft(val, 22), TEXT_R, y);
  }
  h.setColor(FG);
}
function miniRow(label, val, y) {
  h.setColor(MID).setFontAlign(-1, -1).drawString(fitRight(label, 8), TEXT_L, y);
  h.setColor(FG).setFontAlign(1, -1).drawString(fitLeft(val, 27), TEXT_R, y);
}

// ============================================================
//  BOOTSTRAP
//  finishBoot wires knob handlers + draw + remove and returns the Pip
//  app object; on the device it also flips the framebuffer (initial +
//  ~20fps). bootMode is the generic shell every NON-CALC mode uses:
//  field 0 is the THEME toggle, fields 1..N are the mode's controls;
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
    if (onDevice()) { try { if (h.flip) h.flip(); } catch (e) {} }
  }
  paint();
  var h1 = function (d) { k1(d); paint(); };
  var h2 = function (d) { k2(d); paint(); };
  Pip.on("knob1", h1);
  Pip.on("knob2", h2);
  var flipId = null;
  if (onDevice()) { try { flipId = setInterval(function () { try { if (h.flip) h.flip(); } catch (e) {} }, 50); } catch (e) {} }
  collect();
  return {
    id: "PIPCALC", notDefault: true, fullscreen: true,
    remove: function () {
      try { if (flipId !== null) clearInterval(flipId); } catch (e) {}
      saveState();                                                    // flush shared state on close
      Pip.removeListener("knob1", h1);
      Pip.removeListener("knob2", h2);
      try { Pip.setPalette(buildPalette(0.1, 1, 0.25)); } catch (e) {} // restore green on true exit
      collect();
    }
  };
}
function bootMode(spec) {
  curMode = spec.mode; field = 0;
  function redraw() { spec.draw(field); }
  function k1(dir) {
    if (dir === 0) { if (field === 0) toggleTheme(); else { spec.press(field); ok(); } }
    else { field = wrap(field + dir, spec.fieldCount()); click(); }
  }
  function k2(dir) {
    if (!dir) return;
    if (field !== 0) spec.knob2(field, dir);
    click();
  }
  return finishBoot(k1, k2, redraw);
}
