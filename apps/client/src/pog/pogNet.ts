import { NativeModules } from "react-native";
import Constants from "expo-constants";

function normalizeToOrigin(hostOrUrl: string): string | null {
  const s = (hostOrUrl || "").trim();
  if (!s) return null;

  // If already URL with scheme:
  const m1 = s.match(/^(https?:\/\/[^/]+)\//);
  if (m1) return m1[1];

  // If host:port or host:port/path
  const noScheme = s.replace(/^[a-z]+:\/\//i, "");
  const hostPort = noScheme.split("/")[0]?.trim();
  if (!hostPort) return null;

  return `http://${hostPort}`;
}

export function getPackagerOrigin(): string | null {
  // 1) Best signal: JS bundle scriptURL
  const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
  if (scriptURL) {
    const origin = normalizeToOrigin(scriptURL);
    if (origin) return origin;
  }

  // 2) Expo Constants fallbacks (dev-client / expo-router)
  // Depending on SDK, these fields may vary
  const c: any = Constants;

  const hostCandidates: Array<any> = [
    c?.expoConfig?.hostUri,                 // often "100.x.x.x:8081"
    c?.manifest?.debuggerHost,              // often "100.x.x.x:8081"
    c?.manifest?.hostUri,
    c?.manifest2?.extra?.expoClient?.hostUri,
    c?.manifest2?.extra?.expoGo?.debuggerHost,
    c?.manifest2?.extra?.expoClient?.debuggerHost,
  ];

  for (const cand of hostCandidates) {
    if (typeof cand === "string" && cand.trim()) {
      const origin = normalizeToOrigin(cand);
      if (origin) return origin;
    }
  }

  // 3) As last resort: nothing
  return null;
}

export async function pingStatus(): Promise<{ ok: boolean; status?: number; url?: string; error?: string }> {
  const origin = getPackagerOrigin();
  if (!origin) return { ok: false, error: "No packager origin (scriptURL/Constants hostUri missing)" };

  const url = `${origin}/status`;
  try {
    const res = await fetch(url, { method: "GET" });
    return { ok: res.ok, status: res.status, url };
  } catch (e: any) {
    return { ok: false, url, error: String(e?.message ?? e) };
  }
}

export function makeReceiptId(prefix = "POG"): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${t}-${r}`;
}
