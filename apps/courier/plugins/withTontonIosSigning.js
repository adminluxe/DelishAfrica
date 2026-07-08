const { withXcodeProject } = require("@expo/config-plugins");

function isObject(v){ return v && typeof v === "object" && !Array.isArray(v); }

module.exports = function withTontonIosSigning(config, props = {}) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const TEAM =
      props.teamId ||
      process.env.TONTON_TEAM_ID ||
      process.env.APPLE_TEAM_ID ||
      process.env.EXPO_APPLE_TEAM_ID ||
      "R238JQAKMG";

    const section = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(section)) {
      const item = section[key];
      if (!isObject(item) || !isObject(item.buildSettings)) continue;

      const bs = item.buildSettings;

      // Force Automatic signing + team
      bs.CODE_SIGN_STYLE = "Automatic";
      bs.DEVELOPMENT_TEAM = TEAM;

      // Remove manual-signing traps (including sdk-specific overrides)
      delete bs.PROVISIONING_PROFILE;
      delete bs.PROVISIONING_PROFILE_SPECIFIER;
      delete bs.CODE_SIGN_IDENTITY;

      delete bs["PROVISIONING_PROFILE[sdk=iphoneos*]"];
      delete bs["PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*]"];
      delete bs["CODE_SIGN_IDENTITY[sdk=iphoneos*]"];
    }

    return cfg;
  });
};
