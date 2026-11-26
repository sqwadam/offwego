import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Car, ExternalLink, GripVertical, Pencil, Plus, Star, Moon, Sparkles, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABEL, type ItemCategory, type SavedItem, type TripPlan } from "@/lib/trip-board";
import { AddItemForm, CATEGORY_ICON, StatusButton } from "@/components/trip-board";
import { TimePlanner } from "@/components/time-planner";
import type { PlannerPoint, StayDates } from "@/lib/travel-help";
import { NightsStepper } from "@/components/nights-stepper";

function StopName({ name, onRename }: { name: string; onRename: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  if (editing) {
    const commit = () => { setEditing(false); if (value.trim() && value.trim() !== name) onRename(value); };
    return (
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onBlur={commit} aria-label="Stop name"
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setValue(name); setEditing(false); } }}
        className="mt-2 w-40 rounded-md border border-gold bg-background px-2 py-0.5 text-center font-semibold" />
    );
  }
  return (
    <button type="button" onClick={() => { setValue(name); setEditing(true); }} aria-label={`Rename ${name}`}
      className="group mt-2 flex items-center gap-1.5 font-semibold hover:text-gold">
      {name}<Pencil className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
    </button>
  );
}

/** Keyless satellite tile around a stop, used as the column's cover image. */
function coverUrl(p: PlannerPoint, z = 11) {
  const n = 2 ** z;
  const x = Math.floor(((p.lng + 180) / 360) * n);
  const lat = (p.lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n);
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}

