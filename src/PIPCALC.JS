(function() {
  // ============================================================
  //  PIP-CALC :: ENGINEER'S CALCULATOR                Pip-Boy 3000
  //  CALC (scientific) -- the resident home app. Every other mode
  //  is its OWN standalone app (APPS/P*.JS); the MODE key opens a
  //  picker that hands off with load(), so only one app is ever in
  //  RAM (no core stacked under a module, no eval() spike). Shared
  //  f(x)/Ans/mem/angle/theme/history live in the CALCST card file.
  //  Source lives in src/; APPS/ ships the minified build. Helpers +
  //  evaluator are inlined from _LIB.JS / _EVAL.JS at build time.
  // ============================================================
  //@inject _LIB.JS
  //@inject _EVAL.JS

  curMode = "CALC";

  // ============================================================
  //  CALCULATOR UI (CALC-local state; shared values live in ST)
  // ============================================================
  var expr = "", justEval = false, calcCur = { r: 0, c: 0 };
  var shift = false, msg = "", retEdit = null;

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
  function pushHist(s, v) { ST.hist.unshift({ s: s, v: v }); if (ST.hist.length > 6) ST.hist.pop(); }

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
      case "MODE": openMenu(); return;
      case "DRG":  ST.ang = ST.ang === "RAD" ? "DEG" : "RAD"; return;
      case "AC":   expr = ""; justEval = false; return;
      case "DEL":  if (justEval) { expr = ""; justEval = false; } else expr = expr.slice(0, -1); return;
      case "=":    return doEval();
      case ">f":   return doSetF();
      case "x":    return insert("x");
      case "Ans":  return insert("ans");
      case "MR":   return insert("mem");
      case "M+":   try { ST.mem += evaluate(expr || "0"); msg = "M=" + fmt(ST.mem); } catch (e) { msg = "ERR"; } return;
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
      ST.ans = r; pushHist(expr + " = " + fmt(r), r);
      expr = fmt(r); justEval = true;
    } catch (e) { msg = "SYNTAX ERR"; }
  }
  // ">f": set the shared f(x). If we detoured here to edit it from another
  // mode (retEdit), hop back to that mode's app once saved.
  function doSetF() {
    setF(expr === "" ? ST.fx : expr);
    justEval = false; msg = "f(x) set";
    if (retEdit) { var m = retEdit; retEdit = null; if (FILES[m]) gotoMode(FILES[m]); }
  }
  function safeEval() { try { return expr ? evaluate(expr) : 0; } catch (e) { return NaN; } }

  function drawCalc() {
    beginScreen("CALC", ST.ang + (shift ? "  2nd" : ""));
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
      if (lbl === "DRG") lbl = ST.ang;
      var x0 = KX + c * KW, y0 = KY + r * KH;
      if (calcCur.r === r && calcCur.c === c) { h.setColor(FG).fillRect(x0 + 2, y0 + 2, x0 + KW - 4, y0 + KH - 4); h.setColor(BG); } else h.setColor(FG);
      h.setFontAlign(0, 0).drawString(lbl, x0 + KW / 2, y0 + KH / 2);
    }
    footer("WHEEL:MOVE  PRESS:ENTER");
  }

  function redraw() { if (menuOpen) drawMenu(); else drawCalc(); }
  function onKnob1(dir) {
    if (menuOpen) { menuK1(dir); redraw(); return; }
    if (dir === 0) { pressKey(GRID[calcCur.r][calcCur.c]); ok(); }
    else { calcCur.r = wrap(calcCur.r + dir, ROWS); click(); }
    redraw();
  }
  function onKnob2(dir) {
    if (menuOpen) { menuK2(); redraw(); return; }
    if (!dir) return;
    calcCur.c = wrap(calcCur.c + dir, COLS);
    click(); redraw();
  }

  // ---------- boot: load shared state, then resume any pending detour ----------
  initState();
  setF(ST.fx);
  if (ST.edit) { retEdit = ST.edit; ST.edit = null; expr = ST.fx; msg = "edit f(x), >f to save"; }
  else if (ST.ins != null) { insert(ST.ins); ST.ins = null; }

  return finishBoot(onKnob1, onKnob2, redraw);
})
