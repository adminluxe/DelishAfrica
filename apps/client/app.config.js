
const fs = require("fs");

const iconPath = fs.existsSync("./assets/icon.png") ? "./assets/icon.png" : undefined;
const splashPath = fs.existsSync("./assets/splash.png") ? "./assets/splash.png" : undefined;

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

module.exports = ({ config }) => {
  const nextConfig = {
    ...config,
    name: "DelishAfrica Client",
    slug: "delishafrica-client",
    owner: "delishafrica",
    scheme: "delishafricaclient",
    version: config.version || "3.0.0",
    orientation: config.orientation || "portrait",
    userInterfaceStyle: config.userInterfaceStyle || "automatic",
    plugins: ["expo-router"],
    ios: {
      ...(config.ios || {}),
      bundleIdentifier: "com.delishafrica.client",
      supportsTablet: true
    },
    android: {
      ...(config.android || {}),
      package: "com.delishafrica.client"
    },
    extra: {
      ...(config.extra || {}),
      EXPO_PUBLIC_API_BASE_URL: API_BASE_URL,
      EXPO_PUBLIC_API_URL: API_BASE_URL,
      eas: {
        ...((config.extra && config.extra.eas) || {}),
        projectId: "b9aebdae-10b4-4638-a576-a5f61352ea97"
      }
    }
  };

  if (iconPath) {
    nextConfig.icon = iconPath;
  }

  if (splashPath) {
    nextConfig.splash = {
      ...(config.splash || {}),
      image: splashPath,
      resizeMode: "contain",
      backgroundColor: "#070A13"
    };
  }

  return nextConfig;
};
