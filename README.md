# RobCo Calculator

RobCo Calculator is a Pip-Boy style engineer's calculator for the Pip runtime. The app installs as `Engineer's Calc` and combines a scientific calculator, graphing view, calculus tools, electronics helpers, unit conversions, constants, reference formulas, vacuum calculations, and a calculation tape in one 480x320 fullscreen interface.

![RobCo Calculator preview contact sheet](screenshots/preview-contact-sheet.png)

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

The app is a single JavaScript file at `APPS/PIPCALC.JS`. It returns a Pip app factory that:

- registers `knob1` and `knob2` handlers with `Pip.on(...)`
- draws the fullscreen interface through the Pip graphics helper `h`
- stores all mode state in memory while the app is open
- parses expressions with a small recursive-descent evaluator
- computes numerical derivatives with central differences
- integrates with Simpson's rule
- solves roots and extrema with Newton-style numerical searches

The metadata file `APPINFO/CALC.info` names the app, version, source file, and install payload for the Pip launcher.

## Installation

1. Connect or mount the device storage used by your Pip runtime.
2. Copy `APPS/PIPCALC.JS` into the device's `APPS/` directory.
3. Copy `APPINFO/CALC.info` into the device's `APPINFO/` directory.
4. Restart, rescan, or reload the Pip launcher.
5. Open **Engineer's Calc** from the app list.

This project does not use npm packages for the app itself. The runtime must provide the global `Pip` API and graphics helper `h`; opening `APPS/PIPCALC.JS` directly in a browser or Node.js will not launch the app.

## Preview Images

The `screenshots/` directory contains generated previews for the main screens:

| Screen | Preview |
| --- | --- |
| Calculator | ![Calculator result preview](screenshots/01-calc-result.png) |
| Graph | ![Graph preview](screenshots/02-graph.png) |
| Calculus | ![Calculus preview](screenshots/03-calculus.png) |
| Circuit tools | ![Circuit preview](screenshots/04-circuit.png) |
| Converter | ![Converter preview](screenshots/05-converter.png) |
| Constants | ![Constants preview](screenshots/06-constants.png) |
| Reference rules | ![Reference rules preview](screenshots/07-rules.png) |
| Vacuum tools | ![Vacuum preview](screenshots/08-vacuum.png) |
| Tape | ![Tape preview](screenshots/09-tape.png) |

To regenerate previews on Windows with Node.js and PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File tools/render-previews.ps1 -Scale 2
```

The capture script evaluates the app in a small mocked Pip environment, records drawing operations, and renders PNG files plus `screenshots/preview-contact-sheet.png`.

## Repository Layout

```text
APPINFO/CALC.info        App metadata used by the Pip launcher
APPS/PIPCALC.JS          RobCo Calculator source
screenshots/             Generated README previews
tools/capture-preview-ops.js
tools/render-previews.ps1
```
