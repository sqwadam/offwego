import { useEffect, useState } from "react";
import { ArrowLeft, BedDouble, Check, Compass, ExternalLink, Loader2, MapPin, Plus, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { nearbyPlaces, nearbyAttractions, type NearbyKind, type NearbyPlace } from "@/lib/geo";
import { LINK_PROVIDER, STAY22_AID, klookLink, type PlannerPoint, type StayDates } from "@/lib/travel-help";

const META: Record<NearbyKind, { title: string; icon: typeof BedDouble; empty: string }> = {
  stay: { title: "Stays", icon: BedDouble, empty: "No places to stay found nearby." },
  eat: { title: "Eats", icon: UtensilsCrossed, empty: "No places to eat found nearby." },
  do: { title: "Activities", icon: Compass, empty: "No sights or activities found nearby." },
};

export function placeLink(p: NearbyPlace, kind: NearbyKind, town: string) {
  if (LINK_PROVIDER === "klook" && kind === "do") return klookLink(`${p.name} ${town}`);
  if (kind === "stay") return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(`${p.name}, ${town}`)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${town}`)}`;
}

const LINK_LABEL: Record<NearbyKind, string> = { stay: "Booking.com", eat: "Google Maps", do: "Klook" };

const HOTEL_TYPES = new Set(["hotel", "guest house", "motel", "apartment", "chalet"]);
const stayBadge = (p: NearbyPlace) => (p.type === "hostel" ? "Hostel" : HOTEL_TYPES.has(p.type) ? "Hotel" : p.type[0].toUpperCase() + p.type.slice(1));

const fmtDate = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short" });

function StayImage({ p, className }: { p: NearbyPlace; className: string }) {
  return p.image ? (
    <img src={p.image} alt={p.name} loading="lazy" className={className} />
  ) : (
    <div className={cn("flex w-full items-center justify-center bg-muted/40", className)}>
      <BedDouble className="h-6 w-6 text-muted-foreground" />
    </div>
  );
}

export function PlaceExplorer({ kind, stops, stop, onStopChange, addedTitles, onAdd, onPlaces, dates = null, backToDay }: {
  kind: NearbyKind;
  stops: PlannerPoint[];
  stop: number;
  onStopChange: (i: number) => void;
  addedTitles: Set<string>;
  onAdd: (p: NearbyPlace, url: string) => void;
  onPlaces?: (places: NearbyPlace[]) => void;
  dates?: StayDates;
  backToDay?: () => void;
}) {
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stayFilter, setStayFilter] = useState<"all" | "hotels" | "hostels">("all");
  const town = stops[stop];
  const { title, icon: Icon, empty } = META[kind];

  useEffect(() => {
    if (!town) return;
    let live = true;
    setLoading(true); setError(null); setPlaces([]);
    const load = kind === "do"
      ? nearbyAttractions(town.lat, town.lng)
      : nearbyPlaces(town.lat, town.lng, kind);
    load
      .then((r) => { if (live) { setPlaces(r.places); onPlaces?.(r.places); setError(r.error ?? null); } })
      .catch(() => live && setError("Couldn't load places. Try again."))
      .finally(() => live && setLoading(false));
    return () => { live = false; onPlaces?.([]); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [town?.lat, town?.lng, kind]);

  if (!stops.length) {
    return (
      <div className="space-y-2 pr-6">
        <h2 className="flex items-center gap-2 text-xl font-bold"><Icon className="h-5 w-5 text-gold" />{title}</h2>
        <p className="text-sm text-muted-foreground">Add a stop to your route first, then come back to browse what's nearby.</p>
      </div>
    );
  }

  const isActivities = kind === "do";
  const isStay = kind === "stay";
  const shown = isStay
    ? places.filter((p) => (stayFilter === "all" ? true : stayFilter === "hostels" ? p.type === "hostel" : p.type !== "hostel"))
    : places;
  const nightRange = isStay && dates ? `${fmtDate(dates.checkIn)} – ${fmtDate(dates.checkOut)}` : null;

  return (
    <div className="space-y-4">
      <div className="pr-6">
        {backToDay && (
          <button onClick={backToDay} className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-gold">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to the day plan
          </button>
        )}
        <h2 className="flex items-center gap-2 text-xl font-bold"><Icon className="h-5 w-5 text-gold" />{title} near {town?.name}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {isActivities
            ? "What Wikipedia knows is nearby — tap through to Klook for their recommended tours and activities."
            : isStay
              ? nightRange
                ? `For the night of ${fmtDate(dates!.checkIn)}. Prices are estimates — tap "Live hotels" on the map for real-time rates.`
                : "Set a trip start date and nights to see check-in dates. Prices are estimates — tap \"Live hotels\" on the map for real-time rates."
              : "Cheapest first. Prices are estimated price bands ($ to $$$$) from the type of place — check real prices on the booking site."}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {stops.map((s, i) => (
          <button key={i} onClick={() => onStopChange(i)}
            className={cn("rounded-full border px-3 py-1 text-xs", i === stop ? "border-gold bg-gold/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
            {i + 1}. {s.name}
          </button>
        ))}
      </div>
      {isStay && (
        <div className="flex gap-1.5">
          {([["all", "All"], ["hotels", "Hotels"], ["hostels", "Hostels"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setStayFilter(key)}
              className={cn("rounded-full border px-3 py-1 text-xs", stayFilter === key ? "border-gold bg-gold/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>
      )}
      {isActivities && town && !loading && (
        <a href={klookLink(town.name)} target="_blank" rel="noopener noreferrer"
          className="glass-card flex items-center justify-between gap-2 rounded-xl border border-gold/50 px-3 py-2.5 text-sm hover:border-gold">
          <span className="flex items-center gap-2 font-medium text-gold">
            <Compass className="h-4 w-4" /> See Klook's picks in {town.name}
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 text-gold" />
        </a>
      )}
      {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Finding places…</div>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && !error && shown.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
      {isActivities ? (
        <ul className="grid grid-cols-2 gap-2">
          {places.map((p) => {
            const url = placeLink(p, kind, town.name);
            const added = addedTitles.has(p.name);
            return (
              <li key={p.id} className="glass-card flex flex-col overflow-hidden rounded-xl border">
                {p.image ? (
                  <img src={p.image} alt={p.name} loading="lazy" className="h-24 w-full object-cover" />
                ) : (
                  <div className="flex h-24 w-full items-center justify-center bg-muted/40"><Compass className="h-6 w-6 text-muted-foreground" /></div>
                )}
                <div className="flex min-w-0 flex-1 flex-col p-2.5">
                  <div className="line-clamp-2 text-[13px] font-medium leading-snug">{p.name}</div>
                  {p.description && <div className="mt-1 line-clamp-3 text-[11px] leading-snug text-muted-foreground">{p.description}</div>}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <span className="shrink-0 text-[11px] text-muted-foreground">{p.distanceKm} km</span>
                    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`View ${p.name} on Klook`}
                      className="inline-flex items-center gap-1 text-[11px] text-gold hover:underline">
                      Klook <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <Button size="sm" disabled={added} onClick={() => onAdd(p, url)}
                    className="mt-2 h-7 bg-gold px-2 text-[11px] text-background hover:bg-gold/90">
                    {added ? <><Check className="mr-1 h-3 w-3" />Added</> : <><Plus className="mr-1 h-3 w-3" />Add</>}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : isStay ? (
        <ul className="grid grid-cols-2 gap-2">
          {shown.map((p) => {
            const url = placeLink(p, kind, town.name);
            const added = addedTitles.has(p.name);
            return (
              <li key={p.id} className="glass-card flex flex-col overflow-hidden rounded-xl border">
                <StayImage p={p} className="h-24 object-cover" />
                <div className="flex min-w-0 flex-1 flex-col p-2.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      p.type === "hostel" ? "bg-emerald-400/15 text-emerald-300" : "bg-gold/15 text-gold")}>
                      {stayBadge(p)}
                    </span>
                    {p.stars && <span className="shrink-0 text-[11px] text-muted-foreground">{p.stars}★</span>}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug">{p.name}</div>
                  {p.address && <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{p.address}</div>}
                  <div className="mt-1 text-sm font-semibold text-gold">
                    {p.priceExact ?? (p.price === 0 ? "Free" : "$".repeat(p.price))}
                    {!p.priceExact && <span className="ml-1 text-[10px] font-normal text-muted-foreground">est. per night</span>}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <span className="text-[11px] text-muted-foreground">{p.distanceKm} km</span>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-gold hover:underline">
                      Booking.com <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <Button size="sm" disabled={added} onClick={() => onAdd(p, url)}
                    className="mt-2 h-7 bg-gold px-2 text-[11px] text-background hover:bg-gold/90">
                    {added ? <><Check className="mr-1 h-3 w-3" />Added</> : <><Plus className="mr-1 h-3 w-3" />Add</>}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="space-y-2">
          {shown.map((p) => {
            const url = placeLink(p, kind, town.name);
            const added = addedTitles.has(p.name);
            return (
              <li key={p.id} className="glass-card rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="capitalize">{p.type}</span>{p.cuisine ? ` · ${p.cuisine}` : ""}{p.stars ? ` · ${p.stars}★` : ""} · {p.distanceKm} km
                    </div>
                    {p.address && <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{p.address}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold text-gold">{p.priceExact ?? (p.price === 0 ? "Free" : "$".repeat(p.price))}</div>
                    {!p.priceExact && <div className="text-[10px] text-muted-foreground">est.</div>}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" disabled={added} onClick={() => onAdd(p, url)} className="h-7 bg-gold px-2.5 text-xs text-background hover:bg-gold/90">
                    {added ? <><Check className="mr-1 h-3.5 w-3.5" />Added</> : <><Plus className="mr-1 h-3.5 w-3.5" />Add to Day {stop + 1}</>}
                  </Button>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-gold">
                    {LINK_LABEL[kind]} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
