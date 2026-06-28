(function() {
  //@inject _LIB.JS
  //@inject _EVAL.JS
  // ============================================================
  //  CALCULUS  -- standalone app: numeric value/slope, area, zero, and
  //  extreme over the shared f(x) (authored in the CALC app). The
  //  numeric routines live here and evaluate f(x) via fAt (inlined
  //  evaluator). Helpers/evaluator inlined at build.
  // ============================================================
  var calcuOp = 0, calcuA = 0, calcuB = 1;

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

  function draw(field) {
    beginScreen("CALCULUS", "NUM");
    drawTab();
    var ops = ["VALUE/SLOPE", "AREA A..B", "ZERO NEAR A", "EXTREME @A"];
    var aLabs = ["X POINT", "FROM A", "GUESS A", "GUESS A"], bLabs = ["COMPARE B", "TO B", "SCAN +/-B", "CHECK B"];
    var ry = [58, 84, 110, 136];
    var fx = ST.fx;
    var rows = [["f(x)", fx.length > 18 ? fx.slice(0, 18) : fx], ["TASK", ops[calcuOp]], [aLabs[calcuOp], fmt(calcuA)], [bLabs[calcuOp], fmt(calcuB)]];
    for (var i = 0; i < 4; i++) row(rows[i][0], rows[i][1], ry[i], field === i + 1);
    section("READOUT", 164);
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
    footer("WHEEL:FIELD  THUMB:SET");
  }

  function knob2(field, dir) {
    if (field === 2) calcuOp = wrap(calcuOp + dir, 4);
    else if (field === 3) calcuA += dir * 0.25;
    else if (field === 4) calcuB += dir * 0.25;
  }

  function press(field) {
    if (field === 1) ST.msg = "set f(x) in CALC";
  }

  initState();
  setF(ST.fx);
  return bootMode({ mode: "CALCULUS", fieldCount: function() { return 5; }, draw: draw, knob2: knob2, press: press });
})
