export const DEFAULT_DEPARTURE = "08:30";

/** Add a road leg's duration to a HH:MM departure, wrapping past midnight. */
export function arrivalTime(departure: string, durationSeconds?: number | null): string {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(departure)) return "";
  if (durationSeconds === null || durationSeconds === undefined || !Number.isFinite(durationSeconds) || durationSeconds < 0) return "";
  const [hours, minutes] = departure.split(":").map(Number);
  const total = (hours * 60 + minutes + Math.round(durationSeconds / 60)) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
