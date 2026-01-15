export async function hapticLight() {
  try {
    const H = await import("expo-haptics");
    await H.impactAsync(H.ImpactFeedbackStyle.Light);
  } catch {
    // noop (web / missing native)
  }
}
export async function hapticSoft() {
  try {
    const H = await import("expo-haptics");
    await H.impactAsync(H.ImpactFeedbackStyle.Soft);
  } catch {
    // noop
  }
}
