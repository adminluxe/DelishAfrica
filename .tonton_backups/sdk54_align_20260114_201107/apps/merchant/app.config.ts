import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "DelishAfrica Merchant",
  slug: "delishafrica-merchant",
  owner: "delishafrica",
  scheme: "delishafrica-merchant",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  extra: {
    EXPO_PUBLIC_API_URL: "https://api.delishafrica.me/api/v1",
  },
  ios: {
    bundleIdentifier: "com.delishafrica.merchant",
  },
  android: {
    package: "com.delishafrica.merchant",
  },
  plugins: ["expo-router", "expo-secure-store"],
};

export default config;
