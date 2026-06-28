(function() {
  // ============================================================
  //  VACUUM TOOLS (N2)  -- standalone launcher app.
  //  Mean free path, number density, Knudsen regime, and mean molecular
  //  speed for nitrogen. Everything is computed in SI internally, but
  //  every input is entered and shown in a unit the user picks:
  //    WHEEL  selects a field
  //    THUMB  dials the value (1-2-5 steps, or degrees for temperature)
  //    PUSH   cycles + locks that field's unit (the physical value is
  //           preserved, so it doubles as "show this in another unit")
  //  A built-in PRESSURE/LENGTH/TEMPERATURE converter is one push away on
  //  the CONVERTER row, so a value can be turned into the unit you know.
  //  Shared helpers are inlined from _LIB.JS at build time; Ans comes
  //  from the shared CALCST state file.
  // ============================================================
  //@inject _LIB.JS

  var KB = 1.380649e-23, MN2 = 4.6517e-26;

  // Each input field carries a display unit. Lists pair a label with the
  // multiplier that converts one of that unit into the SI base unit.
  var P_U = ["Pa", "Torr", "mbar", "atm", "psi", "kPa", "bar"];
  var P_F = [1, 133.322368, 100, 101325, 6894.757293, 1000, 100000];
  var L_U = ["m", "mm", "cm", "um", "nm", "km"];
  var L_F = [1, 0.001, 0.01, 0.000001, 0.000000001, 1000];
  var D_U = ["A", "nm", "pm", "m"];
  var D_F = [0.0000000001, 0.000000001, 0.000000000001, 1];
  var T_U = ["K", "C", "F"];                              // handled specially

  // SI state + the selected display-unit index for each field.
  var vacP = 1, vacT = 293.15, vacD = 0.00000000037, vacL = 0.1;
  var uP = 0, uT = 0, uD = 0, uL = 0;
  var view = 0;                                           // 0 = main, 1 = converter

  // Converter state (its own quantity / from / to / value).
  var cQ = 0, cFrom = 1, cTo = 0, cVal = 760;

  // ---- unit math ----------------------------------------------------------
  function toK(v, u) { return u === 1 ? v + 273.15 : u === 2 ? (v - 32) * 5 / 9 + 273.15 : v; }
  function fromK(k, u) { return u === 1 ? k - 273.15 : u === 2 ? (k - 273.15) * 9 / 5 + 32 : k; }
  // 1-2-5 stepping on a positive value, so the dialled numbers stay round
  // (1, 2, 5, 10, 20, 50, ...) regardless of the unit they are shown in.
  function nudge(v, dir) {
    if (!(v > 0)) return dir > 0 ? 1 : 0.000001;
    var dec = Math.floor(Math.log(v) / Math.LN10 + 0.000000001);
    var m = v / Math.pow(10, dec);                        // mantissa in [1,10)
    var s = m < 1.5 ? 0 : m < 3.5 ? 1 : m < 7.5 ? 2 : 3;  // snap to 1 / 2 / 5 / 10
    var n = dec * 3 + s + dir;
    var nd = Math.floor(n / 3), nm = n - nd * 3;
    return [1, 2, 5][nm] * Math.pow(10, nd);
  }
  // Length readout that auto-picks a sensible unit instead of forcing metres.
  function lenAuto(m) {
    var a = Math.abs(m);
    if (a === 0) return "0 m";
    if (a < 0.000001) return fmt(m * 1000000000) + " nm";
    if (a < 0.001) return fmt(m * 1000000) + " um";
    if (a < 1) return fmt(m * 1000) + " mm";
    if (a < 1000) return fmt(m) + " m";
    return fmt(m / 1000) + " km";
  }

  // ---- physics (all SI) ---------------------------------------------------
  function meanFreePath() { return KB * vacT / (Math.sqrt(2) * Math.PI * vacD * vacD * vacP); }
  function numberDensity() { return vacP / (KB * vacT); }
  function meanSpeed() { return Math.sqrt(8 * KB * vacT / (Math.PI * MN2)); }

  // ---- converter helpers --------------------------------------------------
  function cUnits() { return cQ === 0 ? P_U : cQ === 1 ? L_U : T_U; }
  function cFactors() { return cQ === 0 ? P_F : L_F; }
  function convOut() {
    if (cQ === 2) return fromK(toK(cVal, cFrom), cTo);
    var f = cFactors();
    return cVal * f[cFrom] / f[cTo];
  }

  // ---- drawing ------------------------------------------------------------
  function drawMain(sel) {
    beginScreen("VACUUM N2");
    row("PRESSURE", fmt(vacP / P_F[uP]) + " " + P_U[uP], 40, sel === 1);
    row("TEMP", fmt(fromK(vacT, uT)) + " " + T_U[uT], 68, sel === 2);
    row("MOL DIAM", fmt(vacD / D_F[uD]) + " " + D_U[uD], 96, sel === 3);
    row("CHAR LEN", fmt(vacL / L_F[uL]) + " " + L_U[uL], 124, sel === 4);
    row("CONVERTER", "OPEN >", 152, sel === 5);
    var mfp = meanFreePath(), Kn = mfp / vacL;
    var reg = Kn < 0.01 ? "VISCOUS" : Kn < 1 ? "TRANSITIONAL" : "MOLECULAR";
    section("READOUT", 176);
    smallFont();
    outRow("MEAN FREE PATH", lenAuto(mfp), 210);
    outRow("NUMBER DENSITY", fmt(numberDensity()) + " /m3", 228);
    outRow("KNUDSEN No", fmt(Kn) + "  " + reg, 246);
    outRow("MEAN SPEED", fmt(meanSpeed()) + " m/s", 264);
    bigFont();
    footer("WHEEL PICK   THUMB DIAL   PUSH UNIT/OPEN");
  }

  function drawConv(sel) {
    beginScreen("CONVERT");
    var U = cUnits();
    row("QUANTITY", ["PRESSURE", "LENGTH", "TEMPERATURE"][cQ], 40, sel === 1);
    row("FROM", U[cFrom], 68, sel === 2);
    row("TO", U[cTo], 96, sel === 3);
    row("VALUE", fmt(cVal) + " " + U[cFrom], 124, sel === 4);
    row("BACK", "MAIN >", 152, sel === 5);
    var out = convOut();
    section("RESULT", 176);
    smallFont();
    outRow(fmt(cVal) + " " + U[cFrom] + " =", fmt(out) + " " + U[cTo], 210);
    outRow("SCI", sci(out, 8) + " " + U[cTo], 232);
    outRow("ENG", eng(out, 8) + " " + U[cTo], 250);
    bigFont();
    footer("WHEEL PICK   THUMB DIAL   PUSH ANS/BACK");
  }

  function draw(sel) { if (view === 0) drawMain(sel); else drawConv(sel); }

  function knob2(sel, dir) {
    if (view === 0) {
      if (sel === 1) vacP = nudge(vacP / P_F[uP], dir) * P_F[uP];
      else if (sel === 2) { var t = fromK(vacT, uT) + dir * (uT === 2 ? 9 : 5); vacT = toK(t, uT); if (vacT < 1) vacT = 1; }
      else if (sel === 3) vacD = nudge(vacD / D_F[uD], dir) * D_F[uD];
      else if (sel === 4) vacL = nudge(vacL / L_F[uL], dir) * L_F[uL];
    } else {
      var L = cUnits().length;
      if (sel === 1) { cQ = wrap(cQ + dir, 3); var L2 = cUnits().length; if (cFrom >= L2) cFrom = L2 - 1; if (cTo >= L2) cTo = L2 - 1; }
      else if (sel === 2) cFrom = wrap(cFrom + dir, L);
      else if (sel === 3) cTo = wrap(cTo + dir, L);
      else if (sel === 4) cVal = cQ === 2 ? cVal + dir * 5 : nudge(cVal, dir);
    }
  }

  function press(sel) {
    if (view === 0) {
      if (sel === 1) uP = wrap(uP + 1, P_U.length);
      else if (sel === 2) uT = wrap(uT + 1, T_U.length);
      else if (sel === 3) uD = wrap(uD + 1, D_U.length);
      else if (sel === 4) uL = wrap(uL + 1, L_U.length);
      else if (sel === 5) { view = 1; field = 1; }
    } else {
      if (sel === 4) cVal = ST.ans;
      else if (sel === 5) { view = 0; field = 1; }
    }
  }

  initState();
  return bootMode({ mode: "VAC", fieldCount: function () { return 5; }, draw: draw, knob2: knob2, press: press });
})
