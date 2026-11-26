import type { PlannerPoint } from "./travel-help";
import { distanceKm } from "./drive-recommendations";

type TownRow = [string, number, number, string, number];

// GeoNames cities1000, CC BY 4.0: https://www.geonames.org/
// The dataset (~7 MB) is served from /towns-data.json and fetched lazily on first use.
let townRows: TownRow[] | null = null;
let townPromise: Promise<TownRow[]> | null = null;

function loadTowns(): Promise<TownRow[]> {
  if (townRows) return Promise.resolve(townRows);
  if (!townPromise) {
    townPromise = fetch("/towns-data.json")
      .then((r) => r.json())
      .then((rows: TownRow[]) => {
        townRows = rows;
        return rows;
      });
  }
  return townPromise;
}

let countries: { of: (code: string) => string | undefined } = { of: () => undefined };
try { countries = new Intl.DisplayNames(["en"], { type: "region" }); } catch { /* keep fallback */ }

export async function nearbyTowns(from: PlannerPoint, radiusKm: number, minKm = 10) {
  const rows = await loadTowns();
  const points: (PlannerPoint & { population: number })[] = [];
  for (const row of rows) {
    const [name, lat, lng, country, population] = row;
    if (typeof name !== "string" || typeof lat !== "number" || typeof lng !== "number" || typeof country !== "string" || typeof population !== "number") continue;
    if (Math.abs(lat - from.lat) > radiusKm / 110) continue;
    const point = { name, fullName: `${name}, ${countries.of(country) || country}`, lat, lng, population };
    const km = distanceKm(from, point);
    if (km > minKm && km <= radiusKm) points.push(point);
  }
  return points;
}
