import React, { useMemo } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

type TasteArchetype = "rice" | "grill" | "fish" | "stew" | "plantain" | "drink" | "dessert" | "platter";

type TastePalette = {
  canvas: string;
  deep: string;
  plate: string;
  sauce: string;
  grain: string;
  accent: string;
  leaf: string;
  ink: string;
};

type TastePortraitProps = {
  name?: string;
  category?: string;
  description?: string;
  seed?: string;
  size?: number;
  compact?: boolean;
  showCode?: boolean;
  style?: StyleProp<ViewStyle>;
};

const DELISHAFRICA_TASTE_PORTRAITS_V1 = true;

const PALETTES: TastePalette[] = [
  { canvas: "#71331E", deep: "#30150E", plate: "#F6D37F", sauce: "#A72C20", grain: "#FFF2C9", accent: "#F3A64A", leaf: "#2E765A", ink: "#2A160D" },
  { canvas: "#145746", deep: "#082B22", plate: "#F0DDB1", sauce: "#D56A36", grain: "#FFF8E2", accent: "#81DDB8", leaf: "#1D6D50", ink: "#08251D" },
  { canvas: "#49306D", deep: "#21152F", plate: "#F1D9AE", sauce: "#B84979", grain: "#FFF3DC", accent: "#CAA4F3", leaf: "#527C50", ink: "#241731" },
  { canvas: "#17536F", deep: "#082A3C", plate: "#F3DDB5", sauce: "#DF5B3F", grain: "#FFF8E8", accent: "#83D4F4", leaf: "#23705D", ink: "#082838" },
  { canvas: "#6D4B18", deep: "#312207", plate: "#F6D77F", sauce: "#7D331E", grain: "#FFF3CB", accent: "#F4C14D", leaf: "#3C7452", ink: "#2B1B06" },
  { canvas: "#642C3D", deep: "#2D1119", plate: "#ECCB92", sauce: "#7B1834", grain: "#FFF0D8", accent: "#EE8CAA", leaf: "#3C7659", ink: "#2C1219" },
];

const GRAIN_POINTS = [
  { left: 19, top: 24, rotate: "18deg" },
  { left: 38, top: 19, rotate: "-14deg" },
  { left: 56, top: 31, rotate: "32deg" },
  { left: 27, top: 48, rotate: "-28deg" },
  { left: 48, top: 52, rotate: "11deg" },
  { left: 65, top: 49, rotate: "-12deg" },
  { left: 38, top: 68, rotate: "25deg" },
];

