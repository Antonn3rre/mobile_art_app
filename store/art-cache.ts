type ArtCacheItem = Record<string, unknown> & { id?: string };

const cache = new Map<string, ArtCacheItem>();

export function setArtCache(item: ArtCacheItem | null | undefined) {
  const id = item?.id;
  if (!id) return;
  cache.set(String(id), item);
}

export function getArtCache(id: string | number | null | undefined) {
  if (id === undefined || id === null) return null;
  return cache.get(String(id)) ?? null;
}
