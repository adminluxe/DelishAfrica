const fs = require("fs");

const CLIENT_BOOT_BACKGROUND = "#051411";
const CLIENT_CAMERA_PURPOSE =
  "DelishAfrica utilise l’appareil photo uniquement si vous choisissez de scanner une carte de paiement pour renseigner plus rapidement ses informations. Aucune image n’est conservée par DelishAfrica.";

const iconPath = fs.existsSync("./assets/icon.png") ? "./assets/icon.png" : undefined;
const splashPath = fs.existsSync("./assets/splash.png") ? "./assets/splash.png" : undefined;

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

module.exports = ({ config }) => {
  if (!iconPath || !splashPath) {
    throw new Error("S9_NATIVE_BRAND_ASSET_MISSING_CLIENT");
  }

  return {
    ...config,
    name: "DelishAfrica Client",
    slug: "delishafrica-client",
    owner: "delishafrica",
    scheme: "delishafricaclient",
    version: config.version || "3.0.0",
    orientation: config.orientation || "portrait",
    userInterfaceStyle: "dark",
    backgroundColor: CLIENT_BOOT_BACKGROUND,
    icon: iconPath,
    plugins: [
      "expo-router",
      "expo-dev-client",
      [
        "expo-splash-screen",
        {
          image: splashPath,
          backgroundColor: CLIENT_BOOT_BACKGROUND,
          dark: {
            image: splashPath,
            backgroundColor: CLIENT_BOOT_BACKGROUND,
          },
          imageWidth: 180,
          resizeMode: "contain",
        },
      ],
      "expo-system-ui",
    ],
    splash: {
      image: splashPath,
      resizeMode: "contain",
      backgroundColor: CLIENT_BOOT_BACKGROUND,
    },
    ios: {
      ...(config.ios || {}),
      bundleIdentifier: "com.delishafrica.client",
      supportsTablet: true,
      backgroundColor: CLIENT_BOOT_BACKGROUND,
      infoPlist: {
        ...((config.ios && config.ios.infoPlist) || {}),
        NSCameraUsageDescription: CLIENT_CAMERA_PURPOSE,
      },
      splash: {
        image: splashPath,
        resizeMode: "contain",
        backgroundColor: CLIENT_BOOT_BACKGROUND,
      },
    },
    android: {
      ...(config.android || {}),
      package: "com.delishafrica.client",
      splash: {
        image: splashPath,
        resizeMode: "contain",
        backgroundColor: CLIENT_BOOT_BACKGROUND,
      },
      adaptiveIcon: {
        ...((config.android && config.android.adaptiveIcon) || {}),
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: CLIENT_BOOT_BACKGROUND,
      },
    },
    androidStatusBar: {
      barStyle: "light-content",
      backgroundColor: CLIENT_BOOT_BACKGROUND,
      translucent: false,
    },
    androidNavigationBar: {
      barStyle: "light-content",
      backgroundColor: CLIENT_BOOT_BACKGROUND,
    },
    extra: {
      ...(config.extra || {}),
      EXPO_PUBLIC_API_BASE_URL: API_BASE_URL,
      EXPO_PUBLIC_API_URL: API_BASE_URL,
      eas: {
        ...((config.extra && config.extra.eas) || {}),
        projectId: "b9aebdae-10b4-4638-a576-a5f61352ea97",
      },
    },
  };
};
