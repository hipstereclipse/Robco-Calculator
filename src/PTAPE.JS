(function() {
  //@inject _LIB.JS
  // ============================================================
  //  TAPE  -- standalone app: calculation-history log (written by the
  //  CALC app) + GREEN/AMBER theme toggle. History and theme live in
  //  CALCST; this app renders them and drives the selection cursor.
  // ============================================================
  var tapeSel = 0;

  function draw(field) {
    beginScreen("TAPE", "LOG");
    drawTab();
    row("THEME", ST.th, 64, field === 1);
    var hist = ST.hist;
    var y = 98;
    if (!hist.length) h.setColor(FG).setFontAlign(-1, -1).drawString("(no history yet)", TEXT_L, y);
    for (var i = 0; i < hist.length; i++) {
      var sel = field === 2 && i === tapeSel, line = hist[i].s;
      if (line.length > 28) line = "<" + line.slice(line.length - 27);
      if (sel) { h.setColor(FG).fillRect(CONTENT_L, y - 2, CONTENT_R, y + 24); h.setColor(BG); } else h.setColor(FG);
      h.setFontAlign(-1, -1).drawString(line, TEXT_L, y); h.setColor(FG); y += 30;
    }
    footer("WHEEL:FIELD  THUMB:SET  PRESS:USE");
  }

  function knob2(field, dir) {
    if (field === 1) toggleTheme();
    else if (field === 2) tapeSel = wrap(tapeSel + dir, Math.max(1, ST.hist.length));
  }

  function press(field) {
    var hist = ST.hist;
    if (field === 2 && hist.length) { ST.ins = "" + hist[tapeSel].v; ST.msg = "staged for CALC"; }
  }

  initState();
  return bootMode({ mode: "TAPE", fieldCount: function() { return 3; }, draw: draw, knob2: knob2, press: press });
})
