import { nearbyTowns } from "./towns";
import type { PlannerPoint } from "./travel-help";
import { distanceKm, withinDrivingWindow, type DriveRecommendation } from "./drive-recommendations";
import { normalizeSearchBias, photonSearchUrl, placeRegion, type SearchBias } from "./place-search";

const UA = { "User-Agent": "journeys-road-trip/1.0" };

export type PlaceResult = { name: string; fullName: string; lat: number; lng: number };

/** Town/city/place search for the start and end pickers. */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = String(query ?? "").slice(0, 120).trim();
  if (q.length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&accept-language=en`;
  try {
    const res = await fetch(url, { headers: UA });
    if (!res.ok) return [];
    const json = (await res.json()) as Array<{ display_name: string; name?: string; lat: string; lon: string }>;
    return json.map((r) => ({
      name: r.name || r.display_name.split(",")[0],
      fullName: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }));
  } catch {
    return [];
  }
}

/** Reverse geocode a map click into a town name. */
export async function reversePlace(lat: number, lng: number): Promise<{ name: string; fullName: string }> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&zoom=14&format=json&accept-language=en`;
  try {
    const res = await fetch(url, { headers: UA });
    if (!res.ok) throw new Error();
    const json = (await res.json()) as { display_name?: string; address?: Record<string, string> };
    const a = json.address ?? {};
    let name = a.city || a.town || a.village || a.hamlet || a.suburb || a.locality || a.municipality || "";
    if (!name) {
      // Rural click: fall back to the nearest bundled town before using the region.
      try {
        const near = (await nearbyTowns({ name: "", fullName: "", lat, lng }, 40, -1))
          .map((t) => ({ t, d: Math.hypot(t.lat - lat, (t.lng - lng) * Math.cos((lat * Math.PI) / 180)) }))
          .sort((x, y) => x.d - y.d)[0];
        if (near) name = near.t.name;
      } catch { /* ignore */ }
    }
    name = name || a.county || a.state || "Dropped pin";
    const region = [a.state, a.country].filter((x) => x && x !== name).join(", ");
    return { name, fullName: region ? `${name}, ${region}` : name };
  } catch {
    return { name: "Dropped pin", fullName: `${lat.toFixed(3)}, ${lng.toFixed(3)}` };
  }
}

export type AnywhereResult = {
  name: string;
  detail: string;
  kind: "town" | "attraction";
  attraction: { name: string; lat: number; lng: number } | null;
  town: PlaceResult;
};

const TOWN_TYPES = new Set(["city", "town", "village", "hamlet", "suburb", "locality", "municipality", "administrative"]);

/** Search any place (fuzzy Photon/OSM); attractions resolve to their nearest town, which becomes the stop. */
export async function searchAnywhere(
  query: string,
  bias?: Partial<SearchBias> | null,
): Promise<AnywhereResult[]> {
  const q = String(query ?? "").slice(0, 120).trim();
  if (q.length < 2) return [];
  const url = photonSearchUrl(q, normalizeSearchBias(bias));
  try {
    const res = await fetch(url, { headers: UA });
    if (!res.ok) return [];
    const json = (await res.json()) as { features?: Array<{ geometry: { coordinates: [number, number] }; properties: Record<string, string> }> };
    const out: AnywhereResult[] = [];
    for (const f of json.features ?? []) {
      const [lng, lat] = f.geometry.coordinates;
      const pr = f.properties;
      const name = pr.name || pr.city || pr.state;
      if (!name) continue;
      const region = placeRegion(pr, name);
      const isTown = (pr.osm_key === "place" && TOWN_TYPES.has(pr.osm_value ?? "")) || pr.type === "city";
      if (isTown) {
        out.push({ name, detail: region, kind: "town", attraction: null, town: { name, fullName: region ? `${name}, ${region}` : name, lat, lng } });
        continue;
      }
      if (pr.osm_key === "boundary" || pr.type === "state" || pr.type === "country") continue;
      let town: PlaceResult | null = null;
      for (const radius of [40, 120, 300]) {
        const near = (await nearbyTowns({ name: "", fullName: "", lat, lng }, radius, -1))
          .map((t) => ({ t, d: Math.hypot(t.lat - lat, (t.lng - lng) * Math.cos((lat * Math.PI) / 180)) - Math.log10(Math.max(t.population, 10)) * 0.02 }))
          .sort((x, y) => x.d - y.d)[0];
        if (near) {
          const reg = [pr.state, pr.country].filter(Boolean).join(", ");
          town = { name: near.t.name, fullName: reg ? `${near.t.name}, ${reg}` : near.t.fullName, lat: near.t.lat, lng: near.t.lng };
          break;
        }
      }
      const fb = pr.city || pr.county || pr.state || name;
      town ??= { name: fb, fullName: region ? `${fb}, ${region}` : fb, lat, lng };
      const type = (pr.osm_value ?? "").replace(/_/g, " ");
      out.push({ name, detail: `${type ? type[0].toUpperCase() + type.slice(1) + " · " : ""}near ${town.name}${region ? ", " + region : ""}`, kind: "attraction", attraction: { name, lat, lng }, town });
    }
    return out;
  } catch (e) {
    console.error("searchAnywhere failed", e);
    return [];
  }
}

