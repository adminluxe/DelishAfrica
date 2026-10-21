import { ConfigContext, ExpoConfig } from "expo/config";

// DA_DEV_VARIANT_SIDE_BY_SIDE_V3 — DEV binary coexists with Store/TestFlight.
const IS_DEV = process.env.APP_VARIANT === "development";
const COURIER_APP_NAME = IS_DEV ? "DelishAfrica Courier DEV" : "DelishAfrica Courier";
const COURIER_DISPLAY_NAME = IS_DEV ? "DA Courier DEV" : "DelishAfrica Courier";
const COURIER_SCHEME = IS_DEV ? "delishafricacourierdev" : "delishafricacourier";
const COURIER_IOS_BUNDLE_ID = IS_DEV ? "com.delishafrica.courier.dev" : "com.delishafrica.courier";
const COURIER_ANDROID_PACKAGE = IS_DEV ? "com.delishafrica.courier.dev" : "com.delishafrica.courier";

const COURIER_BOOT_BACKGROUND = "#00140B";
const SPLASH_IMAGE = "./assets/splash.png";

// Preview must remain blocked until an independent review pins the QA services.
// An arbitrary URL supplied through EAS environment variables is not evidence of isolation.
const IS_QA_PREVIEW =
  process.env.EAS_BUILD_PROFILE === "preview" ||
  process.env.APP_VARIANT === "preview";
if (IS_QA_PREVIEW) {
  throw new Error(
    "DA_COURIER_PREVIEW_NO_GO: isolated QA API and IAM origins require review before Preview builds or updates."
  );
}

const API_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me";

const ANDROID_GOOGLE_MAPS_API_KEY =
  process.env.DA_COURIER_ANDROID_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
  "";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: COURIER_APP_NAME,
  slug: "delishafrica-courier",
  owner: "delishafrica",
  scheme: COURIER_SCHEME,
  version: IS_DEV ? "3.0.0" : "3.0.2",
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
    bundleIdentifier: COURIER_IOS_BUNDLE_ID,
    backgroundColor: COURIER_BOOT_BACKGROUND,
    splash: {
      image: SPLASH_IMAGE,
      resizeMode: "contain",
      backgroundColor: COURIER_BOOT_BACKGROUND,
    },
    infoPlist: {
      ...(config.ios?.infoPlist ?? {}),
      CFBundleDisplayName: COURIER_DISPLAY_NAME,
      UIViewControllerBasedStatusBarAppearance: false,
    },
  },
  android: {
    ...config.android,
    package: COURIER_ANDROID_PACKAGE,
    // Least-privilege: Courier does not use all-files/media-library access.
    // Android system document pickers do not require the legacy storage grants.
    // Verify effective merged native AndroidManifest inside signed AAB before stores.
    blockedPermissions: [
      ...(config.android?.blockedPermissions ?? []),
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      ...(!IS_DEV
        ? [
            "android.permission.SYSTEM_ALERT_WINDOW",
            "android.permission.USE_BIOMETRIC",
            "android.permission.USE_FINGERPRINT",
          ]
        : []),
    ],
    ...(!IS_DEV
      ? {
          // Delivery identity/session state is sensitive and server-backed.
          // Disable Android backup/restore for Store binaries.
          allowBackup: false,
        }
      : {}),
    config: {
      ...(config.android?.config ?? {}),
      ...(ANDROID_GOOGLE_MAPS_API_KEY
        ? { googleMaps: { apiKey: ANDROID_GOOGLE_MAPS_API_KEY } }
        : {}),
    },
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
    ["expo-dev-client", { addGeneratedScheme: IS_DEV }],
    "expo-notifications",
    [
      "expo-location",
      {
        locationWhenInUsePermission: "Autorisez DelishAfrica Courier à utiliser votre position pendant une livraison afin d'estimer le trajet et l'heure d'arrivée.",
      },
    ],
    "expo-web-browser",
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
