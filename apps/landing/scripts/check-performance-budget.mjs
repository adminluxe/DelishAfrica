#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "dist");
const htmlPath = path.join(root, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const bytes = Buffer.byteLength(html);
const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
const stylesheetLinks = linkTags.filter((tag) => /\brel=["']stylesheet["']/i.test(tag));
const hrefs = linkTags.map((tag) => tag.match(/\bhref=["']([^"']+)["']/i)?.[1]).filter(Boolean);
const individualWater = hrefs.filter((href) => /\/water-(?:app-parity|cordon|rain-food|gala-v\d+)\.css(?:\?|$)/i.test(href));
const required = [
  "water-live-v11.bundle.css",
  "delish-theme-v2.css",
  "site.webmanifest.json",
  "data-theme-toggle",
  'rel="preload"',
];
let failed = false;

const pass = (name, value) => console.log("PASS", name, value);
const fail = (name, value) => { console.error("FAIL", name, value); failed = true; };

bytes <= 120000 ? pass("HTML_BYTES", bytes) : fail("HTML_BYTES", bytes);
stylesheetLinks.length <= 4 ? pass("STYLESHEET_LINKS", stylesheetLinks.length) : fail("STYLESHEET_LINKS", stylesheetLinks.length);
individualWater.length === 0 ? pass("INDIVIDUAL_WATER_LINKS", 0) : fail("INDIVIDUAL_WATER_LINKS", individualWater.join(","));

for (const token of required) {
  html.includes(token) ? pass("HTML_TOKEN", token) : fail("HTML_TOKEN", token);
}

for (const rel of ["site.webmanifest.json", "delish-theme-v2.css", "theme-controller-v3.js"]) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) fail("MISSING_ASSET", rel);
  else pass("ASSET_BYTES", rel + "=" + fs.statSync(p).size);
}

const themeBytes = fs.statSync(path.join(root, "delish-theme-v2.css")).size;
themeBytes <= 24000 ? pass("THEME_CSS_BUDGET", themeBytes) : fail("THEME_CSS_BUDGET", themeBytes);

if (failed) process.exit(2);
console.log("PERFORMANCE_BUDGET=PASS");