export type SnapResult = {
  coords: [number, number][] | null;
  duration?: number; // seconds
  distance?: number; // meters
  error?: string;
};

/** Snap a straight line between two points onto the road network (OSRM). */
export async function snapRoute(from: [number, number], to: [number, number]): Promise<SnapResult> {
  // Normalize longitudes to [-180, 180]; OSRM rejects out-of-range values.
  const normLng = (lng: number) => {
    let x = ((lng + 180) % 360 + 360) % 360 - 180;
    if (x === -180) x = 180;
    return x;
  };
  const fromLng = normLng(from[1]);
  const toLng = normLng(to[1]);
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${from[0]};${toLng},${to[0]}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { coords: null, error: `osrm http ${res.status}` };
    const json = (await res.json()) as {
      routes?: Array<{ geometry?: { coordinates?: [number, number][] }; duration?: number; distance?: number }>;
    };
    const route = json?.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!coords) return { coords: null, error: "no route in response" };
    // Shift returned coords back into the same 360° world copy as the input longitudes.
    const lngOffset = from[1] - fromLng;
    return {
      coords: coords.map(([lng, lat]) => [lat, lng + lngOffset] as [number, number]),
      duration: route?.duration,
      distance: route?.distance,
    };
  } catch (err) {
    return { coords: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export type NearbyKind = "stay" | "eat" | "do";
export type NearbyPlace = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distanceKm: number;
  address?: string;
  website?: string;
  stars?: string;
  cuisine?: string;
  price: number; // 0 = free, 1-4 = $..$$$$
  priceExact?: string;
  image?: string;
  description?: string;
};

export function estimatePrice(kind: NearbyKind, type: string, stars?: string): number {
  const t = type.replace(/ /g, "_");
  if (kind === "stay") {
    if (/^(hostel|camp_site|caravan_site)$/.test(t)) return 1;
    if (/^(guest_house|motel|apartment|chalet)$/.test(t)) return 2;
    const st = Number.parseFloat(stars ?? "");
    return st >= 5 ? 4 : st >= 4 ? 3 : st > 0 && st < 3 ? 2 : 3;
  }
  if (kind === "eat") return /^(fast_food|cafe|food_court)$/.test(t) ? 1 : /^(pub|bar)$/.test(t) ? 2 : 3;
  return /^(viewpoint|park|artwork|monument|ruins|attraction)$/.test(t) ? 0 : /^(theme_park|zoo)$/.test(t) ? 3 : 1;
}

const KEYWORDS: Record<NearbyKind, string[]> = {
  stay: ["hotel", "guest house", "hostel", "motel"],
  eat: ["restaurant", "cafe", "pub"],
  do: ["attraction", "museum", "castle", "viewpoint"],
};
const TYPES: Record<NearbyKind, RegExp> = {
  stay: /^(hotel|guest_house|hostel|motel|apartment|chalet|camp_site|caravan_site)$/,
  eat: /^(restaurant|cafe|pub|fast_food|bar|food_court)$/,
  do: /^(attraction|museum|viewpoint|gallery|zoo|theme_park|castle|monument|ruins|artwork|park)$/,
};

function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = Math.PI / 180;
  const x = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLng - aLng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

/** OSM sometimes carries a photo of the place — normalise it to a browseable URL. */
function stayImageUrl(t: Record<string, string>): string | undefined {
  if (t.image && /^https?:\/\//.test(t.image)) return t.image;
  const commons = t.image?.startsWith("File:") ? t.image : t.wikimedia_commons?.startsWith("File:") ? t.wikimedia_commons : null;
  return commons ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commons.slice(5))}?width=400` : undefined;
}

/** Hotels, restaurants or sights near a stop, from OpenStreetMap via Nominatim. */
export async function nearbyPlaces(lat: number, lng: number, kind: NearbyKind): Promise<{ places: NearbyPlace[]; error?: string }> {
  const d = kind === "do" ? 0.15 : 0.07;
  const box = [lng - d * 1.6, lat + d, lng + d * 1.6, lat - d].join(",");
  const seen = new Map<string, NearbyPlace>();
  let failed = 0;
  for (const q of KEYWORDS[kind]) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=40&bounded=1&viewbox=${box}&extratags=1&addressdetails=1&accept-language=en`;
      const res = await fetch(url, { headers: { "User-Agent": "journeys-road-trip/1.0" }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) { failed++; console.error("Nominatim failed", res.status); continue; }
      const rows = (await res.json()) as Array<{ osm_type: string; osm_id: number; lat: string; lon: string; name?: string; type: string; extratags?: Record<string, string> | null; address?: Record<string, string> }>;
      for (const r of rows) {
        if (!r.name || !TYPES[kind].test(r.type)) continue;
        const id = `${r.osm_type}/${r.osm_id}`;
        if (seen.has(id)) continue;
        const plat = Number(r.lat), plng = Number(r.lon), t = r.extratags ?? {}, a = r.address ?? {};
        const address = [a.house_number, a.road, a.town || a.city || a.village].filter(Boolean).join(" ");
        seen.set(id, {
          id, name: r.name, lat: plat, lng: plng, type: r.type.replace(/_/g, " "),
          distanceKm: Math.round(km(lat, lng, plat, plng) * 10) / 10,
          address: address || undefined,
          website: t.website || t["contact:website"] || undefined,
          stars: t.stars, cuisine: t.cuisine?.replace(/[_;]/g, " "),
          image: stayImageUrl(t),
          price: t.fee === "no" ? 0 : estimatePrice(kind, r.type, t.stars),
          priceExact: t.charge || t.price || undefined,
        });
      }
    } catch (err) { failed++; console.error("Nominatim error", err); }
  }
  if (failed === KEYWORDS[kind].length) return { places: [], error: "Couldn't reach the place search. Try again shortly." };
  const places = [...seen.values()].sort((a, b) => a.price - b.price || a.distanceKm - b.distanceKm);
  return { places: places.slice(0, 40) };
}

