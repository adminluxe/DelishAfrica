const { execSync } = require("child_process");

function run(cmd) {
  console.log(`[DA][eas-preinstall] ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

let pkg = {};
try { pkg = require("./package.json"); } catch {}

const spec =
  pkg.packageManager && typeof pkg.packageManager === "string" && pkg.packageManager.startsWith("pnpm@")
    ? pkg.packageManager
    : "pnpm@latest";

// enable corepack + activate pnpm
try { run("corepack enable"); } catch (e) { console.log("[DA][eas-preinstall] corepack enable failed (ignored)"); }
try { run(`corepack prepare ${spec} --activate`); } catch (e) { console.log("[DA][eas-preinstall] corepack prepare failed (ignored)"); }

// verify pnpm
try { run("pnpm -v"); } catch (e) {
  console.error("[DA][eas-preinstall] ERROR: pnpm not available.");
  process.exit(1);
}

console.log("[DA][eas-preinstall] OK");
