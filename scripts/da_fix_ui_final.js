const fs = require("fs");
const path = require("path");

const ROOT = "/opt/delishafrica/monorepo";
const APPS = ["client", "courier", "merchant"];
const UI_MODULES = ["ui", "useApiHealth", "theme"];
const exts = new Set([".ts", ".tsx", ".js", ".jsx"]);

function exists(p){ try { fs.accessSync(p); return true; } catch { return false; } }
function mkdirp(p){ fs.mkdirSync(p, { recursive: true }); }

function walk(dir, out=[]) {
  if (!exists(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules") continue;
      walk(p, out);
    } else {
      if (exts.has(path.extname(ent.name))) out.push(p);
    }
  }
  return out;
}

function cpMerge(src, dst) {
  mkdirp(dst);
  fs.cpSync(src, dst, { recursive: true, force: true });
}

function rmRF(p) {
  if (exists(p)) fs.rmSync(p, { recursive: true, force: true });
}

function patchFile(file, uiDest) {
  const dir = path.dirname(file);
  let rel = path.relative(dir, uiDest).split(path.sep).join("/");
  if (!rel.startsWith(".")) rel = "./" + rel;

  const before = fs.readFileSync(file, "utf8");

  // remplace toute ref relative vers +ui/_ui/ui (dans app/) par le nouveau ui/ (hors app/)
  // exemples matchés:
  //  "./+ui/ui"  "./_ui/ui"  "../_ui/useApiHealth"  "./ui/theme" etc.
  const re = /(['"])(\.\.?\/[^'"]*?)(?:\+ui|_ui|ui)\/(ui|useApiHealth|theme)\1/g;

  const after = before.replace(re, (_m, q, _prefix, mod) => {
    return `${q}${rel}/${mod}${q}`;
  });

  if (after !== before) fs.writeFileSync(file, after, "utf8");
}

for (const app of APPS) {
  const appDir = path.join(ROOT, "apps", app);
  const routesDir = path.join(appDir, "app");
  const uiDest = path.join(appDir, "ui");

  if (!exists(routesDir)) {
    console.error(`[${app}] ERROR: dossier routes introuvable: ${routesDir}`);
    process.exit(1);
  }

  // backup léger (copie du dossier app)
  const ts = new Date().toISOString().replace(/[:.]/g,"-");
  const bk = path.join(ROOT, "backups", `ui_fix_final_${ts}`, app);
  mkdirp(bk);
  fs.cpSync(routesDir, path.join(bk, "app"), { recursive: true, force: true });

  // source UI possible dans app/
  const candidates = [
    path.join(routesDir, "+ui"),
    path.join(routesDir, "_ui"),
    path.join(routesDir, "ui"),
  ].filter(exists);

  mkdirp(uiDest);

  // copie/merge candidates -> apps/<app>/ui
  for (const src of candidates) cpMerge(src, uiDest);

  // patch imports dans toutes les routes
  for (const f of walk(routesDir)) patchFile(f, uiDest);

  // supprime les dossiers UI sous app/ pour arrêter Expo Router warnings
  rmRF(path.join(routesDir, "+ui"));
  rmRF(path.join(routesDir, "_ui"));
  rmRF(path.join(routesDir, "ui"));

  console.log(`[${app}] OK: UI déplacé hors app/ => ${uiDest} ; imports patchés ; dossiers app/(+ui|_ui|ui) supprimés.`);
}

console.log("DONE.");
