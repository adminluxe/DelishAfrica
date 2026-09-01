import { ConfigContext, ExpoConfig } from "expo/config";

const MERCHANT_BOOT_BACKGROUND = "#120804";
const SPLASH_IMAGE = "./assets/splash.png";

const API_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "DelishAfrica Merchant",
  slug: "delishafrica-merchant",
  owner: "delishafrica",
  scheme: "delishafricamerchant",
  version: "3.0.0",
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
    bundleIdentifier: "com.delishafrica.merchant",
    backgroundColor: MERCHANT_BOOT_BACKGROUND,
    splash: {
      image: SPLASH_IMAGE,
      resizeMode: "contain",
      backgroundColor: MERCHANT_BOOT_BACKGROUND,
    },
    infoPlist: {
      ...(config.ios?.infoPlist ?? {}),
      CFBundleDisplayName: "DelishAfrica Merchant",
      UIViewControllerBasedStatusBarAppearance: false,
    },
  },
  android: {
    ...config.android,
    package: "com.delishafrica.merchant",
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