/** Sights and attractions near a stop, from Wikipedia's geo search, with photos. */
export async function nearbyAttractions(lat: number, lng: number): Promise<{ places: NearbyPlace[]; error?: string }> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "geosearch",
    ggscoord: `${lat}|${lng}`,
    ggsradius: "10000",
    ggslimit: "24",
    ggsnamespace: "0",
    prop: "pageimages|extracts|coordinates",
    piprop: "thumbnail",
    pithumbsize: "400",
    pilimit: "24",
    exintro: "1",
    explaintext: "1",
    exlimit: "24",
  });
  try {
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { places: [], error: "Couldn't reach the activities search. Try again shortly." };
    const json = (await res.json()) as {
      query?: { pages?: Record<string, { pageid: number; title: string; index?: number; extract?: string; thumbnail?: { source: string }; coordinates?: Array<{ lat: number; lon: number }> }> };
    };
    const pages = Object.values(json.query?.pages ?? {})
      // Non-attraction articles (schools, suburbs, infrastructure) show up in geo search — drop them.
      .filter((p) => !/\b(school|college|university|suburb|locality|railway|airport|shrubland|radio station)\b/i.test(`${p.title}. ${p.extract ?? ""}`))
      .sort((a, b) => Number(!!b.thumbnail?.source) - Number(!!a.thumbnail?.source) || (a.index ?? 0) - (b.index ?? 0));
    const places: NearbyPlace[] = [];
    for (const p of pages) {
      const c = p.coordinates?.[0];
      if (!c) continue;
      const extract = (p.extract ?? "").replace(/\s*\([^)]*\)\s*/g, " ").trim();
      const description = extract.length > 10 ? (extract.length > 140 ? extract.slice(0, 140).replace(/\s+\S*$/, "") + "…" : extract) : undefined;
      places.push({
        id: `wiki-${p.pageid}`,
        name: p.title,
        type: "attraction",
        lat: c.lat,
        lng: c.lon,
        distanceKm: Math.round(km(lat, lng, c.lat, c.lon) * 10) / 10,
        image: p.thumbnail?.source,
        description,
        price: 0,
      });
    }
    return { places };
  } catch (err) {
    console.error("Wikipedia geosearch failed", err);
    return { places: [], error: "Couldn't reach the activities search. Try again shortly." };
  }
}

