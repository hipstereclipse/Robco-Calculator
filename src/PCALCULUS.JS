(function() {
  //@inject _LIB.JS
  //@inject _EVAL.JS
  // ============================================================
  //  CALCULUS  -- standalone app: numeric value/slope, area, root, and
  //  extreme over a function f(x).
  //
  //  The function is shared with CALC/GRAPH through ST.fx, but you no
  //  longer have to leave for the CALC app to set it: the F(X) row dials
  //  through a small library of presets. NAV: WHEEL picks a row, PUSH
  //  selects it (F(X)/TASK cycle, A/B edit, SOLVE writes Ans). EDIT (A/B):
  //  WHEEL nudges +/-1 at the current step, THUMB dials that step's
  //  magnitude. The numeric routines evaluate f(x) via fAt (inlined evaluator).
  // ============================================================
  var calcuOp = 0, calcuA = 0, calcuB = 1, calcuMsg = "";
  // Preset library for the F(X) row -- expressions the inlined evaluator
  // understands, so the app is usable without first visiting CALC.
  var FXP = ["x^2", "x^3-3*x", "sin(x)", "cos(x)", "exp(x)", "ln(x)", "sqrt(x)", "1/x", "x^2-2", "abs(x)"];
  var fxi = 0;

  function deriv(x0) { var h2 = 1e-5 * (Math.abs(x0) + 1); return (fAt(x0 + h2) - fAt(x0 - h2)) / (2 * h2); }
  function secondDeriv(x0) { var h2 = 1e-4 * (Math.abs(x0) + 1); return (fAt(x0 + h2) - 2 * fAt(x0) + fAt(x0 - h2)) / (h2 * h2); }
  // n=128 Simpson: accurate to well past display precision, but ~8x fewer f(x)
  // evals per frame than the old n=1000 -- the AREA readout recomputes this
  // every redraw, so the device stays responsive instead of stalling/crashing.
  function integ(a, b) { var n = 128, hh = (b - a) / n, s = fAt(a) + fAt(b); for (var i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * fAt(a + i * hh); return s * hh / 3; }
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
  function syncCalcState() {
    ST.calculus = { op: calcuOp, a: calcuA, b: calcuB };
  }
  function loadCalcState() {
    var c = ST.calculus || {};
    if (typeof c.op === "number") calcuOp = wrap(c.op | 0, 4);
    if (typeof c.a === "number" && isFinite(c.a)) calcuA = c.a;
    if (typeof c.b === "number" && isFinite(c.b)) calcuB = c.b;
    for (var i = 0; i < FXP.length; i++) if (FXP[i] === ST.fx) { fxi = i; break; }
  }
  function primaryResult() {
    if (calcuOp === 0) return { label: "f(A)", value: fAt(calcuA) };
    if (calcuOp === 1) return { label: "AREA", value: integ(calcuA, calcuB) };
    if (calcuOp === 2) return { label: "ROOT", value: rootSpan(calcuA, calcuB) };
    return { label: "X*", value: critical(calcuA) };
  }

  function draw(sel) {
    beginScreen("CALCULUS");
    var ops = ["VALUE & SLOPE", "AREA A..B", "ROOT NEAR A", "EXTREME @A"];
    var aLabs = ["X POINT", "LOWER A", "GUESS A", "GUESS A"];
    var bLabs = ["2ND POINT B", "UPPER B", "SCAN +/-B", "WINDOW B"];
    var pr = primaryResult();                            // computed once, reused below
    row("F(X)", caps(ST.fx), 40, sel === 1);
    row("TASK", ops[calcuOp], 66, sel === 2);
    row(aLabs[calcuOp], fmt(calcuA), 92, sel === 3);
    row(bLabs[calcuOp], fmt(calcuB), 118, sel === 4);
    row("SOLVE >ANS", fmt(pr.value), 144, sel === 5);
    section("READOUT", 176);
    smallFont();
    if (calcuOp === 0) {
      var fa = pr.value, fb = fAt(calcuB), dx = calcuB - calcuA;
      outRow("f(A)", fmt(fa), 210);
      outRow("SLOPE f'(A)", fmt(deriv(calcuA)), 228);
      outRow("f(B)", fmt(fb), 246);
      outRow("SECANT A..B", dx === 0 ? "ERR" : fmt((fb - fa) / dx), 264);
    } else if (calcuOp === 1) {
      var area = pr.value, w = calcuB - calcuA;
      outRow("AREA (INTEGRAL)", fmt(area), 210);
      outRow("WIDTH B-A", fmt(w), 228);
      outRow("AVERAGE VALUE", w === 0 ? "ERR" : fmt(area / w), 246);
      outRow("MID f((A+B)/2)", fmt(fAt((calcuA + calcuB) / 2)), 264);
    } else if (calcuOp === 2) {
      var rz = pr.value, fr = fAt(rz);
      outRow("ROOT x0", fmt(rz), 210);
      outRow("f(x0)", fmt(fr), 228);
      outRow("SLOPE f'(x0)", fmt(deriv(rz)), 246);
      outRow("SCAN WINDOW", "+/- " + fmt(Math.abs(calcuB)), 264);
    } else {
      var cx = pr.value, cy = fAt(cx), d1 = deriv(cx), d2 = secondDeriv(cx);
      outRow("X* (CRITICAL)", fmt(cx), 210);
      outRow("f(X*)", fmt(cy), 228);
      outRow("SLOPE f'(X*)", fmt(d1), 246);
      outRow("TYPE", Math.abs(d1) > 1e-5 ? "CHECK GUESS" : d2 > 0 ? "LOCAL MIN" : d2 < 0 ? "LOCAL MAX" : "FLAT", 264);
    }
    bigFont();
    footer(calcuMsg ? caps(calcuMsg) : navHint());
  }

  // 1 F(X) / 2 TASK are option lists; 3 A / 4 B are numbers (wheel +/-1, thumb
  // dials the step magnitude); 5 SOLVE is the action that writes Ans.
  function kind(sel) { return sel <= 2 ? "enum" : sel === 5 ? "act" : "num"; }
  function edit(sel, dir) {
    calcuMsg = ""; ST.msg = "";
    if (sel === 1) { fxi = wrap(fxi + dir, FXP.length); setF(FXP[fxi]); }
    else if (sel === 2) calcuOp = wrap(calcuOp + dir, 4);
    else if (sel === 3) calcuA += dir * magStep();
    else if (sel === 4) calcuB += dir * magStep();
    syncCalcState();
  }

  function act(sel) {
    if (sel !== 5) return;
    var p = primaryResult();
    if (isFinite(p.value)) { ST.ans = p.value; calcuMsg = "ANS " + p.label + "=" + fmt(p.value); }
    else calcuMsg = "NO FINITE RESULT";
    ST.msg = calcuMsg;
    syncCalcState();
    saveState();
  }

  initState();
  loadCalcState();
  syncCalcState();
  setF(ST.fx);
  return bootMode({ mode: "CALCULUS", fieldCount: function() { return 5; }, draw: draw, kind: kind, edit: edit, act: act });
})
