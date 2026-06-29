(function() {
  // ============================================================
  //  VACUUM TOOLS (N2)  -- standalone launcher app.
  //  Mean free path, number density, Knudsen regime, and mean molecular
  //  speed for nitrogen. Everything is computed in SI internally, but
  //  every input is entered and shown in a unit the user picks:
  //    NAV   WHEEL picks a field; THUMB cycles that field's display unit
  //          (the physical value is preserved, so it doubles as "show this
  //          in another unit"); PUSH enters EDIT (or opens the converter).
  //    EDIT  WHEEL nudges +/-1 step, THUMB dials the step magnitude, PUSH = done.
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
    // In NAV the thumb cycles the selected row's display unit (the value stays
    // physically the same); push enters EDIT, where wheel = +/-1 step, thumb = magnitude.
    footer(ST.msg ? caps(ST.msg) : (editing ? navHint() : "WHEEL PICK   THUMB UNIT   PUSH EDIT/OPEN"));
  }

  function drawConv(sel) {
    beginScreen("CONVERT");
    var U = cUnits();
    row("QUANTITY", ["PRESSURE", "LENGTH", "TEMPERATURE"][cQ], 40, sel === 1);
    row("FROM", U[cFrom], 64, sel === 2);
    row("TO", U[cTo], 88, sel === 3);
    row("VALUE", fmt(cVal) + " " + U[cFrom], 112, sel === 4);
    row("IMPORT ANS", "ANS=" + fmt(ST.ans), 136, sel === 5);
    row("BACK", "MAIN >", 160, sel === 6);
    var out = convOut();
    section("RESULT", 182);
    smallFont();
    outRow(fmt(cVal) + " " + U[cFrom] + " =", fmt(out) + " " + U[cTo], 206);
    outRow("SCI", sci(out, 8) + " " + U[cTo], 226);
    outRow("ENG", eng(out, 8) + " " + U[cTo], 244);
    bigFont();
    footer(ST.msg ? caps(ST.msg) : navHint());
  }

  function draw(sel) { if (view === 0) drawMain(sel); else drawConv(sel); }

  // Field kinds. Main: 1-4 numeric, 5 CONVERTER action. Converter: 1-3 option
  // lists, 4 numeric value, 5 IMPORT ANS + 6 BACK actions.
  function kind(sel) {
    if (view === 0) return sel === 5 ? "act" : "num";
    return sel <= 3 ? "enum" : sel === 4 ? "num" : "act";
  }

  // THUMB during NAV: cycle the selected main-view field's display unit. (The
  // converter sub-view has no per-field unit, so the thumb is idle there.)
  function navThumb(sel, dir) {
    if (view !== 0) return;
    if (sel === 1) uP = wrap(uP + dir, P_U.length);
    else if (sel === 2) uT = wrap(uT + dir, T_U.length);
    else if (sel === 3) uD = wrap(uD + dir, D_U.length);
    else if (sel === 4) uL = wrap(uL + dir, L_U.length);
  }

  // EDIT: wheel nudges +/-1 * magStep() in the shown unit, thumb dials the step's
  // magnitude. Values are entered in the shown unit but kept in SI internally.
  function edit(sel, dir) {
    var s = magStep();
    if (view === 0) {
      if (sel === 1) vacP = (vacP / P_F[uP] + dir * s) * P_F[uP];
      else if (sel === 2) { vacT = toK(fromK(vacT, uT) + dir * s, uT); if (vacT < 1) vacT = 1; }
      else if (sel === 3) vacD = (vacD / D_F[uD] + dir * s) * D_F[uD];
      else if (sel === 4) vacL = (vacL / L_F[uL] + dir * s) * L_F[uL];
    } else {
      var L = cUnits().length;
      if (sel === 1) { cQ = wrap(cQ + dir, 3); var L2 = cUnits().length; if (cFrom >= L2) cFrom = L2 - 1; if (cTo >= L2) cTo = L2 - 1; }
      else if (sel === 2) cFrom = wrap(cFrom + dir, L);
      else if (sel === 3) cTo = wrap(cTo + dir, L);
      else if (sel === 4) cVal += dir * s;
    }
  }

  function act(sel) {
    if (view === 0) {
      if (sel === 5) { view = 1; field = 1; editing = false; }
    } else {
      if (sel === 5) { cVal = ST.ans; ST.msg = "ANS IMPORTED"; }
      else if (sel === 6) { view = 0; field = 1; editing = false; ST.msg = ""; }
    }
  }

  initState();
  return bootMode({ mode: "VAC", fieldCount: function () { return view === 0 ? 5 : 6; }, draw: draw, kind: kind, edit: edit, act: act, navThumb: navThumb });
})
