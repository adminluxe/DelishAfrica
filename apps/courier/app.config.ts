import { ConfigContext, ExpoConfig } from "expo/config";

const COURIER_BOOT_BACKGROUND = "#00140B";
const SPLASH_IMAGE = "./assets/splash.png";

const API_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "DelishAfrica Courier",
  slug: "delishafrica-courier",
  owner: "delishafrica",
  scheme: "delishafricacourier",
  version: "3.0.0",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  backgroundColor: COURIER_BOOT_BACKGROUND,
  icon: "./assets/icon.png",
  splash: {
    image: SPLASH_IMAGE,
    resizeMode: "contain",
    backgroundColor: COURIER_BOOT_BACKGROUND,
  },
  ios: {
    ...config.ios,
    supportsTablet: false,
    bundleIdentifier: "com.delishafrica.courier",
    backgroundColor: COURIER_BOOT_BACKGROUND,
    splash: {
      image: SPLASH_IMAGE,
      resizeMode: "contain",
      backgroundColor: COURIER_BOOT_BACKGROUND,
    },
    infoPlist: {
      ...(config.ios?.infoPlist ?? {}),
      CFBundleDisplayName: "DelishAfrica Courier",
      UIViewControllerBasedStatusBarAppearance: false,
    },
  },
  android: {
    ...config.android,
    package: "com.delishafrica.courier",
    splash: {
      image: SPLASH_IMAGE,
      resizeMode: "contain",
      backgroundColor: COURIER_BOOT_BACKGROUND,
    },
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: COURIER_BOOT_BACKGROUND,
    },
  },
  androidStatusBar: {
    barStyle: "light-content",
    backgroundColor: COURIER_BOOT_BACKGROUND,
    translucent: false,
  },
  androidNavigationBar: {
    barStyle: "light-content",
    backgroundColor: COURIER_BOOT_BACKGROUND,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        image: SPLASH_IMAGE,
        backgroundColor: COURIER_BOOT_BACKGROUND,
        dark: {
          image: SPLASH_IMAGE,
          backgroundColor: COURIER_BOOT_BACKGROUND,
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
      projectId: "5d1b6b85-9e64-4cc2-9cbe-7d698feccc84",
    },
  },
});
