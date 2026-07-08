const path = require('path');
const fs = require('fs');

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Make a blockList in a way that survives Metro API differences
function makeBlockList(patterns) {
  // Try Metro's helpers if present; otherwise build a single regex.
  const tries = [
    'metro-config/src/defaults/exclusionList',
    'metro-config/src/defaults/blacklist',
    'metro-config/src/defaults/blacklistRE'
  ];
  for (const mod of tries) {
    try {
      const fn = require(mod);
      return fn(patterns);
    } catch (_) {}
  }
  // Fallback: union the patterns ourselves
  return new RegExp(patterns.map((p) => `(${p})`).join('|'));
}

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(projectRoot);

// IMPORTANT: do NOT watch monorepo root (prevents scanning .secrets)
const candidates = [
  path.join(monorepoRoot, 'packages'),
  path.join(monorepoRoot, 'shared'),
  path.join(monorepoRoot, 'libs'),
];
config.watchFolders = candidates.filter((p) => fs.existsSync(p));

// Prevent resolver from climbing parents (monorepo root)
config.resolver.disableHierarchicalLookup = true;

// Help Metro find node_modules cleanly
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  path.join(monorepoRoot, 'node_modules'),
].filter((p) => fs.existsSync(p));

// Block .secrets just in case (defense in depth)
const secretsPath = path.join(monorepoRoot, '.secrets');
const secretsPattern = `${escapeRegExp(secretsPath)}\\/.*`;
config.resolver.blockList = makeBlockList([secretsPattern]);

module.exports = config;
