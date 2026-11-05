import * as SecureStore from "expo-secure-store";

const META_SUFFIX = ".__da_chunks_meta_v1";
const CHUNK_PREFIX = ".__da_chunk_v1.";
const MAX_CODEPOINTS_PER_CHUNK = 400;
const MAX_CHUNKS = 64;

type ChunkMeta = {
  version: 1;
  generation: string;
  count: number;
};

function splitByCodePoints(value: string): string[] {
  const points = Array.from(value);
  const chunks: string[] = [];
  for (let i = 0; i < points.length; i += MAX_CODEPOINTS_PER_CHUNK) {
    chunks.push(points.slice(i, i + MAX_CODEPOINTS_PER_CHUNK).join(""));
  }
  if (chunks.length > MAX_CHUNKS) throw new Error("Secure payload is too large.");
  return chunks.length ? chunks : [""];
}

function metaKey(key: string): string {
  return `${key}${META_SUFFIX}`;
}

function chunkKey(key: string, generation: string, index: number): string {
  return `${key}${CHUNK_PREFIX}${generation}.${index}`;
}

async function readMeta(key: string): Promise<ChunkMeta | null> {
  try {
    const raw = await SecureStore.getItemAsync(metaKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChunkMeta;
    if (
      parsed?.version !== 1 ||
      !parsed.generation ||
      !Number.isInteger(parsed.count) ||
      parsed.count < 1 ||
      parsed.count > MAX_CHUNKS
    ) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function daSecureGetLargeString(key: string): Promise<string | null> {
  const meta = await readMeta(key);
  if (meta) {
    const parts: string[] = [];
    for (let i = 0; i < meta.count; i += 1) {
      const part = await SecureStore.getItemAsync(chunkKey(key, meta.generation, i));
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join("");
  }
  // Legacy single-value format; it migrates on the next save.
  return await SecureStore.getItemAsync(key);
}

export async function daSecureSetLargeString(key: string, value: string): Promise<void> {
  const oldMeta = await readMeta(key);
  const generation = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const chunks = splitByCodePoints(value);
  const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

  for (let i = 0; i < chunks.length; i += 1) {
    await SecureStore.setItemAsync(chunkKey(key, generation, i), chunks[i], options);
  }

  const nextMeta: ChunkMeta = { version: 1, generation, count: chunks.length };
  await SecureStore.setItemAsync(metaKey(key), JSON.stringify(nextMeta), options);

  await SecureStore.deleteItemAsync(key).catch(() => undefined);
  if (oldMeta && oldMeta.generation !== generation) {
    for (let i = 0; i < oldMeta.count; i += 1) {
      await SecureStore.deleteItemAsync(chunkKey(key, oldMeta.generation, i)).catch(() => undefined);
    }
  }
}

export async function daSecureDeleteLargeString(key: string): Promise<void> {
  const meta = await readMeta(key);
  if (meta) {
    for (let i = 0; i < meta.count; i += 1) {
      await SecureStore.deleteItemAsync(chunkKey(key, meta.generation, i)).catch(() => undefined);
    }
  }
  await SecureStore.deleteItemAsync(metaKey(key)).catch(() => undefined);
  await SecureStore.deleteItemAsync(key).catch(() => undefined);
}