function normalized(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hashOf(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function paletteFor(identity: string): TastePalette {
  return PALETTES[hashOf(identity) % PALETTES.length];
}

function archetypeFor(identity: string): TasteArchetype {
  if (/jus|boisson|bissap|gingembre|cocktail|soda|the|cafe/.test(identity)) return "drink";
  if (/dessert|gateau|beignet|thiakry|degue|glace|tarte/.test(identity)) return "dessert";
  if (/poisson|tilapia|dorade|capitaine|sole|saumon/.test(identity)) return "fish";
  if (/brochette|braise|grill|poulet|agneau|boeuf|chevre|viande/.test(identity)) return "grill";
  if (/plantain|alloco|banane/.test(identity)) return "plantain";
  if (/riz|thieb|jollof|mafe|yassa|atti[eé]k[eé]|couscous/.test(identity)) return "rice";
  if (/sauce|soupe|ndole|eru|gombo|pondu|madesu|ragout/.test(identity)) return "stew";
  return "platter";
}

function codeOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "DA";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || "D"}${words[1][0] || "A"}`.toUpperCase();
}

function Plate({ size, palette, children }: { size: number; palette: TastePalette; children: React.ReactNode }) {
  const plateSize = size * 0.72;
  return (
    <View
      style={[
        styles.plate,
        {
          width: plateSize,
          height: plateSize,
          borderRadius: plateSize / 2,
          backgroundColor: palette.plate,
          borderColor: palette.accent,
        },
      ]}
    >
      {children}
    </View>
  );
}

function FoodIllustration({ archetype, size, palette }: { archetype: TasteArchetype; size: number; palette: TastePalette }) {
  const scale = size / 112;

  if (archetype === "drink") {
    return (
      <View style={styles.center}>
        <View style={[styles.glass, { width: 38 * scale, height: 58 * scale, borderColor: palette.grain }]}>
          <View style={[styles.liquid, { backgroundColor: palette.sauce }]} />
          <View style={[styles.bubble, { left: 8 * scale, top: 22 * scale, backgroundColor: palette.grain }]} />
          <View style={[styles.bubble, { right: 7 * scale, top: 34 * scale, width: 5 * scale, height: 5 * scale, backgroundColor: palette.grain }]} />
        </View>
        <View style={[styles.straw, { height: 56 * scale, backgroundColor: palette.accent, transform: [{ rotate: "13deg" }] }]} />
      </View>
    );
  }

  return (
    <Plate size={size} palette={palette}>
      {archetype === "rice" ? (
        <>
          <View style={[styles.riceMound, { backgroundColor: palette.grain }]} />
          {GRAIN_POINTS.map((point, index) => (
            <View
              key={index}
              style={[
                styles.riceGrain,
                {
                  left: point.left * scale,
                  top: point.top * scale,
                  backgroundColor: index % 3 === 0 ? palette.accent : palette.plate,
                  transform: [{ rotate: point.rotate }],
                },
              ]}
            />
          ))}
          <View style={[styles.saucePool, { right: 14 * scale, bottom: 17 * scale, backgroundColor: palette.sauce }]} />
        </>
      ) : null}

      {archetype === "grill" ? (
        <>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={[
                styles.grillPiece,
                {
                  width: (45 - index * 3) * scale,
                  height: 16 * scale,
                  top: (23 + index * 17) * scale,
                  left: (23 + index * 4) * scale,
                  backgroundColor: index === 1 ? palette.sauce : palette.deep,
                  transform: [{ rotate: index % 2 ? "7deg" : "-8deg" }],
                },
              ]}
            >
              <View style={[styles.grillLine, { backgroundColor: palette.accent }]} />
              <View style={[styles.grillLine, { left: "62%", backgroundColor: palette.accent }]} />
            </View>
          ))}
          <View style={[styles.leaf, { right: 15 * scale, bottom: 13 * scale, backgroundColor: palette.leaf, transform: [{ rotate: "34deg" }] }]} />
        </>
      ) : null}

      {archetype === "fish" ? (
        <>
          <View style={[styles.fishBody, { width: 56 * scale, height: 30 * scale, backgroundColor: palette.sauce }]}>
            <View style={[styles.fishEye, { backgroundColor: palette.grain }]} />
            <View style={[styles.fishStripe, { backgroundColor: palette.accent }]} />
          </View>
          <View style={[styles.fishTail, { right: 15 * scale, borderLeftColor: palette.sauce }]} />
          <View style={[styles.leaf, { left: 16 * scale, bottom: 16 * scale, backgroundColor: palette.leaf, transform: [{ rotate: "-26deg" }] }]} />
        </>
      ) : null}

      {archetype === "stew" ? (
        <>
          <View style={[styles.stewPool, { backgroundColor: palette.sauce }]} />
          <View style={[styles.stewDot, { left: 24 * scale, top: 31 * scale, backgroundColor: palette.grain }]} />
          <View style={[styles.stewDot, { right: 26 * scale, top: 46 * scale, width: 13 * scale, height: 13 * scale, backgroundColor: palette.accent }]} />
          <View style={[styles.leaf, { right: 20 * scale, top: 18 * scale, backgroundColor: palette.leaf, transform: [{ rotate: "41deg" }] }]} />
        </>
      ) : null}

      {archetype === "plantain" ? (
        <>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[
                styles.plantain,
                {
                  left: (18 + index * 14) * scale,
                  top: (25 + (index % 2) * 18) * scale,
                  backgroundColor: index % 2 ? palette.accent : palette.grain,
                  transform: [{ rotate: `${-25 + index * 17}deg` }],
                },
              ]}
            />
          ))}
          <View style={[styles.saucePool, { right: 16 * scale, bottom: 15 * scale, backgroundColor: palette.sauce }]} />
        </>
      ) : null}

      {archetype === "dessert" ? (
        <>
          <View style={[styles.cakeBase, { backgroundColor: palette.sauce }]} />
          <View style={[styles.cakeLayer, { backgroundColor: palette.grain }]} />
          <View style={[styles.cakeTop, { backgroundColor: palette.accent }]} />
          <View style={[styles.berry, { backgroundColor: palette.leaf }]} />
        </>
      ) : null}

      {archetype === "platter" ? (
        <>
          <View style={[styles.saucePool, { left: 16 * scale, top: 18 * scale, width: 36 * scale, height: 36 * scale, backgroundColor: palette.sauce }]} />
          <View style={[styles.sideMound, { right: 16 * scale, top: 18 * scale, backgroundColor: palette.grain }]} />
          <View style={[styles.sideMound, { left: 30 * scale, bottom: 15 * scale, width: 30 * scale, height: 23 * scale, backgroundColor: palette.accent }]} />
          <View style={[styles.leaf, { right: 20 * scale, bottom: 13 * scale, backgroundColor: palette.leaf, transform: [{ rotate: "31deg" }] }]} />
        </>
      ) : null}
    </Plate>
  );
}

export function TastePortrait({
  name,
  category,
  description,
  seed,
  size = 96,
  compact = false,
  showCode = false,
  style,
}: TastePortraitProps) {
  const identity = useMemo(
    () => normalized([seed, name, category, description].filter(Boolean).join(" ")),
    [seed, name, category, description],
  );
  const palette = useMemo(() => paletteFor(identity || "delishafrica"), [identity]);
  const archetype = useMemo(() => archetypeFor(identity), [identity]);
  const code = useMemo(() => codeOf(String(name || category || "DelishAfrica")), [name, category]);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: compact ? size * 0.23 : size * 0.30,
          backgroundColor: palette.canvas,
          borderColor: palette.accent,
        },
        style,
      ]}
    >
      <View style={[styles.deepOrb, { width: size * 1.1, height: size * 1.1, borderRadius: size, backgroundColor: palette.deep }]} />
      <View style={[styles.lightOrb, { width: size * 0.88, height: size * 0.88, borderRadius: size, backgroundColor: palette.accent }]} />
      <FoodIllustration archetype={archetype} size={size} palette={palette} />
      {showCode ? (
        <View style={[styles.codePill, { backgroundColor: palette.deep }]}>
          <Text style={[styles.codeText, { color: palette.grain }]}>{code}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default TastePortrait;

const styles = StyleSheet.create({
  frame: {
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  deepOrb: { position: "absolute", left: "-52%", bottom: "-68%", opacity: 0.76 },
  lightOrb: { position: "absolute", right: "-48%", top: "-55%", opacity: 0.17 },
  center: { alignItems: "center", justifyContent: "center" },
  plate: { position: "relative", alignItems: "center", justifyContent: "center", borderWidth: 1.4, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 5 } },
  riceMound: { width: "57%", height: "54%", borderRadius: 999, opacity: 0.95 },
  riceGrain: { position: "absolute", width: 13, height: 6, borderRadius: 99 },
  saucePool: { position: "absolute", width: 25, height: 25, borderRadius: 999 },
  grillPiece: { position: "absolute", borderRadius: 8, overflow: "hidden" },
  grillLine: { position: "absolute", left: "32%", top: 0, bottom: 0, width: 2, opacity: 0.62 },
  leaf: { position: "absolute", width: 13, height: 28, borderRadius: 99 },
  fishBody: { position: "absolute", left: "20%", top: "35%", borderRadius: 999, alignItems: "flex-start", justifyContent: "center" },
  fishEye: { width: 5, height: 5, borderRadius: 99, marginLeft: 10 },
  fishStripe: { position: "absolute", width: 4, height: "78%", left: "54%", borderRadius: 99, opacity: 0.85 },
  fishTail: { position: "absolute", top: "40%", width: 0, height: 0, borderTopWidth: 13, borderBottomWidth: 13, borderLeftWidth: 20, borderTopColor: "transparent", borderBottomColor: "transparent" },
  stewPool: { width: "62%", height: "62%", borderRadius: 999 },
  stewDot: { position: "absolute", width: 17, height: 17, borderRadius: 99 },
  plantain: { position: "absolute", width: 31, height: 14, borderRadius: 99 },
  cakeBase: { position: "absolute", width: "56%", height: "33%", borderRadius: 7, bottom: "23%" },
  cakeLayer: { position: "absolute", width: "50%", height: "15%", borderRadius: 5, bottom: "38%" },
  cakeTop: { position: "absolute", width: "58%", height: 7, borderRadius: 99, bottom: "52%" },
  berry: { position: "absolute", width: 12, height: 12, borderRadius: 99, top: "22%", right: "31%" },
  sideMound: { position: "absolute", width: 33, height: 31, borderRadius: 999 },
  glass: { position: "relative", overflow: "hidden", borderRadius: 9, borderWidth: 2, justifyContent: "flex-end", backgroundColor: "rgba(255,255,255,0.12)" },
  liquid: { height: "68%", opacity: 0.92 },
  bubble: { position: "absolute", width: 7, height: 7, borderRadius: 99, opacity: 0.78 },
  straw: { position: "absolute", width: 4, right: -3, top: -10, borderRadius: 99 },
  codePill: { position: "absolute", right: 7, bottom: 7, minWidth: 28, height: 22, borderRadius: 99, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", opacity: 0.92 },
  codeText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
});
