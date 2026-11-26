import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Plus, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddItemForm, CATEGORY_ICON, StatusButton } from "@/components/trip-board";
import { TimePlanner } from "@/components/time-planner";
import { NightsStepper } from "@/components/nights-stepper";
import type { ItemCategory, SavedItem } from "@/lib/trip-board";
import { CATEGORY_LABEL, fmtMoney, sumCosts } from "@/lib/trip-board";
import type { PlannerPoint, StayDates } from "@/lib/travel-help";

const CATS: ItemCategory[] = ["stay", "eat", "do"];
const TAB_LABEL: Record<ItemCategory, string> = { stay: "Stay", eat: "Eat", do: "To do" };
const RECOMMEND_LABEL: Record<ItemCategory, string> = { stay: "Live hotel prices", eat: "Eats on Google Maps", do: "To do on Klook" };
const ADD_LABEL: Record<ItemCategory, string> = { stay: "Add stay", eat: "Add eat", do: "Add to do" };
const fmt = (iso?: string) => (iso ? new Date(iso + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");

/** Keyless ArcGIS satellite export centered exactly on the stop (used when no real photo exists). */
export function satelliteCoverUrl(p: PlannerPoint, w = 640, h = 240) {
  const latSpan = 0.02; // roughly 2 km of ground
  const lngSpan = (latSpan * w) / h / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
  const b = [p.lng - lngSpan / 2, p.lat - latSpan / 2, p.lng + lngSpan / 2, p.lat + latSpan / 2]
    .map((v) => v.toFixed(5))
    .join(",");
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${b}&bboxSR=4326&imageSR=3857&size=${w},${h}&format=png&f=image`;
}

/** Real photo of the place from Wikipedia (no key needed): title match first, then nearby pages. */
async function wikiThumb(query: string): Promise<string | null> {
  try {
    const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=800&${query}`);
    if (!r.ok) return null;
    const j = await r.json();
    const pages = Object.values(j?.query?.pages ?? {}) as { thumbnail?: { source?: string } }[];
    return pages.find((p) => p.thumbnail?.source)?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}
export async function placePhotoUrl(p: PlannerPoint): Promise<string | null> {
  return (
    (await wikiThumb(`titles=${encodeURIComponent(p.name)}`)) ??
    (await wikiThumb(`generator=geosearch&ggscoord=${p.lat}|${p.lng}&ggsradius=10000&ggslimit=10`))
  );
}

/** The itinerary's day column, living in the map's side panel: reacts to the selected stop. */
export function DayPanel(props: {
  stop: PlannerPoint;
  stopIndex: number;
  nights: number;
  date?: StayDates;
  items: SavedItem[];
  currency: string;
  departure: string;
  arrival?: string;
  drive?: string;
  tab: ItemCategory;
  onTab: (c: ItemCategory) => void;
  onNightsChange: (v: number) => void;
  onDepartureChange: (v: string) => void;
  onItemChange: (item: SavedItem) => void;
  onSaveItem: (item: SavedItem) => void;
  onOpenItem: () => void;
  onRecommend: (c: ItemCategory) => void;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  hasPrevDay?: boolean;
  hasNextDay?: boolean;
}) {
  const [manual, setManual] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const list = props.items.filter((it) => it.category === props.tab);
  const tabBooked = sumCosts(props.items, props.tab, true);
  const tabPlanned = sumCosts(props.items, props.tab, false);
  const dayBooked = CATS.reduce((a, c) => a + sumCosts(props.items, c, true), 0);
  const stop = props.stop;

  useEffect(() => {
    let dead = false;
    setPhoto(null);
    placePhotoUrl(stop).then((u) => {
      if (!dead) setPhoto(u);
    });
    return () => {
      dead = true;
    };
  }, [stop.name, stop.lat, stop.lng]);

  return (
    <div className="space-y-4 pr-6 max-lg:space-y-2.5 max-lg:pr-5">
      {props.onPrevDay && props.onNextDay && (
        <div className="flex items-center justify-between gap-2 lg:hidden">
          <button type="button" aria-label="Previous day" disabled={!props.hasPrevDay} onClick={props.onPrevDay}
            className="glass-control flex h-8 w-8 shrink-0 items-center justify-center rounded-full border disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="truncate text-xs font-medium text-muted-foreground">Day {props.stopIndex + 1} · {props.stop.name} — swipe for other days</span>
          <button type="button" aria-label="Next day" disabled={!props.hasNextDay} onClick={props.onNextDay}
            className="glass-control flex h-8 w-8 shrink-0 items-center justify-center rounded-full border disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      <img src={photo ?? satelliteCoverUrl(props.stop)} alt={photo ? `Photo of ${props.stop.name}` : `Satellite view of ${props.stop.name}`} loading="lazy"
        onError={() => setPhoto((cur) => (cur ? null : cur))}
        className="h-32 w-full rounded-xl border border-border/60 object-cover max-lg:h-16" />

      <div>
        <h2 className="font-display text-2xl font-bold max-lg:text-xl">{props.stop.name}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <NightsStepper label={props.stop.name} value={props.nights} onChange={props.onNightsChange} />
          {props.date?.checkIn && <span>{fmt(props.date.checkIn)} – {fmt(props.date.checkOut)}</span>}
          <span>· Day {props.stopIndex + 1}</span>
        </div>
      </div>

      <TimePlanner detailed stopName={props.stop.name} departure={props.departure} arrival={props.arrival} drive={props.drive}
        hasIncoming={props.stopIndex > 0} onDepartureChange={props.onDepartureChange} />

      <div className="flex gap-1.5">
        {CATS.map((c) => {
          const Icon = CATEGORY_ICON[c];
          return (
            <button key={c} onClick={() => { props.onTab(c); setManual(false); }}
              className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs", props.tab === c ? "border-gold bg-gold/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
              <Icon className="h-3.5 w-3.5" />{TAB_LABEL[c]}
            </button>
          );
        })}
      </div>

      <section className="space-y-1.5">
        {list.map((it) => (
          <div key={it.id} className="glass-card w-full rounded-md px-2 py-1.5 text-left text-[13px]">
            <div className="flex items-center gap-2">
              {it.url ? (
                <a href={it.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${it.title} in a new tab`}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-sm hover:text-gold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <span className="min-w-0 flex-1 truncate">{it.title}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </a>
              ) : (
                <button type="button" onClick={props.onOpenItem} className="min-w-0 flex-1 truncate text-left hover:text-gold">{it.title}</button>
              )}
              <Star className="h-3.5 w-3.5 shrink-0 fill-gold text-gold" />
              <StatusButton status={it.status} itemName={it.title} onChange={(status) => props.onItemChange({ ...it, status })} />
            </div>
            <label className="mt-1 flex items-center gap-1.5 pl-0.5 text-[11px] text-muted-foreground">
              Cost
              <input type="number" min={0} inputMode="decimal" value={it.cost ?? ""} placeholder="—"
                onChange={(e) => props.onItemChange({ ...it, cost: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })}
                className="h-6 w-20 rounded border border-border bg-background px-1.5 text-xs text-foreground" />
            </label>
          </div>
        ))}

        {(tabBooked > 0 || tabPlanned > 0) && (
          <div className="flex items-center gap-3 pl-0.5 text-[11px]">
            <span className="text-gold">Booked {fmtMoney(tabBooked, props.currency)}</span>
            {tabPlanned > 0 && <span className="text-muted-foreground">Planned {fmtMoney(tabPlanned, props.currency)}</span>}
          </div>
        )}

        {manual ? (
          <AddItemForm key={`${props.stopIndex}-${props.tab}`} draft={{ stop: props.stopIndex, category: props.tab }} stopName={props.stop.name}
            onCancel={() => setManual(false)} onSave={(it) => { props.onSaveItem(it); setManual(false); }} />
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => props.onRecommend(props.tab)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-gold hover:text-gold">
              <Sparkles className="h-3.5 w-3.5" />{RECOMMEND_LABEL[props.tab]}
              <ExternalLink className="h-3 w-3 opacity-60" />
            </button>
            <button onClick={() => setManual(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-gold hover:text-gold">
              <Plus className="h-3.5 w-3.5" />{ADD_LABEL[props.tab]}
            </button>
          </div>
        )}
        {!manual && list.length === 0 && (
          <p className="text-xs text-muted-foreground">Nothing saved for {TAB_LABEL[props.tab].toLowerCase()} here yet.</p>
        )}
      </section>

      <div className="glass-card flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md px-2 py-1.5 text-[11px]">
        {CATS.map((c) => (
          <span key={c} className="text-muted-foreground">
            {CATEGORY_LABEL[c]} <b className="font-semibold text-gold">{fmtMoney(sumCosts(props.items, c, true), props.currency)}</b>
          </span>
        ))}
        <span className="ml-auto text-foreground">Day <b className="text-gold">{fmtMoney(dayBooked, props.currency)}</b></span>
      </div>
    </div>
  );
}
