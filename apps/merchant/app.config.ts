import { ConfigContext, ExpoConfig } from "expo/config";

// DA_DEV_VARIANT_SIDE_BY_SIDE_V3 — DEV binary coexists with Store/TestFlight.
const IS_DEV = process.env.APP_VARIANT === "development";
const MERCHANT_APP_NAME = IS_DEV ? "DelishAfrica Merchant DEV" : "DelishAfrica Merchant";
const MERCHANT_DISPLAY_NAME = IS_DEV ? "DA Merchant DEV" : "DelishAfrica Merchant";
const MERCHANT_SCHEME = IS_DEV ? "delishafricamerchantdev" : "delishafricamerchant";
const MERCHANT_IOS_BUNDLE_ID = IS_DEV ? "com.delishafrica.merchant.dev" : "com.delishafrica.merchant";
const MERCHANT_ANDROID_PACKAGE = IS_DEV ? "com.delishafrica.merchant.dev" : "com.delishafrica.merchant";

const MERCHANT_BOOT_BACKGROUND = "#120804";
const SPLASH_IMAGE = "./assets/splash.png";

const API_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: MERCHANT_APP_NAME,
  slug: "delishafrica-merchant",
  owner: "delishafrica",
  scheme: MERCHANT_SCHEME,
  version: "3.0.1",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  backgroundColor: MERCHANT_BOOT_BACKGROUND,
  icon: "./assets/icon.png",
  splash: {
    image: SPLASH_IMAGE,
    resizeMode: "contain",
    backgroundColor: MERCHANT_BOOT_BACKGROUND,
  },
  ios: {
    ...config.ios,
    supportsTablet: false,
    bundleIdentifier: MERCHANT_IOS_BUNDLE_ID,
    backgroundColor: MERCHANT_BOOT_BACKGROUND,
    splash: {
      image: SPLASH_IMAGE,
      resizeMode: "contain",
      backgroundColor: MERCHANT_BOOT_BACKGROUND,
    },
    infoPlist: {
      ...(config.ios?.infoPlist ?? {}),
      CFBundleDisplayName: MERCHANT_DISPLAY_NAME,
      UIViewControllerBasedStatusBarAppearance: false,
    },
  },
  android: {
    ...config.android,
    package: MERCHANT_ANDROID_PACKAGE,
    splash: {
      image: SPLASH_IMAGE,
      resizeMode: "contain",
      backgroundColor: MERCHANT_BOOT_BACKGROUND,
    },
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: MERCHANT_BOOT_BACKGROUND,
    },
  },
  androidStatusBar: {
    barStyle: "light-content",
    backgroundColor: MERCHANT_BOOT_BACKGROUND,
    translucent: false,
  },
  androidNavigationBar: {
    barStyle: "light-content",
    backgroundColor: MERCHANT_BOOT_BACKGROUND,
  },
  plugins: [
    ["expo-dev-client", { addGeneratedScheme: IS_DEV }],
    "expo-notifications",
    "expo-web-browser",
    "expo-router",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        image: SPLASH_IMAGE,
        backgroundColor: MERCHANT_BOOT_BACKGROUND,
        dark: {
          image: SPLASH_IMAGE,
          backgroundColor: MERCHANT_BOOT_BACKGROUND,
        },
        imageWidth: 180,
        resizeMode: "contain",
      },
    ],
    "expo-system-ui",
  ],
  extra: {
    ...(config.extra ?? {}),
    EXPO_PUBLIC_API_URL: API_URL,
    EXPO_PUBLIC_API_BASE_URL: API_URL,
    eas: {
      projectId: "394e7d6f-559b-4536-81a9-fbc0cdb0c68f",
    },
  },
});
