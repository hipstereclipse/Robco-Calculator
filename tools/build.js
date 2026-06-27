#!/usr/bin/env node
// ============================================================
//  build.js -- minify src/*.JS into APPS/*.JS for the device.
//
//  Espruino keeps each function's *source text* resident in RAM
//  (comments/whitespace/long names included) unless pretokenised,
//  so file size ~= RAM cost. Shipping minified files is what lets
//  the app launch without ERROR Errors: CALLBACK, LOW_MEMORY,
//  MEMORY. Repo keeps readable source in src/; the installer ships
//  the minified APPS/ files verbatim.
//
//  Usage: npm install && npm run build
// ============================================================
const fs = require("fs");
const path = require("path");
const { minify } = require("terser");

const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src");
const outDir = path.join(root, "APPS");

// Every app file is a bare parenthesised factory expression:
//   (function(ctx){ ... })
// the device loads it with eval(src) and calls the result. terser's
// compressor would drop a bare expression as dead code, so we wrap it
// in an assignment to keep it, then unwrap and re-parenthesise so the
// output stays an expression eval() can return.
async function buildFile(name) {
  const src = fs.readFileSync(path.join(srcDir, name), "utf8");
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
  const files = fs.readdirSync(srcDir).filter((f) => /\.JS$/i.test(f));
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
