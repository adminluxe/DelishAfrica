import React from "react";
import { StyleSheet, Text, View } from "react-native";

type DestinationApproachMarkerProps = {
  progressValue: number;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function DestinationApproachMarker({
  progressValue,
}: DestinationApproachMarkerProps) {
  const progress = clamp(progressValue);
  const approaching = progress >= 0.7;
  const near = progress >= 0.88;
  const arrived = progress >= 0.97;

  return (
    <View style={styles.root} pointerEvents="none">
      {/* DA_P3A8_ARRIVAL_MOMENT_ENGINE_RUNTIME_V2_V1 */}
      {approaching ? (
        <View
          style={[
            styles.halo,
            arrived
              ? styles.haloArrived
              : near
                ? styles.haloNear
                : styles.haloApproaching,
          ]}
        />
      ) : null}

      {near ? (
        <View
          style={[
            styles.innerHalo,
            arrived ? styles.innerHaloArrived : null,
          ]}
        />
      ) : null}

      <View
        style={[
          styles.marker,
          near ? styles.markerNear : null,
          arrived ? styles.markerArrived : null,
        ]}
      >
        <Text style={styles.icon}>⌂</Text>
      </View>

      {arrived ? (
        <View style={styles.arrivalBadge}>
          <Text style={styles.arrivalBadgeText}>ICI</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 2,
    backgroundColor: "rgba(70, 211, 151, 0.08)",
  },
  haloApproaching: {
    width: 62,
    height: 62,
    borderColor: "rgba(102, 232, 173, 0.38)",
  },
  haloNear: {
    width: 72,
    height: 72,
    borderColor: "rgba(124, 244, 190, 0.58)",
    backgroundColor: "rgba(70, 211, 151, 0.13)",
  },
  haloArrived: {
    width: 76,
    height: 76,
    borderWidth: 3,
    borderColor: "rgba(225, 255, 238, 0.92)",
    backgroundColor: "rgba(62, 211, 145, 0.18)",
  },
  innerHalo: {
    position: "absolute",
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: "rgba(134, 255, 202, 0.12)",
  },
  innerHaloArrived: {
    backgroundColor: "rgba(217, 255, 233, 0.18)",
  },
  marker: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2E9A70",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#0A2B20",
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  markerNear: {
    borderWidth: 4,
    borderColor: "#D7FFEA",
    backgroundColor: "#23966A",
  },
  markerArrived: {
    borderColor: "#FFFFFF",
    backgroundColor: "#16865D",
    shadowOpacity: 0.42,
    shadowRadius: 12,
    elevation: 12,
  },
  arrivalBadge: {
    position: "absolute",
    bottom: -5,
    minWidth: 34,
    height: 18,
    paddingHorizontal: 8,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#071B15",
    borderWidth: 1,
    borderColor: "rgba(226, 255, 239, 0.88)",
  },
  arrivalBadgeText: {
    color: "#E6FFF1",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    lineHeight: 12,
  },
  icon: {
    color: "#071B15",
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 31,
  },
});
