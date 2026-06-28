(function() {
  // ============================================================
  //  VACUUM TOOLS (N2)  -- standalone load()-swap app.
  //  mean free path, density, Knudsen, regime. Shared helpers are
  //  inlined from _LIB.JS at build time; Ans comes from the shared
  //  CALCST state file. Reached from CALC via the MODE menu.
  // ============================================================
  //@inject _LIB.JS

  var vacP = 1, vacT = 293.15, vacD = 3.7e-10, vacL = 0.1;
  var KB = 1.380649e-23, MN2 = 4.6517e-26;
  function meanFreePath() { return KB * vacT / (Math.sqrt(2) * Math.PI * vacD * vacD * vacP); }
  function numberDensity() { return vacP / (KB * vacT); }
  function meanSpeed() { return Math.sqrt(8 * KB * vacT / (Math.PI * MN2)); }

  function draw(field) {
    beginScreen("VACUUM N2", "GAS");
    drawTab();
    var ry = [60, 92, 124, 156];
    var rows = [["P (Pa)", fmt(vacP)], ["T (K)", fmt(vacT)], ["d (m)", fmt(vacD)], ["L (m)", fmt(vacL)]];
    for (var i = 0; i < 4; i++) row(rows[i][0], rows[i][1], ry[i], field === i + 1);
    var mfp = meanFreePath(), Kn = mfp / vacL, reg = Kn < 0.01 ? "viscous" : Kn < 1 ? "transitional" : "molecular";
    section("READOUT", 180);
    h.setColor(FG);
    h.setFontAlign(-1, -1).drawString("mean free path", 26, 198); h.setFontAlign(1, -1).drawString(fitLeft(fmt(mfp) + " m", 22), W - 26, 198);
    h.setFontAlign(-1, -1).drawString("number density", 26, 220); h.setFontAlign(1, -1).drawString(fitLeft(fmt(numberDensity()) + " /m3", 22), W - 26, 220);
    h.setFontAlign(-1, -1).drawString("Knudsen/regime", 26, 242); h.setFontAlign(1, -1).drawString(fitLeft(fmt(Kn) + " " + reg, 24), W - 26, 242);
    h.setFontAlign(-1, -1).drawString("mean speed", 26, 264); h.setFontAlign(1, -1).drawString(fitLeft(fmt(meanSpeed()) + " m/s", 22), W - 26, 264);
    footer("WHEEL:FIELD  THUMB:X10/STEP  PRESS:ANS");
  }

  function knob2(field, dir) {
    if (field === 1) vacP *= (dir > 0 ? 10 : 0.1);
    else if (field === 2) { vacT += dir * 10; if (vacT < 1) vacT = 1; }
    else if (field === 3) { vacD += dir * 0.1e-10; if (vacD < 0.1e-10) vacD = 0.1e-10; }
    else if (field === 4) vacL *= (dir > 0 ? 10 : 0.1);
  }

  function press(field) {
    if (field === 1) vacP = ST.ans; else if (field === 2) vacT = ST.ans; else if (field === 3) vacD = ST.ans; else if (field === 4) vacL = ST.ans;
  }

  initState();
  return bootMode({ mode: "VAC", fieldCount: function () { return 5; }, draw: draw, knob2: knob2, press: press });
})
