#!/usr/bin/env node
"use strict";

/**
 * DelishAfrica — scan-project.js (SAFE / ASCII only / no external deps)
 * - Finds key config files in monorepo
 * - Searches for API/ports strings in apps
 */

const fs = require("fs");
const path = require("path");

const ROOT = "/opt/delishafrica/monorepo";
const APPS = ["client", "merchant", "courier"];
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".expo", ".next", ".turbo"]);
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_HITS_PER_APP = 80;

const NEEDLES = [
  "api.delishafrica.me",
  "localhost:3010",
  "127.0.0.1:3010",
  ":3010",
  ":4010",
  "EXPO_PUBLIC_API",
  "API_URL",
  "BASE_URL",
  "/api/v1",
];

function exists(p) {
  try { fs.accessSync(p, fs.constants.F_OK); return true; } catch { return false; }
}

function isTextFile(filePath) {
  return /\.(ts|tsx|js|jsx|json|env|yaml|yml|md)$/i.test(filePath);
}

function walk(dir, onFile) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(full, onFile);
    } else if (ent.isFile()) {
      onFile(full);
    }
  }
}

function readSmallFile(filePath) {
  try {
    const st = fs.statSync(filePath);
    if (st.size > MAX_FILE_SIZE) return null;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function findKeyFiles() {
  const keys = [
    "docker-compose.yml",
    "docker-compose.yaml",
    "compose.yml",
    "compose.yaml",
    "eas.json",
    "package.json",
    "pnpm-workspace.yaml",
    "turbo.json",
  ];

  console.log("== ROOT KEY FILES ==");
  for (const k of keys) {
    const p = path.join(ROOT, k);
    console.log(`${exists(p) ? "FOUND" : "---- "}  ${p}`);
  }
  console.log("");
}

function scanApp(app) {
  const appDir = path.join(ROOT, "apps", app);
  console.log(`== APP: ${app.toUpperCase()} ==`);
  console.log(`dir: ${appDir}`);
  if (!exists(appDir)) {
    console.log("ERROR: app dir not found\n");
    return;
  }

  const important = [
    "app.json",
    "app.config.js",
    "app.config.ts",
    "package.json",
    "eas.json",
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
  ];

  console.log("-- important files --");
  for (const f of important) {
    const p = path.join(appDir, f);
    if (exists(p)) console.log(`FOUND  ${p}`);
  }

  let hits = 0;
  console.log("\n-- needle hits (first matches) --");
  walk(appDir, (filePath) => {
    if (hits >= MAX_HITS_PER_APP) return;
    if (!isTextFile(filePath)) return;

    const content = readSmallFile(filePath);
    if (!content) return;

    for (const needle of NEEDLES) {
      if (content.includes(needle)) {
        // Print a compact one-line match per file
        console.log(`HIT   ${filePath}  [${needle}]`);
        hits++;
        break;
      }
    }
  });

  if (hits === 0) console.log("(no hits found)");
  console.log("");
}

function scanCloudflared() {
  const cfDir = "/etc/cloudflared";
  console.log("== CLOUDFLARED (quick) ==");
  if (!exists(cfDir)) {
    console.log("No /etc/cloudflared\n");
    return;
  }

  const files = fs.readdirSync(cfDir).filter((n) => n.endsWith(".yml") || n.endsWith(".yaml") || n === "config.yml");
  for (const f of files.sort()) {
    const p = path.join(cfDir, f);
    const txt = readSmallFile(p);
    if (!txt) continue;

    const lines = txt.split("\n").filter((l) => {
      const s = l.trim();
      return s.startsWith("tunnel:") || s.startsWith("hostname:") || s.startsWith("service:");
    });

    if (lines.length) {
      console.log(`-- ${p}`);
      for (const ln of lines.slice(0, 30)) console.log(ln);
    }
  }
  console.log("");
}

function main() {
  console.log("DelishAfrica scan-project.js");
  console.log("node:", process.version);
  console.log("root:", ROOT);
  console.log("");

  findKeyFiles();
  for (const app of APPS) scanApp(app);
  scanCloudflared();

  console.log("DONE.");
}

main();
