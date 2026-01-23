// polyfills.js — DelishAfrica
// Fix Hermes iOS: SharedArrayBuffer missing

(() => {
  const g = (typeof globalThis !== "undefined")
    ? globalThis
    : (typeof global !== "undefined" ? global : this);

  if (typeof g.SharedArrayBuffer === "undefined") {
    // Define as a real global identifier (not only a property access)
    Object.defineProperty(g, "SharedArrayBuffer", {
      value: g.ArrayBuffer,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
})();
