import { useState } from "react";
import { NightsStepper } from "@/components/nights-stepper";
import { BedDouble, ExternalLink, MapPinned, Plus, Star, Trash2, UtensilsCrossed, X, ChevronRight, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, nextStatus, STATUS_LABEL, statusClass, type ItemCategory, type SavedItem, type TripPlan } from "@/lib/trip-board";
import type { StayDates } from "@/lib/travel-help";

export const CATEGORY_ICON = { stay: BedDouble, eat: UtensilsCrossed, do: MapPinned } as const;

export type Draft = { stop: number; category: ItemCategory; url?: string; title?: string };

export function StatusChip({ status }: { status: SavedItem["status"] }) {
  return <span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium", statusClass[status])}>{STATUS_LABEL[status]}</span>;
}

export function StatusButton({ status, itemName, onChange }: { status: SavedItem["status"]; itemName: string; onChange: (status: SavedItem["status"]) => void }) {
  const next = nextStatus(status);
  return (
    <button
      type="button"
      aria-label={`Change ${itemName} to ${STATUS_LABEL[next]}`}
      title={`Mark as ${STATUS_LABEL[next]}`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(next); }}
      className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <StatusChip status={status} />
    </button>
  );
}

function ItemRow({ item, onChange, onRemove }: { item: SavedItem; onChange: (i: SavedItem) => void; onRemove: () => void }) {
  const Icon = CATEGORY_ICON[item.category];
  return (
    <div className="group flex overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex w-24 shrink-0 items-center justify-center bg-gradient-to-br from-muted to-secondary"><Icon className="h-7 w-7 text-gold/80" /></div>
      <div className="min-w-0 flex-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{CATEGORY_LABEL[item.category]}</div>
          <StatusButton status={item.status} itemName={item.title} onChange={(status) => onChange({ ...item, status })} />
        </div>
        <div className="mt-0.5 flex items-center gap-2 font-medium"><span className="truncate">{item.title}</span></div>
        {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
        <div className="mt-1 flex items-center justify-between">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-gold">
              <ExternalLink className="h-3 w-3" /> Open link
            </a>
          ) : <span />}
          <button aria-label={`Remove ${item.title}`} onClick={onRemove} className="text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
        <label className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          Cost
          <input type="number" min={0} inputMode="decimal" value={item.cost ?? ""} placeholder="—"
            onChange={(e) => onChange({ ...item, cost: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })}
            className="h-6 w-20 rounded border border-border bg-background px-1.5 text-xs text-foreground" />
        </label>
      </div>
    </div>
  );
}

export function AddItemForm({ draft, stopName, onSave, onCancel }: { draft: Draft; stopName: string; onSave: (i: SavedItem) => void; onCancel: () => void }) {
  const [category, setCategory] = useState<ItemCategory>(draft.category);
  const [title, setTitle] = useState(draft.title ?? "");
  const [url, setUrl] = useState(draft.url ?? "");
  const [note, setNote] = useState("");
  return (
    <form className="glass-card space-y-2 rounded-lg border border-gold/50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSave({ id: crypto.randomUUID(), stop: draft.stop, category, title: title.trim(), url: url.trim() || undefined, note: note.trim() || undefined, status: "idea" });
      }}>
      <div className="text-xs text-muted-foreground">Save an idea for <span className="text-foreground">{stopName}</span></div>
      <div className="flex gap-1">
        {(Object.keys(CATEGORY_LABEL) as ItemCategory[]).map((c) => {
          const Icon = CATEGORY_ICON[c];
          return (
            <Button key={c} type="button" size="sm" variant={category === c ? "default" : "outline"} onClick={() => setCategory(c)}>
              <Icon className="mr-1 h-3.5 w-3.5" />{CATEGORY_LABEL[c]}
            </Button>
          );
        })}
      </div>
      <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name, e.g. Zealandia sanctuary tour" />
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link (optional) — paste the Viator or hotel page" />
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!title.trim()}><Star className="mr-1 h-3.5 w-3.5" />Save</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

