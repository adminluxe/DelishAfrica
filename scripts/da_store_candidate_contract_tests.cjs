#!/usr/bin/env node
"use strict";
// Read-only release regression suite. No network requests, live accounts or payment calls.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ROOT = path.resolve(__dirname, "..");
const ts = require(path.join(ROOT, "node_modules/typescript"));
let passed = 0;
function check(label, run) {
  return Promise.resolve().then(run).then(() => {
    console.log("PASS " + label);
    passed += 1;
  });
}
function loadSource(relative, stubs = {}) {
  const filename = path.join(ROOT, relative);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics || []).filter(
    (d) => d.category === ts.DiagnosticCategory.Error
  );
  assert.equal(errors.length, 0, relative + " must transpile");
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const baseRequire = mod.require.bind(mod);
  mod.require = (name) => Object.hasOwn(stubs, name)
    ? stubs[name]
    : baseRequire(name);
  mod._compile(compiled.outputText, filename);
  return mod.exports;
}
async function run() {
  const memory = new Map();
  const oldKey = "@delishafrica/client/cart/v1";
  const newKey = "@delishafrica/client/cart/v2";
  const legacyPayload = {
    version: 1,
    cart: { restaurantId: "thieyp", items: [
      { id: "rice", name: "Rice", quantity: 1, unitPrice: 1290 },
    ] },
  };
  memory.set(oldKey, JSON.stringify(legacyPayload));
  const storage = {
    getItem: async (key) => memory.get(key) ?? null,
    setItem: async (key, value) => { memory.set(key, value); },
    removeItem: async (key) => { memory.delete(key); },
  };
  const stub = { "@react-native-async-storage/async-storage": storage };
  const cart = loadSource("apps/client/utils/daCart.ts", stub);
  const valid = {
    restaurantId: "restaurant-verified",
    restaurantSlug: "restaurant-verified",
    restaurantName: "Restaurant Verified",
    serviceAreaLabel: "Ixelles",
    minimumOrderAmount: 0,
  };
  await check("Legacy cart is NOT silently deleted or promoted", async () => {
    const snapshot = await cart.hydrateCartFromStorage();
    assert.equal(snapshot.items.length, 0);
    assert.ok(memory.has(oldKey));
    assert.ok(!memory.has(newKey));
  });
  await check("Missing real restaurant context fails closed", async () => {
    assert.throws(
      () => cart.addToCart({ id: "rice", name: "Rice", unitPrice: 1290 }, {}),
      { code: "DA_CART_RESTAURANT_CONTEXT_REQUIRED" }
    );
    assert.equal(cart.canAddRestaurant({ restaurantId: "missing" }).ok, false);
    assert.equal(cart.getCartSnapshot().items.length, 0);
  });
  await check("Confirmed restaurant context allows a genuine v2 cart", async () => {
    const next = cart.addToCart(
      { id: "rice", name: "Rice", unitPrice: 1290 }, valid
    );
    assert.equal(next.total, 1290);
    assert.equal(next.restaurantSlug, valid.restaurantSlug);
    await cart.waitForCartPersistence();
    assert.equal(JSON.parse(memory.get(newKey)).version, 2);
    assert.ok(memory.has(oldKey), "Old storage remains until v2 is rehydrated");
  });
  await check("Verified v2 cart restores and retires the old key", async () => {
    const reboot = loadSource("apps/client/utils/daCart.ts", stub);
    const snapshot = await reboot.hydrateCartFromStorage();
    assert.equal(snapshot.items.length, 1);
    assert.equal(snapshot.total, 1290);
    assert.equal(snapshot.restaurantName, valid.restaurantName);
    assert.ok(!memory.has(oldKey));
  });
  await check("Malformed v2 is rejected without consuming legacy storage", async () => {
    const isolated = new Map([
      [oldKey, JSON.stringify(legacyPayload)],
      [newKey, JSON.stringify({
        version: 2,
        cart: { restaurantId: "unverified", items: [
          { id: "bad", name: "Bad", quantity: 1, unitPrice: 42 },
        ] },
      })],
    ]);
    const invalidStorage = {
      getItem: async (key) => isolated.get(key) ?? null,
      setItem: async (key, value) => { isolated.set(key, value); },
      removeItem: async (key) => { isolated.delete(key); },
    };
    const cold = loadSource("apps/client/utils/daCart.ts",
      { "@react-native-async-storage/async-storage": invalidStorage });
    assert.equal((await cold.hydrateCartFromStorage()).items.length, 0);
    assert.ok(!isolated.has(newKey));
    assert.ok(isolated.has(oldKey));
  });

  const zones = loadSource("apps/client/utils/daDeliveryZones.ts");
  await check("Delivery zones are restaurant-declared and fail closed", async () => {
    assert.equal(zones.validateDeliveryZone(
      { address: "Rue Longue Vie, 1050", city: "Ixelles" },
      "Bruxelles / Ixelles"
    ).ok, true);
    assert.equal(zones.validateDeliveryZone(
      { city: "Gand", address: "Rue du Port" },
      "Bruxelles / Ixelles"
    ).ok, false);
    assert.equal(zones.validateDeliveryZone(
      { city: "Ixelles" }, ""
    ).ok, false);
    assert.equal(zones.validateDeliveryZone(
      { city: "Gand", address: "Rue d'Ixelles" }, "Bruxelles / Ixelles"
    ).ok, false, "Street names cannot spoof the declared delivery city");
    assert.equal(zones.validateDeliveryZone(
      { city: "", address: "Rue de Bruxelles" }, "Bruxelles / Ixelles"
    ).ok, false, "A street name cannot replace a missing city");
    assert.equal(zones.validateDeliveryZone(
      { city: "Ixelles", address: "" }, "Bruxelles / Ixelles"
    ).ok, false, "The delivery address must also be present");
  });

  const catalog = loadSource("apps/client/utils/daRestaurantCatalog.ts");
  const originalFetch = global.fetch;
  const catalogPayload = [
    { id: "verified", slug: "verified", name: "Restaurant Verified",
      status: "active", delivery: { enabled: true, serviceAreaLabel: "Ixelles" },
      menuItems: [{ id: "rice", name: "Rice", priceEUR: 12.9 }] },
    { id: "placeholder", slug: "placeholder", name: "Fictional",
      status: "placeholder", delivery: { enabled: true, serviceAreaLabel: "Ixelles" },
      menuItems: [{ id: "test", name: "Test" }] },
    { id: "missing-zone", slug: "missing-zone", name: "No coverage",
      status: "active", delivery: { enabled: true },
      menuItems: [{ id: "rice", name: "Rice" }] },
    { id: "closed", slug: "closed", name: "Closed",
      status: "active", acceptingOrders: false,
      delivery: { enabled: true, serviceAreaLabel: "Ixelles" },
      menuItems: [{ id: "rice", name: "Rice" }] },
  ];
  try {
    global.fetch = async () => ({
      ok: true, json: async () => catalogPayload,
    });
    await check("Placeholder restaurants remain hidden from Client", async () => {
      const restaurants = await catalog.fetchRestaurants();
      assert.equal(restaurants.length, 3);
      assert.ok(!restaurants.some((r) => r.slug === "placeholder"));
      assert.ok(restaurants.find((r) => r.slug === "verified").acceptingOrders);
      assert.equal(restaurants.find((r) => r.slug === "missing-zone").acceptingOrders, false);
      assert.equal(restaurants.find((r) => r.slug === "closed").acceptingOrders, false);
    });
    await check("No hard-coded restaurant opens on an empty slug", async () => {
      await assert.rejects(catalog.fetchRestaurantBySlug(""),
        /Sélectionnez un restaurant réel/);
    });
  } finally {
    global.fetch = originalFetch;
  }

  await check("Live map transition includes tracked destination and secure order reads", async () => {
    const app = fs.readFileSync(path.join(ROOT, "apps/client/app/maps-live.tsx"), "utf8");
    const tracking = fs.readFileSync(path.join(ROOT, "apps/client/app/live-tracking.tsx"), "utf8");
    assert.match(app, /daOrdersFetch/);
    assert.match(app, /orders\/demo\/location\/get/);
    assert.match(tracking, /pathname:\s*"\/maps-live"/);
    assert.ok(fs.existsSync(path.join(ROOT, "apps/client/app/maps-live-lab.tsx")));
  });

  await check("Catalog retirement migration is administrative and auditable", async () => {
    const migration = fs.readFileSync(path.join(ROOT,
      "services/api-nest/migrations/catalog-foundation/34b4b5b2a5a2_002_retire_placeholder_partners.sql"), "utf8");
    assert.match(migration, /pg_advisory_xact_lock/);
    assert.match(migration, /INSERT INTO da_catalog_audit/);
    assert.match(migration, /lifecycle_status = 'archived'/);
    assert.match(migration, /da_catalog_schema_migrations/);
  });

  await check("Patched build-tool libraries remain compatible", async () => {
    const imageModule = require("image-size");
    const imageSize = imageModule.default || imageModule.imageSize || imageModule;
    assert.equal(typeof imageSize, "function");
    const pixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9lV3OVQAAAAASUVORK5CYII=",
      "base64"
    );
    assert.deepEqual([imageSize(pixel).width, imageSize(pixel).height], [1, 1]);
    const shellQuote = require("shell-quote");
    assert.throws(() => shellQuote.quote(["echo", "ok", { comment: "x" }, "a\nid;#"]), TypeError);
    const metroAssets = fs.readFileSync(
      path.join(ROOT, "node_modules/metro/src/Assets.js"), "utf8"
    );
    assert.match(metroAssets, /typeof isImageInput === "string"/,
      "Metro must convert its asset paths into bytes for secure image-size v2");
  });

  console.log("STORE_CANDIDATE_CONTRACTS=" + passed + "/11 PASS");
}
run().catch((error) => {
  console.error("STORE_CANDIDATE_CONTRACTS=FAILED", error);
  process.exitCode = 1;
});
