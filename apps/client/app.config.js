const fs = require("fs");

// DA_DEV_VARIANT_SIDE_BY_SIDE_V3 — DEV binary coexists with Store/TestFlight.
const IS_DEV = process.env.APP_VARIANT === "development";
// Preview stays blocked until a real isolated QA API and IAM are approved.
const DA_PREVIEW_REQUESTED =
  process.env.EAS_BUILD_PROFILE === "preview" ||
  process.env.APP_VARIANT === "preview";
if (DA_PREVIEW_REQUESTED) {
  throw new Error("DA_PREVIEW_QA_API_ISOLATION_REQUIRED");
}

const CLIENT_APP_NAME = IS_DEV ? "DelishAfrica Client DEV" : "DelishAfrica Client";
const CLIENT_DISPLAY_NAME = IS_DEV ? "DA Client DEV" : "DelishAfrica Client";
const CLIENT_SCHEME = IS_DEV ? "delishafricaclientdev" : "delishafricaclient";
const CLIENT_IOS_BUNDLE_ID = IS_DEV ? "com.delishafrica.client.dev" : "com.delishafrica.client";
const CLIENT_ANDROID_PACKAGE = IS_DEV ? "com.delishafrica.client.dev" : "com.delishafrica.client";

const CLIENT_BOOT_BACKGROUND = "#051411";
const CLIENT_LOCATION_PURPOSE =
  "DelishAfrica utilise votre position uniquement si vous choisissez de détecter votre zone de livraison et de faciliter la saisie de votre adresse.";

const iconPath = fs.existsSync("./assets/icon.png") ? "./assets/icon.png" : undefined;
const splashPath = fs.existsSync("./assets/splash-client.png") ? "./assets/splash-client.png" : undefined;

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
    name: CLIENT_APP_NAME,
    slug: "delishafrica-client",
    owner: "delishafrica",
    scheme: CLIENT_SCHEME,
    version: IS_DEV ? (config.version || "3.0.0") : "3.0.2",
    orientation: config.orientation || "portrait",
    userInterfaceStyle: "dark",
    backgroundColor: CLIENT_BOOT_BACKGROUND,
    icon: iconPath,
    plugins: [
      ["expo-dev-client", { addGeneratedScheme: IS_DEV }],
      "expo-notifications",
      "expo-web-browser",
      "expo-router",
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
      bundleIdentifier: CLIENT_IOS_BUNDLE_ID,
      supportsTablet: true,
      backgroundColor: CLIENT_BOOT_BACKGROUND,
      infoPlist: {
        ...((config.ios && config.ios.infoPlist) || {}),
        CFBundleDisplayName: CLIENT_DISPLAY_NAME,
        NSLocationWhenInUseUsageDescription: CLIENT_LOCATION_PURPOSE,
      },
      splash: {
        image: splashPath,
        resizeMode: "contain",
        backgroundColor: CLIENT_BOOT_BACKGROUND,
      },
    },
    android: {
      ...(config.android || {}),
      package: CLIENT_ANDROID_PACKAGE,
      ...(!IS_DEV
        ? {
            // Store hardening: these broad permissions are not used by Client.
            // Disabling Android backup avoids restoring security-sensitive local state.
            allowBackup: false,
            blockedPermissions: [
              ...((config.android && config.android.blockedPermissions) || []),
              "android.permission.SYSTEM_ALERT_WINDOW",
              "android.permission.READ_EXTERNAL_STORAGE",
              "android.permission.WRITE_EXTERNAL_STORAGE",
              "android.permission.USE_BIOMETRIC",
              "android.permission.USE_FINGERPRINT",
            ],
          }
        : {}),
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