type RecResult = { recommendations: DriveRecommendation[]; error?: string };
const recCache = new Map<string, { at: number; result: RecResult }>();
const normalize = (p: PlannerPoint): PlannerPoint => ({ ...p, lng: ((p.lng + 180) % 360 + 360) % 360 - 180 });

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error("Travel search unavailable");
  return response.json() as Promise<T>;
}

/** Towns a realistic drive away: GeoNames candidates narrowed by OSRM drive times. */
export async function recommendDriveStops(
  from: PlannerPoint, hours: number, minHours: number, maxHours: number, end: PlannerPoint | null,
): Promise<RecResult> {
  const fromN = normalize(from);
  const endN = end ? normalize(end) : null;
  const key = JSON.stringify([fromN.lat, fromN.lng, hours, minHours, maxHours, endN?.lat, endN?.lng]);
  const hit = recCache.get(key);
  if (hit && Date.now() - hit.at < 900000) return hit.result;
  try {
    const points = await nearbyTowns(fromN, Math.min(1000, maxHours * 115));
    // Sample across directions and distance bands so the chosen window is covered,
    // rather than letting nearby suburbs fill the table.
    const band = Math.max(10, maxHours * 9);
    points.sort((a, b) => {
      const score = (p: typeof a) => (p.population < 3000 ? 35 : 0) + (endN ? distanceKm(p, endN) * 0.2 : 0);
      return score(a) - score(b);
    });
    const selected: typeof points = [];
    const seen = new Set<string>();
    for (const p of points) {
      const sector = Math.floor((Math.atan2(p.lat - fromN.lat, (p.lng - fromN.lng) * Math.cos(fromN.lat * Math.PI / 180)) + Math.PI) / (Math.PI / 8));
      const bucket = `${sector}:${Math.floor(distanceKm(fromN, p) / band)}`;
      if (seen.has(bucket)) continue;
      seen.add(bucket); selected.push(p);
      if (selected.length === 80) break;
    }
    if (!selected.length) return { recommendations: [] };
    const locations = [fromN, ...selected].map((p) => `${p.lng},${p.lat}`).join(";");
    const table = await readJson<{ durations?: (number | null)[][] }>(`https://router.project-osrm.org/table/v1/driving/${locations}?sources=0&annotations=duration`);
    const durations = table.durations?.[0];
    if (!durations) throw new Error("No drive times");
    const inWindow = selected.map((point, i) => ({ point, duration: durations[i + 1] ?? null }))
      .filter((r): r is { point: typeof selected[number]; duration: number } => withinDrivingWindow(r.duration, minHours, maxHours))
      .sort((a, b) => a.duration - b.duration);
    // Spread picks evenly across the window, then order by closeness to the daily target.
    const count = Math.min(8, inWindow.length);
    const step = inWindow.length / count;
    const matches = Array.from({ length: count }, (_, i) => inWindow[Math.min(inWindow.length - 1, Math.floor(i * step))])
      .sort((a, b) => Math.abs(a.duration - hours * 3600) - Math.abs(b.duration - hours * 3600) + (endN ? (distanceKm(a.point, endN) - distanceKm(b.point, endN)) * 4 : 0));
    const routes = await Promise.all(matches.map(async ({ point }): Promise<DriveRecommendation | null> => {
      try {
        const response = await readJson<{ routes?: { duration: number; distance: number; geometry: { coordinates: [number, number][] } }[] }>(`https://router.project-osrm.org/route/v1/driving/${fromN.lng},${fromN.lat};${point.lng},${point.lat}?overview=full&geometries=geojson`);
        const route = response.routes?.[0];
        if (!route || !withinDrivingWindow(route.duration, minHours, maxHours)) return null;
        const offset = from.lng - fromN.lng;
        return { point: { name: point.name, fullName: point.fullName, lat: point.lat, lng: point.lng + offset }, duration: route.duration, distance: route.distance, coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng + offset]) };
      } catch { return null; }
    }));
    const result: RecResult = { recommendations: routes.filter((r): r is DriveRecommendation => r !== null) };
    if (matches.length && !result.recommendations.length) return { recommendations: [], error: "Road routes are temporarily unavailable. Please try again." };
    if (recCache.size >= 60) recCache.clear();
    recCache.set(key, { at: Date.now(), result });
    return result;
  } catch (err) {
    console.error("recommendDriveStops failed", err);
    return { recommendations: [], error: "The free town or routing service is busy. Please try again shortly." };
  }
}
