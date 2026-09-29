#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(process.argv[2] || "dist");
const expected = {
  "water-app-parity-v2.css": "dfd4db48cebffd990128c1e1c8eb44d2c3b371a19149d20b092501052f1b4ae3",
  "water-cordon-v3.css": "1a3f3277969b7df6771ad7579bda9e54d6b5e3096e6e3b6107c2974b30a5f384",
  "water-rain-food-v4.css": "babc9002a00c836bde6ee5460c89f3b07b46910c34aab87bf044e9aabfd5573a",
  "water-gala-v5.css": "0810430eea29e361ee45559461718b8fae6bfd8c997780de8832cb8d20643b7a",
  "water-gala-v6.css": "d8f080e59664b45aeacf6073946e3a504476733a63f86cbade5d863d89f74466",
  "water-gala-v7.css": "5349a7a0e72ffabf2ed02eeb898ed9f4da86d061c2f385f49963308b28122b9e",
  "water-gala-v8.css": "e72994853a1abdd3734a09c8eda9b7cc331bc607fd0b5b2c321ba2261dacc05b",
  "water-gala-v9.css": "5f80cfe214367521bcfe2c85c67c4338069b31c506eb59bd3f851f7d0c0e43db",
  "water-gala-v10.css": "618219b21e823df7db049f9cf46dd1b487b9662cecbe2714b8d176486d5722d5",
  "water-gala-v11.css": "f2c109fdfa8790ccbb50d1915de12b55a1dc4954cec6a3db79e5853633956200",
};
let failed = false;
for (const [name, want] of Object.entries(expected)) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) {
    console.error("MISSING", name);
    failed = true;
    continue;
  }
  const got = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  if (got !== want) {
    console.error("HASH_MISMATCH", name, got, want);
    failed = true;
  } else {
    console.log("PASS", name, got);
  }
}
for (const rel of ["media/water", "media/dishes/editorial", "media/partners/la-boule-bleue"]) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    console.error("MISSING_DIR", rel);
    failed = true;
  } else {
    console.log("PASS_DIR", rel);
  }
}
if (failed) process.exit(2);
console.log("LIVE_POLISH_GATE=PASS");
