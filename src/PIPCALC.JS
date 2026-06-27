(function() {
  // ============================================================
  //  PIP-CALC :: ENGINEER'S CALCULATOR                Pip-Boy 3000
  //  CALC (scientific) | GRAPH | CALCULUS | CIRC | CONV |
  //  CONST | VAC | TAPE      -- one shared f(x) + variable x
  //
  //  Memory note: only the CALC keypad + shared evaluator stay
  //  resident. EVERY other mode (GRAPH/CALCULUS/CIRC/CONV/CONST/
  //  REF/VAC/TAPE) lives in its own APPS/P*.JS file, loaded from
  //  the card only while open and freed on exit (one resident at a
  //  time). This keeps the launch footprint small enough to fit in
  //  device RAM (Espruino). Source lives in src/; APPS/ ships the
  //  minified build (see tools/build.js).
  // ============================================================

  var W = 480, H = 320;             // working coordinate space (tune to device)
  var FG = 3, MID = 2, DIM = 1, BG = 0; // palette indices: bright / mid / dim / black

  var MODES = ["CALC", "GRAPH", "CALCULUS", "CIRC", "CONV", "CONST", "REF", "VAC", "TAPE"];
  var mode = "CALC";
  var ans = 0, mem = 0, xVar = 0;
  var angleMode = "RAD";
  var shift = false, msg = "", returnMode = null;
  var theme = "GREEN", themeChanged = false;
  var field = 0;                    // selected field on every non-CALC screen (0 = MODE tab)

  // heavy modes loaded on demand from the card; only one resident at a time
  var HEAVY = { GRAPH: "PGRAPH.JS", CALCULUS: "PCALCULUS.JS", CIRC: "PCIRC.JS", CONV: "PCONV.JS", CONST: "PCONST.JS", REF: "PREF.JS", VAC: "PVAC.JS", TAPE: "PTAPE.JS" };
  var activeModule = null, activeName = null, loadErr = "";

  // ---------- helpers ----------
  function wrap(v, n) { return ((v % n) + n) % n; }
  function click() { try { Pip.audioBuiltin("COLUMN"); } catch (e) {} }
  function ok()    { try { Pip.audioBuiltin("OK"); } catch (e) {} }

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
  function fitLeft(s, n) {
    s = "" + s;
    return s.length > n ? "<" + s.slice(s.length - n + 1) : s;
  }
  function fitRight(s, n) {
    s = "" + s;
    return s.length > n ? s.slice(0, n - 1) + ">" : s;
  }
  function collect() {
    try {
      if (typeof global !== "undefined" && global.gc) global.gc();
    } catch (e) {}
  }
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
        var f = Math.min(1, i / 3) * dim;   // map 2-bit levels 0..3 -> black..full
        arr[i] = h.toColor(rr * f, gg * f, bb * f);
      }
      out.push(arr);
    }
    return out;
  }
  function applyTheme() {
    try {
      Pip.setPalette(theme === "AMBER" ? buildPalette(1, 0.6, 0) : buildPalette(0.1, 1, 0.25));
      if (theme === "AMBER") themeChanged = true;
    } catch (e) {}
  }

  // ============================================================
  //  EXPRESSION EVALUATOR (recursive descent over a token array)
  // ============================================================
  function fact(x) {
    if (x < 0 || x !== Math.round(x)) return NaN;
    if (x > 170) return Infinity;
    var r = 1; for (var k = 2; k <= x; k++) r *= k; return r;
  }
  function toRad(x) { return angleMode === "DEG" ? x * Math.PI / 180 : x; }
  function fromRad(x) { return angleMode === "DEG" ? x * 180 / Math.PI : x; }

  function applyFn(name, a) {
    switch (name) {
      case "sin":  return Math.sin(toRad(a));
      case "cos":  return Math.cos(toRad(a));
      case "tan":  return Math.tan(toRad(a));
      case "asin": return fromRad(Math.asin(a));
      case "acos": return fromRad(Math.acos(a));
      case "atan": return fromRad(Math.atan(a));
      case "sinh": return (Math.exp(a) - Math.exp(-a)) / 2;
      case "cosh": return (Math.exp(a) + Math.exp(-a)) / 2;
      case "tanh": var p = Math.exp(a), m = Math.exp(-a); return (p - m) / (p + m);
      case "asinh": return Math.log(a + Math.sqrt(a * a + 1));
      case "acosh": return Math.log(a + Math.sqrt(a * a - 1));
      case "atanh": return 0.5 * Math.log((1 + a) / (1 - a));
      case "ln":   return Math.log(a);
      case "log":  return Math.log(a) / Math.log(10);
      case "log2": return Math.log(a) / Math.log(2);
      case "exp":  return Math.exp(a);
      case "sqrt": return Math.sqrt(a);
      case "cbrt": return a < 0 ? -Math.pow(-a, 1/3) : Math.pow(a, 1/3);
      case "abs":  return Math.abs(a);
      case "fact": return fact(a);
      default: throw "fn?";
    }
  }
  function constVal(name) {
    switch (name) {
      case "pi":  return Math.PI;
      case "e":   return Math.E;
      case "phi": return 1.618033988749895;
      case "x":   return xVar;
      case "ans": return ans;
      case "mem": return mem;
      default: throw "id?";
    }
  }

  function tokenize(s) {
    var toks = [], i = 0, n = s.length;
    function dig(c) { return c >= "0" && c <= "9"; }
    function alp(c) { return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z"); }
    while (i < n) {
      var c = s[i];
      if (c === " ") { i++; continue; }
      if (dig(c) || c === ".") {
        var j = i + 1; while (j < n && (dig(s[j]) || s[j] === ".")) j++;
        toks.push({ t: "num", v: parseFloat(s.slice(i, j)) }); i = j; continue;
      }
      if (alp(c)) {
        var j2 = i + 1; while (j2 < n && alp(s[j2])) j2++;
        var nm = s.slice(i, j2).toLowerCase(); i = j2;
        var k = i; while (k < n && s[k] === " ") k++;
        toks.push(s[k] === "(" ? { t: "fn", v: nm } : { t: "const", v: nm });
        continue;
      }
      if (c === "(") { toks.push({ t: "lp" }); i++; continue; }
      if (c === ")") { toks.push({ t: "rp" }); i++; continue; }
      if (c === "!") { toks.push({ t: "fact" }); i++; continue; }
      if ("+-*/^".indexOf(c) >= 0) { toks.push({ t: "op", v: c }); i++; continue; }
      throw "char?";
    }
    return toks;
  }

  function evalToks(toks) {
    var pos = 0;
    function peek() { return toks[pos]; }
    function nx() { return toks[pos++]; }
    function eat(t) { var k = nx(); if (!k || k.t !== t) throw "syntax"; }
    function pE() { var v = pT();
      while (peek() && peek().t === "op" && (peek().v === "+" || peek().v === "-")) { var o = nx().v, r = pT(); v = o === "+" ? v + r : v - r; } return v; }
    function pT() { var v = pU();
      while (peek() && peek().t === "op" && (peek().v === "*" || peek().v === "/")) { var o = nx().v, r = pU(); v = o === "*" ? v * r : v / r; } return v; }
    function pU() { if (peek() && peek().t === "op" && (peek().v === "+" || peek().v === "-")) { var o = nx().v; return o === "-" ? -pU() : pU(); } return pF(); }
    function pF() { var b = pP(); if (peek() && peek().t === "op" && peek().v === "^") { nx(); return Math.pow(b, pU()); } return b; }
    function pP() { var v = pPrim(); while (peek() && peek().t === "fact") { nx(); v = fact(v); } return v; }
    function pPrim() {
      var k = peek(); if (!k) throw "syntax";
      if (k.t === "num")   { nx(); return k.v; }
      if (k.t === "const") { nx(); return constVal(k.v); }
      if (k.t === "fn")    { nx(); eat("lp"); var a = pE(); eat("rp"); return applyFn(k.v, a); }
      if (k.t === "lp")    { nx(); var v = pE(); eat("rp"); return v; }
      throw "syntax";
    }
    var res = pE();
    if (pos !== toks.length) throw "syntax";
    return res;
  }
  function evaluate(s) { return evalToks(tokenize(s)); }

  // ---------- shared f(x) ----------
  var fx = "sin(x)", fxToks = null;
  function setF(str) { fx = str; try { fxToks = tokenize(str); } catch (e) { fxToks = null; } }
  function fAt(x) { xVar = x; if (!fxToks) return NaN; try { return evalToks(fxToks); } catch (e) { return NaN; } }
  setF("sin(x)");

  // ============================================================
  //  CALCULATOR UI
  // ============================================================
  var expr = "", justEval = false, calcCur = { r: 0, c: 0 };
  var hist = [];

  var GRID = [
    ["2nd", "MODE", "DRG", "AC",  "DEL", ">f"],
    ["sin", "cos", "tan", "asin", "acos", "atan"],
    ["sinh","cosh","tanh","ln",   "log",  "exp"],
    ["sqrt","cbrt","abs", "pi",   "e",    "x"],
    ["7",   "8",   "9",   "(",    ")",    "^"],
    ["4",   "5",   "6",   "!",    "/",    "*"],
    ["1",   "2",   "3",   "+",    "-",    "EE"],
    ["0",   ".",   "=",   "Ans",  "MR",   "M+"]
  ];
  var ROWS = GRID.length, COLS = 6;
  var SHIFTLBL = { asin: "asinh", acos: "acosh", atan: "atanh", sqrt: "x^2", cbrt: "1/x", ln: "log2" };

  function insert(t)   { if (justEval) { expr = ""; justEval = false; } expr += t; }
  function insertOp(t) { justEval = false; expr += t; }
  function pushHist(s, v) { hist.unshift({ s: s, v: v }); if (hist.length > 6) hist.pop(); }

  function pressKey(label) {
    msg = "";
    if (shift && SHIFTLBL[label]) {
      shift = false;
      if (label === "asin") return insert("asinh(");
      if (label === "acos") return insert("acosh(");
      if (label === "atan") return insert("atanh(");
      if (label === "sqrt") return insertOp("^2");
      if (label === "cbrt") return insertOp("^-1");
      if (label === "ln")   return insert("log2(");
    }
    switch (label) {
      case "2nd":  shift = !shift; return;
      case "MODE": cycleMode(); return;
      case "DRG":  angleMode = angleMode === "RAD" ? "DEG" : "RAD"; return;
      case "AC":   expr = ""; justEval = false; return;
      case "DEL":  if (justEval) { expr = ""; justEval = false; } else expr = expr.slice(0, -1); return;
      case "=":    return doEval();
      case ">f":   setF(expr === "" ? fx : expr); justEval = false; msg = "f(x) set"; if (returnMode) { mode = returnMode; returnMode = null; } return;
      case "x":    return insert("x");
      case "Ans":  return insert("ans");
      case "MR":   return insert("mem");
      case "M+":   try { mem += evaluate(expr || "0"); msg = "M=" + fmt(mem); } catch (e) { msg = "ERR"; } return;
      case "pi":   return insert("pi");
      case "e":    return insert("e");
      case "EE":   return insertOp("*10^");
      case "sin": case "cos": case "tan": case "asin": case "acos": case "atan":
      case "sinh": case "cosh": case "tanh": case "ln": case "log": case "exp":
      case "sqrt": case "cbrt": case "abs":
        return insert(label + "(");
      default:
        if ("+-*/^!".indexOf(label) >= 0) return insertOp(label);
        return insert(label);
    }
  }
  function doEval() {
    if (!expr) return;
    try {
      var r = evaluate(expr);
      if (isNaN(r)) { msg = "MATH ERR"; return; }
      ans = r; pushHist(expr + " = " + fmt(r), r);
      expr = fmt(r); justEval = true;
    } catch (e) { msg = "SYNTAX ERR"; }
  }
  function safeEval() { try { return expr ? evaluate(expr) : 0; } catch (e) { return NaN; } }

  // ============================================================
  //  MODE / FIELD NAVIGATION
  // ============================================================
  function cycleMode()      { mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length]; resetFields(); }
  function cycleModeBy(dir) { mode = MODES[wrap(MODES.indexOf(mode) + dir, MODES.length)]; resetFields(); }
  function resetFields()    { shift = false; msg = ""; field = 0; returnMode = null; }
  function fieldCount() {
    if (HEAVY[mode]) { ensureModule(); return activeModule ? activeModule.fieldCount() : 1; }
    return 0;
  }
  function curField() { return field; }
  function setField(v) { field = v; }

  function changeField(dir) {     // knob2 rotate
    if (field === 0) { cycleModeBy(dir); return; }
    if (HEAVY[mode] && activeModule) activeModule.knob2(field, dir);
  }
  function modeAction() {         // knob1 press on a non-CALC screen
    if (HEAVY[mode] && activeModule) activeModule.press(field);
  }

  // ============================================================
  //  LAZY MODULE LOADER (defensive: tries several runtime APIs)
  //  Heavy modes are eval'd from the card on entry and dropped on
  //  exit so only one is ever resident. If the runtime cannot read
  //  files, the mode shows a notice instead of crashing the app.
  // ============================================================
  function readFileRaw(p) {
    var s;
    try { s = require("Storage").read(p); if (s) return "" + s; } catch (e) {}
    try { s = require("fs").readFileSync(p); if (s) return "" + s; } catch (e) {}
    try { var f = E.openFile(p, "r"); if (f) { s = f.read(0x7fffffff); f.close(); if (s) return "" + s; } } catch (e) {}
    return null;
  }
  function readModule(base) {
    var tries = [base, "APPS/" + base, "/" + base, "APPS/MODES/" + base, "USER/APPS/" + base], i, s;
    for (i = 0; i < tries.length; i++) { s = readFileRaw(tries[i]); if (s) return s; }
    return null;
  }
  function ensureModule() {
    if (HEAVY[mode]) {
      if (activeName !== mode) {
        var src, factory;
        activeModule = null; activeName = mode; loadErr = "";   // drop previous, mark target
        collect();
        src = readModule(HEAVY[mode]);
        if (!src) { loadErr = "file not found"; return; }
        try {
          factory = eval(src);
          src = null;
          collect();
          activeModule = factory(ctx);
          factory = null;
          collect();
        } catch (e) {
          src = null; factory = null; activeModule = null; loadErr = "" + e;
          collect();
        }
      }
    } else if (activeName && !returnMode) {
      // returnMode is set only during the f(x) edit detour to CALC; keep the
      // module (and its view state) resident until we return or change modes.
      activeModule = null; activeName = null; loadErr = "";      // leaving a heavy mode -> free it
      collect();
    }
  }

  // shared services handed to each loaded module
  var ctx = {
    W: W, H: H, FG: FG, MID: MID, DIM: DIM, BG: BG, h: h,
    wrap: wrap, fmt: fmt, convFmt: convFmt, rawFmt: rawFmt, sci: sci, eng: eng,
    fitLeft: fitLeft, fitRight: fitRight,
    beginScreen: function (t, s) { return beginScreen(t, s); },
    drawTab: function () { return drawTab(); },
    drawCorners: function (a, b, c, d, n) { return drawCorners(a, b, c, d, n); },
    panel: function (a, b, c, d, l) { return panel(a, b, c, d, l); },
    section: function (l, y) { return section(l, y); },
    footer: function (s) { return footer(s); },
    row: function (l, v, y, sel) { return row(l, v, y, sel); },
    miniRow: function (l, v, y) { return miniRow(l, v, y); },
    getAns: function () { return ans; },
    getMsg: function () { return msg; },
    setMsg: function (s) { msg = s; },
    insert: function (s) { insert(s); },
    setMode: function (m) { mode = m; },
    // shared f(x) services used by the GRAPH/CALCULUS modules
    fAt: function (x) { return fAt(x); },
    getFx: function () { return fx; },
    editFx: function (rm) { expr = fx; justEval = false; returnMode = rm; mode = "CALC"; msg = "edit f(x), >f to save"; },
    // TAPE services
    getHist: function () { return hist; },
    getTheme: function () { return theme; },
    toggleTheme: function () { theme = theme === "GREEN" ? "AMBER" : "GREEN"; applyTheme(); }
  };

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
  function beginScreen(title, status) {
    h.reset().clear().setColor(FG).setFont("Monofonto23");
    drawScanlines();
    h.setColor(DIM).drawRect(10, 6, W - 10, H - 8);
    drawCorners(10, 6, W - 10, H - 8, 18);
    h.setColor(FG).setFontAlign(-1, -1).drawString("ROBCO", 18, 6);
    h.setColor(DIM).setFontAlign(-1, -1).drawString("PIP-OS", 86, 6);
    h.setColor(FG).setFontAlign(0, -1).drawString(title, W / 2, 6);
    h.setFontAlign(1, -1).drawString(status || mode, W - 18, 6);
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
    var sel = curField() === 0;
    h.setColor(DIM).drawLine(16, 54, W - 16, 54);
    if (sel) { h.setColor(FG).fillRect(18, 32, W - 18, 52); h.setColor(BG); }
    else h.setColor(MID);
    h.setFontAlign(-1, -1).drawString("MODE", 26, 33);
    if (!sel) h.setColor(FG);
    h.setFontAlign(1, -1).drawString(mode, W - 26, 33);
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

  function drawCalc() {
    beginScreen("CALC", angleMode + (shift ? "  2nd" : ""));
    var shown = expr === "" ? "0" : expr;
    if (shown.length > 30) shown = "<" + shown.slice(shown.length - 29);
    panel(16, 32, W - 16, 78, "EVALUATOR");
    h.setColor(DIM).setFontAlign(-1, -1).drawString("EXPR", 28, 36);
    h.setColor(FG).setFontAlign(1, -1).drawString(shown, W - 28, 36);
    var pv = safeEval();
    h.setColor(DIM).drawLine(28, 56, W - 28, 56);
    h.setColor(DIM).setFontAlign(-1, -1).drawString("LIVE", 28, 58);
    h.setColor(FG).setFontAlign(1, -1).drawString(msg ? msg : (isNaN(pv) ? "" : "= " + fmt(pv)), W - 28, 58);
    h.setColor(DIM).drawLine(16, 84, W - 16, 84);
    var KX = 16, KY = 89, KW = (W - 32) / COLS, KH = 24;
    panel(16, 84, W - 16, 282, "");
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var lbl = GRID[r][c];
      if (shift && SHIFTLBL[lbl]) lbl = SHIFTLBL[lbl];
      if (lbl === "DRG") lbl = angleMode;
      var x0 = KX + c * KW, y0 = KY + r * KH;
      if (calcCur.r === r && calcCur.c === c) { h.setColor(FG).fillRect(x0 + 2, y0 + 2, x0 + KW - 4, y0 + KH - 4); h.setColor(BG); } else h.setColor(FG);
      h.setFontAlign(0, 0).drawString(lbl, x0 + KW / 2, y0 + KH / 2);
    }
    footer("WHEEL:MOVE  PRESS:ENTER");
  }

  function drawModuleError() {
    beginScreen(mode, "LOAD");
    drawTab();
    h.setColor(FG).setFontAlign(0, -1).drawString("MODULE UNAVAILABLE", W / 2, 96);
    h.setColor(MID).setFontAlign(0, -1).drawString(HEAVY[mode] || "", W / 2, 130);
    h.setColor(MID).setFontAlign(0, -1).drawString(fitRight(loadErr || "not loaded", 34), W / 2, 158);
    h.setColor(FG).setFontAlign(0, -1).drawString("turn THUMB to switch mode", W / 2, 200);
    footer("WHEEL:MODE  THUMB:CHANGE MODE");
  }

  function draw() {
    ensureModule();
    if (mode === "CALC") drawCalc();
    else if (activeModule) activeModule.draw(field);
    else drawModuleError();
  }

  // ============================================================
  //  INPUT HANDLERS
  // ============================================================
  function onKnob1(dir) {
    if (mode === "CALC") {
      if (dir === 0) { pressKey(GRID[calcCur.r][calcCur.c]); ok(); }
      else { calcCur.r = wrap(calcCur.r + dir, ROWS); click(); }
    } else {
      if (dir === 0) { modeAction(); ok(); }
      else { setField(wrap(curField() + dir, fieldCount())); click(); }
    }
    draw();
  }
  function onKnob2(dir) {
    if (!dir) return;
    if (mode === "CALC") calcCur.c = wrap(calcCur.c + dir, COLS);
    else changeField(dir);
    click(); draw();
  }

  Pip.on("knob1", onKnob1);
  Pip.on("knob2", onKnob2);
  draw();
  collect();

  return {
    id: "PIPCALC",
    notDefault: true,
    fullscreen: true,
    remove: function() {
      activeModule = null; activeName = null;
      Pip.removeListener("knob1", onKnob1);
      Pip.removeListener("knob2", onKnob2);
      if (themeChanged) { try { Pip.setPalette(buildPalette(0.1, 1, 0.25)); } catch (e) {} } // restore green
      collect();
    }
  };
})
