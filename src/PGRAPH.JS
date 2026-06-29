(function() {
  //@inject _LIB.JS
  //@inject _EVAL.JS
  // ============================================================
  //  GRAPH  -- standalone app: plots the shared f(x) (authored in the
  //  CALC app); zoom / pan-x / pan-y / auto-Y. View state (centre/span)
  //  is local and resets each launch. Helpers/evaluator inlined at build.
  // ============================================================
  var gxc = 0, gxs = Math.PI * 2, gyc = 0, gys = 2;

  function autoY() {
    var lo = Infinity, hi = -Infinity, N = 160;
    for (var i = 0; i <= N; i++) { var y = fAt(gxc - gxs + 2 * gxs * i / N); if (isFinite(y)) { if (y < lo) lo = y; if (y > hi) hi = y; } }
    if (lo < hi) { gyc = (lo + hi) / 2; gys = (hi - lo) / 2 * 1.1; if (gys < 1e-9) gys = 1; }
  }

  function draw(field) {
    beginScreen("GRAPH");
    var ctl = ["AUTO-Y", "ZOOM", "PAN X", "PAN Y"][field - 1];
    var cv = field === 1 ? "PRESS" : field === 2 ? "SPAN " + fmt(gxs) : field === 3 ? "X " + fmt(gxc) : "Y " + fmt(gyc);
    var fxs = "f(x)=" + ST.fx; if (fxs.length > 24) fxs = fxs.slice(0, 24);
    h.setColor(FG).setFontAlign(-1, -1).drawString(fxs, TEXT_L, 40);
    // One CONTROL row whose label IS the selected control: the wheel cycles it in
    // NAV (the name blinks), and after a push the value blinks and the wheel/thumb
    // fine/coarse it.
    row(ctl, cv, 62, true);
    var px0 = 58, py0 = 92, px1 = CONTENT_R, py1 = H - 76;
    h.setColor(DIM).drawRect(px0, py0, px1, py1);
    drawCorners(px0, py0, px1, py1, 8);
    for (var gx = 1; gx < 4; gx++) h.drawLine(px0 + (px1 - px0) * gx / 4, py0, px0 + (px1 - px0) * gx / 4, py1);
    for (var gy = 1; gy < 4; gy++) h.drawLine(px0, py0 + (py1 - py0) * gy / 4, px1, py0 + (py1 - py0) * gy / 4);
    function my(y) { return py1 - (y - (gyc - gys)) / (2 * gys) * (py1 - py0); }
    h.setColor(MID);
    if (gxc - gxs < 0 && gxc + gxs > 0) { var ax = px0 + (0 - (gxc - gxs)) / (2 * gxs) * (px1 - px0); h.drawLine(ax, py0, ax, py1); }
    if (gyc - gys < 0 && gyc + gys > 0) { var ay = my(0); h.drawLine(px0, ay, px1, ay); }
    h.setColor(FG);
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
    smallFont();                                     // labelled window readout below the plot
    outRow("X RANGE", fmt(gxc - gxs) + " .. " + fmt(gxc + gxs), py1 + 6);
    outRow("Y RANGE", fmt(gyc - gys) + " .. " + fmt(gyc + gys), py1 + 24);
    bigFont();
    footer(ST.msg ? caps(ST.msg) : (editing ? "WHEEL FINE   THUMB COARSE   PUSH DONE" : navHint()));
  }

  // AUTO-Y is the action; ZOOM/PAN are numeric. Their magnitude is multiplicative
  // (zoom factor) / fractional (pan), not a power-of-ten step, so GRAPH supplies
  // its own thumb handler (mag) rather than using the generic editMag.
  function kind(field) { return field === 1 ? "act" : "num"; }
  function edit(field, dir) {              // WHEEL: fine zoom / pan
    if (field === 2) { var f = dir > 0 ? 0.95 : 1 / 0.95; gxs *= f; gys *= f; }
    else if (field === 3) gxc += dir * gxs * 0.05;
    else if (field === 4) gyc += dir * gys * 0.05;
  }
  function mag(field, dir) {               // THUMB: coarse zoom / pan
    if (field === 2) { var f = dir > 0 ? 0.8 : 1.25; gxs *= f; gys *= f; }
    else if (field === 3) gxc += dir * gxs * 0.25;
    else if (field === 4) gyc += dir * gys * 0.25;
  }
  function act(field) { if (field === 1) { autoY(); ST.msg = "AUTO-Y"; } }

  initState();
  setF(ST.fx);
  return bootMode({ mode: "GRAPH", fieldCount: function() { return 4; }, draw: draw, kind: kind, edit: edit, mag: mag, act: act });
})
