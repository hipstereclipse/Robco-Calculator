# RobCo Calculator

RobCo Calculator is a Pip-Boy style engineer's calculator for the Pip runtime. The app installs as `Engineer's Calc` and combines a scientific calculator, graphing view, calculus tools, electronics helpers, unit conversions, constants, reference formulas, vacuum calculations, and a calculation tape in one 480x320 fullscreen interface.

<p align="center">
  <img src="./screenshots/preview-contact-sheet.png" alt="RobCo Calculator preview contact sheet" width="720">
</p>

## Features

- **CALC**: scientific keypad with trig, inverse trig, hyperbolic functions, logs, roots, powers, factorials, `Ans`, memory recall, and `RAD` / `DEG` angle modes.
- **GRAPH**: plots the shared `f(x)` expression, with controls for edit, zoom, and pan.
- **CALCULUS**: evaluates `f(x)`, numerical slope, Simpson-rule area, roots near a guess, and extrema.
- **CIRC**: electronics workbench for dividers, Ohm/power, resistor networks, LED limits, RC/RL filters, LC tanks, reactance, 555 timers, op amps, ADC scale, wire drop, and resistor color values.
- **CONV**: unit converter covering pressure, length, mass, cooking units, area, volume, temperature, energy, power, force, time, speed, data, angle, frequency, acceleration, torque, density, flow, charge, resistance, capacitance, inductance, magnetic field, and radiation units.
- **CONST**: searchable constants for math, physics, electrical, thermal, unit, material, Earth, space, and cooking references.
- **REF**: formula cards for logs, algebra, derivatives, integrals, series, geometry, vectors, electrical formulas, and mechanics.
- **VAC**: nitrogen vacuum helper for mean free path, number density, Knudsen regime, and mean molecular speed.
- **TAPE**: recent calculation history plus green / amber theme switching.

## Controls

RobCo Calculator uses the Pip runtime's two rotary inputs:

- **Knob 1 / wheel** moves through rows or editable fields.
- **Knob 1 press** activates the selected calculator key, field action, insertion, or import.
- **Knob 2 / thumb** moves through columns in `CALC` or changes the selected field in tool modes.

The calculator, graph, and calculus screens share the same `f(x)` expression. In `CALC`, build an expression and press `>f` to set it as the graph/calculus function. Constants and tool results can be inserted back into the calculator, and evaluated results are stored in `Ans` and the tape.

## How It Works

The core app is `APPS/PIPCALC.JS`. It returns a Pip app factory that:

- registers `knob1` and `knob2` handlers with `Pip.on(...)`
- draws the fullscreen interface through the Pip graphics helper `h`
- stores all mode state in memory while the app is open
- parses expressions with a small recursive-descent evaluator
- computes numerical derivatives with central differences
- integrates with Simpson's rule
- solves roots and extrema with Newton-style numerical searches

To fit in device RAM (the Pip runtime is Espruino-based, with limited
memory), only the `CALC` keypad and the shared expression evaluator stay
resident. **Every other mode** lives in its own file that is loaded from the
card only while open and freed on exit, so only one is ever resident:

- `APPS/PGRAPH.JS` — function plotter (`GRAPH`)
- `APPS/PCALCULUS.JS` — numeric calculus (`CALCULUS`)
- `APPS/PCIRC.JS` — circuit workbench (`CIRC`)
- `APPS/PCONV.JS` — unit converter (`CONV`)
- `APPS/PCONST.JS` — constants (`CONST`)
- `APPS/PREF.JS` — reference formula cards (`REF`)
- `APPS/PVAC.JS` — vacuum tools (`VAC`)
- `APPS/PTAPE.JS` — calculation tape + theme (`TAPE`)

Each module file evaluates to a `function(ctx)` factory that returns a
`{ fieldCount, draw, knob2, press }` object; `PIPCALC.JS` passes shared
drawing/formatting helpers, the f(x) evaluator, and state accessors through
`ctx`. The loader tries the runtime's `Storage`, `fs`, and `E.openFile` APIs
in turn; if none can read the file, the mode shows a notice instead of
crashing the app.

Espruino keeps each function's source text resident in RAM, so file size is
essentially RAM cost. The readable source lives in `src/`; the device files in
`APPS/` are the **minified build** produced by `tools/build.js` (terser). The
minified core is ~14 KB versus ~30 KB unminified, which is what lets the app
launch without `ERROR Errors: CALLBACK, LOW_MEMORY, MEMORY`. Edit `src/` and
re-run `npm run build`; never hand-edit `APPS/`.

The metadata file `APPINFO/CALC.info` names the app, version, source file, and install payload for the Pip launcher.

## Installation

### Browser installer

1. Open `install.html` in Chrome or Edge.
2. Select the root of the microSD card used by your Pip runtime.
3. Click **Install**.

The installer reads the payload list from `APPINFO/CALC.info`, downloads the files from this GitHub repository, and writes them into matching `APPS/` and `APPINFO/` folders on the selected card. If your browser does not offer folder write access, use the manual steps below.

**Purge any previous install** is on by default: before writing, the installer reads any `APPINFO/CALC.info` already on the card, deletes every file that older version listed (plus the current payload), and then writes a clean copy. This avoids stale files from an earlier version conflicting with the new one. Uncheck it to install without clearing.

If the direct install fails (some SD-card/OS combinations throw `NotReadableError` from the browser's File System Access API), click **Download .zip** instead. It bundles the same payload into `RobCo-Calculator.zip`; extract that to the microSD root and it creates the `APPS/` and `APPINFO/` folders for you. This path writes no files directly, so it works in any browser.

### Manual install

1. Connect or mount the device storage used by your Pip runtime.
2. Copy `APPS/PIPCALC.JS` and all eight mode modules (`APPS/PGRAPH.JS`, `APPS/PCALCULUS.JS`, `APPS/PCIRC.JS`, `APPS/PCONV.JS`, `APPS/PCONST.JS`, `APPS/PREF.JS`, `APPS/PVAC.JS`, `APPS/PTAPE.JS`) into the device's `APPS/` directory.
3. Copy `APPINFO/CALC.info` into the device's `APPINFO/` directory.
4. Restart, rescan, or reload the Pip launcher.
5. Open **Engineer's Calc** from the app list.

The app itself ships no npm packages; the runtime must provide the global `Pip` API and graphics helper `h`, so opening `APPS/PIPCALC.JS` directly in a browser or Node.js will not launch the app. Every mode except `CALC` needs its matching `APPS/P*.JS` file alongside `PIPCALC.JS` to load on the device.

### Building from source

The device files in `APPS/` are generated from `src/` and are committed so the
installer can fetch them directly. To rebuild after editing `src/`:

1. `npm install` — installs the only dev dependency, `terser`.
2. `npm run build` — minifies `src/*.JS` into `APPS/*.JS`.
3. `npm run verify` — confirms the minified build renders byte-for-byte
   identically to the source (drives the headless harness over every screen).

## Preview Images

The `screenshots/` directory contains generated previews for the main screens:

| Screen | Preview |
| --- | --- |
| Calculator | <img src="./screenshots/01-calc-result.png" alt="Calculator result preview" width="360"> |
| Graph | <img src="./screenshots/02-graph.png" alt="Graph preview" width="360"> |
| Calculus | <img src="./screenshots/03-calculus.png" alt="Calculus preview" width="360"> |
| Circuit tools | <img src="./screenshots/04-circuit.png" alt="Circuit preview" width="360"> |
| Converter | <img src="./screenshots/05-converter.png" alt="Converter preview" width="360"> |
| Constants | <img src="./screenshots/06-constants.png" alt="Constants preview" width="360"> |
| Reference rules | <img src="./screenshots/07-rules.png" alt="Reference rules preview" width="360"> |
| Vacuum tools | <img src="./screenshots/08-vacuum.png" alt="Vacuum preview" width="360"> |
| Tape | <img src="./screenshots/09-tape.png" alt="Tape preview" width="360"> |

To regenerate previews on Windows with Node.js and PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File tools/render-previews.ps1 -Scale 2
```

The capture script evaluates the app in a small mocked Pip environment, records drawing operations, and renders PNG files plus `screenshots/preview-contact-sheet.png`.

## Repository Layout

```text
APPINFO/CALC.info        App metadata + install payload list used by the Pip launcher
APPS/PIPCALC.JS          RobCo Calculator core (CALC/GRAPH/CALCULUS/TAPE + loader)
APPS/PCONV.JS            CONV mode module (loaded on demand)
APPS/PCONST.JS           CONST mode module (loaded on demand)
APPS/PREF.JS             REF mode module (loaded on demand)
APPS/PCIRC.JS            CIRC mode module (loaded on demand)
APPS/PVAC.JS             VAC mode module (loaded on demand)
screenshots/             Generated README previews
tools/capture-preview-ops.js
tools/render-previews.ps1
```
