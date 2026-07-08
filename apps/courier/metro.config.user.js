const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../.."); // monorepo root

const config = getDefaultConfig(projectRoot);

// IMPORTANT: monorepo watch
config.watchFolders = [workspaceRoot];

// IMPORTANT: forcer la résolution depuis le root node_modules (pnpm)
config.resolver.nodeModulesPaths = [
  path.resolve(workspaceRoot, "node_modules"),
  path.resolve(projectRoot, "node_modules"),
];

// IMPORTANT: évite que Metro “remonte” et se perde dans pnpm/.pnpm
config.resolver.disableHierarchicalLookup = true;

// IMPORTANT: accepte les symlinks pnpm
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
