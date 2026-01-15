const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const polyfills = [
  path.resolve(__dirname, 'apps/client/polyfills.js'),
  path.resolve(__dirname, 'apps/courier/polyfills.js'),
  path.resolve(__dirname, 'apps/merchant/polyfills.js'),
];

config.serializer = config.serializer || {};
const original = config.serializer.getModulesRunBeforeMainModule;

config.serializer.getModulesRunBeforeMainModule = () => {
  const defaults = original ? original() : [];
  return [...polyfills, ...defaults];
};

module.exports = config;
