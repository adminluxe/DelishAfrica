import React from "react";
import { View } from "react-native";

// Web bundle fallback: native map features are NOT available in browsers.
// Actual web route uses maps-live-lab.web.tsx. Mobile uses react-native-maps unchanged.
const StubView = ({ children, style }: any) =>
  <View style={style}>{children}</View>;
export const Marker = StubView;
export const Callout = StubView;
export const Polygon = () => null;
export const Polyline = () => null;
export const Circle = () => null;
export const Overlay = () => null;
export const PROVIDER_GOOGLE = "google";
export const PROVIDER_DEFAULT = undefined;
export default StubView;
