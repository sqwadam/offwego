import type { PlannerPoint } from "./travel-help";
import { DEFAULT_DEPARTURE } from "./time-planner";

export type ItemCategory = "stay" | "eat" | "do";
export type ItemStatus = "idea" | "shortlisted" | "booked" | "done";

export type SavedItem = {
  id: string;
  stop: number; // index into stops
  category: ItemCategory;
  title: string;
  url?: string;
  status: ItemStatus;
  note?: string;
  cost?: number;
};

export type TripPlan = {
  start: PlannerPoint | null;
  end: PlannerPoint | null;
  stops: PlannerPoint[];
  nights: number[];
  departures: string[];
  startDeparture: string;
  endDeparture: string;
  startDate: string;
  items: SavedItem[];
  currency?: string;
};

export const CATEGORY_LABEL: Record<ItemCategory, string> = { stay: "Stay", eat: "Eat", do: "Things to do" };
export const STATUS_LABEL: Record<ItemStatus, string> = { idea: "Idea", shortlisted: "Shortlisted", booked: "Booked", done: "Done" };
export const STATUSES: ItemStatus[] = ["idea", "shortlisted", "booked", "done"];

export function nextStatus(status: ItemStatus): ItemStatus {
  return STATUSES[(STATUSES.indexOf(status) + 1) % STATUSES.length];
}

/** Which board section a planner link belongs to. */
export function categoryForLink(key: string): ItemCategory {
  if (key === "hotels" || key === "hostels") return "stay";
  if (key === "food" || key === "ta-food") return "eat";
  return "do";
}

export function emptyPlan(): TripPlan {
  return { start: null, end: null, stops: [], nights: [], departures: [], startDeparture: DEFAULT_DEPARTURE, endDeparture: DEFAULT_DEPARTURE, startDate: "", items: [], currency: "NZD" };
}

export function parsePlan(raw: unknown): TripPlan {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<TripPlan>;
  const stops = Array.isArray(p.stops) ? p.stops : [];
  return {
    start: p.start ?? null,
    end: p.end ?? null,
    stops,
    nights: Array.isArray(p.nights) ? p.nights : stops.map(() => 1),
    departures: stops.map((_, i) => typeof p.departures?.[i] === "string" ? p.departures[i] : DEFAULT_DEPARTURE),
    startDeparture: typeof p.startDeparture === "string" ? p.startDeparture : DEFAULT_DEPARTURE,
    endDeparture: typeof p.endDeparture === "string" ? p.endDeparture : DEFAULT_DEPARTURE,
    startDate: typeof p.startDate === "string" ? p.startDate : "",
    items: Array.isArray(p.items) ? p.items : [],
    currency: typeof p.currency === "string" && p.currency ? p.currency : "NZD",
  };
}

/** Removing a stop drops its items and shifts later items down one index. */
export function removeStopItems(items: SavedItem[], index: number): SavedItem[] {
  return items.filter((i) => i.stop !== index).map((i) => (i.stop > index ? { ...i, stop: i.stop - 1 } : i));
}

/** Move stop `from` to position `to`; saved places follow their stop. */
export function moveStopItems(items: SavedItem[], from: number, to: number): SavedItem[] {
  return items.map((i) => {
    if (i.stop === from) return { ...i, stop: to };
    if (from < to && i.stop > from && i.stop <= to) return { ...i, stop: i.stop - 1 };
    if (from > to && i.stop >= to && i.stop < from) return { ...i, stop: i.stop + 1 };
    return i;
  });
}

/** Currencies the cost calculator offers, per trip. */
export const CURRENCIES = ["NZD", "AUD", "USD", "EUR", "GBP"] as const;

export function fmtMoney(n: number, code: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code, maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
  } catch {
    return `${code} ${n}`;
  }
}

/** Sum of item costs in a category — booked items count as booked, everything else as planned. */
export function sumCosts(items: SavedItem[], category: ItemCategory, booked: boolean) {
  return items
    .filter((i) => i.category === category && typeof i.cost === "number" && (booked ? i.status === "booked" : i.status !== "booked"))
    .reduce((a, i) => a + (i.cost ?? 0), 0);
}

export function moveInArray<T>(arr: T[], from: number, to: number): T[] {
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
}

export const statusClass: Record<ItemStatus, string> = {
  idea: "border-border text-muted-foreground",
  shortlisted: "border-gold/50 bg-gold/10 text-gold",
  booked: "border-success/40 bg-success/15 text-success",
  done: "border-border bg-muted text-foreground",
};
