import type { PlannerPoint } from "./travel-help";

export type DriveRecommendation = {
  point: PlannerPoint;
  duration: number;
  distance: number;
  coords: [number, number][];
};

export const DEFAULT_RANGE = { min: 2, max: 9 };
export const RANGE_PRESETS = [
  { label: "Close (0.5–2h)", min: 0.5, max: 2 },
  { label: "Medium (1–4h)", min: 1, max: 4 },
  { label: "Long (2–9h)", min: 2, max: 9 },
];

/** Window in seconds for a chosen hour range (defaults to 2–9 hours). */
export function drivingWindow(minHours = DEFAULT_RANGE.min, maxHours = DEFAULT_RANGE.max) {
  return { min: minHours * 3600, max: maxHours * 3600 };
}

export function withinDrivingWindow(seconds: number | null, minHours = DEFAULT_RANGE.min, maxHours = DEFAULT_RANGE.max): seconds is number {
  const { min, max } = drivingWindow(minHours, maxHours);
  return seconds !== null && Number.isFinite(seconds) && seconds > 0 && seconds >= min && seconds <= max;
}

export function distanceKm(a: Pick<PlannerPoint, "lat" | "lng">, b: Pick<PlannerPoint, "lat" | "lng">) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