export function TripBoard(props: {
  plan: TripPlan;
  title: string;
  dates: StayDates[];
  selected: number;
  onSelect: (i: number) => void;
  draft: Draft | null;
  setDraft: (d: Draft | null) => void;
  onItemsChange: (items: SavedItem[]) => void;
  onClose: () => void;
  onMoveStop: (from: number, to: number) => void;
  onNightsChange: (stop: number, nights: number) => void;
  fixedLast?: boolean;
  fixedFirst?: boolean;
}) {
  const { plan, selected } = props;
  const [tab, setTab] = useState<"itinerary" | "bookings">("itinerary");
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const endDrag = () => { setDragFrom(null); setDragOver(null); };
  const stop = plan.stops[selected];
  const items = plan.items.filter((i) => i.stop === selected);
  const update = (it: SavedItem) => props.onItemsChange(plan.items.map((x) => (x.id === it.id ? it : x)));
  const remove = (id: string) => props.onItemsChange(plan.items.filter((x) => x.id !== id));
  const booked = plan.items.filter((i) => i.status === "booked" || i.status === "done");
  const fmt = (iso?: string) => (iso ? new Date(iso + "T00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "");

  return (
    <aside className="absolute inset-y-0 right-0 z-[600] flex w-full max-w-[440px] flex-col border-l border-border bg-background shadow-2xl lg:static lg:z-auto lg:w-[440px] lg:shrink-0 lg:shadow-none" aria-label="Trip board">
      <div className="flex items-start justify-between px-6 pt-6">
        <div>
          <h2 className="font-display text-3xl font-bold">Trip Board</h2>
          <p className="mt-1 text-lg text-muted-foreground">{plan.stops.length} day{plan.stops.length === 1 ? "" : "s"} · {props.title}</p>
        </div>
        <button aria-label="Close trip board" onClick={props.onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
      </div>
      <div className="mx-4 mt-5 grid grid-cols-2 border-b border-border text-sm">
        {(["itinerary", "bookings"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("-mb-px border-b-[3px] pb-3 capitalize", tab === t ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t}{t === "bookings" && booked.length > 0 && ` (${booked.length})`}
          </button>
        ))}
      </div>

      {tab === "itinerary" && stop && (
        <div className="border-b border-border bg-card/60 px-6 py-3">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-2xl font-bold">Day {selected + 1} · {stop.name}</h3>
            <span className="text-sm text-muted-foreground">{fmt(props.dates[selected]?.checkIn)}</span>
          </div>
          <NightsStepper className="mt-1" label={stop.name} value={plan.nights[selected] ?? 1} onChange={(v) => props.onNightsChange(selected, v)} />
        </div>
      )}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {tab === "bookings" ? (
          <div className="space-y-2 p-5">
            {booked.length === 0 && <p className="text-sm text-muted-foreground">Nothing booked yet. Mark a saved idea as Booked and it will show here.</p>}
            {booked.map((it) => (
              <div key={it.id}>
                <div className="mb-1 text-xs text-muted-foreground">Day {it.stop + 1} · {plan.stops[it.stop]?.name}</div>
                <ItemRow item={it} onChange={update} onRemove={() => remove(it.id)} />
              </div>
            ))}
          </div>
        ) : plan.stops.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Add a stop on the map, then star the places you'd like to stay, eat and visit there.</p>
        ) : (
          <>
            <p className="px-6 pt-3 text-xs text-muted-foreground">Drag a day to change the order.</p>
            <ol className="py-2">
              {plan.stops.map((s, i) => {
                const count = plan.items.filter((x) => x.stop === i).length;
                const dragging = dragFrom === i;
                const target = dragOver === i && dragFrom !== null && dragFrom !== i;
                return (
                  <li key={i} draggable={!(((props.fixedLast && i === plan.stops.length - 1) || (props.fixedFirst && i === 0)))}
                    onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }}
                    onDragOver={(e) => { e.preventDefault(); if (dragOver !== i) setDragOver(i); }}
                    onDrop={(e) => { e.preventDefault(); if (dragFrom !== null && dragFrom !== i && !(((props.fixedLast && i === plan.stops.length - 1) || (props.fixedFirst && i === 0)))) props.onMoveStop(dragFrom, i); endDrag(); }}
                    onDragEnd={endDrag}
                    className={cn("relative cursor-grab transition-all duration-150 active:cursor-grabbing",
                      dragging && "z-10 scale-[1.04] rounded-lg bg-card opacity-90 shadow-2xl ring-2 ring-gold",
                      target && (dragFrom! < i ? "border-b-2 border-gold" : "border-t-2 border-gold"))}>
                    <button onClick={() => props.onSelect(i)}
                      className={cn("flex w-full items-center gap-4 border-l-[3px] px-4 py-3 text-left", i === selected ? "border-gold bg-gradient-to-r from-gold/20 to-transparent font-semibold" : "border-transparent hover:bg-muted/50")}>
                      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className={cn("w-12", i === selected ? "text-gold" : "text-muted-foreground")}>Day {i + 1}</span>
                      <span className="flex-1 truncate">{s.name}{((props.fixedLast && i === plan.stops.length - 1) || (props.fixedFirst && i === 0)) && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase text-muted-foreground">{props.fixedFirst && i === 0 ? "Start" : "End"}</span>}</span>
                      {count > 0 && <span className="flex items-center gap-0.5 text-xs text-gold"><Star className="h-3 w-3 fill-gold" />{count}</span>}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ol>
            {stop && (
              <div className="space-y-2 p-6 pt-3">
                {items.length === 0 && !props.draft && <p className="text-sm text-muted-foreground">No saved ideas yet. Tap a ☆ next to a link in your route, or add one below.</p>}
                {items.map((it) => <ItemRow key={it.id} item={it} onChange={update} onRemove={() => remove(it.id)} />)}
                {props.draft && props.draft.stop === selected ? (
                  <AddItemForm key={JSON.stringify(props.draft)} draft={props.draft} stopName={stop.name}
                    onCancel={() => props.setDraft(null)}
                    onSave={(it) => { props.onItemsChange([...plan.items, it]); props.setDraft(null); }} />
                ) : (
                  <Button variant="outline" className="h-11 w-full border-gold/70 bg-transparent text-gold hover:bg-gold/10 hover:text-gold" onClick={() => props.setDraft({ stop: selected, category: "do" })}>
                    <Plus className="mr-1 h-4 w-4" /> Add to Day {selected + 1}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
