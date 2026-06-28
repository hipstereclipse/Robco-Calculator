(function() {
  //@inject _LIB.JS
  // ============================================================
  //  TAPE  -- standalone app: the durable calculation log. CALC appends
  //  one line per "=" to a StorageFile on the card (see tapeLog), so the
  //  history survives power-off and OOM crashes -- not just clean exits.
  //  This app reads it back newest-first, scrolls it, and stages a value
  //  back to CALC (PRESS). When the card log is empty or unavailable it
  //  falls back to the in-RAM ST.hist. The log self-compacts to the last
  //  TAPE_MAX entries when it grows past ~120 lines.
  // ============================================================
  var tape = [], tapeSel = 0, tapeTop = 0, tapeMsg = "";
  var VIS = 8, PITCH = 28, TOPY = 48;

  function loadTape() {
    var log = tapeReadAll();                       // oldest-first from the card
    if (log.length > 120) { log = log.slice(log.length - TAPE_MAX); tapeTrim(log); }
    if (log.length) { log.reverse(); tape = log; } // show newest first
    else tape = (ST.hist || []).slice();           // fallback: in-RAM mirror
    if (tapeSel >= tape.length) tapeSel = 0;
  }

  function draw(field) {
    var n = tape.length;
    beginScreen("TAPE", n ? (tapeSel + 1) + "/" + n : "LOG");
    if (!n) {
      h.setColor(FG).setFontAlign(-1, -1).drawString("(NO HISTORY YET)", TEXT_L, 60);
      h.setFontAlign(-1, -1).drawString("CALC = WRITES HERE", TEXT_L, 92);
      footer("THUMB SCROLL  PRESS USE");
      return;
    }
    if (tapeSel < tapeTop) tapeTop = tapeSel;
    if (tapeSel >= tapeTop + VIS) tapeTop = tapeSel - VIS + 1;
    for (var i = 0; i < VIS && tapeTop + i < n; i++) {
      var idx = tapeTop + i, line = tape[idx].s, y = TOPY + i * PITCH;
      if (line.length > 30) line = "<" + line.slice(line.length - 29);
      if (idx === tapeSel) { h.setColor(DIM).drawRect(CONTENT_L, y - 3, CONTENT_R, y + 22); h.setColor(FG); } else h.setColor(FG);
      h.setFontAlign(-1, -1).drawString(line, TEXT_L, y);
    }
    footer(tapeMsg ? caps(tapeMsg) : "THUMB SCROLL  PRESS USE");
  }

  function knob2(field, dir) {
    if (dir && tape.length) { tapeSel = wrap(tapeSel + dir, tape.length); tapeMsg = ""; }
  }

  function press(field) {
    if (!tape.length) { tapeMsg = "NO HISTORY"; return; }
    var e = tape[tapeSel];
    ST.ins = "" + e.v;
    ST.msg = "STAGED FOR CALC";
    tapeMsg = "STAGED " + fmt(e.v);
    saveState();
  }

  initState();
  loadTape();
  return bootMode({ mode: "TAPE", fieldCount: function() { return 1; }, draw: draw, knob2: knob2, press: press });
})