const ADD_LABEL: Record<ItemCategory, string> = { stay: "Add stay", eat: "Add eat", do: "Add activity" };
const RECOMMEND_LABEL: Record<ItemCategory, string> = { stay: "Recommended stays", eat: "Recommended eats", do: "Recommended activities" };
const fmt = (iso?: string) => (iso ? new Date(iso + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");

export function TripOverview(props: {
  driveIn?: string[];
  arrivals: string[];
  plan: TripPlan;
  title: string;
  dates: StayDates[];
  saved: boolean;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
  onAdd: (stop: number, category: ItemCategory) => void;
  onOpenItem: (stop: number) => void;
  onSaveItem: (item: SavedItem) => void;
  onRemoveStop: (stop: number) => void;
  onMoveStop: (from: number, to: number) => void;
  onRenameStop: (stop: number, name: string) => void;
  map: ReactNode;
  fixedLast?: boolean;
  fixedFirst?: boolean;
  onNightsChange: (stop: number, nights: number) => void;
  onDepartureChange: (stop: number, value: string) => void;
  onItemChange: (item: SavedItem) => void;
  selected: number;
  onSelectStop: (stop: number) => void;
}) {
  const { plan } = props;
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const endDrag = () => { setDragFrom(null); setDragOver(null); };
  const nights = (i: number) => plan.nights[i] ?? 1;
  const totalNights = plan.stops.reduce((s, _, i) => s + nights(i), 0);
  const first = props.dates[0]?.checkIn;
  const last = props.dates[plan.stops.length - 1]?.checkOut;
  const n = plan.stops.length;

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      <div className="relative min-w-0 flex-1 overflow-y-auto px-6 py-5">
        <button onClick={props.onBack} aria-label="Close trip overview" className="glass-control absolute right-4 top-4 z-10 rounded-full border p-2 text-muted-foreground hover:border-gold hover:text-gold"><X className="h-5 w-5" /></button>
        <button onClick={props.onBack} className="flex items-center gap-3 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" /> Back to map
        </button>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4 pr-12">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-4xl font-bold">{props.title}</h1>
              {props.saved && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-gold/50 bg-gold/10 px-2.5 py-1 text-sm text-gold">
                  <Star className="h-3.5 w-3.5" /> Saved
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{first ? `${fmt(first)} – ${fmt(last)} ` : ""}({totalNights} night{totalNights === 1 ? "" : "s"})</span>
              <span className="flex items-center gap-2"><Car className="h-4 w-4" />Road trip</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="glass-control h-11" onClick={props.onBack}><Pencil className="mr-2 h-4 w-4" />Edit trip</Button>
            <Button className="h-11" onClick={props.onSave} disabled={props.saving || !plan.start}>{props.saving ? "Saving…" : props.saved ? "Saved" : "Save trip"}</Button>
          </div>
        </div>

        {n === 0 ? (
          <p className="mt-10 text-muted-foreground">Add stops on the map and they'll appear here as a day-by-day timeline.</p>
        ) : (
          <>
            <p className="mt-6 text-xs uppercase tracking-wider text-muted-foreground">Timeline · drag days to reorder</p>
            <div className="mt-2 overflow-x-auto pb-3">
              <div className="flex min-w-max gap-3">
                {plan.stops.map((s, i) => {
                  const isStart = !!props.fixedFirst && i === 0;
                  const locked = (!!props.fixedLast && i === n - 1) || isStart;
                  const sel = i === props.selected;
                  return (
                    <div key={`t${i}`} draggable={!locked}
                      onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }}
                      onDragOver={(e) => { e.preventDefault(); if (dragOver !== i) setDragOver(i); }}
                      onDrop={(e) => { e.preventDefault(); if (dragFrom !== null && dragFrom !== i && !locked) props.onMoveStop(dragFrom, i); endDrag(); }}
                      onDragEnd={endDrag}
                      onClick={() => props.onSelectStop(i)}
                      className={cn("glass-card relative flex w-64 cursor-pointer flex-col items-center rounded-xl border px-3 pb-3 pt-3 text-center transition-all",
                        sel ? "scale-[1.03] border-gold bg-gold/10" : "hover:border-gold/50",
                        dragFrom === i && "z-20 scale-105 shadow-2xl ring-2 ring-gold",
                        dragOver === i && dragFrom !== null && dragFrom !== i && "ring-2 ring-gold/60")}>
                      {!locked && <GripVertical className="absolute left-2 top-2 h-4 w-4 cursor-grab text-muted-foreground" />}
                      {locked && <span className="absolute right-2 top-2 rounded bg-muted px-1.5 text-[10px] uppercase text-muted-foreground">{isStart ? "Start" : "End"}</span>}
                      {i < n - 1 && <ArrowRight className="absolute -right-3 top-5 z-10 h-4 w-4 text-gold" />}
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-sm font-bold text-primary-foreground">{i + 1}</span>
                      <StopName name={s.name} onRename={(v) => props.onRenameStop(i, v)} />
                      <span className="text-xs text-muted-foreground">Day {i + 1}{props.dates[i]?.checkIn ? ` · ${fmt(props.dates[i]?.checkIn)}` : ""}</span>
                      {props.driveIn?.[i] && <span className="text-xs text-gold">🚗 {props.driveIn[i]}</span>}
                      <div className="mt-2 w-full">
                        <TimePlanner stopName={s.name} departure={plan.departures[i] ?? "08:30"} arrival={props.arrivals[i]} drive={props.driveIn?.[i]}
                          hasIncoming={!!props.fixedFirst && i > 0} onDepartureChange={(v) => props.onDepartureChange(i, v)} />
                      </div>
                      <NightsStepper className="mt-2" label={s.name} value={nights(i)} onChange={(v) => props.onNightsChange(i, v)} />
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                        <button type="button" disabled={i <= (props.fixedFirst ? 1 : 0) || locked} onClick={() => props.onMoveStop(i, i - 1)} aria-label={`Move ${s.name} earlier`}
                          className="hover:text-gold disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => props.onRemoveStop(i)} aria-label={`Remove ${s.name}`}
                          className="flex items-center gap-1 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                        <button type="button" disabled={locked || i >= n - (props.fixedLast ? 2 : 1)} onClick={() => props.onMoveStop(i, i + 1)} aria-label={`Move ${s.name} later`}
                          className="hover:text-gold disabled:opacity-30"><ArrowRight className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {(() => {
              const i = Math.min(props.selected, n - 1);
              const s = plan.stops[i];
              return (
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
                  <div className="relative h-[420px] overflow-hidden rounded-xl border border-border">{props.map}</div>
                  <StopColumn stop={s} nights={nights(i)} items={plan.items.filter((it) => it.stop === i)}
                    departure={plan.departures[i] ?? "08:30"} arrival={props.arrivals[i]} drive={props.driveIn?.[i]}
                    onDepartureChange={(v) => props.onDepartureChange(i, v)} onItemChange={props.onItemChange}
                    onAdd={(c) => props.onAdd(i, c)} onOpen={() => props.onOpenItem(i)} stopIndex={i} onSave={props.onSaveItem} />
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

function StopColumn(props: {
  stop: PlannerPoint;
  nights: number;
  items: SavedItem[];
  departure: string;
  arrival?: string;
  drive?: string;
  onDepartureChange: (value: string) => void;
  onItemChange: (item: SavedItem) => void;
  onAdd: (c: ItemCategory) => void;
  onOpen: () => void;
  stopIndex: number;
  onSave: (item: SavedItem) => void;
}) {
  const [manual, setManual] = useState<ItemCategory | null>(null);
  return (
    <div className="glass-panel flex flex-col rounded-xl border p-1.5">
      <img src={coverUrl(props.stop)} alt={`Satellite view of ${props.stop.name}`} loading="lazy" className="h-32 w-full rounded-lg object-cover" />
      <div className="px-2.5 pb-3 pt-3">
        <h3 className="text-xl font-semibold">{props.stop.name}</h3>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Moon className="h-3.5 w-3.5" />{props.nights} night{props.nights === 1 ? "" : "s"}</p>
        <div className="mt-4">
          <TimePlanner detailed stopName={props.stop.name} departure={props.departure} arrival={props.arrival} drive={props.drive}
            hasIncoming={props.stopIndex > 0} onDepartureChange={props.onDepartureChange} />
        </div>
        {(["stay", "eat", "do"] as ItemCategory[]).map((c) => {
          const Icon = CATEGORY_ICON[c];
          const list = props.items.filter((it) => it.category === c);
          return (
            <section key={c} className="mt-5">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4" />{CATEGORY_LABEL[c]}</h4>
              <div className="space-y-1.5">
                {list.map((it) => (
                  <div key={it.id} className="glass-card flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]">
                    {it.url ? (
                      <a href={it.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${it.title} in a new tab`}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-sm hover:text-gold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <span className="min-w-0 flex-1 truncate">{it.title}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </a>
                    ) : (
                      <button type="button" onClick={props.onOpen} className="min-w-0 flex-1 truncate text-left hover:text-gold">{it.title}</button>
                    )}
                    <Star className="h-3.5 w-3.5 shrink-0 fill-gold text-gold" />
                    <StatusButton status={it.status} itemName={it.title} onChange={(status) => props.onItemChange({ ...it, status })} />
                  </div>
                ))}
              </div>
              {manual === c ? (
                <div className="mt-2"><AddItemForm key={`${props.stopIndex}-${c}`} draft={{ stop: props.stopIndex, category: c }} stopName={props.stop.name}
                  onCancel={() => setManual(null)} onSave={(it) => { props.onSave(it); setManual(null); }} /></div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => props.onAdd(c)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-gold hover:text-gold">
                    <Sparkles className="h-3.5 w-3.5" />{RECOMMEND_LABEL[c]}
                  </button>
                  <button onClick={() => setManual(c)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-gold hover:text-gold">
                    <Plus className="h-3.5 w-3.5" />{ADD_LABEL[c]}
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
