/**
 * Generates THIRD-PARTY-NOTICES.md from what the bundle actually contains.
 *
 * This package ships its chart engine inside `dist/` rather than resolving it
 * from the host app, which makes us a redistributor of that code and puts us
 * under its licences. The notices are therefore part of the published artifact,
 * not documentation.
 *
 * The package list is read from esbuild's metafile — every module that ended up
 * in the bundle — rather than from a hand-kept list, so a new transitive
 * dependency cannot slip in unnoticed.
 *
 *   npm run build     # writes dist/metafile-esm.json
 *   npm run notices   # rewrites THIRD-PARTY-NOTICES.md
 *
 * `npm run notices -- --check` verifies the file is current without writing,
 * which is what CI runs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.join(HERE, "..");
const METAFILE = path.join(PKG, "dist", "metafile-esm.json");
const OUT = path.join(PKG, "THIRD-PARTY-NOTICES.md");
const CHECK = process.argv.includes("--check");

/** Every node_modules package that contributed a module to the bundle. */
function bundledPackages(metafile) {
  const names = new Set();
  for (const input of Object.keys(metafile.inputs)) {
    // "../../node_modules/@wuba/react-native-echarts/lib/..." -> "@wuba/react-native-echarts"
    const at = input.lastIndexOf("node_modules/");
    if (at < 0) continue;
    const rest = input.slice(at + "node_modules/".length).split("/");
    names.add(rest[0].startsWith("@") ? `${rest[0]}/${rest[1]}` : rest[0]);
  }
  return [...names].sort();
}

/** Resolve a package directory by walking up from here, as Node would. */
function resolvePackage(name) {
  let dir = PKG;
  for (;;) {
    const candidate = path.join(dir, "node_modules", name);
    if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const LICENCE_FILES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "COPYING"];

/**
 * The licence a text actually is, independent of what package.json claims.
 * Used only to surface disagreements — not to decide anything on our behalf.
 */
function identify(text) {
  const head = text.slice(0, 2500);
  if (/Apache License\s*\n?\s*Version 2\.0/i.test(head)) return "Apache-2.0";
  if (/\bBSD\b.*3-Clause|Redistributions in binary form/i.test(head) && /\bBSD\b/i.test(head)) return "BSD-3-Clause";
  // 0BSD and ISC share this wording; the two are told apart only by whether a
  // copyright line is retained, which is not worth guessing at.
  if (/Permission to use, copy, modify, and\/or distribute this software/i.test(head)) return "0BSD/ISC";
  if (/Permission is hereby granted, free of charge/i.test(head)) return "MIT";
  return null;
}

/** Does the declared licence agree with what the shipped file appears to be? */
function agrees(declared, actual) {
  if (!declared || !actual) return true;
  if (declared === actual) return true;
  return actual === "0BSD/ISC" && (declared === "0BSD" || declared === "ISC");
}

const metafile = JSON.parse(fs.readFileSync(METAFILE, "utf8"));
const names = bundledPackages(metafile);
if (!names.length) throw new Error("metafile lists no bundled packages — did the build run?");

const parts = [
  "# Third-party notices",
  "",
  "`@tryterra/graphs-react-native` bundles its chart engine into `dist/` rather than",
  "resolving it from the host app. That makes the projects below part of the published",
  "artifact, so their licences are reproduced here in full, as those licences require.",
  "",
  "Generated from the build's own module list by `npm run notices` — do not edit by hand.",
  "",
  `Packages bundled: ${names.length}.`,
  "",
];

const problems = [];

for (const name of names) {
  const dir = resolvePackage(name);
  if (!dir) {
    problems.push(`${name}: bundled but not resolvable from node_modules`);
    continue;
  }

  const meta = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  const declared = typeof meta.license === "string" ? meta.license : meta.license?.type || null;

  const licenceFile = LICENCE_FILES.map((f) => path.join(dir, f)).find((p) => fs.existsSync(p));
  const text = licenceFile ? fs.readFileSync(licenceFile, "utf8").trim() : null;
  const actual = text ? identify(text) : null;

  parts.push(`## ${name} ${meta.version}`, "");
  if (meta.homepage) parts.push(`<${meta.homepage}>`, "");

  // A package whose package.json and LICENSE file disagree is an upstream defect,
  // and silently picking one would misstate the terms we redistribute under. Say
  // both, and say which we comply with.
  if (!agrees(declared, actual)) {
    parts.push(
      `> **Licence declaration conflict (upstream).** \`package.json\` declares \`${declared}\`,`,
      `> while the shipped \`${path.basename(licenceFile)}\` is \`${actual}\`. We redistribute this`,
      `> package unmodified and comply with the terms of the file it ships, reproduced below,`,
      `> which are the more demanding of the two. Reported here rather than resolved silently.`,
      "",
    );
    problems.push(`${name}: package.json says ${declared}, LICENSE file is ${actual}`);
  } else {
    parts.push(`Licence: \`${declared ?? actual ?? "see below"}\`.`, "");
  }

  const notice = path.join(dir, "NOTICE");
  if (fs.existsSync(notice)) {
    // Apache-2.0 s4(d): a NOTICE file must travel with redistributions.
    parts.push("### NOTICE", "", "```", fs.readFileSync(notice, "utf8").trim(), "```", "");
  }

  if (text) {
    parts.push("```", text, "```", "");
  } else {
    parts.push(
      `_No licence file is shipped in the package; \`${declared ?? "unknown"}\` is declared in its package.json._`,
      "",
    );
    problems.push(`${name}: no licence file shipped`);
  }

  parts.push("---", "");
}

const rendered = parts.join("\n");

if (CHECK) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== rendered) {
    console.error("THIRD-PARTY-NOTICES.md is out of date. Run `npm run notices` and commit the result.");
    process.exit(1);
  }
  console.log(`notices are current (${names.length} bundled packages)`);
} else {
  fs.writeFileSync(OUT, rendered);
  console.log(`wrote THIRD-PARTY-NOTICES.md (${names.length} bundled packages)`);
}

for (const p of problems) console.warn(`  note: ${p}`);
