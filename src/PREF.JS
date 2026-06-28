(function() {
  //@inject _LIB.JS
  // ============================================================
  //  REFERENCE RULES  -- standalone app: formulas, approximations,
  //  geometry cards. Read-only reference; helpers inlined at build.
  // ============================================================
  var REF_SECTIONS = [
    { name: "LOG/EXP", items: [
      { name: "LOG LAWS", lines: ["ln(ab)=ln a+ln b", "ln(a/b)=ln a-ln b", "ln(a^r)=r ln a", "log_b(a)=ln(a)/ln(b)", "a^x=e^(x ln a)"] },
      { name: "EXP LAWS", lines: ["e^(a+b)=e^a e^b", "a^m a^n=a^(m+n)", "(a^m)^n=a^(mn)", "a^-n=1/a^n", "sqrt(a)=a^(1/2)"] },
      { name: "HYPERBOLIC", lines: ["sinh x=(e^x-e^-x)/2", "cosh x=(e^x+e^-x)/2", "cosh^2 x-sinh^2 x=1", "tanh x=sinh x/cosh x"] }
    ] },
    { name: "ALG/DIV", items: [
      { name: "FRACTIONS", lines: ["a/b+c/d=(ad+bc)/bd", "(a/b)(c/d)=ac/bd", "(a/b)/(c/d)=ad/bc", "a/(bc)=(a/b)/c", "(a+b)/c=a/c+b/c"] },
      { name: "QUADRATIC", lines: ["ax^2+bx+c=0", "x=(-b+-sqrt(b^2-4ac))/(2a)", "vertex x=-b/(2a)", "sum roots=-b/a", "product roots=c/a"] },
      { name: "COMPLEX", lines: ["i^2=-1", "(a+bi)(c+di)=(ac-bd)+(ad+bc)i", "|a+bi|=sqrt(a^2+b^2)", "e^(i t)=cos t+i sin t"] }
    ] },
    { name: "DERIV", items: [
      { name: "RULES", lines: ["d(uv)=u'v+uv'", "d(u/v)=(u'v-uv')/v^2", "d f(g)=f'(g)g'", "d x^n=n x^(n-1)", "d ln u=u'/u"] },
      { name: "COMMON", lines: ["d sin x=cos x", "d cos x=-sin x", "d tan x=sec^2 x", "d e^x=e^x", "d a^x=a^x ln a"] },
      { name: "GRADIENT", lines: ["grad f=<df/dx,df/dy,df/dz>", "div F=dFx/dx+dFy/dy+dFz/dz", "curl F=del x F", "Laplacian f=div grad f"] }
    ] },
    { name: "INTEG", items: [
      { name: "RULES", lines: ["int x^n dx=x^(n+1)/(n+1)", "int 1/x dx=ln|x|", "int e^x dx=e^x", "int a^x dx=a^x/ln a", "int f'(x)/f(x) dx=ln|f|"] },
      { name: "METHODS", lines: ["substitution: u=g(x)", "by parts: int u dv=uv-int v du", "even: int_-a^a f=2 int_0^a f", "odd: int_-a^a f=0"] },
      { name: "TRIG INT", lines: ["int sin x dx=-cos x", "int cos x dx=sin x", "int sec^2 x dx=tan x", "int 1/(1+x^2) dx=atan x"] }
    ] },
    { name: "SERIES", items: [
      { name: "MACLAURIN", lines: ["e^x=1+x+x^2/2!+...", "sin x=x-x^3/3!+x^5/5!-...", "cos x=1-x^2/2!+x^4/4!-...", "ln(1+x)=x-x^2/2+x^3/3-...", "|x|<1 where needed"] },
      { name: "APPROX", lines: ["1/(1-x)=1+x+x^2+...", "sqrt(1+x)=1+x/2-x^2/8+...", "(1+x)^a=1+ax+a(a-1)x^2/2+...", "small x: sin x~x, tan x~x"] },
      { name: "NUMERIC", lines: ["trap area=h(y0/2+sum yi+yn/2)", "Simpson=h/3(y0+4y1+2y2+...+yn)", "Newton: x1=x-f/f'", "linear interp y=y0+(x-x0)m"] }
    ] },
    { name: "GEOM2D", items: [
      { name: "RECTANGLE", shape: "RECT", lines: ["A=w h", "P=2(w+h)", "diag=sqrt(w^2+h^2)", "I_x=w h^3/12"] },
      { name: "TRIANGLE", shape: "TRI", lines: ["A=b h/2", "P=a+b+c", "c^2=a^2+b^2-2ab cos C", "centroid=2/3 median"] },
      { name: "CIRCLE", shape: "CIRCLE", lines: ["A=pi r^2", "C=2 pi r", "arc=r theta", "sector=theta r^2/2"] },
      { name: "ELLIPSE", shape: "ELLIPSE", lines: ["A=pi a b", "x^2/a^2+y^2/b^2=1", "c^2=a^2-b^2", "P~2pi sqrt((a^2+b^2)/2)"] }
    ] },
    { name: "GEOM3D", items: [
      { name: "BOX", shape: "BOX", solid: true,
        iso: ["V=l w h", "mass=rho V"], top: ["base=l w"], side: ["S=2(lw+lh+wh)", "diag=sqrt(l^2+w^2+h^2)"] },
      { name: "CYLINDER", shape: "CYL", solid: true,
        iso: ["V=pi r^2 h", "I_axis=1/2 m r^2"], top: ["base=pi r^2", "C=2 pi r"], side: ["side=2 pi r h", "S=2 pi r(r+h)"] },
      { name: "CONE", shape: "CONE", solid: true,
        iso: ["V=pi r^2 h/3", "S=pi r(r+slant)"], top: ["base=pi r^2"], side: ["slant=sqrt(r^2+h^2)", "side=pi r slant"] },
      { name: "SPHERE", shape: "SPHERE", solid: true,
        iso: ["V=4/3 pi r^3", "S=4 pi r^2"], top: ["great circle=2 pi r"], side: ["I_solid=2/5 m r^2"] }
    ] },
    { name: "ENG", items: [
      { name: "VECTORS", lines: ["dot: a.b=|a||b|cos t", "cross: |axb|=|a||b|sin t", "proj_b a=(a.b/|b|^2)b", "work=F.d", "torque=r x F"] },
      { name: "ELECTRICAL", lines: ["V=I R", "P=V I=I^2 R=V^2/R", "Xc=1/(2 pi f C)", "Xl=2 pi f L", "f0=1/(2 pi sqrt(LC))"] },
      { name: "MECHANICS", lines: ["F=m a", "KE=1/2 m v^2", "PE=m g h", "p=m v", "tau=I alpha"] }
    ] }
  ];
  var refSection = 0, refItem = 0;
  function refCurSec() { return REF_SECTIONS[refSection]; }
  function refCurItem() { return refCurSec().items[refItem]; }

  function drawEllipse(cx, cy, rx, ry) {
    var px = cx + rx, py = cy;
    for (var i = 1; i <= 32; i++) {
      var a = Math.PI * 2 * i / 32, nx = cx + Math.cos(a) * rx, ny = cy + Math.sin(a) * ry;
      h.drawLine(px, py, nx, ny); px = nx; py = ny;
    }
  }
  function drawShape(kind, x, y) {
    h.setColor(FG).setFontAlign(-1, -1);
    if (kind === "RECT") {
      h.drawRect(x + 18, y + 26, x + 110, y + 90);
      h.drawString("w", x + 58, y + 94); h.drawString("h", x + 116, y + 54);
    } else if (kind === "TRI") {
      h.drawLine(x + 14, y + 92, x + 118, y + 92); h.drawLine(x + 118, y + 92, x + 70, y + 18); h.drawLine(x + 70, y + 18, x + 14, y + 92);
      h.drawLine(x + 70, y + 18, x + 70, y + 92); h.drawString("b", x + 58, y + 96); h.drawString("h", x + 76, y + 52);
    } else if (kind === "CIRCLE") {
      drawEllipse(x + 66, y + 58, 42, 42); h.drawLine(x + 66, y + 58, x + 108, y + 58); h.drawString("r", x + 86, y + 62);
    } else if (kind === "ELLIPSE") {
      drawEllipse(x + 66, y + 58, 54, 34); h.drawLine(x + 12, y + 58, x + 120, y + 58); h.drawLine(x + 66, y + 24, x + 66, y + 92); h.drawString("a", x + 92, y + 62); h.drawString("b", x + 70, y + 34);
    }
  }
  // 3D solids: one of the three orthographic/iso views, centred at (cx,cy)
  function drawSolidView(view, kind, cx, cy) {
    h.setColor(FG).setFontAlign(-1, -1);
    if (kind === "BOX") {
      if (view === 0) {                                   // ISO cube
        h.drawRect(cx - 20, cy - 6, cx + 8, cy + 18);
        h.drawLine(cx - 20, cy - 6, cx - 10, cy - 16); h.drawLine(cx - 10, cy - 16, cx + 18, cy - 16); h.drawLine(cx + 18, cy - 16, cx + 8, cy - 6);
        h.drawLine(cx + 18, cy - 16, cx + 18, cy + 8); h.drawLine(cx + 18, cy + 8, cx + 8, cy + 18);
      } else if (view === 1) {                            // TOP: l x w footprint
        h.drawRect(cx - 26, cy - 12, cx + 26, cy + 12); h.drawString("l", cx - 2, cy + 14); h.drawString("w", cx + 30, cy - 8);
      } else {                                            // SIDE: w x h profile
        h.drawRect(cx - 18, cy - 18, cx + 18, cy + 18); h.drawString("w", cx - 2, cy + 20); h.drawString("h", cx + 22, cy - 14);
      }
    } else if (kind === "CYL") {
      if (view === 0) {
        drawEllipse(cx, cy - 14, 24, 5); drawEllipse(cx, cy + 14, 24, 5);
        h.drawLine(cx - 24, cy - 14, cx - 24, cy + 14); h.drawLine(cx + 24, cy - 14, cx + 24, cy + 14); h.drawString("h", cx + 28, cy - 6);
      } else if (view === 1) {
        drawEllipse(cx, cy, 18, 18); h.drawLine(cx, cy, cx + 18, cy); h.drawString("r", cx + 4, cy - 14);
      } else {
        h.drawRect(cx - 18, cy - 20, cx + 18, cy + 20); h.drawLine(cx, cy - 20, cx, cy + 20); h.drawString("h", cx + 22, cy - 16);
      }
    } else if (kind === "CONE") {
      if (view === 0) {
        drawEllipse(cx, cy + 14, 24, 5);
        h.drawLine(cx - 24, cy + 14, cx, cy - 18); h.drawLine(cx + 24, cy + 14, cx, cy - 18); h.drawLine(cx, cy - 18, cx, cy + 14); h.drawString("h", cx + 4, cy - 6);
      } else if (view === 1) {
        drawEllipse(cx, cy, 18, 18); h.drawLine(cx, cy, cx + 18, cy); h.drawString("r", cx + 4, cy - 14);
      } else {
        h.drawLine(cx - 22, cy + 18, cx + 22, cy + 18); h.drawLine(cx - 22, cy + 18, cx, cy - 18); h.drawLine(cx + 22, cy + 18, cx, cy - 18);
        h.drawLine(cx, cy - 18, cx, cy + 18); h.drawString("h", cx + 4, cy - 6);
      }
    } else if (kind === "SPHERE") {
      if (view === 0) {
        drawEllipse(cx, cy, 18, 18); drawEllipse(cx, cy, 18, 5); h.drawLine(cx, cy, cx + 18, cy); h.drawString("r", cx + 4, cy - 16);
      } else {
        drawEllipse(cx, cy, 17, 17);
      }
    }
  }
  // GEOM3D card: stacked ISO / TOP / SIDE rows, each with its own equations
  function drawSolid3D(item) {
    var names = ["ISO", "TOP", "SIDE"], groups = [item.iso, item.top, item.side];
    for (var r = 0; r < 3; r++) {
      var y0 = 132 + r * 46, cy = y0 + 22;
      if (r > 0) h.setColor(DIM).drawLine(CONTENT_L, y0 - 2, CONTENT_R, y0 - 2);
      h.setColor(FG).setFontAlign(-1, 0).drawString(names[r], TEXT_L, cy);
      drawSolidView(r, item.shape, 122, cy);
      var g = groups[r] || [];
      for (var i = 0; i < g.length && i < 2; i++)
        h.setColor(FG).setFontAlign(-1, -1).drawString(fitRight(g[i], 26), 176, y0 + 1 + i * 22);
    }
  }
  function draw(field) {
    beginScreen("RULES", "REF");
    var sec = refCurSec(), item = refCurItem();
    row("TOPIC", sec.name, 40, field === 1);
    row("CARD", item.name, 64, field === 2);
    section("", 94);
    h.setFontAlign(-1, -1).drawString("CARD " + (refItem + 1) + "/" + sec.items.length, TEXT_L, 104);
    h.setFontAlign(1, -1).drawString(fitLeft(sec.name, 18), TEXT_R, 104);
    var x = 34, y = 132, max = 34;
    if (item.solid) { drawSolid3D(item); footer("WHEEL SELECT  THUMB CHANGE"); return; }
    if (item.shape) {
      drawShape(item.shape, CONTENT_L, 126);
      x = 178; y = 128; max = 25;
    }
    for (var i = 0; i < item.lines.length && i < 6; i++) {
      h.setColor(FG).setFontAlign(-1, -1).drawString(fitRight(item.lines[i], max), x, y + i * 22);
    }
    footer("WHEEL SELECT  THUMB CHANGE");
  }

  function knob2(field, dir) {
    if (field === 1) { refSection = wrap(refSection + dir, REF_SECTIONS.length); refItem = 0; }
    else if (field === 2) refItem = wrap(refItem + dir, refCurSec().items.length);
  }

  function press() { ST.msg = ""; }

  initState();
  return bootMode({ mode: "REF", fieldCount: function() { return 2; }, draw: draw, knob2: knob2, press: press });
})
