#!/usr/bin/env node
"use strict";
/*
 * POG private dependency QA attestation, R2 and isolated R3B candidates.
 * All packages retain their npm names/versions: advisories are NOT bypassed.
 * DRAFT/CI is untrusted; this script never handles real keys, signs releases,
 * deploys or approves a publication. The release gate always rejects.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const {createRequire} = require("node:module");
const assert = require("node:assert/strict");

if(process.argv.includes("--release-gate")) {
  console.error("STORE_NO_GO: independent audit, native SCA, signing and approval are pending");
  process.exit(10);
}
const root = path.resolve(__dirname, "..");
const vendor = path.join(root, "vendor/pog-security");
const baseline = JSON.parse(fs.readFileSync(path.join(vendor, "B7_PACKAGE_MANIFEST.json"), "utf8"));
const project = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const lock = fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
const R2_BRACES_SHA = "4bff218db239804e386a20d9b4b577a13c9be7df892d652971277f33f135b5af";
const R2_FORGE_SHA = "1cbc5f02f47c42e1a748b6396f0381658fd2bf97fc99dc4c126fc308ec74dce9";
const R3B_FORGE_SHA = "06f9940abf4493b4353ed063e44f4fb5555fef8c5665f5f819b9b6a6737201e2";
const R3B_NAME = "node-forge-1.4.0-pog-r3b-rebuilt-QA-ONLY.tgz";
const r3b = project.pnpm.overrides["node-forge"] === "file:vendor/pog-security/" + R3B_NAME;
const r3bMeta = r3b ?
  JSON.parse(fs.readFileSync(path.join(vendor, "R3B_PACKAGE_MANIFEST.json"), "utf8")) : null;
if(r3b) {
  assert.equal(r3bMeta.archive, R3B_NAME);
  assert.equal(r3bMeta.archiveSha256, R3B_FORGE_SHA);
  assert.equal(r3bMeta.parentR2Sha256, R2_FORGE_SHA);
  assert.equal(r3bMeta.upstreamVersionRetained, "1.4.0");
  assert.equal(r3bMeta.fileCount, 60);
  assert.equal(r3bMeta.builder.independentBuilds, 2);
  assert.equal(r3bMeta.builder.offlineBuild, true);
  for(const flag of ["releaseApproved", "externallyAudited", "signedBinary", "storeApproved"]) {
    assert.equal(r3bMeta[flag], false, "R3B governance unexpectedly relaxed: " + flag);
  }
  assert.equal(r3bMeta.candidateOnly, true);
  assert.equal(r3bMeta.officialUpstreamRelease, false);
}
assert.equal(baseline.releaseApproved, false);
assert.equal(baseline.officialUpstreamRelease, false);

function hash(bytes, algorithm) {
  return crypto.createHash(algorithm).update(bytes).digest("hex");
}
function packageMember(archive, member) {
  return cp.execFileSync("tar", ["-xOzf", archive, "package/" + member], {
    timeout: 15000, maxBuffer: 8 * 1024 * 1024,
  });
}
const metas = {
  braces: {
    name: "braces",
    archive: path.join(vendor, "braces-3.0.3-orchidpay-b7.2.tgz"),
    expected: R2_BRACES_SHA,
    version: "3.0.3",
    sha512: baseline.packages.braces.sha512,
    files: baseline.packages.braces.files,
    provenance: baseline.packages.braces.provenance,
    licensePreserved: baseline.packages.braces.licensePreserved,
  },
  "node-forge": r3b ? {
    name: "node-forge",
    archive: path.join(vendor, R3B_NAME),
    expected: R3B_FORGE_SHA,
    version: "1.4.0",
    sha512: r3bMeta.archiveSha512,
    files: r3bMeta.sourceFiles,
    provenance: {candidateOnly: true, releaseApproved: false, officialUpstreamRelease: false},
    licensePreserved: true,
  } : {
    name: "node-forge",
    archive: path.join(vendor, "node-forge-1.4.0-orchidpay-b7.2.tgz"),
    expected: R2_FORGE_SHA,
    version: "1.4.0",
    sha512: baseline.packages["node-forge"].sha512,
    files: baseline.packages["node-forge"].files,
    provenance: baseline.packages["node-forge"].provenance,
    licensePreserved: baseline.packages["node-forge"].licensePreserved,
  },
};
for(const [name, info] of Object.entries(metas)) {
  assert.equal(info.provenance.releaseApproved, false);
  assert.equal(info.provenance.candidateOnly, true);
  assert.equal(info.provenance.officialUpstreamRelease, false);
  assert.equal(info.licensePreserved, true);
  const pkgPath = "vendor/pog-security/" + path.basename(info.archive);
  assert.equal(project.pnpm.overrides[name], "file:" + pkgPath,
    "unexpected runtime override for " + name);
  assert.ok(lock.includes(name + "@file:" + pkgPath), "missing frozen lock " + name);
  const archiveBytes = fs.readFileSync(info.archive);
  assert.equal(hash(archiveBytes, "sha256"), info.expected, "archive SHA mismatch " + name);
  assert.equal(hash(archiveBytes, "sha512"), info.sha512, "archive SHA512 mismatch " + name);
  const tarEntries = cp.execFileSync("tar", ["-tzf", info.archive], {
    timeout: 15000, maxBuffer: 1024 * 1024, encoding: "utf8",
  }).trim().split("\n");
  assert.equal(new Set(tarEntries).size, tarEntries.length, "duplicate tar members " + name);
  const namedFiles = Object.keys(info.files).sort();
  assert.deepEqual(tarEntries.slice().sort(),
    namedFiles.map(x => "package/" + x).sort(), "wrong tar member list " + name);
  assert.ok(namedFiles.includes("LICENSE"), "license missing " + name);
  for(const item of namedFiles) {
    const b = packageMember(info.archive, item);
    assert.equal(hash(b, "sha256"), info.files[item].sha256,
      "package member hash mismatch " + name + "/" + item);
    if(info.files[item].sha512) {
      assert.equal(hash(b, "sha512"), info.files[item].sha512,
        "package member SHA512 mismatch " + name + "/" + item);
    }
  }
  const pkg = JSON.parse(packageMember(info.archive, "package.json").toString("utf8"));
  assert.equal(pkg.name, name);
  assert.equal(pkg.version, info.version);
  console.log("PASS_BACKPORT_PROVENANCE " + name + " candidate=" + (r3b && name === "node-forge" ? "R3B" : "R2") +
    " archive=" + info.expected + " files=" + namedFiles.length);
}
const store = path.join(root, "node_modules/.pnpm");
if(!fs.existsSync(store)) {
  if(process.env.CI) throw Error("Missing CI dependency installation");
  console.log("QA_PROVENANCE_ONLY: no packages installed");
} else {
  // Identify the consumers by actual resolved paths, not virtual-store assumptions.
  function findPackage(mod, expectedName) {
    let current = path.dirname(fs.realpathSync(mod));
    while(current !== path.dirname(current)) {
      const pj = path.join(current, "package.json");
      if(fs.existsSync(pj) &&
         JSON.parse(fs.readFileSync(pj, "utf8")).name === expectedName) return current;
      current = path.dirname(current);
    }
    throw Error("Unable to locate actual package " + expectedName);
  }
  const metro = require.resolve("metro-file-map");
  const mm = createRequire(metro).resolve("micromatch");
  const braceModule = createRequire(mm).resolve("braces");
  const codeSigningTool = require.resolve("@expo/code-signing-certificates");
  const forgeModule = createRequire(codeSigningTool).resolve("node-forge");
  const installed = {
    braces: findPackage(braceModule, "braces"),
    "node-forge": findPackage(forgeModule, "node-forge"),
  };
  for(const [name, p] of Object.entries(installed)) {
    const meta = metas[name];
    const pkg = JSON.parse(fs.readFileSync(path.join(p, "package.json"), "utf8"));
    assert.equal(pkg.version, meta.version);
    for(const [file, entry] of Object.entries(meta.files)) {
      const actual = fs.readFileSync(path.join(p, file));
      assert.equal(hash(actual, "sha256"), entry.sha256,
        "actual Expo/Metro package differs " + name + "/" + file);
    }
    console.log("PASS_ACTIVE_CONSUMER " + name + " files=" +
      Object.keys(meta.files).length);
  }
  const braces = require(installed.braces);
  let successfulPatterns = 0;
  const benign = [
    "x", "a{b,c}z", "{1..5}", "{05..01}", "{a..e}", "{a,{b,c}}",
    "**/*.{ts,tsx,js,jsx}", "src/**/{screens,components}/*.{ts,tsx}",
    "[a-z]/{a,b}", "a{b,{c,d},e}f", "{a,b,}", "a(b(c))",
  ];
  for(const sample of benign) {
    for(const method of ["compile", "expand", "stringify"]) {
      assert.notEqual(braces[method](sample), undefined);
      successfulPatterns++;
    }
  }
  for(const depth of [101, 350]) {
    assert.throws(() => braces.expand("{".repeat(depth) + "x" + "}".repeat(depth)),
      /depth|nest|range|limit|exceed/i);
  }
  console.log("PASS_BRACES_INSTALLED " + successfulPatterns + " benign and 2 deep rejects");
  const forge = require(path.join(installed["node-forge"], "lib/index.js"));
  const tlv = (tag, b) => Buffer.concat([
    Buffer.from([tag, ...(b.length < 128 ? [b.length] : [0x81, b.length])]), b]);
  const seq = (...nodes) => tlv(0x30, Buffer.concat(nodes));
  const oct = b => tlv(0x04, b);
  const oid = tlv(0x06, Buffer.from("608648016503040201", "hex"));
  const nil = tlv(0x05, Buffer.alloc(0));
  for(const exponent of [3, 65537]) {
    const keys = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048, publicExponent: exponent,
      publicKeyEncoding: {format: "pem", type: "spki"},
      privateKeyEncoding: {format: "pem", type: "pkcs8"},
    });
    const message = Buffer.from("POG ephemeral R3B QA exponent " + exponent);
    const digest = crypto.createHash("sha256").update(message).digest();
    const publicKey = forge.pki.publicKeyFromPem(keys.publicKey);
    const valid = crypto.sign("sha256", message, keys.privateKey);
    for(const options of [undefined, {_parseAllDigestBytes: false}]) {
      assert.equal(publicKey.verify(digest.toString("binary"), valid.toString("binary"),
        "RSASSA-PKCS1-V1_5", options), true, "valid signature rejected");
      assert.equal(publicKey.verify(crypto.randomBytes(32).toString("binary"),
        valid.toString("binary"), "RSASSA-PKCS1-V1_5", options), false,
        "altered digest accepted");
      const wrongDer = seq(seq(oid, nil, oct(Buffer.from("nested-garbage"))), oct(digest));
      const width = 256;
      const encoded = Buffer.concat([Buffer.from([0, 1]),
        Buffer.alloc(width - wrongDer.length - 3, 0xff), Buffer.from([0]), wrongDer]);
      const malicious = crypto.privateEncrypt({
        key: keys.privateKey, padding: crypto.constants.RSA_NO_PADDING}, encoded);
      let accepted = false;
      try {
        accepted = publicKey.verify(digest.toString("binary"), malicious.toString("binary"),
          "RSASSA-PKCS1-V1_5", options) === true;
      } catch {}
      assert.equal(accepted, false, "nested ASN.1 garbage signature accepted");
    }
  }
  console.log("PASS_NODE_FORGE_INSTALLED ephemeral RSA positive, tamper, DER negatives");
}
console.log("POG_BACKPORT_QA=PASS_TARGETED_NOT_EXTERNAL_CERTIFICATION");
console.log("SCA_NOT_WAIVED=true RELEASE_APPROVED=false SECURITY_REVIEW_REQUIRED=true");
