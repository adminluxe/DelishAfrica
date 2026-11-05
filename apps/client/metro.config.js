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

// DA_R7L_MAPS_WEB_ONLY_RESOLVER
// Platform-scoped no-op map module to keep web Metro from loading RN native internals.
const path = require("node:path");
const upstreamResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (ctx, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-maps") {
    return { type: "sourceFile", filePath: path.resolve(__dirname, "utils/daMapsWebStub.tsx") };
  }
  return upstreamResolver
    ? upstreamResolver(ctx, moduleName, platform)
    : ctx.resolveRequest(ctx, moduleName, platform);
};

module.exports = config;
