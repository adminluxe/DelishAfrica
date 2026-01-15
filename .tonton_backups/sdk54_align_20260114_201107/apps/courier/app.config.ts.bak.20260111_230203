import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "DelishAfrica Courier",
  slug: "delishafrica-courier",
  owner: "delishafrica",
  scheme: "delishafrica-courier",
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
    bundleIdentifier: "com.delishafrica.courier",
  },
  android: {
    package: "com.delishafrica.courier",
  },
  plugins: ["expo-router", "expo-secure-store"],
};

export default config;
