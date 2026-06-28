(function() {
  //@inject _LIB.JS
  // ============================================================
  //  UNIT CONVERTER  -- standalone app. Pulls the shared Ans (set in
  //  the CALC app) into the value field via press.
  // ============================================================
  var CATS = [
    { name: "PRESSURE", u: ["Pa","kPa","MPa","GPa","hPa","bar","mbar","ubar","atm","Torr","mTorr","psi","ksi","psf","inHg","mmHg","cmHg","inH2O","ftH2O","cmH2O","mmH2O","kgf/cm2","dyn/cm2"],
      f: [1,1e3,1e6,1e9,100,1e5,100,0.1,101325,133.322368,0.133322368,6894.757293,6.894757293e6,47.88025898,3386.389,133.322368,1333.22368,249.0889,2989.06692,98.0665,9.80665,98066.5,0.1] },
    { name: "LENGTH", u: ["m","km","cm","mm","um","nm","pm","A","mi","yd","ft","in","nmi","fur","chain","rod","ly","pc","AU"],
      f: [1,1e3,1e-2,1e-3,1e-6,1e-9,1e-12,1e-10,1609.344,0.9144,0.3048,0.0254,1852,201.168,20.1168,5.0292,9.4607304725808e15,3.0856775814913673e16,1.495978707e11] },
    { name: "MASS", u: ["kg","g","mg","ug","ng","pg","t","tonUS","tonUK","lb","oz","st","gr","slug","ct","Da","amu"],
      f: [1,1e-3,1e-6,1e-9,1e-12,1e-15,1000,907.18474,1016.0469088,0.45359237,0.028349523125,6.35029318,6.479891e-5,14.59390294,2e-4,1.6605390666e-27,1.6605390666e-27] },
    { name: "COOK MASS", u: ["g","kg","mg","oz","lb","ozLbl","butterStk","tbspButter","cupButter","cupFlour~","cupSugar~","cupBrown~"],
      f: [1e-3,1,1e-6,0.028349523125,0.45359237,0.028,0.1133980925,0.0141747615625,0.226796185,0.12,0.2,0.22] },
    { name: "AREA", u: ["m2","km2","cm2","mm2","um2","ha","acre","ft2","in2","yd2","mi2","rood"],
      f: [1,1e6,1e-4,1e-6,1e-12,1e4,4046.8564224,0.09290304,6.4516e-4,0.83612736,2589988.110336,1011.7141056] },
    { name: "VOLUME", u: ["m3","L","mL","uL","cm3","mm3","ft3","in3","yd3","galUS","qtUS","ptUS","cupUS","flozUS","tbspUS","tspUS","galUK","qtUK","ptUK","flozUK","bbl"],
      f: [1,1e-3,1e-6,1e-9,1e-6,1e-9,0.028316846592,1.6387064e-5,0.764554857984,0.003785411784,0.000946352946,0.000473176473,0.0002365882365,2.95735295625e-5,1.478676478125e-5,4.92892159375e-6,0.00454609,0.0011365225,0.00056826125,2.84130625e-5,0.158987294928] },
    { name: "COOK VOL", u: ["mL","L","tsp","tbsp","flozLbl","cupLbl","flozUS","cupUS","cupMet","ptUS","qtUS","galUS","flozUK","ptUK","qtUK","galUK","pinch","dash","butterStk"],
      f: [1e-6,1e-3,5e-6,15e-6,30e-6,240e-6,2.95735295625e-5,0.0002365882365,0.00025,0.000473176473,0.000946352946,0.003785411784,2.84130625e-5,0.00056826125,0.0011365225,0.00454609,0.3125e-6,0.625e-6,0.00011829411825] },
    { name: "TEMP", u: ["C","F","K","R"], temp: true },
    { name: "ENERGY", u: ["J","kJ","MJ","GJ","mJ","uJ","erg","cal","kcal","Wh","kWh","MWh","eV","keV","MeV","GeV","BTU","therm","ftlb","tonTNT"],
      f: [1,1e3,1e6,1e9,1e-3,1e-6,1e-7,4.184,4184,3600,3.6e6,3.6e9,1.602176634e-19,1.602176634e-16,1.602176634e-13,1.602176634e-10,1055.05585,105480400,1.3558179483,4.184e9] },
    { name: "POWER", u: ["W","mW","kW","MW","GW","hp","hpM","BTU/h","ftlb/s","cal/s","kcal/h","tonR"],
      f: [1,1e-3,1e3,1e6,1e9,745.6998715823,735.49875,0.29307107,1.3558179483,4.184,1.162222222,3516.8528420667] },
    { name: "FORCE", u: ["N","mN","kN","MN","dyn","kgf","gf","lbf","ozf","pdl"],
      f: [1,1e-3,1e3,1e6,1e-5,9.80665,0.00980665,4.4482216153,0.27801385095378125,0.138254954376] },
    { name: "TIME", u: ["s","ms","us","ns","ps","min","h","day","wk","yr","mo"],
      f: [1,1e-3,1e-6,1e-9,1e-12,60,3600,86400,604800,31557600,2629800] },
    { name: "SPEED", u: ["m/s","km/h","mph","ft/s","ft/min","in/s","kn","mach","c"],
      f: [1,0.2777777777777778,0.44704,0.3048,0.00508,0.0254,0.514444444,340.29,299792458] },
    { name: "DATA", u: ["bit","B","nib","kb","kB","Kib","KiB","Mb","MB","Mib","MiB","Gb","GB","Gib","GiB","Tb","TB","Tib","TiB","Pb","PB","Pib","PiB"],
      f: [0.125,1,0.5,125,1000,128,1024,125000,1000000,131072,1048576,125000000,1000000000,134217728,1073741824,125000000000,1000000000000,137438953472,1099511627776,125000000000000,1000000000000000,140737488355328,1125899906842624] },
    { name: "ANGLE", u: ["rad","mrad","urad","deg","grad","turn","arcmin","arcsec","mas","uas"],
      f: [1,1e-3,1e-6,Math.PI/180,Math.PI/200,2*Math.PI,Math.PI/10800,Math.PI/648000,Math.PI/648000000,Math.PI/648000000000] },
    { name: "FREQ", u: ["Hz","mHz","kHz","MHz","GHz","THz","rpm","cpm","BPM"],
      f: [1,1e-3,1e3,1e6,1e9,1e12,1/60,1/60,1/60] },
    { name: "ACCEL", u: ["m/s2","cm/s2","mm/s2","ft/s2","in/s2","g","Gal"],
      f: [1,0.01,0.001,0.3048,0.0254,9.80665,0.01] },
    { name: "TORQUE", u: ["N m","mN m","kN m","lbf ft","lbf in","ozf in","kgf m"],
      f: [1,0.001,1000,1.3558179483314004,0.1129848290276167,0.007061551814226044,9.80665] },
    { name: "DENSITY", u: ["kg/m3","g/cm3","g/mL","kg/L","lb/ft3","lb/in3","lb/gal","slug/ft3"],
      f: [1,1000,1000,1000,16.01846337,27679.90471,119.8264273,515.3788184] },
    { name: "FLOW", u: ["m3/s","L/s","L/min","mL/min","m3/h","ft3/s","cfm","gal/min","gal/h","bbl/day"],
      f: [1,1e-3,1e-3/60,1e-6/60,1/3600,0.028316846592,0.028316846592/60,0.003785411784/60,0.003785411784/3600,0.158987294928/86400] },
    { name: "CHARGE", u: ["C","mC","uC","nC","pC","Ah","mAh","e"],
      f: [1,1e-3,1e-6,1e-9,1e-12,3600,3.6,1.602176634e-19] },
    { name: "RESIST", u: ["ohm","mohm","kohm","Mohm","Gohm"],
      f: [1,1e-3,1e3,1e6,1e9] },
    { name: "CAP", u: ["F","mF","uF","nF","pF"],
      f: [1,1e-3,1e-6,1e-9,1e-12] },
    { name: "INDUCT", u: ["H","mH","uH","nH"],
      f: [1,1e-3,1e-6,1e-9] },
    { name: "MAG B", u: ["T","mT","uT","nT","G","mG"],
      f: [1,1e-3,1e-6,1e-9,1e-4,1e-7] },
    // Radiation categories stay separate: activity, absorbed dose, equivalent dose, exposure, and rates are not interchangeable.
    { name: "RAD ACT", u: ["Bq","kBq","MBq","GBq","TBq","Ci","mCi","uCi","nCi","pCi","dps","dpm"],
      f: [1,1e3,1e6,1e9,1e12,3.7e10,3.7e7,3.7e4,37,0.037,1,1/60] },
    { name: "RAD ABS", u: ["Gy","mGy","uGy","nGy","cGy","rad","mrad","urad","J/kg","erg/g"],
      f: [1,1e-3,1e-6,1e-9,1e-2,1e-2,1e-5,1e-8,1,1e-4] },
    { name: "RAD EQ", u: ["Sv","mSv","uSv","nSv","rem","mrem","urem"],
      f: [1,1e-3,1e-6,1e-9,1e-2,1e-5,1e-8] },
    { name: "RAD EXP", u: ["C/kg","mC/kg","uC/kg","R","mR","uR"],
      f: [1,1e-3,1e-6,2.58e-4,2.58e-7,2.58e-10] },
    { name: "RAD EQRATE", u: ["Sv/s","Sv/h","mSv/h","uSv/h","nSv/h","rem/h","mrem/h","urem/h","mSv/yr","uSv/yr"],
      f: [1,1/3600,1e-3/3600,1e-6/3600,1e-9/3600,1e-2/3600,1e-5/3600,1e-8/3600,1e-3/31557600,1e-6/31557600] },
    { name: "RAD ABSRATE", u: ["Gy/s","Gy/h","mGy/h","uGy/h","rad/h","mrad/h","cGy/min"],
      f: [1,1/3600,1e-3/3600,1e-6/3600,1e-2/3600,1e-5/3600,1e-2/60] },
    { name: "RAD EXPRATE", u: ["C/kg/s","C/kg/h","R/h","mR/h","uR/h"],
      f: [1,1/3600,2.58e-4/3600,2.58e-7/3600,2.58e-10/3600] }
  ];
  var convCat = 6, convFrom = 0, convTo = 5, convVal = 240;

  function convResult() {
    var c = CATS[convCat];
    if (c.temp) {
      var from = c.u[convFrom], to = c.u[convTo], cel;
      if (from === "C") cel = convVal; else if (from === "F") cel = (convVal - 32) * 5/9; else if (from === "K") cel = convVal - 273.15; else cel = (convVal - 491.67) * 5/9;
      if (to === "C") return cel; else if (to === "F") return cel * 9/5 + 32; else if (to === "K") return cel + 273.15; else return (cel + 273.15) * 9/5;
    }
    return convVal * c.f[convFrom] / c.f[convTo];
  }

  function draw(field) {
    beginScreen("CONVERT", "UNIT");
    var c = CATS[convCat], ry = [40, 66, 92, 118], out = convResult(), unit = c.u[convTo];
    var rows = [["CATEGORY", c.name], ["FROM", c.u[convFrom]], ["TO", c.u[convTo]], ["VALUE", convFmt(convVal)]];
    for (var i = 0; i < 4; i++) row(rows[i][0], rows[i][1], ry[i], field === i + 1);
    section("OUTPUT", 146);
    miniRow("RAW =", rawFmt(out) + " " + unit, 174);
    h.setColor(DIM).setFontAlign(-1, -1).drawString("ALSO =", TEXT_L, 200);
    miniRow("SCI", sci(out, 8) + " " + unit, 222);
    miniRow("ENG", eng(out, 8) + " " + unit, 246);
    var m = ST.msg || "";
    if (m) h.setFontAlign(0, -1).drawString(m, W / 2, 266);
    footer("WHEEL SELECT  THUMB CHANGE  PRESS VALUE");
  }

  function knob2(field, dir) {
    var L = CATS[convCat].u.length;
    if (field === 1) { convCat = wrap(convCat + dir, CATS.length); var L2 = CATS[convCat].u.length; if (convFrom >= L2) convFrom = L2 - 1; if (convTo >= L2) convTo = L2 - 1; }
    else if (field === 2) convFrom = wrap(convFrom + dir, L);
    else if (field === 3) convTo = wrap(convTo + dir, L);
    else if (field === 4) convVal *= (dir > 0 ? 10 : 0.1);
  }

  function press(field) {
    if (field === 4) { convVal = ST.ans; ST.msg = "ANS IMPORTED"; }
  }

  initState();
  return bootMode({ mode: "CONV", fieldCount: function() { return 4; }, draw: draw, knob2: knob2, press: press });
})
