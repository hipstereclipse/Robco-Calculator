#!/usr/bin/env node
// ============================================================
//  build.js -- inline shared fragments, then minify src/*.JS into
//  APPS/*.JS for the device.
//
//  Each mode is now its own standalone app that switches via load(),
//  so only one app is ever resident. Shared helpers live once in
//  src/_LIB.JS (+ src/_EVAL.JS for the math apps) and are spliced into
//  each app at every `//@inject NAME.JS` marker here -- so every
//  shipped APPS/ file is self-contained (duplicated bytes cost card
//  space, not RAM, and there is no runtime lib eval() spike).
//
//  Espruino keeps each function's *source text* resident in RAM, so
//  file size ~= RAM cost; shipping minified files is what lets the app
//  launch without ERROR Errors: CALLBACK, LOW_MEMORY, MEMORY. Repo
//  keeps readable source in src/; the installer ships APPS/ verbatim.
//
//  Usage: npm install && npm run build
// ============================================================
const fs = require("fs");
const path = require("path");
const { minify } = require("terser");

const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src");
const outDir = path.join(root, "APPS");

const INJECT = /^[ \t]*\/\/@inject[ \t]+(\S+)[ \t]*$/gm;

// Splice shared fragments (_LIB.JS / _EVAL.JS) into an app's source at each
// //@inject marker. Fragments contain no markers themselves (no recursion).
function inlineSource(name) {
  const src = fs.readFileSync(path.join(srcDir, name), "utf8");
  return src.replace(INJECT, (m, frag) => fs.readFileSync(path.join(srcDir, frag), "utf8"));
}

// Every app file is a bare parenthesised factory expression:
//   (function(){ ... })
// the device loads it with eval(src) and calls the result. terser's
// compressor would drop a bare expression as dead code, so we wrap it
// in an assignment to keep it, then unwrap and re-parenthesise so the
// output stays an expression eval() can return.
async function buildFile(name) {
  const src = inlineSource(name);
  const result = await minify("var __m=" + src + ";", {
    compress: true,
    mangle: true,
    format: { comments: false },
  });
  if (result.error) throw result.error;
  let code = result.code.trim();
  code = code.replace(/^var __m=/, "").replace(/;$/, "");
  code = "(" + code + ")";
  fs.writeFileSync(path.join(outDir, name), code);
  return { name, before: src.length, after: code.length };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  // Skip fragment files (names starting with "_"): they are inlined, not shipped.
  const files = fs.readdirSync(srcDir).filter((f) => /\.JS$/i.test(f) && !f.startsWith("_"));
  let before = 0, after = 0;
  for (const f of files) {
    const r = await buildFile(f);
    before += r.before; after += r.after;
    const pct = Math.round(100 * (1 - r.after / r.before));
    console.log(
      `${r.name.padEnd(14)} ${String(r.before).padStart(6)} -> ${String(r.after).padStart(6)}  (-${pct}%)`
    );
  }
  console.log(
    `${"TOTAL".padEnd(14)} ${String(before).padStart(6)} -> ${String(after).padStart(6)}  (-${Math.round(100 * (1 - after / before))}%)`
  );
}

module.exports = { inlineSource };

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
