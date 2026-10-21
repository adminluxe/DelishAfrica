#!/usr/bin/env node
"use strict";
/* QA only. Deterministic POG private security-backport attestation.
 * No live keys, network calls, publishing, production payments or signing.
 * Native package audits must remain visible, not laundered.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const vendor = path.join(root, "vendor/pog-security");
const meta = JSON.parse(fs.readFileSync(path.join(vendor, "B7_PACKAGE_MANIFEST.json"), "utf8"));
const project = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const lock = fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
const names = ["braces", "node-forge"];
const expected = {
  "braces": "4bff218db239804e386a20d9b4b577a13c9be7df892d652971277f33f135b5af",
  "node-forge": "1cbc5f02f47c42e1a748b6396f0381658fd2bf97fc99dc4c126fc308ec74dce9",
};
function digest(data, alg) {
  return crypto.createHash(alg).update(data).digest("hex");
}
function tarContents(file, item) {
  return cp.execFileSync("tar", ["-xOzf", file, "package/" + item], {
    maxBuffer: 8 * 1024 * 1024,
    timeout: 15000,
  });
}
for (const name of names) {
  const m = meta.packages[name];
  assert.equal(m.sha256, expected[name], name + " unexpected provenance");
  assert.equal(m.provenance?.releaseApproved, false);
  assert.equal(m.provenance?.candidateOnly, true);
  assert.equal(m.provenance?.officialUpstreamRelease, false);
  assert.equal(m.licensePreserved, true);
  const file = path.join(root, m.archive.replace("vendor/orchidpay-security/", "vendor/pog-security/"));
  const bytes = fs.readFileSync(file);
  assert.equal(digest(bytes, "sha256"), m.sha256);
  assert.equal(digest(bytes, "sha512"), m.sha512);
  assert.equal(project.pnpm.overrides[name], "file:" + path.relative(root, file));
  assert.ok(lock.includes(name + "@file:" + path.relative(root, file)));
  const tarNames = cp.execFileSync("tar", ["-tzf", file], {
    encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024,
  }).trim().split("\n");
  const files = Object.keys(m.files);
  for (const item of tarNames) {
    assert.ok(item.startsWith("package/") && !item.split("/").includes(".."),
      "unsafe tar member: " + item);
  }
  for (const item of files) {
    const bytes = tarContents(file, item);
    assert.equal(digest(bytes, "sha256"), m.files[item].sha256,
      "content tamper " + name + "/" + item);
  }
  const pj = JSON.parse(tarContents(file, "package.json").toString("utf8"));
  assert.equal(pj.name, name);
  assert.equal(pj.version, m.version);
  assert.ok(files.includes("LICENSE"));
  console.log("PASS_BACKPORT_PROVENANCE " + name + " files=" + files.length);
}
const store = path.join(root, "node_modules/.pnpm");
if (!fs.existsSync(store)) {
  if (process.env.CI) throw new Error("CI install missing: cannot assert package runtime");
  console.log("QA_PROVENANCE_ONLY: no installed packages in isolated worktree");
} else {
  const folders = fs.readdirSync(store);
  const libDirs = {};
  for (const name of names) {
    const entry = folders.find(x => x.startsWith(name + "@file+vendor+"));
    assert.ok(entry, name + " patched local tarball not installed");
    libDirs[name] = path.join(store, entry, "node_modules", name);
    assert.ok(fs.existsSync(path.join(libDirs[name], "package.json")));
    const actual = JSON.parse(fs.readFileSync(path.join(libDirs[name], "package.json"), "utf8"));
    assert.equal(actual.version, meta.packages[name].version);
  }
  const braces = require(libDirs.braces);
  let matches = 0;
  for (const sample of [
    "x", "a{b,c}z", "{1..5}", "{05..01}", "{a..e}", "{a,{b,c}}",
    "**/*.{ts,tsx,js,jsx}", "src/**/{screens,components}/*.{ts,tsx}",
    "[a-z]/{a,b}", "a{b,{c,d},e}f", "{a,b,}", "a(b(c))",
  ]) {
    for (const method of ["compile", "expand", "stringify"]) {
      const r = braces[method](sample);
      assert.ok(r !== undefined); matches++;
    }
  }
  for (const depth of [101, 350]) {
    assert.throws(() => braces.expand("{".repeat(depth) + "x" + "}".repeat(depth)),
      /depth|nest|range|limit|exceed/i);
  }
  console.log("PASS_BRACES_INSTALLED " + matches + " normal cases + 2 deep guard rejects");
  const forge = require(path.join(libDirs["node-forge"], "lib/index.js"));
  const tlv = (tag, data) => Buffer.concat([
    Buffer.from([tag, ...(data.length < 128 ? [data.length] : [0x81, data.length])]), data,
  ]);
  const seq = (...children) => tlv(0x30, Buffer.concat(children));
  const oct = x => tlv(0x04, x);
  const oid = tlv(0x06, Buffer.from("608648016503040201", "hex"));
  const nul = tlv(0x05, Buffer.alloc(0));
  for (const exponent of [3, 65537]) {
    const pair = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicExponent: exponent,
      publicKeyEncoding: { format: "pem", type: "spki" },
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
    });
    const msg = Buffer.from("POG QA TEMP KEY - e=" + exponent);
    const digestValue = crypto.createHash("sha256").update(msg).digest();
    const key = forge.pki.publicKeyFromPem(pair.publicKey);
    const valid = crypto.sign("sha256", msg, pair.privateKey);
    assert.equal(key.verify(digestValue.toString("binary"), valid.toString("binary")), true);
    assert.equal(key.verify(crypto.randomBytes(32).toString("binary"),
      valid.toString("binary")), false);
    const der = seq(seq(oid, nul, oct(Buffer.from("nested-garbage"))), oct(digestValue));
    const size = 2048 / 8;
    assert.ok(der.length <= size - 11);
    const em = Buffer.concat([
      Buffer.from([0, 1]), Buffer.alloc(size - der.length - 3, 0xff),
      Buffer.from([0]), der,
    ]);
    const bad = crypto.privateEncrypt({
      key: pair.privateKey,
      padding: crypto.constants.RSA_NO_PADDING,
    }, em);
    let accepted = false;
    try { accepted = key.verify(digestValue.toString("binary"),
      bad.toString("binary")) === true; } catch {}
    assert.equal(accepted, false, "RSA nested garbage accepted");
  }
  console.log("PASS_NODE_FORGE_INSTALLED: temporary-key positive/tamper/DER-negative");
}
console.log("POG_BACKPORT_QA=PASS_TARGETED_NOT_EXTERNAL_CERTIFICATION");
console.log("RELEASE_APPROVED=false SECURITY_REVIEW_REQUIRED=true");
if (process.argv.includes("--release-gate")) {
  console.error("STORE_NO_GO: private cryptographic/build backports have no independent release admission");
  process.exitCode = 10;
}
