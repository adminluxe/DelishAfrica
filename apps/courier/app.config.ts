import { ConfigContext, ExpoConfig } from "expo/config";

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
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#062A1A",
  },
  ios: {
    ...config.ios,
    supportsTablet: false,
    bundleIdentifier: "com.delishafrica.courier",
    infoPlist: {
      ...(config.ios?.infoPlist ?? {}),
      CFBundleDisplayName: "DelishAfrica Courier",
      UIViewControllerBasedStatusBarAppearance: false,
    },
  },
  android: {
    ...config.android,
    package: "com.delishafrica.courier",
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#062A1A",
    },
  },
  androidStatusBar: {
    barStyle: "light-content",
    backgroundColor: "#062A1A",
    translucent: false,
  },
  androidNavigationBar: {
    barStyle: "light-content",
    backgroundColor: "#062A1A",
  },
  plugins: ["expo-router"],
  extra: {
    ...(config.extra ?? {}),
    EXPO_PUBLIC_API_URL: API_URL,
    EXPO_PUBLIC_API_BASE_URL: API_URL,
    eas: {
      projectId: "5d1b6b85-9e64-4cc2-9cbe-7d698feccc84",
    },
  },
});
