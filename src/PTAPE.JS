(function() {
  //@inject _LIB.JS
  // ============================================================
  //  TAPE  -- standalone app: calculation-history log written by CALC.
  //  History lives in CALCST; this app renders it and drives the cursor.
  // ============================================================
  var tapeSel = 0;

  function draw(field) {
    beginScreen("TAPE", "LOG");
    var hist = ST.hist;
    var y = 44;
    if (!hist.length) h.setColor(FG).setFontAlign(-1, -1).drawString("(NO HISTORY YET)", TEXT_L, y);
    for (var i = 0; i < hist.length; i++) {
      var sel = field === 1 && i === tapeSel, line = hist[i].s;
      if (line.length > 28) line = "<" + line.slice(line.length - 27);
      if (sel) { h.setColor(DIM).drawRect(CONTENT_L, y - 2, CONTENT_R, y + 24); h.setColor(FG); } else h.setColor(FG);
      h.setFontAlign(-1, -1).drawString(line, TEXT_L, y); h.setColor(FG); y += 30;
    }
    footer("WHEEL SELECT  THUMB SCROLL  PRESS USE");
  }

  function knob2(field, dir) {
    if (field === 1) tapeSel = wrap(tapeSel + dir, Math.max(1, ST.hist.length));
  }

  function press(field) {
    var hist = ST.hist;
    if (field === 1 && hist.length) { ST.ins = "" + hist[tapeSel].v; ST.msg = "STAGED FOR CALC"; }
  }

  initState();
  return bootMode({ mode: "TAPE", fieldCount: function() { return 1; }, draw: draw, knob2: knob2, press: press });
})
