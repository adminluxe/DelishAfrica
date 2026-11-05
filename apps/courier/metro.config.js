const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

let config = getDefaultConfig(__dirname);

// The original Expo configuration is preserved for iOS and Android.
if (
  config.watcher &&
  config.watcher.ignorePattern &&
  !(config.watcher.ignorePattern instanceof RegExp)
) {
  delete config.watcher.ignorePattern;
}

const polyfill = require.resolve("./polyfills/sharedArrayBuffer");
const prev =
  config.serializer && config.serializer.getModulesRunBeforeMainModule
    ? config.serializer.getModulesRunBeforeMainModule()
    : [];

config.serializer = config.serializer || {};
config.serializer.getModulesRunBeforeMainModule = () => [polyfill, ...prev];

// R7AC_COURIER_MAPS_BROWSER_ONLY_RESOLVER:
// Native map imports must never execute Android/iOS native codegen on web.
// This mirrors the proven Client Expo Metro web resolver.
const upstreamResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-maps") {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "utils/daMapsWebStub.tsx"),
    };
  }
  return upstreamResolver
    ? upstreamResolver(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
