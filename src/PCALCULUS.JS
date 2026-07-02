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
  //  The READOUT block shows ONE of the task's four derived results at full
  //  row size and is itself a field: select it, push, and the wheel cycles
  //  which result is displayed.
  // ============================================================
  var calcuOp = 0, calcuA = 0, calcuB = 1, calcuMsg = "";
  var outIdx = 0;                           // which of the 4 readout entries is on show
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

  // One readout entry per task (label, value). Only the entry on show is
  // computed each redraw -- pr (the already-computed primaryResult) covers
  // entry 0 of every task, so cycling AREA's readouts costs one integ() per
  // paint, not four sets of derived values.
  function outEntry(j, pr) {
    if (calcuOp === 0) {
      if (j === 0) return ["f(A)", fmt(pr.value)];
      if (j === 1) return ["SLOPE f'(A)", fmt(deriv(calcuA))];
      if (j === 2) return ["f(B)", fmt(fAt(calcuB))];
      var dx = calcuB - calcuA;
      return ["SECANT A..B", dx === 0 ? "ERR" : fmt((fAt(calcuB) - pr.value) / dx)];
    }
    if (calcuOp === 1) {
      if (j === 0) return ["AREA (INTEGRAL)", fmt(pr.value)];
      var w = calcuB - calcuA;
      if (j === 1) return ["WIDTH B-A", fmt(w)];
      if (j === 2) return ["AVERAGE VALUE", w === 0 ? "ERR" : fmt(pr.value / w)];
      return ["MID f((A+B)/2)", fmt(fAt((calcuA + calcuB) / 2))];
    }
    if (calcuOp === 2) {
      if (j === 0) return ["ROOT x0", fmt(pr.value)];
      if (j === 1) return ["f(x0)", fmt(fAt(pr.value))];
      if (j === 2) return ["SLOPE f'(x0)", fmt(deriv(pr.value))];
      return ["SCAN WINDOW", "+/- " + fmt(Math.abs(calcuB))];
    }
    if (j === 0) return ["X* (CRITICAL)", fmt(pr.value)];
    if (j === 1) return ["f(X*)", fmt(fAt(pr.value))];
    if (j === 2) return ["SLOPE f'(X*)", fmt(deriv(pr.value))];
    var d1 = deriv(pr.value), d2 = secondDeriv(pr.value);
    return ["TYPE", Math.abs(d1) > 1e-5 ? "CHECK GUESS" : d2 > 0 ? "LOCAL MIN" : d2 < 0 ? "LOCAL MAX" : "FLAT"];
  }

  // Per-task labels AND a one-line plain-English hint for the A/B rows: the
  // same two rows mean very different things across tasks (an eval point, an
  // integration bound, a root guess, a search window) and earlier builds gave
  // no in-app explanation of which -- confusing to enter blind. The hint
  // shows in the footer while that row is selected (NAV, not yet editing).
  var ops = ["VALUE & SLOPE", "AREA UNDER CURVE", "FIND A ROOT", "FIND MIN/MAX"];
  var aLabs = ["EVAL AT X=A", "LOWER A", "GUESS X=A", "GUESS X=A"];
  var bLabs = ["2ND PT X=B", "UPPER B", "+/- WIDTH B", "+/- WIDTH B"];
  var aHints = [
    "A: WHERE TO EVALUATE F(X)",
    "A: INTEGRATE STARTING HERE",
    "A: SEARCH STARTS NEAR HERE",
    "A: SEARCH STARTS NEAR HERE"
  ];
  var bHints = [
    "B: 2ND POINT FOR SLOPE A..B",
    "B: INTEGRATE UP TO HERE",
    "B: HOW FAR +/- OF A TO SCAN",
    "B: HOW FAR +/- OF A TO SCAN"
  ];

  function draw(sel) {
    beginScreen("CALCULUS");
    var pr = primaryResult();                            // computed once, reused below
    row("F(X)", caps(ST.fx), 40, sel === 1);
    row("TASK", ops[calcuOp], 66, sel === 2);
    row(aLabs[calcuOp], fmt(calcuA), 92, sel === 3);
    row(bLabs[calcuOp], fmt(calcuB), 118, sel === 4);
    row("SOLVE >ANS", fmt(pr.value), 144, sel === 5);
    var e = outEntry(outIdx, pr);
    readout("READOUT", outIdx, 4, e[0], e[1], 176, sel === 6);
    // While just browsing to the A/B row (not yet editing it), show what that
    // field means for the current task instead of the generic "WHEEL PICK"
    // hint -- the same two rows mean a different thing per task, so this is
    // the one place that explanation fits without crowding the layout.
    var hint = calcuMsg ? caps(calcuMsg)
      : (!editing && sel === 3) ? aHints[calcuOp]
      : (!editing && sel === 4) ? bHints[calcuOp]
      : (!editing && sel === 5) ? "LIVE PREVIEW -- PUSH TO SAVE INTO ANS"
      : (!editing && sel === 6) ? "PUSH, THEN WHEEL = OTHER RESULTS"
      : navHint();
    footer(hint);
  }

  // 1 F(X) / 2 TASK are option lists; 3 A / 4 B are numbers (wheel +/-1, thumb
  // dials the step magnitude); 5 SOLVE is the action that writes Ans; 6 is the
  // READOUT (an enum the wheel cycles).
  function kind(sel) { return sel <= 2 || sel === 6 ? "enum" : sel === 5 ? "act" : "num"; }
  function edit(sel, dir) {
    calcuMsg = ""; ST.msg = "";
    if (sel === 1) { fxi = wrap(fxi + dir, FXP.length); setF(FXP[fxi]); }
    else if (sel === 2) { calcuOp = wrap(calcuOp + dir, 4); outIdx = 0; } // new task, new readouts
    else if (sel === 3) calcuA += dir * magStep();
    else if (sel === 4) calcuB += dir * magStep();
    else if (sel === 6) outIdx = wrap(outIdx + dir, 4);
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
  return bootMode({ mode: "CALCULUS", fieldCount: function() { return 6; }, draw: draw, kind: kind, edit: edit, act: act });
})
