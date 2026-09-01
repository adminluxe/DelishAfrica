type NativeIntentInput = {
  path: string;
  initial: boolean;
};

const ROOT_SCHEMES = new Set([
  "delishafricacourier:",
  "delishafricacourier://",
  "delishafricacourier:///",
  "delishafrica-courier-dev54:",
  "delishafrica-courier-dev54://",
  "delishafrica-courier-dev54:///",
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
