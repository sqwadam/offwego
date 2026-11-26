export type SearchBias = { lat: number; lng: number; zoom: number };

export function normalizeSearchBias(input?: Partial<SearchBias> | null): SearchBias | null {
  const lat = Number(input?.lat);
  const lng = Number(input?.lng);
  const zoom = Number(input?.zoom);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const wrappedLng = ((lng + 180) % 360 + 360) % 360 - 180;
  return {
    lat: Math.max(-85, Math.min(85, lat)),
    lng: Number(wrappedLng.toFixed(6)),
    zoom: Number.isFinite(zoom) ? Math.max(2, Math.min(18, Math.round(zoom))) : 6,
  };
}

// Photon ranks near this point first; no bounding box means exact distant searches still work.
export function photonSearchUrl(query: string, bias?: Partial<SearchBias> | null): string {
  const params = new URLSearchParams({ q: query, limit: "10", lang: "en" });
  const normalized = normalizeSearchBias(bias);
  if (normalized) {
    params.set("lat", String(normalized.lat));
    params.set("lon", String(normalized.lng));
    params.set("zoom", String(normalized.zoom));
  }
  return `https://photon.komoot.io/api/?${params.toString()}`;
}

export function placeRegion(properties: Record<string, string>, name: string): string {
  return [properties.state, properties.country]
    .filter((part, index, all) => part && part !== name && all.indexOf(part) === index)
    .join(", ");
}
