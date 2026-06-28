(function() {
  //@inject _LIB.JS
  //@inject _EVAL.JS
  return bootCtxMode("GRAPH", function(ctx) {
  // ============================================================
  //  GRAPH  (loaded on demand by PIPCALC.JS)
  //  plots the shared f(x); zoom / pan-x / pan-y / auto-Y.
  //  View state (centre/span) lives here and resets when the mode
  //  is left -- consistent with the other on-demand modules.
  // ============================================================
  var W = ctx.W, H = ctx.H, FG = ctx.FG, MID = ctx.MID, DIM = ctx.DIM;
  var fmt = ctx.fmt, fAt = ctx.fAt;
  var beginScreen = ctx.beginScreen, drawTab = ctx.drawTab, drawCorners = ctx.drawCorners, footer = ctx.footer;

  var gxc = 0, gxs = Math.PI * 2, gyc = 0, gys = 2;

  function autoY() {
    var lo = Infinity, hi = -Infinity, N = 160;
    for (var i = 0; i <= N; i++) { var y = fAt(gxc - gxs + 2 * gxs * i / N); if (isFinite(y)) { if (y < lo) lo = y; if (y > hi) hi = y; } }
    if (lo < hi) { gyc = (lo + hi) / 2; gys = (hi - lo) / 2 * 1.1; if (gys < 1e-9) gys = 1; }
  }

  function draw(field) {
    beginScreen("GRAPH", "TRACE");
    drawTab();
    var ctl = ["MODE", "EDIT", "ZOOM", "PAN-X", "PAN-Y"][field];
    var fxs = "f(x)=" + ctx.getFx(); if (fxs.length > 24) fxs = fxs.slice(0, 24);
    h.setColor(FG).setFontAlign(-1, -1).drawString(fxs, 18, 62);
    h.setFontAlign(1, -1).drawString("[" + ctl + "]", W - 18, 62);
    var px0 = 44, py0 = 88, px1 = W - 12, py1 = H - 68;
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
    h.setColor(FG).setFontAlign(-1, -1).drawString(fmt(gxc - gxs), px0, py1 + 8);
    h.setFontAlign(1, -1).drawString(fmt(gxc + gxs), px1, py1 + 8);
    footer("WHEEL:SEL  THUMB:ADJ  PRESS:EDIT/AUTO");
  }

  function knob2(field, dir) {
    if (field === 2) { gxs *= (dir > 0 ? 0.8 : 1.25); gys *= (dir > 0 ? 0.8 : 1.25); }
    else if (field === 3) gxc += dir * gxs * 0.25;
    else if (field === 4) gyc += dir * gys * 0.25;
  }

  function press(field) {
    if (field === 1) ctx.editFx("GRAPH");
    else if (field >= 2) { autoY(); ctx.setMsg("auto-Y"); }
  }

  return { fieldCount: function() { return 5; }, draw: draw, knob2: knob2, press: press };
  });
})
