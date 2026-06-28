(function() {
  //@inject _LIB.JS
  //@inject _EVAL.JS
  // ============================================================
  //  CALCULUS  -- standalone app: numeric value/slope, area, zero, and
  //  extreme over the shared f(x) (authored in the CALC app). The
  //  numeric routines live here and evaluate f(x) via fAt (inlined
  //  evaluator). Helpers/evaluator inlined at build.
  // ============================================================
  var calcuOp = 0, calcuA = 0, calcuB = 1, calcuStep = 2, calcuMsg = "";
  var CALCU_STEPS = [0.01, 0.1, 0.25, 1, 10, 100];

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
  function stepSize() { return CALCU_STEPS[calcuStep]; }
  function syncCalcState() {
    ST.calculus = { op: calcuOp, a: calcuA, b: calcuB, step: calcuStep };
  }
  function loadCalcState() {
    var c = ST.calculus || {};
    if (typeof c.op === "number") calcuOp = wrap(c.op | 0, 4);
    if (typeof c.a === "number" && isFinite(c.a)) calcuA = c.a;
    if (typeof c.b === "number" && isFinite(c.b)) calcuB = c.b;
    if (typeof c.step === "number") calcuStep = wrap(c.step | 0, CALCU_STEPS.length);
  }
  function primaryResult() {
    if (calcuOp === 0) return { label: "f(A)", value: fAt(calcuA) };
    if (calcuOp === 1) return { label: "area", value: integ(calcuA, calcuB) };
    if (calcuOp === 2) return { label: "root", value: rootSpan(calcuA, calcuB) };
    return { label: "x*", value: critical(calcuA) };
  }

  function draw(field) {
    beginScreen("CALCULUS");
    var ops = ["VALUE/SLOPE", "AREA A..B", "ZERO NEAR A", "EXTREME @A"];
    var aLabs = ["X POINT", "FROM A", "GUESS A", "GUESS A"], bLabs = ["COMPARE B", "TO B", "SCAN +/-B", "CHECK B"];
    var fx = ST.fx;
    h.setColor(FG).setFontAlign(-1, -1).drawString("F(X)", TEXT_L, 40);
    h.setColor(FG).setFontAlign(1, -1).drawString(fx.length > 24 ? fx.slice(0, 24) : fx, TEXT_R, 40);
    var ry = [64, 88, 112, 136];
    var rows = [["TASK", ops[calcuOp]], [aLabs[calcuOp], fmt(calcuA)], [bLabs[calcuOp], fmt(calcuB)], ["STEP", fmt(stepSize())]];
    for (var i = 0; i < 4; i++) row(rows[i][0], rows[i][1], ry[i], field === i + 1);
    section("READOUT", 164);
    if (calcuOp === 0) {
      var fa = fAt(calcuA), fb = fAt(calcuB), dx = calcuB - calcuA;
      miniRow("f(A)", fmt(fa), 194);
      miniRow("d/dx", fmt(deriv(calcuA)), 218);
      miniRow("f(B)", fmt(fb), 242);
      miniRow("secant", dx === 0 ? "ERR" : fmt((fb - fa) / dx), 266);
    } else if (calcuOp === 1) {
      var area = integ(calcuA, calcuB), w = calcuB - calcuA;
      miniRow("area", fmt(area), 194);
      miniRow("width", fmt(w), 218);
      miniRow("avg y", w === 0 ? "ERR" : fmt(area / w), 242);
      miniRow("mid y", fmt(fAt((calcuA + calcuB) / 2)), 266);
    } else if (calcuOp === 2) {
      var rz = rootSpan(calcuA, calcuB), fr = fAt(rz);
      miniRow("root", fmt(rz), 194);
      miniRow("f(root)", fmt(fr), 218);
      miniRow("slope", fmt(deriv(rz)), 242);
      miniRow("scan", "+/- " + fmt(Math.abs(calcuB)), 266);
    } else {
      var cx = critical(calcuA), cy = fAt(cx), d1 = deriv(cx), d2 = secondDeriv(cx);
      miniRow("x*", fmt(cx), 194);
      miniRow("f(x*)", fmt(cy), 218);
      miniRow("d/dx", fmt(d1), 242);
      miniRow("type", Math.abs(d1) > 1e-5 ? "CHECK GUESS" : d2 > 0 ? "LOCAL MIN" : d2 < 0 ? "LOCAL MAX" : "FLAT", 266);
    }
    footer(calcuMsg ? caps(calcuMsg) : "WHEEL SELECT  THUMB CHANGE  PRESS ANS");
  }

  function knob2(field, dir) {
    calcuMsg = "";
    ST.msg = "";
    if (field === 1) calcuOp = wrap(calcuOp + dir, 4);
    else if (field === 2) calcuA += dir * stepSize();
    else if (field === 3) calcuB += dir * stepSize();
    else if (field === 4) calcuStep = wrap(calcuStep + dir, CALCU_STEPS.length);
    syncCalcState();
  }

  function press(field) {
    var p;
    if (field === 1) {
      p = primaryResult();
      if (isFinite(p.value)) {
        ST.ans = p.value;
        calcuMsg = "ANS " + p.label + "=" + fmt(p.value);
      } else calcuMsg = "NO FINITE RESULT";
    } else if (field === 2) {
      if (isFinite(ST.ans)) { calcuA = ST.ans; calcuMsg = "A=ANS " + fmt(calcuA); }
      else calcuMsg = "ANS NOT FINITE";
    } else if (field === 3) {
      if (isFinite(ST.ans)) { calcuB = ST.ans; calcuMsg = "B=ANS " + fmt(calcuB); }
      else calcuMsg = "ANS NOT FINITE";
    } else if (field === 4) {
      calcuStep = wrap(calcuStep + 1, CALCU_STEPS.length);
      calcuMsg = "STEP " + fmt(stepSize());
    }
    ST.msg = calcuMsg;
    syncCalcState();
    saveState();
  }

  initState();
  loadCalcState();
  syncCalcState();
  setF(ST.fx);
  return bootMode({ mode: "CALCULUS", fieldCount: function() { return 4; }, draw: draw, knob2: knob2, press: press });
})
