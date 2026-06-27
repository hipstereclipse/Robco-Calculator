(function() {
  // ============================================================
  //  PIP-CALC :: ENGINEER'S CALCULATOR                Pip-Boy 3000
  //  CALC (scientific) | GRAPH | CALCULUS | CIRC | CONV |
  //  CONST | VAC | TAPE      -- one shared f(x) + variable x
  // ============================================================

  var W = 480, H = 320;     // working coordinate space (tune to device)
  var FG = 3, BG = 0;       // palette indices: bright fg / black (verify)

  var MODES = ["CALC", "GRAPH", "CALCULUS", "CIRC", "CONV", "CONST", "REF", "VAC", "TAPE"];
  var mode = "CALC";
  var ans = 0, mem = 0, xVar = 0;
  var angleMode = "RAD";
  var shift = false, msg = "", returnMode = null;
  var theme = "GREEN", themeChanged = false;

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
  function convText(n, unit) {
    var s = convFmt(n);
    if ((s + " " + unit).length > 24) s = sci(n, 4);
    return s + " " + unit;
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

  function deriv(x0) { var h2 = 1e-5 * (Math.abs(x0) + 1); return (fAt(x0 + h2) - fAt(x0 - h2)) / (2 * h2); }
  function secondDeriv(x0) { var h2 = 1e-4 * (Math.abs(x0) + 1); return (fAt(x0 + h2) - 2 * fAt(x0) + fAt(x0 - h2)) / (h2 * h2); }
  function integ(a, b) { var n = 1000, hh = (b - a) / n, s = fAt(a) + fAt(b); for (var i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * fAt(a + i * hh); return s * hh / 3; }
  function root(x0) { var x = x0; for (var i = 0; i < 40; i++) { var f = fAt(x), d = deriv(x); if (!isFinite(d) || d === 0) break; var nv = x - f / d; if (Math.abs(nv - x) < 1e-10) { x = nv; break; } x = nv; } return x; }
  function rootSpan(x0, span) {
    var r = root(x0);
    if (isFinite(r) && Math.abs(fAt(r)) < 1e-6) return r;
    var s = Math.abs(span); if (!isFinite(s) || s === 0) s = 1;
    var ax = x0 - s, ay = fAt(ax), bx = ax, by = ay, best = ax, bestA = Math.abs(ay), x, y, t, mid, my;
    for (var i = 1; i <= 80; i++) {
      x = x0 - s + 2 * s * i / 80; y = fAt(x);
      if (isFinite(y) && Math.abs(y) < bestA) { best = x; bestA = Math.abs(y); }
      if (isFinite(ay) && isFinite(y) && ay * y <= 0) {
        bx = x; by = y;
        for (var j = 0; j < 50; j++) {
          mid = (ax + bx) / 2; my = fAt(mid);
          if (!isFinite(my)) break;
          if (ay * my <= 0) { bx = mid; by = my; } else { ax = mid; ay = my; }
        }
        return (ax + bx) / 2;
      }
      ax = x; ay = y;
    }
    return root(best);
  }
  function critical(x0) {
    var x = x0;
    for (var i = 0; i < 35; i++) {
      var d = deriv(x), dd = secondDeriv(x);
      if (!isFinite(d) || !isFinite(dd) || dd === 0) break;
      var nx = x - d / dd;
      if (!isFinite(nx)) break;
      if (Math.abs(nx - x) < 1e-10) { x = nx; break; }
      x = nx;
    }
    return x;
  }

  // ============================================================
  //  CALCULATOR UI
  // ============================================================
  var expr = "", justEval = false, calcCur = { r: 0, c: 0 };
  var hist = [], tapeSel = 0;

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
  //  UNIT CONVERTER
  // ============================================================
  var CATS = [
    { name: "PRESSURE", u: ["Pa","kPa","MPa","GPa","hPa","bar","mbar","ubar","atm","Torr","mTorr","psi","ksi","psf","inHg","mmHg","cmHg","inH2O","ftH2O","cmH2O","mmH2O","kgf/cm2","dyn/cm2"],
      f: [1,1e3,1e6,1e9,100,1e5,100,0.1,101325,133.322368,0.133322368,6894.757293,6.894757293e6,47.88025898,3386.389,133.322368,1333.22368,249.0889,2989.06692,98.0665,9.80665,98066.5,0.1] },
    { name: "LENGTH", u: ["m","km","cm","mm","um","nm","pm","A","mi","yd","ft","in","nmi","fur","chain","rod","ly","pc","AU"],
      f: [1,1e3,1e-2,1e-3,1e-6,1e-9,1e-12,1e-10,1609.344,0.9144,0.3048,0.0254,1852,201.168,20.1168,5.0292,9.4607304725808e15,3.0856775814913673e16,1.495978707e11] },
    { name: "MASS", u: ["kg","g","mg","ug","ng","pg","t","tonUS","tonUK","lb","oz","st","gr","slug","ct","Da","amu"],
      f: [1,1e-3,1e-6,1e-9,1e-12,1e-15,1000,907.18474,1016.0469088,0.45359237,0.028349523125,6.35029318,6.479891e-5,14.59390294,2e-4,1.6605390666e-27,1.6605390666e-27] },
    { name: "COOK MASS", u: ["g","kg","mg","oz","lb","ozLbl","butterStk","tbspButter","cupButter","cupFlour~","cupSugar~","cupBrown~"],
      f: [1e-3,1,1e-6,0.028349523125,0.45359237,0.028,0.1133980925,0.0141747615625,0.226796185,0.12,0.2,0.22] },
    { name: "AREA", u: ["m2","km2","cm2","mm2","um2","ha","acre","ft2","in2","yd2","mi2","rood"],
      f: [1,1e6,1e-4,1e-6,1e-12,1e4,4046.8564224,0.09290304,6.4516e-4,0.83612736,2589988.110336,1011.7141056] },
    { name: "VOLUME", u: ["m3","L","mL","uL","cm3","mm3","ft3","in3","yd3","galUS","qtUS","ptUS","cupUS","flozUS","tbspUS","tspUS","galUK","qtUK","ptUK","flozUK","bbl"],
      f: [1,1e-3,1e-6,1e-9,1e-6,1e-9,0.028316846592,1.6387064e-5,0.764554857984,0.003785411784,0.000946352946,0.000473176473,0.0002365882365,2.95735295625e-5,1.478676478125e-5,4.92892159375e-6,0.00454609,0.0011365225,0.00056826125,2.84130625e-5,0.158987294928] },
    { name: "COOK VOL", u: ["mL","L","tsp","tbsp","flozLbl","cupLbl","flozUS","cupUS","cupMet","ptUS","qtUS","galUS","flozUK","ptUK","qtUK","galUK","pinch","dash","butterStk"],
      f: [1e-6,1e-3,5e-6,15e-6,30e-6,240e-6,2.95735295625e-5,0.0002365882365,0.00025,0.000473176473,0.000946352946,0.003785411784,2.84130625e-5,0.00056826125,0.0011365225,0.00454609,0.3125e-6,0.625e-6,0.00011829411825] },
    { name: "TEMP", u: ["C","F","K","R"], temp: true },
    { name: "ENERGY", u: ["J","kJ","MJ","GJ","mJ","uJ","erg","cal","kcal","Wh","kWh","MWh","eV","keV","MeV","GeV","BTU","therm","ftlb","tonTNT"],
      f: [1,1e3,1e6,1e9,1e-3,1e-6,1e-7,4.184,4184,3600,3.6e6,3.6e9,1.602176634e-19,1.602176634e-16,1.602176634e-13,1.602176634e-10,1055.05585,105480400,1.3558179483,4.184e9] },
    { name: "POWER", u: ["W","mW","kW","MW","GW","hp","hpM","BTU/h","ftlb/s","cal/s","kcal/h","tonR"],
      f: [1,1e-3,1e3,1e6,1e9,745.6998715823,735.49875,0.29307107,1.3558179483,4.184,1.162222222,3516.8528420667] },
    { name: "FORCE", u: ["N","mN","kN","MN","dyn","kgf","gf","lbf","ozf","pdl"],
      f: [1,1e-3,1e3,1e6,1e-5,9.80665,0.00980665,4.4482216153,0.27801385095378125,0.138254954376] },
    { name: "TIME", u: ["s","ms","us","ns","ps","min","h","day","wk","yr","mo"],
      f: [1,1e-3,1e-6,1e-9,1e-12,60,3600,86400,604800,31557600,2629800] },
    { name: "SPEED", u: ["m/s","km/h","mph","ft/s","ft/min","in/s","kn","mach","c"],
      f: [1,0.2777777777777778,0.44704,0.3048,0.00508,0.0254,0.514444444,340.29,299792458] },
    { name: "DATA", u: ["bit","B","nib","kb","kB","Kib","KiB","Mb","MB","Mib","MiB","Gb","GB","Gib","GiB","Tb","TB","Tib","TiB","Pb","PB","Pib","PiB"],
      f: [0.125,1,0.5,125,1000,128,1024,125000,1000000,131072,1048576,125000000,1000000000,134217728,1073741824,125000000000,1000000000000,137438953472,1099511627776,125000000000000,1000000000000000,140737488355328,1125899906842624] },
    { name: "ANGLE", u: ["rad","mrad","urad","deg","grad","turn","arcmin","arcsec","mas","uas"],
      f: [1,1e-3,1e-6,Math.PI/180,Math.PI/200,2*Math.PI,Math.PI/10800,Math.PI/648000,Math.PI/648000000,Math.PI/648000000000] },
    { name: "FREQ", u: ["Hz","mHz","kHz","MHz","GHz","THz","rpm","cpm","BPM"],
      f: [1,1e-3,1e3,1e6,1e9,1e12,1/60,1/60,1/60] },
    { name: "ACCEL", u: ["m/s2","cm/s2","mm/s2","ft/s2","in/s2","g","Gal"],
      f: [1,0.01,0.001,0.3048,0.0254,9.80665,0.01] },
    { name: "TORQUE", u: ["N m","mN m","kN m","lbf ft","lbf in","ozf in","kgf m"],
      f: [1,0.001,1000,1.3558179483314004,0.1129848290276167,0.007061551814226044,9.80665] },
    { name: "DENSITY", u: ["kg/m3","g/cm3","g/mL","kg/L","lb/ft3","lb/in3","lb/gal","slug/ft3"],
      f: [1,1000,1000,1000,16.01846337,27679.90471,119.8264273,515.3788184] },
    { name: "FLOW", u: ["m3/s","L/s","L/min","mL/min","m3/h","ft3/s","cfm","gal/min","gal/h","bbl/day"],
      f: [1,1e-3,1e-3/60,1e-6/60,1/3600,0.028316846592,0.028316846592/60,0.003785411784/60,0.003785411784/3600,0.158987294928/86400] },
    { name: "CHARGE", u: ["C","mC","uC","nC","pC","Ah","mAh","e"],
      f: [1,1e-3,1e-6,1e-9,1e-12,3600,3.6,1.602176634e-19] },
    { name: "RESIST", u: ["ohm","mohm","kohm","Mohm","Gohm"],
      f: [1,1e-3,1e3,1e6,1e9] },
    { name: "CAP", u: ["F","mF","uF","nF","pF"],
      f: [1,1e-3,1e-6,1e-9,1e-12] },
    { name: "INDUCT", u: ["H","mH","uH","nH"],
      f: [1,1e-3,1e-6,1e-9] },
    { name: "MAG B", u: ["T","mT","uT","nT","G","mG"],
      f: [1,1e-3,1e-6,1e-9,1e-4,1e-7] },
    // Radiation categories stay separate: activity, absorbed dose, equivalent dose, exposure, and rates are not interchangeable.
    { name: "RAD ACT", u: ["Bq","kBq","MBq","GBq","TBq","Ci","mCi","uCi","nCi","pCi","dps","dpm"],
      f: [1,1e3,1e6,1e9,1e12,3.7e10,3.7e7,3.7e4,37,0.037,1,1/60] },
    { name: "RAD ABS", u: ["Gy","mGy","uGy","nGy","cGy","rad","mrad","urad","J/kg","erg/g"],
      f: [1,1e-3,1e-6,1e-9,1e-2,1e-2,1e-5,1e-8,1,1e-4] },
    { name: "RAD EQ", u: ["Sv","mSv","uSv","nSv","rem","mrem","urem"],
      f: [1,1e-3,1e-6,1e-9,1e-2,1e-5,1e-8] },
    { name: "RAD EXP", u: ["C/kg","mC/kg","uC/kg","R","mR","uR"],
      f: [1,1e-3,1e-6,2.58e-4,2.58e-7,2.58e-10] },
    { name: "RAD EQRATE", u: ["Sv/s","Sv/h","mSv/h","uSv/h","nSv/h","rem/h","mrem/h","urem/h","mSv/yr","uSv/yr"],
      f: [1,1/3600,1e-3/3600,1e-6/3600,1e-9/3600,1e-2/3600,1e-5/3600,1e-8/3600,1e-3/31557600,1e-6/31557600] },
    { name: "RAD ABSRATE", u: ["Gy/s","Gy/h","mGy/h","uGy/h","rad/h","mrad/h","cGy/min"],
      f: [1,1/3600,1e-3/3600,1e-6/3600,1e-2/3600,1e-5/3600,1e-2/60] },
    { name: "RAD EXPRATE", u: ["C/kg/s","C/kg/h","R/h","mR/h","uR/h"],
      f: [1,1/3600,2.58e-4/3600,2.58e-7/3600,2.58e-10/3600] }
  ];
  var convCat = 6, convFrom = 0, convTo = 5, convVal = 240, convField = 0;
  function convResult() {
    var c = CATS[convCat];
    if (c.temp) {
      var from = c.u[convFrom], to = c.u[convTo], cel;
      if (from === "C") cel = convVal; else if (from === "F") cel = (convVal - 32) * 5/9; else if (from === "K") cel = convVal - 273.15; else cel = (convVal - 491.67) * 5/9;
      if (to === "C") return cel; else if (to === "F") return cel * 9/5 + 32; else if (to === "K") return cel + 273.15; else return (cel + 273.15) * 9/5;
    }
    return convVal * c.f[convFrom] / c.f[convTo];
  }

  // ============================================================
  //  CONSTANTS: filtered math, SI physics, unit factors, space, kitchen
  // ============================================================
  var CONST_GROUPS = ["ALL","MATH","PHYS","ELEC","THERM","UNIT","MATL","EARTH","SPACE","COOK"];
  var CONST_SEARCHES = ["ALL","pi","log","grav","light","charge","mass","energy","press","length","temp","water","air","space","cook","planck","gas"];
  var CONSTS = [
    ["pi","circle ratio",Math.PI,"","MATH","circle trig"], ["tau","2*pi",2*Math.PI,"","MATH","circle trig"],
    ["e","Euler number",Math.E,"","MATH","exp log"], ["phi","golden ratio",1.618033988749895,"","MATH","geometry"],
    ["sqrt2","root 2",1.4142135623730951,"","MATH","geometry"], ["ln2","natural log 2",0.6931471805599453,"","MATH","log"],
    ["ln10","natural log 10",2.302585092994046,"","MATH","log"], ["log2e","log2(e)",1.4426950408889634,"","MATH","log"],
    ["c","speed of light",299792458,"m/s","PHYS","light relativity"], ["G","gravitation",6.67430e-11,"m3/kg/s2","PHYS","gravity grav mass"],
    ["h","Planck",6.62607015e-34,"J s","PHYS","planck quantum"], ["hbar","red. Planck",1.054571817e-34,"J s","PHYS","planck quantum"],
    ["k","Boltzmann",1.380649e-23,"J/K","THERM","gas thermal"], ["NA","Avogadro",6.02214076e23,"1/mol","PHYS","mole gas"],
    ["R","gas const",8.31446261815324,"J/mol/K","THERM","gas"], ["F","Faraday",96485.33212331,"C/mol","ELEC","charge electrochem"],
    ["qe","elem. charge",1.602176634e-19,"C","ELEC","charge electron"], ["me","electron mass",9.1093837139e-31,"kg","PHYS","mass electron"],
    ["mp","proton mass",1.67262192595e-27,"kg","PHYS","mass proton"], ["mn","neutron mass",1.67492750056e-27,"kg","PHYS","mass neutron"],
    ["amu","atomic mass",1.66053906892e-27,"kg","PHYS","mass atom"], ["alpha","fine struct",0.0072973525643,"","PHYS","charge"],
    ["eps0","vac permitt",8.8541878188e-12,"F/m","ELEC","field capacitance vacuum"], ["mu0","vac permeab",1.25663706127e-6,"H/m","ELEC","field inductance vacuum"],
    ["Z0","vac impedance",376.730313412,"ohm","ELEC","vacuum wave"], ["sigma","Stefan-Boltz",5.670374419e-8,"W/m2/K4","THERM","radiation heat"],
    ["bWien","Wien displ",0.002897771955,"m K","THERM","radiation light"], ["Ry","Rydberg",10973731.568157,"1/m","PHYS","atomic light"],
    ["g0","std gravity",9.80665,"m/s2","EARTH","gravity accel"], ["atm","std atmos",101325,"Pa","UNIT","pressure press air"],
    ["Torr","one torr",133.32236842105263,"Pa","UNIT","pressure press"], ["psi","one psi",6894.757293168361,"Pa","UNIT","pressure press"],
    ["cal","thermo cal",4.184,"J","UNIT","energy heat"], ["BTU","IT Btu",1055.05585,"J","UNIT","energy heat"],
    ["eV","electron volt",1.602176634e-19,"J","UNIT","energy charge"], ["Wh","watt hour",3600,"J","UNIT","energy power"],
    ["in","inch",0.0254,"m","UNIT","length"], ["ft","foot",0.3048,"m","UNIT","length"],
    ["yd","yard",0.9144,"m","UNIT","length"], ["mi","mile",1609.344,"m","UNIT","length"],
    ["nmi","naut mile",1852,"m","UNIT","length space"], ["acre","acre",4046.8564224,"m2","UNIT","area land"],
    ["lb","pound mass",0.45359237,"kg","UNIT","mass"], ["oz","ounce mass",0.028349523125,"kg","UNIT","mass cook"],
    ["galUS","US gallon",0.003785411784,"m3","UNIT","volume cook"], ["cupUS","US cup",0.0002365882365,"m3","COOK","volume"],
    ["cupLbl","label cup",0.00024,"m3","COOK","volume"], ["tbsp","label tbsp",0.000015,"m3","COOK","volume"],
    ["tsp","label tsp",0.000005,"m3","COOK","volume"], ["cupMet","metric cup",0.00025,"m3","COOK","volume"],
    ["rhoW","water dens 20C",998.2071,"kg/m3","MATL","water density"], ["rhoAir","air dens 20C",1.2041,"kg/m3","MATL","air density"],
    ["sndAir","sound air 20C",343.2,"m/s","MATL","air sound"], ["Tice","water freeze",273.15,"K","MATL","water temp"],
    ["Tboil","water boil",373.15,"K","MATL","water temp"], ["STPmol","molar vol STP",0.02241396954,"m3/mol","THERM","gas air"],
    ["earthR","Earth radius",6371008.8,"m","EARTH","space length"], ["earthM","Earth mass",5.9722e24,"kg","EARTH","space mass"],
    ["earthMu","Earth GM",3.986004418e14,"m3/s2","EARTH","space gravity grav"], ["moonR","Moon radius",1737400,"m","SPACE","length"],
    ["moonM","Moon mass",7.342e22,"kg","SPACE","mass"], ["sunM","Solar mass",1.98847e30,"kg","SPACE","mass"],
    ["AU","astro unit",149597870700,"m","SPACE","length"], ["ly","light year",9.4607304725808e15,"m","SPACE","length light"],
    ["pc","parsec",3.0856775814913673e16,"m","SPACE","length"]
  ];
  var constGroup = 0, constSearch = 0, constSel = 0, constField = 0;
  function constGroupOf(e) { return e[4] || "UNIT"; }
  function constHay(e) { return (e[0] + " " + e[1] + " " + e[3] + " " + constGroupOf(e) + " " + (e[5] || "")).toLowerCase(); }
  function constMatch(e) {
    var g = CONST_GROUPS[constGroup], q = CONST_SEARCHES[constSearch].toLowerCase();
    if (g !== "ALL" && constGroupOf(e) !== g) return false;
    return q === "all" || constHay(e).indexOf(q) >= 0;
  }
  function constList() {
    var out = [];
    for (var i = 0; i < CONSTS.length; i++) if (constMatch(CONSTS[i])) out.push(i);
    return out;
  }
  function constEnsure() {
    var list = constList();
    if (!list.length) return list;
    if (list.indexOf(constSel) < 0) constSel = list[0];
    return list;
  }
  function constMove(dir) {
    var list = constEnsure(), p;
    if (!list.length) return;
    p = list.indexOf(constSel);
    constSel = list[wrap(p + dir, list.length)];
  }
  function constValueText(e) {
    return fitLeft(fmt(e[2]) + (e[3] ? " " + e[3] : ""), 26);
  }
  function constCurrent() {
    var list = constEnsure();
    return list.length ? CONSTS[constSel] : null;
  }

  // ============================================================
  //  REFERENCE RULES: formulas, approximations, geometry cards
  // ============================================================
  var REF_SECTIONS = [
    { name: "LOG/EXP", items: [
      { name: "LOG LAWS", lines: ["ln(ab)=ln a+ln b", "ln(a/b)=ln a-ln b", "ln(a^r)=r ln a", "log_b(a)=ln(a)/ln(b)", "a^x=e^(x ln a)"] },
      { name: "EXP LAWS", lines: ["e^(a+b)=e^a e^b", "a^m a^n=a^(m+n)", "(a^m)^n=a^(mn)", "a^-n=1/a^n", "sqrt(a)=a^(1/2)"] },
      { name: "HYPERBOLIC", lines: ["sinh x=(e^x-e^-x)/2", "cosh x=(e^x+e^-x)/2", "cosh^2 x-sinh^2 x=1", "tanh x=sinh x/cosh x"] }
    ] },
    { name: "ALG/DIV", items: [
      { name: "FRACTIONS", lines: ["a/b+c/d=(ad+bc)/bd", "(a/b)(c/d)=ac/bd", "(a/b)/(c/d)=ad/bc", "a/(bc)=(a/b)/c", "(a+b)/c=a/c+b/c"] },
      { name: "QUADRATIC", lines: ["ax^2+bx+c=0", "x=(-b+-sqrt(b^2-4ac))/(2a)", "vertex x=-b/(2a)", "sum roots=-b/a", "product roots=c/a"] },
      { name: "COMPLEX", lines: ["i^2=-1", "(a+bi)(c+di)=(ac-bd)+(ad+bc)i", "|a+bi|=sqrt(a^2+b^2)", "e^(i t)=cos t+i sin t"] }
    ] },
    { name: "DERIV", items: [
      { name: "RULES", lines: ["d(uv)=u'v+uv'", "d(u/v)=(u'v-uv')/v^2", "d f(g)=f'(g)g'", "d x^n=n x^(n-1)", "d ln u=u'/u"] },
      { name: "COMMON", lines: ["d sin x=cos x", "d cos x=-sin x", "d tan x=sec^2 x", "d e^x=e^x", "d a^x=a^x ln a"] },
      { name: "GRADIENT", lines: ["grad f=<df/dx,df/dy,df/dz>", "div F=dFx/dx+dFy/dy+dFz/dz", "curl F=del x F", "Laplacian f=div grad f"] }
    ] },
    { name: "INTEG", items: [
      { name: "RULES", lines: ["int x^n dx=x^(n+1)/(n+1)", "int 1/x dx=ln|x|", "int e^x dx=e^x", "int a^x dx=a^x/ln a", "int f'(x)/f(x) dx=ln|f|"] },
      { name: "METHODS", lines: ["substitution: u=g(x)", "by parts: int u dv=uv-int v du", "even: int_-a^a f=2 int_0^a f", "odd: int_-a^a f=0"] },
      { name: "TRIG INT", lines: ["int sin x dx=-cos x", "int cos x dx=sin x", "int sec^2 x dx=tan x", "int 1/(1+x^2) dx=atan x"] }
    ] },
    { name: "SERIES", items: [
      { name: "MACLAURIN", lines: ["e^x=1+x+x^2/2!+...", "sin x=x-x^3/3!+x^5/5!-...", "cos x=1-x^2/2!+x^4/4!-...", "ln(1+x)=x-x^2/2+x^3/3-...", "|x|<1 where needed"] },
      { name: "APPROX", lines: ["1/(1-x)=1+x+x^2+...", "sqrt(1+x)=1+x/2-x^2/8+...", "(1+x)^a=1+ax+a(a-1)x^2/2+...", "small x: sin x~x, tan x~x"] },
      { name: "NUMERIC", lines: ["trap area=h(y0/2+sum yi+yn/2)", "Simpson=h/3(y0+4y1+2y2+...+yn)", "Newton: x1=x-f/f'", "linear interp y=y0+(x-x0)m"] }
    ] },
    { name: "GEOM2D", items: [
      { name: "RECTANGLE", shape: "RECT", lines: ["A=w h", "P=2(w+h)", "diag=sqrt(w^2+h^2)", "I_x=w h^3/12"] },
      { name: "TRIANGLE", shape: "TRI", lines: ["A=b h/2", "P=a+b+c", "c^2=a^2+b^2-2ab cos C", "centroid=2/3 median"] },
      { name: "CIRCLE", shape: "CIRCLE", lines: ["A=pi r^2", "C=2 pi r", "arc=r theta", "sector=theta r^2/2"] },
      { name: "ELLIPSE", shape: "ELLIPSE", lines: ["A=pi a b", "x^2/a^2+y^2/b^2=1", "c^2=a^2-b^2", "P~2pi sqrt((a^2+b^2)/2)"] }
    ] },
    { name: "GEOM3D", items: [
      { name: "BOX", shape: "BOX", lines: ["V=l w h", "S=2(lw+lh+wh)", "diag=sqrt(l^2+w^2+h^2)", "mass=rho V"] },
      { name: "CYLINDER", shape: "CYL", lines: ["V=pi r^2 h", "side=2 pi r h", "S=2 pi r(r+h)", "I_axis=1/2 m r^2"] },
      { name: "CONE", shape: "CONE", lines: ["V=pi r^2 h/3", "slant=sqrt(r^2+h^2)", "side=pi r slant", "S=pi r(r+slant)"] },
      { name: "SPHERE", shape: "SPHERE", lines: ["V=4/3 pi r^3", "S=4 pi r^2", "great circle=2 pi r", "I_solid=2/5 m r^2"] }
    ] },
    { name: "ENG", items: [
      { name: "VECTORS", lines: ["dot: a.b=|a||b|cos t", "cross: |axb|=|a||b|sin t", "proj_b a=(a.b/|b|^2)b", "work=F.d", "torque=r x F"] },
      { name: "ELECTRICAL", lines: ["V=I R", "P=V I=I^2 R=V^2/R", "Xc=1/(2 pi f C)", "Xl=2 pi f L", "f0=1/(2 pi sqrt(LC))"] },
      { name: "MECHANICS", lines: ["F=m a", "KE=1/2 m v^2", "PE=m g h", "p=m v", "tau=I alpha"] }
    ] }
  ];
  var refSection = 0, refItem = 0, refField = 0;
  function refCurSec() { return REF_SECTIONS[refSection]; }
  function refCurItem() { return refCurSec().items[refItem]; }

  // ============================================================
  //  VACUUM TOOLS (N2): mean free path, density, Knudsen, regime
  // ============================================================
  var vacP = 1, vacT = 293.15, vacD = 3.7e-10, vacL = 0.1, vacField = 0;
  var KB = 1.380649e-23, MN2 = 4.6517e-26;
  function meanFreePath() { return KB * vacT / (Math.sqrt(2) * Math.PI * vacD * vacD * vacP); }
  function numberDensity() { return vacP / (KB * vacT); }
  function meanSpeed() { return Math.sqrt(8 * KB * vacT / (Math.PI * MN2)); }

  // ============================================================
  //  CIRCUIT CALCULATORS (data-driven)
  // ============================================================
  var COLORS = ["blk","brn","red","org","yel","grn","blu","vio","gry","wht"];
  var MULTS = ["x.01","x.1","x1","x10","x100","x1k","x10k","x100k","x1M","x10M"];
  var MULTF = [0.01,0.1,1,10,100,1000,10000,100000,1000000,10000000];
  var TOLC = ["brn","red","grn","blu","vio","gry","gld","sil"];
  var TOLV = [1,2,0.5,0.25,0.1,0.05,5,10];
  function par2(a, b) { return a * b / (a + b); }
  function awgArea(n) { var d = 0.127 * Math.pow(92, (36 - n) / 39); return Math.PI / 4 * d * d; }
  var CIRC_TOOLS = [
    { name: "DIVIDER LOAD", in: [{ l:"Vin", u:"V", v:5, step:0.1 }, { l:"Rtop", u:"ohm", v:10000, dec:1 }, { l:"Rbot", u:"ohm", v:10000, dec:1 }, { l:"Load", u:"ohm", v:100000, dec:1 }],
      out: function(vin, rt, rb, rl) { var open = vin * rb / (rt + rb), eq = par2(rb, rl), v = vin * eq / (rt + eq); return [["V open", open, "V"], ["V load", v, "V"], ["I load", v / rl, "A"], ["Err", (open - v) / open * 100, "%"]]; } },
    { name: "OHM+POWER", in: [{ l:"V", u:"V", v:5, step:0.1 }, { l:"R", u:"ohm", v:1000, dec:1 }],
      out: function(V, R) { var I = V / R; return [["I", I, "A"], ["I mA", I * 1000, "mA"], ["P", V * I, "W"], ["R/V", R / V, "ohm/V"]]; } },
    { name: "R NETWORK", in: [{ l:"R1", u:"ohm", v:1000, dec:1 }, { l:"R2", u:"ohm", v:2200, dec:1 }, { l:"R3", u:"ohm", v:4700, dec:1 }],
      out: function(a, b, c) { var rs = a + b + c, rp = 1 / (1/a + 1/b + 1/c); return [["Series", rs, "ohm"], ["Parallel", rp, "ohm"], ["I@5V", 5 / rp, "A"], ["G", 1 / rp, "S"]]; } },
    { name: "LED LIMIT", in: [{ l:"Vs", u:"V", v:5, step:0.1 }, { l:"Vf", u:"V", v:2, step:0.1 }, { l:"I", u:"mA", v:20, step:1 }, { l:"Count", u:"", v:1, intg:1, min:1, max:10 }],
      out: function(vs, vf, i, n) { var head = vs - vf * n, a = i / 1000; if (head <= 0) return [["Headroom", "LOW VS", ""], ["Need >", vf * n, "V"], ["I", i, "mA"], ["Count", n, "LED"]]; return [["R", head / a, "ohm"], ["P res", head * a, "W"], ["P LED", vf * n * a, "W"], ["Margin", head, "V"]]; } },
    { name: "RC STEP/FILT", in: [{ l:"R", u:"ohm", v:10000, dec:1 }, { l:"C", u:"F", v:1e-6, dec:1 }],
      out: function(r, c) { var tau = r * c; return [["tau", tau, "s"], ["fc", 1/(2*Math.PI*tau), "Hz"], ["10-90", 2.2*tau, "s"], ["1% set", 4.6*tau, "s"]]; } },
    { name: "RL STEP/FILT", in: [{ l:"R", u:"ohm", v:100, dec:1 }, { l:"L", u:"H", v:1e-3, dec:1 }],
      out: function(r, l) { var tau = l / r; return [["tau", tau, "s"], ["fc", r/(2*Math.PI*l), "Hz"], ["I@5V", 5/r, "A"], ["E@5V", 0.5*l*Math.pow(5/r,2), "J"]]; } },
    { name: "LC TANK", in: [{ l:"L", u:"H", v:1e-3, dec:1 }, { l:"C", u:"F", v:1e-6, dec:1 }, { l:"Rser", u:"ohm", v:1, dec:1 }],
      out: function(l, c, r) { var f = 1/(2*Math.PI*Math.sqrt(l*c)), xl = 2*Math.PI*f*l, q = xl/r; return [["f0", f, "Hz"], ["X", xl, "ohm"], ["Q", q, ""], ["BW", f/q, "Hz"]]; } },
    { name: "REACTANCE", in: [{ l:"f", u:"Hz", v:1000, dec:1 }, { l:"C", u:"F", v:1e-6, dec:1 }, { l:"L", u:"H", v:1e-3, dec:1 }],
      out: function(f, c, l) { var xc = 1/(2*Math.PI*f*c), xl = 2*Math.PI*f*l; return [["Xc", xc, "ohm"], ["Xl", xl, "ohm"], ["Xl-Xc", xl-xc, "ohm"], ["f0", 1/(2*Math.PI*Math.sqrt(l*c)), "Hz"]]; } },
    { name: "555 ASTABLE", in: [{ l:"RA", u:"ohm", v:10000, dec:1 }, { l:"RB", u:"ohm", v:10000, dec:1 }, { l:"C", u:"F", v:1e-6, dec:1 }],
      out: function(ra, rb, c) { return [["Freq", 1.44/((ra+2*rb)*c), "Hz"], ["Duty", (ra+rb)/(ra+2*rb)*100, "%"], ["High", 0.693*(ra+rb)*c, "s"], ["Low", 0.693*rb*c, "s"]]; } },
    { name: "OP AMP", in: [{ l:"Mode", u:"", v:0, opts:["NONINV","INV"] }, { l:"Rf", u:"ohm", v:10000, dec:1 }, { l:"Rg", u:"ohm", v:1000, dec:1 }, { l:"Vin", u:"V", v:0.1, step:0.1 }],
      out: function(mode, rf, rg, vin) { var g = mode === 0 ? 1 + rf/rg : -rf/rg; return [["Gain", g, "V/V"], ["Vout", g*vin, "V"], ["Rf/Rg", rf/rg, ""], ["Phase", mode === 0 ? "0 deg" : "180 deg", ""]]; } },
    { name: "ADC SCALE", in: [{ l:"Vref", u:"V", v:3.3, step:0.1 }, { l:"Bits", u:"", v:12, intg:1, min:1, max:24 }, { l:"Code", u:"", v:2048, intg:1, min:0, max:16777215 }],
      out: function(vref, bits, code) { var max = Math.pow(2, bits) - 1, lsb = vref / Math.pow(2, bits), c = code > max ? max : code; return [["LSB", lsb, "V"], ["MaxCode", max, ""], ["V code", c*lsb, "V"], ["Pct FS", c/max*100, "%"]]; } },
    { name: "WIRE DROP", in: [{ l:"I", u:"A", v:1, step:0.1 }, { l:"Len", u:"m", v:10, dec:1 }, { l:"AWG", u:"", v:18, intg:1, min:0, max:40 }],
      out: function(i, len, awg) { var area = awgArea(awg), r = 2 * 0.017241 * len / area; return [["Loop R", r, "ohm"], ["V drop", i*r, "V"], ["Loss", i*i*r, "W"], ["Area", area, "mm2"]]; } },
    { name: "R COLOR", in: [{ l:"Band1", u:"", v:1, opts:COLORS }, { l:"Band2", u:"", v:0, opts:COLORS }, { l:"Mult", u:"", v:2, opts:MULTS }, { l:"Tol", u:"", v:6, opts:TOLC }],
      out: function(d1, d2, m, t) { return [["Value", (d1*10+d2)*MULTF[m], "ohm"], ["Tol", TOLV[t], "%"], ["Bands", COLORS[d1]+"-"+COLORS[d2], ""], ["End", MULTS[m]+" "+TOLC[t], ""]]; } }
  ];
  var circTool = 0, circField = 0;
  function stepInput(inp, dir) {
    if (inp.opts) inp.v = wrap(inp.v + dir, inp.opts.length);
    else if (inp.col) inp.v = wrap(inp.v + dir, 10);
    else if (inp.intg) { inp.v += dir; if (inp.v < inp.min) inp.v = inp.min; if (inp.v > inp.max) inp.v = inp.max; }
    else if (inp.dec) inp.v *= (dir > 0 ? 10 : 0.1);
    else inp.v += dir * (inp.step || 1);
  }

  // ============================================================
  //  GRAPH + CALCULUS state
  // ============================================================
  var gxc = 0, gxs = Math.PI * 2, gyc = 0, gys = 2, graphField = 0;
  function autoY() {
    var lo = Infinity, hi = -Infinity, N = 160;
    for (var i = 0; i <= N; i++) { var y = fAt(gxc - gxs + 2 * gxs * i / N); if (isFinite(y)) { if (y < lo) lo = y; if (y > hi) hi = y; } }
    if (lo < hi) { gyc = (lo + hi) / 2; gys = (hi - lo) / 2 * 1.1; if (gys < 1e-9) gys = 1; }
  }
  var calcuOp = 0, calcuA = 0, calcuB = 1, calcuField = 0;

  // ============================================================
  //  MODE / FIELD NAVIGATION
  // ============================================================
  function cycleMode()      { mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length]; resetFields(); }
  function cycleModeBy(dir) { mode = MODES[wrap(MODES.indexOf(mode) + dir, MODES.length)]; resetFields(); }
  function resetFields()    { shift = false; msg = ""; convField = constField = refField = vacField = graphField = calcuField = circField = tapeField = 0; }
  function fieldCount() {
    if (mode === "CONV") return 5; if (mode === "VAC") return 5; if (mode === "CONST") return 4; if (mode === "REF") return 3;
    if (mode === "GRAPH") return 5; if (mode === "CALCULUS") return 5; if (mode === "TAPE") return 3;
    if (mode === "CIRC") return 2 + CIRC_TOOLS[circTool].in.length; return 0;
  }
  var tapeField = 0;
  function curField() {
    if (mode === "CONV") return convField; if (mode === "CONST") return constField; if (mode === "REF") return refField; if (mode === "VAC") return vacField;
    if (mode === "GRAPH") return graphField; if (mode === "CALCULUS") return calcuField; if (mode === "CIRC") return circField;
    if (mode === "TAPE") return tapeField; return 0;
  }
  function setField(v) {
    if (mode === "CONV") convField = v; else if (mode === "CONST") constField = v; else if (mode === "REF") refField = v; else if (mode === "VAC") vacField = v;
    else if (mode === "GRAPH") graphField = v; else if (mode === "CALCULUS") calcuField = v; else if (mode === "CIRC") circField = v;
    else if (mode === "TAPE") tapeField = v;
  }

  function changeField(dir) {
    var f = curField();
    if (f === 0) { cycleModeBy(dir); return; }
    if (mode === "CONV") {
      var L = CATS[convCat].u.length;
      if (f === 1) { convCat = wrap(convCat + dir, CATS.length); var L2 = CATS[convCat].u.length; if (convFrom >= L2) convFrom = L2 - 1; if (convTo >= L2) convTo = L2 - 1; }
      else if (f === 2) convFrom = wrap(convFrom + dir, L);
      else if (f === 3) convTo = wrap(convTo + dir, L);
      else if (f === 4) convVal *= (dir > 0 ? 10 : 0.1);
    } else if (mode === "CONST") {
      if (f === 1) { constGroup = wrap(constGroup + dir, CONST_GROUPS.length); constEnsure(); }
      else if (f === 2) { constSearch = wrap(constSearch + dir, CONST_SEARCHES.length); constEnsure(); }
      else if (f === 3) constMove(dir);
    } else if (mode === "REF") {
      if (f === 1) { refSection = wrap(refSection + dir, REF_SECTIONS.length); refItem = 0; }
      else if (f === 2) refItem = wrap(refItem + dir, refCurSec().items.length);
    } else if (mode === "VAC") {
      if (f === 1) vacP *= (dir > 0 ? 10 : 0.1);
      else if (f === 2) { vacT += dir * 10; if (vacT < 1) vacT = 1; }
      else if (f === 3) { vacD += dir * 0.1e-10; if (vacD < 0.1e-10) vacD = 0.1e-10; }
      else if (f === 4) vacL *= (dir > 0 ? 10 : 0.1);
    } else if (mode === "GRAPH") {
      if (f === 2) { gxs *= (dir > 0 ? 0.8 : 1.25); gys *= (dir > 0 ? 0.8 : 1.25); }
      else if (f === 3) gxc += dir * gxs * 0.25;
      else if (f === 4) gyc += dir * gys * 0.25;
    } else if (mode === "CALCULUS") {
      if (f === 2) calcuOp = wrap(calcuOp + dir, 4);
      else if (f === 3) calcuA += dir * 0.25;
      else if (f === 4) calcuB += dir * 0.25;
    } else if (mode === "CIRC") {
      if (f === 1) circTool = wrap(circTool + dir, CIRC_TOOLS.length);
      else stepInput(CIRC_TOOLS[circTool].in[f - 2], dir);
    } else if (mode === "TAPE") {
      if (f === 1) { theme = theme === "GREEN" ? "AMBER" : "GREEN"; applyTheme(); }
      else if (f === 2) tapeSel = wrap(tapeSel + dir, Math.max(1, hist.length));
    }
  }
  function modeAction() {     // knob1 press on a non-CALC screen
    var f = curField();
    if (mode === "CONV") { convVal = ans; msg = "Ans imported"; }
    else if (mode === "CONST") { if (f) { var ce = constCurrent(); if (ce) { insert("" + ce[2]); mode = "CALC"; msg = ""; } } }
    else if (mode === "REF") { msg = ""; }
    else if (mode === "VAC") { if (f === 1) vacP = ans; else if (f === 2) vacT = ans; else if (f === 3) vacD = ans; else if (f === 4) vacL = ans; if (f) msg = "Ans imported"; }
    else if (mode === "GRAPH") { if (f === 1) { expr = fx; justEval = false; returnMode = "GRAPH"; mode = "CALC"; msg = "edit f(x), >f to save"; } else if (f >= 2) { autoY(); msg = "auto-Y"; } }
    else if (mode === "CALCULUS") { if (f === 1) { expr = fx; justEval = false; returnMode = "CALCULUS"; mode = "CALC"; msg = "edit f(x), >f to save"; } }
    else if (mode === "CIRC") { if (f >= 2) { CIRC_TOOLS[circTool].in[f - 2].v = ans; msg = "Ans imported"; } }
    else if (mode === "TAPE") { if (f === 2 && hist.length) { insert("" + hist[tapeSel].v); mode = "CALC"; msg = ""; } }
  }

  // ============================================================
  //  DRAWING
  // ============================================================
  function drawTab() {
    h.setColor(FG).drawLine(16, 26, W - 16, 26);
    if (curField() === 0) { h.setColor(FG).fillRect(16, 30, W - 16, 54); h.setColor(BG); } else h.setColor(FG);
    h.setFontAlign(-1, -1).drawString("MODE", 26, 32);
    h.setFontAlign(1, -1).drawString(mode, W - 26, 32);
    h.setColor(FG);
  }
  function footer(s) {
    h.setColor(FG).drawLine(16, H - 28, W - 16, H - 28);
    h.setFontAlign(0, 1).drawString(s, W / 2, H - 3);
  }
  function row(label, val, y, sel) {
    if (sel) { h.setColor(FG).fillRect(16, y - 2, W - 16, y + 22); h.setColor(BG); } else h.setColor(FG);
    h.setFontAlign(-1, -1).drawString(fitRight(label, 13), 26, y);
    h.setFontAlign(1, -1).drawString(fitLeft(val, 24), W - 26, y);
    h.setColor(FG);
  }
  function miniRow(label, val, y) {
    h.setColor(FG).setFontAlign(-1, -1).drawString(fitRight(label, 8), 36, y);
    h.setFontAlign(1, -1).drawString(fitLeft(val, 31), W - 26, y);
  }

  function drawCalc() {
    h.reset().clear().setColor(FG).setFont("Monofonto23");
    h.setFontAlign(-1, -1).drawString("CALC", 18, 6);
    h.setFontAlign(1, -1).drawString(angleMode + (shift ? "  2nd" : ""), W - 18, 6);
    var shown = expr === "" ? "0" : expr;
    if (shown.length > 30) shown = "<" + shown.slice(shown.length - 29);
    h.setFontAlign(1, -1).drawString(shown, W - 18, 34);
    var pv = safeEval();
    h.setFontAlign(1, -1).drawString(msg ? msg : (isNaN(pv) ? "" : "= " + fmt(pv)), W - 18, 60);
    h.setColor(FG).drawLine(16, 80, W - 16, 80);
    var KX = 12, KY = 86, KW = (W - 24) / COLS, KH = 24;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var lbl = GRID[r][c];
      if (shift && SHIFTLBL[lbl]) lbl = SHIFTLBL[lbl];
      if (lbl === "DRG") lbl = angleMode;
      var x0 = KX + c * KW, y0 = KY + r * KH;
      if (calcCur.r === r && calcCur.c === c) { h.setColor(FG).fillRect(x0 + 1, y0 + 1, x0 + KW - 1, y0 + KH - 1); h.setColor(BG); } else h.setColor(FG);
      h.setFontAlign(0, 0).drawString(lbl, x0 + KW / 2, y0 + KH / 2);
    }
    footer("WHEEL:MOVE  PRESS:ENTER");
  }

  function drawConv() {
    h.reset().clear().setColor(FG).setFont("Monofonto23");
    h.setFontAlign(-1, -1).drawString("CONVERT", 18, 6); drawTab();
    var c = CATS[convCat], ry = [58, 84, 110, 136], out = convResult(), unit = c.u[convTo];
    var rows = [["CATEGORY", c.name], ["FROM", c.u[convFrom]], ["TO", c.u[convTo]], ["VALUE", convFmt(convVal)]];
    for (var i = 0; i < 4; i++) row(rows[i][0], rows[i][1], ry[i], convField === i + 1);
    h.setColor(FG).drawLine(16, 164, W - 16, 164);
    miniRow("RAW =", rawFmt(out) + " " + unit, 174);
    h.setFontAlign(-1, -1).drawString("ALSO =", 26, 206);
    miniRow("SCI", sci(out, 8) + " " + unit, 230);
    miniRow("ENG", eng(out, 8) + " " + unit, 254);
    if (msg) h.setFontAlign(0, -1).drawString(msg, W / 2, 276);
    footer("WHEEL:FIELD  THUMB:SET  PRESS:ANS");
  }

  function drawConst() {
    h.reset().clear().setColor(FG).setFont("Monofonto23");
    h.setFontAlign(-1, -1).drawString("CONSTANTS", 18, 6); drawTab();
    row("GROUP", CONST_GROUPS[constGroup], 58, constField === 1);
    row("FIND", CONST_SEARCHES[constSearch], 82, constField === 2);
    var list = constEnsure(), e = constCurrent(), pos = list.indexOf(constSel), y;
    h.setColor(FG).drawLine(16, 112, W - 16, 112);
    if (!e) {
      h.setFontAlign(-1, -1).drawString("NO MATCHES", 26, 128);
      h.setFontAlign(-1, -1).drawString("Try GROUP=ALL or FIND=ALL", 26, 154);
      footer("WHEEL:FIELD  THUMB:FILTER");
      return;
    }
    h.setFontAlign(-1, -1).drawString("MATCH " + (pos + 1) + "/" + list.length, 26, 122);
    h.setFontAlign(1, -1).drawString(fitLeft(constGroupOf(e) + " " + e[0], 20), W - 26, 122);
    h.setFontAlign(-1, -1).drawString(fitRight(e[1], 25), 26, 146);
    h.setFontAlign(1, -1).drawString(constValueText(e), W - 26, 146);
    h.drawLine(16, 178, W - 16, 178);
    var vis = 4, lh = 24, top = Math.max(0, Math.min(pos - 1, list.length - vis));
    for (var i = 0; i < vis && top + i < list.length; i++) {
      var idx = list[top + i], ce = CONSTS[idx];
      y = 190 + i * lh;
      if (idx === constSel && constField === 3) { h.setColor(FG).fillRect(16, y - 2, W - 16, y + 20); h.setColor(BG); } else h.setColor(FG);
      h.setFontAlign(-1, -1).drawString(fitRight(ce[0] + " " + ce[1], 21), 26, y);
      h.setFontAlign(1, -1).drawString(fitLeft(fmt(ce[2]) + (ce[3] ? " " + ce[3] : ""), 21), W - 26, y);
    }
    footer("WHEEL:FIELD  THUMB:FIND  PRESS:INS");
  }

  function drawEllipse(cx, cy, rx, ry) {
    var px = cx + rx, py = cy;
    for (var i = 1; i <= 32; i++) {
      var a = Math.PI * 2 * i / 32, nx = cx + Math.cos(a) * rx, ny = cy + Math.sin(a) * ry;
      h.drawLine(px, py, nx, ny); px = nx; py = ny;
    }
  }
  function drawShape(kind, x, y) {
    h.setColor(FG).setFontAlign(-1, -1);
    if (kind === "RECT") {
      h.drawRect(x + 18, y + 26, x + 110, y + 90);
      h.drawString("w", x + 58, y + 94); h.drawString("h", x + 116, y + 54);
    } else if (kind === "TRI") {
      h.drawLine(x + 14, y + 92, x + 118, y + 92); h.drawLine(x + 118, y + 92, x + 70, y + 18); h.drawLine(x + 70, y + 18, x + 14, y + 92);
      h.drawLine(x + 70, y + 18, x + 70, y + 92); h.drawString("b", x + 58, y + 96); h.drawString("h", x + 76, y + 52);
    } else if (kind === "CIRCLE") {
      drawEllipse(x + 66, y + 58, 42, 42); h.drawLine(x + 66, y + 58, x + 108, y + 58); h.drawString("r", x + 86, y + 62);
    } else if (kind === "ELLIPSE") {
      drawEllipse(x + 66, y + 58, 54, 34); h.drawLine(x + 12, y + 58, x + 120, y + 58); h.drawLine(x + 66, y + 24, x + 66, y + 92); h.drawString("a", x + 92, y + 62); h.drawString("b", x + 70, y + 34);
    } else if (kind === "BOX") {
      h.drawString("ISO", x + 2, y + 0);
      h.drawRect(x + 24, y + 22, x + 72, y + 52); h.drawRect(x + 42, y + 10, x + 90, y + 40);
      h.drawLine(x + 24, y + 22, x + 42, y + 10); h.drawLine(x + 72, y + 22, x + 90, y + 10); h.drawLine(x + 72, y + 52, x + 90, y + 40);
      h.drawString("TOP", x + 2, y + 68); h.drawRect(x + 50, y + 66, x + 106, y + 88); h.drawString("l", x + 72, y + 90); h.drawString("w", x + 110, y + 70);
      h.drawString("SIDE", x + 2, y + 104); h.drawRect(x + 50, y + 102, x + 106, y + 124); h.drawString("h", x + 110, y + 106);
    } else if (kind === "CYL") {
      h.drawString("ISO", x + 2, y + 0);
      drawEllipse(x + 66, y + 14, 32, 8); drawEllipse(x + 66, y + 54, 32, 8);
      h.drawLine(x + 34, y + 14, x + 34, y + 54); h.drawLine(x + 98, y + 14, x + 98, y + 54); h.drawString("h", x + 104, y + 28);
      h.drawString("TOP", x + 2, y + 68); drawEllipse(x + 74, y + 78, 20, 20); h.drawLine(x + 74, y + 78, x + 94, y + 78); h.drawString("r", x + 84, y + 80);
      h.drawString("SIDE", x + 2, y + 106); h.drawRect(x + 52, y + 104, x + 100, y + 126); h.drawLine(x + 76, y + 104, x + 76, y + 126);
    } else if (kind === "CONE") {
      h.drawString("ISO", x + 2, y + 0);
      drawEllipse(x + 66, y + 56, 34, 9); h.drawLine(x + 32, y + 56, x + 66, y + 10); h.drawLine(x + 100, y + 56, x + 66, y + 10); h.drawLine(x + 66, y + 10, x + 66, y + 56);
      h.drawString("TOP", x + 2, y + 68); drawEllipse(x + 74, y + 78, 20, 20); h.drawLine(x + 74, y + 78, x + 94, y + 78); h.drawString("r", x + 84, y + 80);
      h.drawString("SIDE", x + 2, y + 106); h.drawLine(x + 50, y + 126, x + 102, y + 126); h.drawLine(x + 50, y + 126, x + 76, y + 102); h.drawLine(x + 102, y + 126, x + 76, y + 102); h.drawLine(x + 76, y + 102, x + 76, y + 126);
    } else if (kind === "SPHERE") {
      h.drawString("ISO", x + 2, y + 0);
      drawEllipse(x + 66, y + 32, 30, 30); drawEllipse(x + 66, y + 32, 30, 9); h.drawLine(x + 66, y + 32, x + 96, y + 32); h.drawString("r", x + 80, y + 34);
      h.drawString("TOP", x + 2, y + 72); drawEllipse(x + 72, y + 82, 18, 18); h.drawLine(x + 72, y + 82, x + 90, y + 82);
      h.drawString("SIDE", x + 2, y + 108); drawEllipse(x + 72, y + 118, 18, 18); h.drawLine(x + 72, y + 118, x + 90, y + 118);
    }
  }
  function drawRef() {
    h.reset().clear().setColor(FG).setFont("Monofonto23");
    h.setFontAlign(-1, -1).drawString("RULES", 18, 6); drawTab();
    var sec = refCurSec(), item = refCurItem();
    row("TOPIC", sec.name, 58, refField === 1);
    row("CARD", item.name, 82, refField === 2);
    h.setColor(FG).drawLine(16, 112, W - 16, 112);
    h.setFontAlign(-1, -1).drawString("CARD " + (refItem + 1) + "/" + sec.items.length, 26, 122);
    h.setFontAlign(1, -1).drawString(fitLeft(sec.name, 20), W - 26, 122);
    var x = 34, y = 150, max = 34;
    if (item.shape) {
      drawShape(item.shape, 24, 144);
      x = 166; y = 146; max = 27;
    }
    for (var i = 0; i < item.lines.length && i < 6; i++) {
      h.setColor(FG).setFontAlign(-1, -1).drawString(fitRight(item.lines[i], max), x, y + i * 22);
    }
    footer("WHEEL:FIELD  THUMB:SET");
  }

  function drawVac() {
    h.reset().clear().setColor(FG).setFont("Monofonto23");
    h.setFontAlign(-1, -1).drawString("VACUUM (N2)", 18, 6); drawTab();
    var ry = [60, 92, 124, 156];
    var rows = [["P (Pa)", fmt(vacP)], ["T (K)", fmt(vacT)], ["d (m)", fmt(vacD)], ["L (m)", fmt(vacL)]];
    for (var i = 0; i < 4; i++) row(rows[i][0], rows[i][1], ry[i], vacField === i + 1);
    var mfp = meanFreePath(), Kn = mfp / vacL, reg = Kn < 0.01 ? "viscous" : Kn < 1 ? "transitional" : "molecular";
    h.setColor(FG);
    h.setFontAlign(-1, -1).drawString("mean free path", 26, 190); h.setFontAlign(1, -1).drawString(fitLeft(fmt(mfp) + " m", 22), W - 26, 190);
    h.setFontAlign(-1, -1).drawString("number density", 26, 214); h.setFontAlign(1, -1).drawString(fitLeft(fmt(numberDensity()) + " /m3", 22), W - 26, 214);
    h.setFontAlign(-1, -1).drawString("Knudsen/regime", 26, 238); h.setFontAlign(1, -1).drawString(fitLeft(fmt(Kn) + " " + reg, 24), W - 26, 238);
    h.setFontAlign(-1, -1).drawString("mean speed", 26, 262); h.setFontAlign(1, -1).drawString(fitLeft(fmt(meanSpeed()) + " m/s", 22), W - 26, 262);
    footer("WHEEL:FIELD  THUMB:X10/STEP  PRESS:ANS");
  }

  function drawGraph() {
    h.reset().clear().setColor(FG).setFont("Monofonto23");
    h.setFontAlign(-1, -1).drawString("GRAPH", 18, 6); drawTab();
    var ctl = ["MODE", "EDIT", "ZOOM", "PAN-X", "PAN-Y"][graphField];
    var fxs = "f(x)=" + fx; if (fxs.length > 24) fxs = fxs.slice(0, 24);
    h.setColor(FG).setFontAlign(-1, -1).drawString(fxs, 18, 62);
    h.setFontAlign(1, -1).drawString("[" + ctl + "]", W - 18, 62);
    var px0 = 44, py0 = 88, px1 = W - 12, py1 = H - 68;
    h.drawRect(px0, py0, px1, py1);
    function my(y) { return py1 - (y - (gyc - gys)) / (2 * gys) * (py1 - py0); }
    if (gxc - gxs < 0 && gxc + gxs > 0) { var ax = px0 + (0 - (gxc - gxs)) / (2 * gxs) * (px1 - px0); h.drawLine(ax, py0, ax, py1); }
    if (gyc - gys < 0 && gyc + gys > 0) { var ay = my(0); h.drawLine(px0, ay, px1, ay); }
    var pjx = null, pjy = null;
    for (var sx = px0; sx <= px1; sx++) {
      var x = (gxc - gxs) + (sx - px0) / (px1 - px0) * (2 * gxs), y = fAt(x);
      if (isFinite(y)) {
        var sy = my(y);
        if (sy >= py0 && sy <= py1) {
          if (pjx !== null && Math.abs(sy - pjy) < (py1 - py0)) h.drawLine(pjx, pjy, sx, sy); else h.fillRect(sx, sy, sx, sy);
          pjx = sx; pjy = sy;
        } else pjx = null;
      } else pjx = null;
    }
    h.setColor(FG).setFontAlign(-1, -1).drawString(fmt(gxc - gxs), px0, py1 + 8);
    h.setFontAlign(1, -1).drawString(fmt(gxc + gxs), px1, py1 + 8);
    footer("WHEEL:SEL  THUMB:ADJ  PRESS:EDIT/AUTO");
  }

  function drawCalculus() {
    h.reset().clear().setColor(FG).setFont("Monofonto23");
    h.setFontAlign(-1, -1).drawString("CALCULUS", 18, 6); drawTab();
    var ops = ["VALUE/SLOPE", "AREA A..B", "ZERO NEAR A", "EXTREME @A"];
    var aLabs = ["X POINT", "FROM A", "GUESS A", "GUESS A"], bLabs = ["COMPARE B", "TO B", "SCAN +/-B", "CHECK B"];
    var ry = [58, 84, 110, 136];
    var rows = [["f(x)", fx.length > 18 ? fx.slice(0, 18) : fx], ["TASK", ops[calcuOp]], [aLabs[calcuOp], fmt(calcuA)], [bLabs[calcuOp], fmt(calcuB)]];
    for (var i = 0; i < 4; i++) row(rows[i][0], rows[i][1], ry[i], calcuField === i + 1);
    h.setColor(FG).drawLine(16, 164, W - 16, 164);
    h.setFontAlign(-1, -1).drawString("READOUT", 26, 172);
    if (calcuOp === 0) {
      var fa = fAt(calcuA), fb = fAt(calcuB), dx = calcuB - calcuA;
      miniRow("f(A)", fmt(fa), 198);
      miniRow("d/dx", fmt(deriv(calcuA)), 222);
      miniRow("f(B)", fmt(fb), 246);
      miniRow("secant", dx === 0 ? "ERR" : fmt((fb - fa) / dx), 270);
    } else if (calcuOp === 1) {
      var area = integ(calcuA, calcuB), w = calcuB - calcuA;
      miniRow("area", fmt(area), 198);
      miniRow("width", fmt(w), 222);
      miniRow("avg y", w === 0 ? "ERR" : fmt(area / w), 246);
      miniRow("mid y", fmt(fAt((calcuA + calcuB) / 2)), 270);
    } else if (calcuOp === 2) {
      var rz = rootSpan(calcuA, calcuB), fr = fAt(rz);
      miniRow("root", fmt(rz), 198);
      miniRow("f(root)", fmt(fr), 222);
      miniRow("slope", fmt(deriv(rz)), 246);
      miniRow("scan", "+/- " + fmt(Math.abs(calcuB)), 270);
    } else {
      var cx = critical(calcuA), cy = fAt(cx), d1 = deriv(cx), d2 = secondDeriv(cx);
      miniRow("x*", fmt(cx), 198);
      miniRow("f(x*)", fmt(cy), 222);
      miniRow("d/dx", fmt(d1), 246);
      miniRow("type", Math.abs(d1) > 1e-5 ? "check guess" : d2 > 0 ? "local min" : d2 < 0 ? "local max" : "flat", 270);
    }
    footer("WHEEL:FIELD  THUMB:SET  PRESS:EDIT");
  }

  function circInputText(inp) {
    var v = inp.opts ? inp.opts[inp.v] : inp.col ? COLORS[inp.v] : inp.intg ? ("" + inp.v) : fmt(inp.v);
    return v + (inp.u ? " " + inp.u : "");
  }
  function circOutputText(out) {
    var s = fmt(out[1]);
    if (out[2]) s += " " + out[2];
    return fitLeft(s, 25);
  }
  function drawCirc() {
    h.reset().clear().setColor(FG).setFont("Monofonto23");
    h.setFontAlign(-1, -1).drawString("CIRCUIT", 18, 6); drawTab();
    var t = CIRC_TOOLS[circTool];
    row("WORKBENCH", t.name, 60, circField === 1);
    var y = 88, vals = [];
    for (var i = 0; i < t.in.length; i++) {
      var inp = t.in[i]; vals.push(inp.v);
      row(inp.l, circInputText(inp), y, circField === i + 2); y += 24;
    }
    h.setColor(FG).drawLine(16, 184, W - 16, 184);
    h.setFontAlign(-1, -1).drawString("READOUT", 26, 188);
    var outs = t.out.apply(null, vals);
    y = 204;
    for (var j = 0; j < outs.length && j < 4; j++) {
      h.setColor(FG).setFontAlign(-1, -1).drawString(fitRight(outs[j][0], 10), 36, y);
      h.setFontAlign(1, -1).drawString(circOutputText(outs[j]), W - 26, y); y += 20;
    }
    footer("WHEEL:FIELD  THUMB:SET  PRESS:ANS");
  }

  function drawTape() {
    h.reset().clear().setColor(FG).setFont("Monofonto23");
    h.setFontAlign(-1, -1).drawString("TAPE", 18, 6); drawTab();
    row("THEME", theme, 64, tapeField === 1);
    var y = 98;
    if (!hist.length) h.setColor(FG).setFontAlign(-1, -1).drawString("(no history yet)", 26, y);
    for (var i = 0; i < hist.length; i++) {
      var sel = tapeField === 2 && i === tapeSel, line = hist[i].s;
      if (line.length > 30) line = "<" + line.slice(line.length - 29);
      if (sel) { h.setColor(FG).fillRect(16, y - 2, W - 16, y + 24); h.setColor(BG); } else h.setColor(FG);
      h.setFontAlign(-1, -1).drawString(line, 26, y); h.setColor(FG); y += 30;
    }
    footer("WHEEL:FIELD  THUMB:SET  PRESS:USE");
  }

  function draw() {
    if (mode === "CALC") drawCalc();
    else if (mode === "GRAPH") drawGraph();
    else if (mode === "CALCULUS") drawCalculus();
    else if (mode === "CIRC") drawCirc();
    else if (mode === "CONV") drawConv();
    else if (mode === "CONST") drawConst();
    else if (mode === "REF") drawRef();
    else if (mode === "VAC") drawVac();
    else drawTape();
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

  return {
    id: "PIPCALC",
    notDefault: true,
    fullscreen: true,
    remove: function() {
      Pip.removeListener("knob1", onKnob1);
      Pip.removeListener("knob2", onKnob2);
      if (themeChanged) { try { Pip.setPalette(buildPalette(0.1, 1, 0.25)); } catch (e) {} } // restore green
    }
  };
})
