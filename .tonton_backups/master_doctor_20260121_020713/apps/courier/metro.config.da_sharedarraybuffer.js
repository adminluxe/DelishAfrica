const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const original = config.serializer?.getModulesRunBeforeMainModule;

config.serializer = config.serializer || {};
config.serializer.getModulesRunBeforeMainModule = () => {
  const defaults = original ? original() : [];
  // Important: notre polyfill en tout premier
  return [require.resolve('./polyfills'), ...defaults];
};

module.exports = config;
