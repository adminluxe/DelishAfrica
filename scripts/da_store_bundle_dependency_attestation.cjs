#!/usr/bin/env node
"use strict";
/**
 * DelishAfrica® — Hermes source-composition attestation.
 * Read-only inspection of six Expo production source maps.
 * Does not read or publish private credentials, source-map contents, or paths.
 * Presence/absence of modules in the mobile bundle does NOT resolve build-tool
 * vulnerabilities or replace the blocking pnpm security audit.
 */
const fs = require("node:fs");
const path = require("node:path");
const roles = ["client", "merchant", "courier"];
const platforms = ["ios", "android"];
const outRoot = process.argv[2];
if (!outRoot || !fs.existsSync(outRoot)) {
  console.error("ATTESTATION=FAIL: expected existing expo export root");
  process.exit(2);
}
const risky = [
  ["node-forge", /(?:^|\/)node-forge(?:\/|$)/i],
  ["braces", /(?:^|\/)braces(?:\/|$)/i],
  ["shell-quote", /(?:^|\/)shell-quote(?:\/|$)/i],
  ["image-size", /(?:^|\/)image-size(?:\/|$)/i],
];
function collectMaps(root) {
  const found = [];
  const pending = [root];
  while (pending.length > 0) {
    const dir = pending.pop();
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) pending.push(full);
      else if (entry.isFile() && entry.name.endsWith(".map")) found.push(full);
    }
  }
  return found;
}
function addSources(doc, collected) {
  if (doc && Array.isArray(doc.sources)) {
    for (const source of doc.sources) {
      if (typeof source === "string") collected.add(source.replace(/\\/g, "/"));
    }
  }
  if (doc && Array.isArray(doc.sections)) {
    for (const section of doc.sections) addSources(section.map, collected);
  }
}
const results = [];
for (const role of roles) {
  for (const platform of platforms) {
    const label = role + "-" + platform;
    const dir = path.join(outRoot, "da-" + label);
    const metadata = path.join(dir, "metadata.json");
    const maps = collectMaps(dir);
    if (!fs.existsSync(metadata) || maps.length === 0) {
      console.error("ATTESTATION=FAIL: " + label + " missing metadata or maps");
      process.exit(3);
    }
    const sources = new Set();
    let readableMaps = 0;
    for (const file of maps) {
      let json;
      try {
        json = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        continue;
      }
      if (json && json.version === 3) {
        readableMaps += 1;
        addSources(json, sources);
      }
    }
    const list = [...sources];
    const hasReactNative = list.some(s =>
      /(?:^|\/)(react-native|expo-router)(?:\/|$)/.test(s));
    if (readableMaps === 0 || list.length < 20 || !hasReactNative) {
      console.error("ATTESTATION=FAIL: " + label + " incomplete source map");
      process.exit(4);
    }
    const detected = risky
      .filter(([, regex]) => list.some(source => regex.test(source)))
      .map(([name]) => name);
    const verdict = detected.length === 0 ? "PASS" : "FAIL";
    console.log(
      "BUNDLE_COMPOSITION " + label
      + " " + verdict
      + " maps=" + readableMaps
      + " source_modules=" + list.length
      + " flagged_packages=" + (detected.join(",") || "none")
    );
    results.push({ label, verdict, maps: readableMaps,
      sources: list.length, flagged: detected });
  }
}
if (results.length !== 6 || results.some(r => r.verdict !== "PASS")) {
  console.error("BUNDLE_COMPOSITION=FAIL");
  process.exit(5);
}
console.log("BUNDLE_COMPOSITION=PASS_6_OF_6");
console.log("BUILD_TOOL_VULNERABILITIES=UNRESOLVED_AUDIT_STILL_REQUIRED");
