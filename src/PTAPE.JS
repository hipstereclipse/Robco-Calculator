(function(ctx) {
  // ============================================================
  //  TAPE  (loaded on demand by PIPCALC.JS)
  //  calculation-history log + GREEN/AMBER theme toggle.
  //  History and theme live in the core; this module only renders
  //  them and drives the selection cursor.
  // ============================================================
  var W = ctx.W, FG = ctx.FG, BG = ctx.BG;
  var wrap = ctx.wrap;
  var beginScreen = ctx.beginScreen, drawTab = ctx.drawTab, row = ctx.row, footer = ctx.footer;

  var tapeSel = 0;

  function draw(field) {
    beginScreen("TAPE", "LOG");
    drawTab();
    row("THEME", ctx.getTheme(), 64, field === 1);
    var hist = ctx.getHist();
    var y = 98;
    if (!hist.length) h.setColor(FG).setFontAlign(-1, -1).drawString("(no history yet)", 26, y);
    for (var i = 0; i < hist.length; i++) {
      var sel = field === 2 && i === tapeSel, line = hist[i].s;
      if (line.length > 30) line = "<" + line.slice(line.length - 29);
      if (sel) { h.setColor(FG).fillRect(22, y - 2, W - 22, y + 24); h.setColor(BG); } else h.setColor(FG);
      h.setFontAlign(-1, -1).drawString(line, 26, y); h.setColor(FG); y += 30;
    }
    footer("WHEEL:FIELD  THUMB:SET  PRESS:USE");
  }

  function knob2(field, dir) {
    if (field === 1) ctx.toggleTheme();
    else if (field === 2) tapeSel = wrap(tapeSel + dir, Math.max(1, ctx.getHist().length));
  }

  function press(field) {
    var hist = ctx.getHist();
    if (field === 2 && hist.length) { ctx.insert("" + hist[tapeSel].v); ctx.setMode("CALC"); ctx.setMsg(""); }
  }

  return { fieldCount: function() { return 3; }, draw: draw, knob2: knob2, press: press };
})
