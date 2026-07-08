import { ConfigContext, ExpoConfig } from "expo/config";

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
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#2A1308",
  },
  ios: {
    ...config.ios,
    supportsTablet: false,
    bundleIdentifier: "com.delishafrica.merchant",
    infoPlist: {
      ...(config.ios?.infoPlist ?? {}),
      CFBundleDisplayName: "DelishAfrica Merchant",
      UIViewControllerBasedStatusBarAppearance: false,
    },
  },
  android: {
    ...config.android,
    package: "com.delishafrica.merchant",
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#2A1308",
    },
  },
  androidStatusBar: {
    barStyle: "light-content",
    backgroundColor: "#2A1308",
    translucent: false,
  },
  androidNavigationBar: {
    barStyle: "light-content",
    backgroundColor: "#2A1308",
  },
  plugins: ["expo-router"],
  extra: {
    ...(config.extra ?? {}),
    EXPO_PUBLIC_API_URL: API_URL,
    EXPO_PUBLIC_API_BASE_URL: API_URL,
    eas: {
      projectId: "394e7d6f-559b-4536-81a9-fbc0cdb0c68f",
    },
  },
});
