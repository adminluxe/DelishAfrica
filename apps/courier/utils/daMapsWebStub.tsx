import React from "react";
import { View } from "react-native";

/**
 * DelishAfrica® Courier browser-only compatibility shim.
 *
 * React Native Maps uses native codegen unavailable in web Metro. Real iOS
 * and Android continue to import react-native-maps; web is mapped here by
 * the platform-specific metro.config.js resolver. These placeholders never
 * request device location, fetch map tiles or suggest any route/ETA.
 */
const Container = ({ children, style }: any) => (
  <View style={style}>{children}</View>
);
const Empty = () => null;

export type LatLng = { latitude: number; longitude: number };
export const Marker = Container;
export const Callout = Container;
export const Circle = Empty;
export const Polygon = Empty;
export const Polyline = Empty;
export const Overlay = Empty;
export const UrlTile = Empty;
export const Heatmap = Empty;
export const PROVIDER_DEFAULT = undefined;
export const PROVIDER_GOOGLE = "google";
export default Container;
