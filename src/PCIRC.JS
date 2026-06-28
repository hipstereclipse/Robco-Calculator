(function() {
  //@inject _LIB.JS
  return bootCtxMode("CIRC", function(ctx) {
  // ============================================================
  //  CIRCUIT CALCULATORS (data-driven)  (loaded on demand)
  // ============================================================
  var W = ctx.W, FG = ctx.FG, wrap = ctx.wrap;
  var fmt = ctx.fmt, fitLeft = ctx.fitLeft, fitRight = ctx.fitRight;
  var beginScreen = ctx.beginScreen, drawTab = ctx.drawTab, row = ctx.row;
  var section = ctx.section, footer = ctx.footer;

  var COLORS = ["blk","brn","red","org","yel","grn","blu","vio","gry","wht"];
  var MULTS = ["x.01","x.1","x1","x10","x100","x1k","x10k","x100k","x1M","x10M"];
  var MULTF = [0.01,0.1,1,10,100,1000,10000,100000,1000000,10000000];
  var TOLC = ["brn","red","grn","blu","vio","gry","gld","sil"];
  var TOLV = [1,2,0.5,0.25,0.1,0.05,5,10];
  function par2(a, b) { return a * b / (a + b); }
  function awgArea(n) { var d = 0.127 * Math.pow(92, (36 - n) / 39); return Math.PI / 4 * d * d; }
  var CIRC_TOOLS = [
    { name: "DIVIDER LOAD", in: [{ l:"Vin", u:"V", v:5, step:0.1 }, { l:"Rtop", u:"ohm", v:10000, dec:1 }, { l:"Rbot", u:"ohm", v:10000, dec:1 }, { l:"Load", u:"ohm", v:100000, dec:1 }],
      out: function(vin, rt, rb, rl) { var open = vin * rb / (rt + rb), eq = par2(rb, rl), v = vin * eq / (rt + eq); return [["V open", open, "V"], ["V load", v, "V"], ["I load", v / rl, "A"], ["Err", (open - v) / open * 100, "%"]]; } },
    { name: "OHM+POWER", in: [{ l:"V", u:"V", v:5, step:0.1 }, { l:"R", u:"ohm", v:1000, dec:1 }],
      out: function(V, R) { var I = V / R; return [["I", I, "A"], ["I mA", I * 1000, "mA"], ["P", V * I, "W"], ["R/V", R / V, "ohm/V"]]; } },
    { name: "R NETWORK", in: [{ l:"R1", u:"ohm", v:1000, dec:1 }, { l:"R2", u:"ohm", v:2200, dec:1 }, { l:"R3", u:"ohm", v:4700, dec:1 }],
      out: function(a, b, c) { var rs = a + b + c, rp = 1 / (1/a + 1/b + 1/c); return [["Series", rs, "ohm"], ["Parallel", rp, "ohm"], ["I@5V", 5 / rp, "A"], ["G", 1 / rp, "S"]]; } },
    { name: "LED LIMIT", in: [{ l:"Vs", u:"V", v:5, step:0.1 }, { l:"Vf", u:"V", v:2, step:0.1 }, { l:"I", u:"mA", v:20, step:1 }, { l:"Count", u:"", v:1, intg:1, min:1, max:10 }],
      out: function(vs, vf, i, n) { var head = vs - vf * n, a = i / 1000; if (head <= 0) return [["Headroom", "LOW VS", ""], ["Need >", vf * n, "V"], ["I", i, "mA"], ["Count", n, "LED"]]; return [["R", head / a, "ohm"], ["P res", head * a, "W"], ["P LED", vf * n * a, "W"], ["Margin", head, "V"]]; } },
    { name: "RC STEP/FILT", in: [{ l:"R", u:"ohm", v:10000, dec:1 }, { l:"C", u:"F", v:1e-6, dec:1 }],
      out: function(r, c) { var tau = r * c; return [["tau", tau, "s"], ["fc", 1/(2*Math.PI*tau), "Hz"], ["10-90", 2.2*tau, "s"], ["1% set", 4.6*tau, "s"]]; } },
    { name: "RL STEP/FILT", in: [{ l:"R", u:"ohm", v:100, dec:1 }, { l:"L", u:"H", v:1e-3, dec:1 }],
      out: function(r, l) { var tau = l / r; return [["tau", tau, "s"], ["fc", r/(2*Math.PI*l), "Hz"], ["I@5V", 5/r, "A"], ["E@5V", 0.5*l*Math.pow(5/r,2), "J"]]; } },
    { name: "LC TANK", in: [{ l:"L", u:"H", v:1e-3, dec:1 }, { l:"C", u:"F", v:1e-6, dec:1 }, { l:"Rser", u:"ohm", v:1, dec:1 }],
      out: function(l, c, r) { var f = 1/(2*Math.PI*Math.sqrt(l*c)), xl = 2*Math.PI*f*l, q = xl/r; return [["f0", f, "Hz"], ["X", xl, "ohm"], ["Q", q, ""], ["BW", f/q, "Hz"]]; } },
    { name: "REACTANCE", in: [{ l:"f", u:"Hz", v:1000, dec:1 }, { l:"C", u:"F", v:1e-6, dec:1 }, { l:"L", u:"H", v:1e-3, dec:1 }],
      out: function(f, c, l) { var xc = 1/(2*Math.PI*f*c), xl = 2*Math.PI*f*l; return [["Xc", xc, "ohm"], ["Xl", xl, "ohm"], ["Xl-Xc", xl-xc, "ohm"], ["f0", 1/(2*Math.PI*Math.sqrt(l*c)), "Hz"]]; } },
    { name: "555 ASTABLE", in: [{ l:"RA", u:"ohm", v:10000, dec:1 }, { l:"RB", u:"ohm", v:10000, dec:1 }, { l:"C", u:"F", v:1e-6, dec:1 }],
      out: function(ra, rb, c) { return [["Freq", 1.44/((ra+2*rb)*c), "Hz"], ["Duty", (ra+rb)/(ra+2*rb)*100, "%"], ["High", 0.693*(ra+rb)*c, "s"], ["Low", 0.693*rb*c, "s"]]; } },
    { name: "OP AMP", in: [{ l:"Mode", u:"", v:0, opts:["NONINV","INV"] }, { l:"Rf", u:"ohm", v:10000, dec:1 }, { l:"Rg", u:"ohm", v:1000, dec:1 }, { l:"Vin", u:"V", v:0.1, step:0.1 }],
      out: function(mode, rf, rg, vin) { var g = mode === 0 ? 1 + rf/rg : -rf/rg; return [["Gain", g, "V/V"], ["Vout", g*vin, "V"], ["Rf/Rg", rf/rg, ""], ["Phase", mode === 0 ? "0 deg" : "180 deg", ""]]; } },
    { name: "ADC SCALE", in: [{ l:"Vref", u:"V", v:3.3, step:0.1 }, { l:"Bits", u:"", v:12, intg:1, min:1, max:24 }, { l:"Code", u:"", v:2048, intg:1, min:0, max:16777215 }],
      out: function(vref, bits, code) { var max = Math.pow(2, bits) - 1, lsb = vref / Math.pow(2, bits), c = code > max ? max : code; return [["LSB", lsb, "V"], ["MaxCode", max, ""], ["V code", c*lsb, "V"], ["Pct FS", c/max*100, "%"]]; } },
    { name: "WIRE DROP", in: [{ l:"I", u:"A", v:1, step:0.1 }, { l:"Len", u:"m", v:10, dec:1 }, { l:"AWG", u:"", v:18, intg:1, min:0, max:40 }],
      out: function(i, len, awg) { var area = awgArea(awg), r = 2 * 0.017241 * len / area; return [["Loop R", r, "ohm"], ["V drop", i*r, "V"], ["Loss", i*i*r, "W"], ["Area", area, "mm2"]]; } },
    { name: "R COLOR", in: [{ l:"Band1", u:"", v:1, opts:COLORS }, { l:"Band2", u:"", v:0, opts:COLORS }, { l:"Mult", u:"", v:2, opts:MULTS }, { l:"Tol", u:"", v:6, opts:TOLC }],
      out: function(d1, d2, m, t) { return [["Value", (d1*10+d2)*MULTF[m], "ohm"], ["Tol", TOLV[t], "%"], ["Bands", COLORS[d1]+"-"+COLORS[d2], ""], ["End", MULTS[m]+" "+TOLC[t], ""]]; } }
  ];
  var circTool = 0;
  function stepInput(inp, dir) {
    if (inp.opts) inp.v = wrap(inp.v + dir, inp.opts.length);
    else if (inp.col) inp.v = wrap(inp.v + dir, 10);
    else if (inp.intg) { inp.v += dir; if (inp.v < inp.min) inp.v = inp.min; if (inp.v > inp.max) inp.v = inp.max; }
    else if (inp.dec) inp.v *= (dir > 0 ? 10 : 0.1);
    else inp.v += dir * (inp.step || 1);
  }

  function circInputText(inp) {
    var v = inp.opts ? inp.opts[inp.v] : inp.col ? COLORS[inp.v] : inp.intg ? ("" + inp.v) : fmt(inp.v);
    return v + (inp.u ? " " + inp.u : "");
  }
  function circOutputText(out) {
    var s = fmt(out[1]);
    if (out[2]) s += " " + out[2];
    return fitLeft(s, 25);
  }
  function draw(field) {
    beginScreen("CIRCUIT", "WORK");
    drawTab();
    var t = CIRC_TOOLS[circTool];
    row("WORKBENCH", t.name, 60, field === 1);
    var y = 88, vals = [];
    for (var i = 0; i < t.in.length; i++) {
      var inp = t.in[i]; vals.push(inp.v);
      row(inp.l, circInputText(inp), y, field === i + 2); y += 24;
    }
    section("READOUT", 184);
    var outs = t.out.apply(null, vals);
    y = 204;
    for (var j = 0; j < outs.length && j < 4; j++) {
      h.setColor(FG).setFontAlign(-1, -1).drawString(fitRight(outs[j][0], 10), 36, y);
      h.setFontAlign(1, -1).drawString(circOutputText(outs[j]), W - 26, y); y += 20;
    }
    footer("WHEEL:FIELD  THUMB:SET  PRESS:ANS");
  }

  function knob2(field, dir) {
    if (field === 1) circTool = wrap(circTool + dir, CIRC_TOOLS.length);
    else stepInput(CIRC_TOOLS[circTool].in[field - 2], dir);
  }

  function press(field) {
    if (field >= 2) { CIRC_TOOLS[circTool].in[field - 2].v = ctx.getAns(); ctx.setMsg("Ans imported"); }
  }

  return { fieldCount: function() { return 2 + CIRC_TOOLS[circTool].in.length; }, draw: draw, knob2: knob2, press: press };
  });
})
