(function() {
  //@inject _LIB.JS
  // ============================================================
  //  CONSTANTS  -- standalone app: filtered math, SI physics, unit
  //  factors, space, kitchen. PRESS stages the selected value in
  //  CALCST (ST.ins) so the CALC app inserts it on its next launch.
  // ============================================================
  var CONST_GROUPS = ["ALL","MATH","PHYS","ELEC","THERM","UNIT","MATL","EARTH","SPACE","COOK"];
  var CONST_SEARCHES = ["ALL","pi","log","grav","light","charge","mass","energy","press","length","temp","water","air","space","cook","planck","gas"];
  var CONSTS = [
    ["pi","circle ratio",Math.PI,"","MATH","circle trig"], ["tau","2*pi",2*Math.PI,"","MATH","circle trig"],
    ["e","Euler number",Math.E,"","MATH","exp log"], ["phi","golden ratio",1.618033988749895,"","MATH","geometry"],
    ["sqrt2","root 2",1.4142135623730951,"","MATH","geometry"], ["ln2","natural log 2",0.6931471805599453,"","MATH","log"],
    ["ln10","natural log 10",2.302585092994046,"","MATH","log"], ["log2e","log2(e)",1.4426950408889634,"","MATH","log"],
    ["c","speed of light",299792458,"m/s","PHYS","light relativity"], ["G","gravitation",6.67430e-11,"m3/kg/s2","PHYS","gravity grav mass"],
    ["h","Planck",6.62607015e-34,"J s","PHYS","planck quantum"], ["hbar","red. Planck",1.054571817e-34,"J s","PHYS","planck quantum"],
    ["k","Boltzmann",1.380649e-23,"J/K","THERM","gas thermal"], ["NA","Avogadro",6.02214076e23,"1/mol","PHYS","mole gas"],
    ["R","gas const",8.31446261815324,"J/mol/K","THERM","gas"], ["F","Faraday",96485.33212331,"C/mol","ELEC","charge electrochem"],
    ["qe","elem. charge",1.602176634e-19,"C","ELEC","charge electron"], ["me","electron mass",9.1093837139e-31,"kg","PHYS","mass electron"],
    ["mp","proton mass",1.67262192595e-27,"kg","PHYS","mass proton"], ["mn","neutron mass",1.67492750056e-27,"kg","PHYS","mass neutron"],
    ["amu","atomic mass",1.66053906892e-27,"kg","PHYS","mass atom"], ["alpha","fine struct",0.0072973525643,"","PHYS","charge"],
    ["eps0","vac permitt",8.8541878188e-12,"F/m","ELEC","field capacitance vacuum"], ["mu0","vac permeab",1.25663706127e-6,"H/m","ELEC","field inductance vacuum"],
    ["Z0","vac impedance",376.730313412,"ohm","ELEC","vacuum wave"], ["sigma","Stefan-Boltz",5.670374419e-8,"W/m2/K4","THERM","radiation heat"],
    ["bWien","Wien displ",0.002897771955,"m K","THERM","radiation light"], ["Ry","Rydberg",10973731.568157,"1/m","PHYS","atomic light"],
    ["g0","std gravity",9.80665,"m/s2","EARTH","gravity accel"], ["atm","std atmos",101325,"Pa","UNIT","pressure press air"],
    ["Torr","one torr",133.32236842105263,"Pa","UNIT","pressure press"], ["psi","one psi",6894.757293168361,"Pa","UNIT","pressure press"],
    ["cal","thermo cal",4.184,"J","UNIT","energy heat"], ["BTU","IT Btu",1055.05585,"J","UNIT","energy heat"],
    ["eV","electron volt",1.602176634e-19,"J","UNIT","energy charge"], ["Wh","watt hour",3600,"J","UNIT","energy power"],
    ["in","inch",0.0254,"m","UNIT","length"], ["ft","foot",0.3048,"m","UNIT","length"],
    ["yd","yard",0.9144,"m","UNIT","length"], ["mi","mile",1609.344,"m","UNIT","length"],
    ["nmi","naut mile",1852,"m","UNIT","length space"], ["acre","acre",4046.8564224,"m2","UNIT","area land"],
    ["lb","pound mass",0.45359237,"kg","UNIT","mass"], ["oz","ounce mass",0.028349523125,"kg","UNIT","mass cook"],
    ["galUS","US gallon",0.003785411784,"m3","UNIT","volume cook"], ["cupUS","US cup",0.0002365882365,"m3","COOK","volume"],
    ["cupLbl","label cup",0.00024,"m3","COOK","volume"], ["tbsp","label tbsp",0.000015,"m3","COOK","volume"],
    ["tsp","label tsp",0.000005,"m3","COOK","volume"], ["cupMet","metric cup",0.00025,"m3","COOK","volume"],
    ["rhoW","water dens 20C",998.2071,"kg/m3","MATL","water density"], ["rhoAir","air dens 20C",1.2041,"kg/m3","MATL","air density"],
    ["sndAir","sound air 20C",343.2,"m/s","MATL","air sound"], ["Tice","water freeze",273.15,"K","MATL","water temp"],
    ["Tboil","water boil",373.15,"K","MATL","water temp"], ["STPmol","molar vol STP",0.02241396954,"m3/mol","THERM","gas air"],
    ["earthR","Earth radius",6371008.8,"m","EARTH","space length"], ["earthM","Earth mass",5.9722e24,"kg","EARTH","space mass"],
    ["earthMu","Earth GM",3.986004418e14,"m3/s2","EARTH","space gravity grav"], ["moonR","Moon radius",1737400,"m","SPACE","length"],
    ["moonM","Moon mass",7.342e22,"kg","SPACE","mass"], ["sunM","Solar mass",1.98847e30,"kg","SPACE","mass"],
    ["AU","astro unit",149597870700,"m","SPACE","length"], ["ly","light year",9.4607304725808e15,"m","SPACE","length light"],
    ["pc","parsec",3.0856775814913673e16,"m","SPACE","length"]
  ];
  var constGroup = 0, constSearch = 0, constSel = 0;

  function constGroupOf(e) { return e[4] || "UNIT"; }
  function constHay(e) { return (e[0] + " " + e[1] + " " + e[3] + " " + constGroupOf(e) + " " + (e[5] || "")).toLowerCase(); }
  function constMatch(e) {
    var g = CONST_GROUPS[constGroup], q = CONST_SEARCHES[constSearch].toLowerCase();
    if (g !== "ALL" && constGroupOf(e) !== g) return false;
    return q === "all" || constHay(e).indexOf(q) >= 0;
  }
  function constList() {
    var out = [];
    for (var i = 0; i < CONSTS.length; i++) if (constMatch(CONSTS[i])) out.push(i);
    return out;
  }
  function constEnsure() {
    var list = constList();
    if (!list.length) return list;
    if (list.indexOf(constSel) < 0) constSel = list[0];
    return list;
  }
  function constMove(dir) {
    var list = constEnsure(), p;
    if (!list.length) return;
    p = list.indexOf(constSel);
    constSel = list[wrap(p + dir, list.length)];
  }
  function constValueText(e) {
    return fitLeft(fmt(e[2]) + (e[3] ? " " + e[3] : ""), 22);
  }
  function constCurrent() {
    var list = constEnsure();
    return list.length ? CONSTS[constSel] : null;
  }

  function draw(field) {
    beginScreen("CONSTANTS", "DATA");
    row("GROUP", CONST_GROUPS[constGroup], 40, field === 1);
    row("FIND", caps(CONST_SEARCHES[constSearch]), 64, field === 2);
    var list = constEnsure(), e = constCurrent(), pos = list.indexOf(constSel), y;
    section("", 94);
    if (!e) {
      h.setFontAlign(-1, -1).drawString("NO MATCHES", TEXT_L, 110);
      h.setFontAlign(-1, -1).drawString("TRY GROUP=ALL OR FIND=ALL", TEXT_L, 136);
      footer("WHEEL SELECT  THUMB CHANGE");
      return;
    }
    h.setFontAlign(-1, -1).drawString("MATCH " + (pos + 1) + "/" + list.length, TEXT_L, 104);
    h.setFontAlign(1, -1).drawString(fitLeft(constGroupOf(e) + " " + e[0], 18), TEXT_R, 104);
    h.setFontAlign(-1, -1).drawString(fitRight(caps(e[1]), 22), TEXT_L, 128);
    h.setFontAlign(1, -1).drawString(constValueText(e), TEXT_R, 128);
    h.setColor(DIM).drawLine(CONTENT_L, 160, CONTENT_R, 160);
    var vis = 4, lh = 24, top = Math.max(0, Math.min(pos - 1, list.length - vis));
    for (var i = 0; i < vis && top + i < list.length; i++) {
      var idx = list[top + i], ce = CONSTS[idx];
      y = 172 + i * lh;
      if (idx === constSel && field === 3) { h.setColor(FG).fillRect(CONTENT_L, y - 2, CONTENT_R, y + 20); h.setColor(BG); } else h.setColor(FG);
      h.setFontAlign(-1, -1).drawString(fitRight(caps(ce[0] + " " + ce[1]), 19), TEXT_L, y);
      h.setFontAlign(1, -1).drawString(fitLeft(fmt(ce[2]) + (ce[3] ? " " + ce[3] : ""), 19), TEXT_R, y);
    }
    footer("WHEEL SELECT  THUMB CHANGE  PRESS INSERT");
  }

  function knob2(field, dir) {
    if (field === 1) { constGroup = wrap(constGroup + dir, CONST_GROUPS.length); constEnsure(); }
    else if (field === 2) { constSearch = wrap(constSearch + dir, CONST_SEARCHES.length); constEnsure(); }
    else if (field === 3) constMove(dir);
  }

  function press(field) {
    if (field === 3) { var ce = constCurrent(); if (ce) { ST.ins = "" + ce[2]; ST.msg = "STAGED FOR CALC"; } }
  }

  initState();
  return bootMode({ mode: "CONST", fieldCount: function() { return 3; }, draw: draw, knob2: knob2, press: press });
})
