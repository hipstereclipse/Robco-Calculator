#!/usr/bin/env node
// ============================================================
//  verify-build.js -- prove the minified APPS/ build renders
//  byte-for-byte identically to the readable src/ source.
//
//  Captures the full screen-op stream from both directories via
//  capture-preview-ops.js and diffs them. Run after `npm run build`.
//  Exits non-zero on any difference.
// ============================================================
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const capture = path.join(__dirname, "capture-preview-ops.js");

function grab(baseDir) {
  const out = path.join(os.tmpdir(), `pipcalc-ops-${baseDir}-${process.pid}.json`);
  execFileSync(process.execPath, [capture, out, baseDir], { stdio: "pipe" });
  const data = JSON.parse(fs.readFileSync(out, "utf8"));
  fs.unlinkSync(out);
  return data.screens;
}

const a = grab("src");
const b = grab("APPS");
let bad = 0;
if (a.length !== b.length) { console.log(`screen count differs: src=${a.length} APPS=${b.length}`); bad++; }
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  const x = a[i] || {}, y = b[i] || {};
  if (x.name !== y.name) { console.log(`screen ${i} name differs: ${x.name} vs ${y.name}`); bad++; continue; }
  if (JSON.stringify(x.ops) !== JSON.stringify(y.ops)) { console.log(`OPS DIFFER on ${x.name}`); bad++; }
  else console.log(`OK ${x.name}`);
}
if (bad) { console.error(`\n*** ${bad} difference(s): minified build does NOT match source ***`); process.exit(1); }
console.log(`\nAll ${a.length} screens identical: src/ and minified APPS/ render the same.`);
