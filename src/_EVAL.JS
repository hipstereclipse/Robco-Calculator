// ============================================================
//  _EVAL.JS -- shared expression evaluator fragment.
//  Inlined by tools/build.js into apps that mark //@inject _EVAL.JS
//  (CALC, GRAPH, CALCULUS). NOT a standalone app -- it is a block of
//  declarations spliced inside an app's factory, after _LIB (so ST
//  already exists). Recursive-descent over a token array; reads the
//  shared Ans/mem/angle from ST so f(x) and Ans behave the same in
//  every app.
// ============================================================
function fact(x) {
  if (x < 0 || x !== Math.round(x)) return NaN;
  if (x > 170) return Infinity;
  var r = 1; for (var k = 2; k <= x; k++) r *= k; return r;
}
function toRad(x) { return ST.ang === "DEG" ? x * Math.PI / 180 : x; }
function fromRad(x) { return ST.ang === "DEG" ? x * 180 / Math.PI : x; }

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
    case "ans": return ST.ans;
    case "mem": return ST.mem;
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

// Recursive-descent parser. The state (token array + cursor) lives in two
// module-level vars and the grammar functions are defined ONCE here rather
// than as closures inside evalToks. That matters: GRAPH evaluates f(x) ~390x
// per frame (one per plot column) and CALCULUS up to ~1000x (the Simpson
// integral), so closing over `toks`/`pos` per call allocated thousands of
// short-lived closures every redraw and OOM-crashed those two apps on the
// device (LOW_MEMORY/CALLBACK). Evaluation never re-enters itself, so a single
// shared cursor is safe.
var _toks = null, _pos = 0;
function _peek() { return _toks[_pos]; }
function _nx() { return _toks[_pos++]; }
function _eat(t) { var k = _nx(); if (!k || k.t !== t) throw "syntax"; }
function _pE() { var v = _pT();
  while (_peek() && _peek().t === "op" && (_peek().v === "+" || _peek().v === "-")) { var o = _nx().v, r = _pT(); v = o === "+" ? v + r : v - r; } return v; }
function _pT() { var v = _pU();
  while (_peek() && _peek().t === "op" && (_peek().v === "*" || _peek().v === "/")) { var o = _nx().v, r = _pU(); v = o === "*" ? v * r : v / r; } return v; }
function _pU() { if (_peek() && _peek().t === "op" && (_peek().v === "+" || _peek().v === "-")) { var o = _nx().v; return o === "-" ? -_pU() : _pU(); } return _pF(); }
function _pF() { var b = _pP(); if (_peek() && _peek().t === "op" && _peek().v === "^") { _nx(); return Math.pow(b, _pU()); } return b; }
function _pP() { var v = _pPrim(); while (_peek() && _peek().t === "fact") { _nx(); v = fact(v); } return v; }
function _pPrim() {
  var k = _peek(); if (!k) throw "syntax";
  if (k.t === "num")   { _nx(); return k.v; }
  if (k.t === "const") { _nx(); return constVal(k.v); }
  if (k.t === "fn")    { _nx(); _eat("lp"); var a = _pE(); _eat("rp"); return applyFn(k.v, a); }
  if (k.t === "lp")    { _nx(); var v = _pE(); _eat("rp"); return v; }
  throw "syntax";
}
function evalToks(toks) {
  _toks = toks; _pos = 0;
  var res = _pE();
  if (_pos !== toks.length) throw "syntax";
  return res;
}
function evaluate(s) { return evalToks(tokenize(s)); }

// ---------- shared f(x) (string lives in ST.fx; tokens cached here) ----------
var fxToks = null, xVar = 0;
function setF(str) { ST.fx = str; try { fxToks = tokenize(str); } catch (e) { fxToks = null; } }
function fAt(x) { xVar = x; if (!fxToks) return NaN; try { return evalToks(fxToks); } catch (e) { return NaN; } }
