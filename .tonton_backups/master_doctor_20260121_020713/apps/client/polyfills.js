(() => {
  const g = (typeof globalThis !== "undefined" ? globalThis : global);

  if (typeof g.SharedArrayBuffer === "undefined") {
    try {
      Object.defineProperty(g, "SharedArrayBuffer", {
        value: g.ArrayBuffer,
        writable: true,
        configurable: true,
      });
    } catch (e) {
      g.SharedArrayBuffer = g.ArrayBuffer;
    }
  }

  if (typeof g.Atomics === "undefined") g.Atomics = {};
})();
