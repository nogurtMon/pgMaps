const MAX_TILES = 5_000;
const cache = new Map<string, Buffer | null>();

export function getCachedTile(key: string): { hit: true; data: Buffer | null } | { hit: false } {
  if (!cache.has(key)) return { hit: false };
  return { hit: true, data: cache.get(key)! };
}

export function setCachedTile(key: string, data: Buffer | null): void {
  if (cache.size >= MAX_TILES) {
    const iter = cache.keys();
    for (let i = 0; i < 500; i++) {
      const { value, done } = iter.next();
      if (done) break;
      cache.delete(value!);
    }
  }
  cache.set(key, data);
}

export function invalidateTilesByPrefix(prefix: string): void {
  for (const key of [...cache.keys()])
    if (key.startsWith(prefix)) cache.delete(key);
}
