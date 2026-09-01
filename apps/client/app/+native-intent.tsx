type NativeIntentInput = {
  path: string;
  initial: boolean;
};

const ROOT_SCHEMES = new Set([
  "delishafricaclient:",
  "delishafricaclient://",
  "delishafricaclient:///",
]);

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function redirectSystemPath({ path }: NativeIntentInput): string {
  const raw = String(path ?? "");
  const normalized = normalize(raw);

  if (!normalized || normalized === "/") return "/";
  if (ROOT_SCHEMES.has(normalized)) return "/";

  return raw;
}
