const { getDefaultConfig } = require("expo/metro-config");

let config = getDefaultConfig(__dirname);

// ✅ Safety: some legacy configs put ignorePattern as string => Metro crashes.
if (config.watcher && config.watcher.ignorePattern && !(config.watcher.ignorePattern instanceof RegExp)) {
  delete config.watcher.ignorePattern;
}

// ✅ Run polyfill before main
const polyfill = require.resolve("./polyfills/sharedArrayBuffer");
const prev = (config.serializer && config.serializer.getModulesRunBeforeMainModule)
  ? config.serializer.getModulesRunBeforeMainModule()
  : [];

config.serializer = config.serializer || {};
config.serializer.getModulesRunBeforeMainModule = () => [polyfill, ...prev];

module.exports = config;
