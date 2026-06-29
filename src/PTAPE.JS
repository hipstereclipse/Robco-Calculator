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
  var VIS = 7, PITCH = 28, TOPY = 48;

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
      footer(navHint());
      return;
    }
    if (tapeSel < tapeTop) tapeTop = tapeSel;
    if (tapeSel >= tapeTop + VIS) tapeTop = tapeSel - VIS + 1;
    for (var i = 0; i < VIS && tapeTop + i < n; i++) {
      var idx = tapeTop + i, line = tape[idx].s, y = TOPY + i * PITCH;
      if (line.length > 30) line = "<" + line.slice(line.length - 29);
      if (idx === tapeSel) {
        if (field === 1 && (!editing || blinkOn)) { h.setColor(FG).fillRect(CONTENT_L, y - 3, CONTENT_R, y + 22); h.setColor(BG); }
        else { h.setColor(DIM).drawRect(CONTENT_L, y - 3, CONTENT_R, y + 22); h.setColor(FG); }
      } else h.setColor(FG);
      h.setFontAlign(-1, -1).drawString(line, TEXT_L, y);
    }
    // Field 1 = the entry selector (push to edit, then wheel scrolls); field 2 =
    // USE, which stages the highlighted result back into CALC.
    row("USE >CALC", fmt(tape[tapeSel].v), TOPY + VIS * PITCH, field === 2);
    footer(tapeMsg ? caps(tapeMsg) : navHint());
  }

  function kind(field) { return field === 1 ? "enum" : "act"; }
  function edit(field, dir) {
    if (field === 1 && tape.length) { tapeSel = wrap(tapeSel + dir, tape.length); tapeMsg = ""; }
  }

  function act(field) {
    if (field !== 2) return;
    if (!tape.length) { tapeMsg = "NO HISTORY"; return; }
    var e = tape[tapeSel];
    ST.ins = "" + e.v;
    ST.msg = "STAGED FOR CALC";
    tapeMsg = "STAGED " + fmt(e.v);
    saveState();
  }

  initState();
  loadTape();
  return bootMode({ mode: "TAPE", fieldCount: function() { return tape.length ? 2 : 1; }, draw: draw, kind: kind, edit: edit, act: act });
})
