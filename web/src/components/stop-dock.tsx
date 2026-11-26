import { useState } from "react";
import { ArrowLeft, ArrowRight, GripVertical, ListChecks, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NightsStepper } from "@/components/nights-stepper";
import { TimePlanner } from "@/components/time-planner";
import type { TripPlan } from "@/lib/trip-board";
import type { StayDates } from "@/lib/travel-help";

const fmt = (iso?: string) => (iso ? new Date(iso + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");

/** Cinematic bottom dock: one draggable card per day, the selected one larger. */
export function StopDock(props: {
  plan: TripPlan;
  driveIn?: string[];
  arrivals: string[];
  dates: StayDates[];
  selected: number;
  fixedLast?: boolean;
  fixedFirst?: boolean;
  onSelect: (i: number) => void;
  onMoveStop: (from: number, to: number) => void;
  onNightsChange: (i: number, n: number) => void;
  onDepartureChange: (i: number, value: string) => void;
  onRemoveStop: (i: number) => void;
  onOpenItinerary: () => void;
  onClose?: () => void;
  className?: string;
}) {
  const { plan } = props;
  const n = plan.stops.length;
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const isStart = (i: number) => !!props.fixedFirst && i === 0;
  const locked = (i: number) => (!!props.fixedLast && i === n - 1) || isStart(i);
  const end = () => { setDragFrom(null); setDragOver(null); };

  return (
    <div className={cn("glass-panel rounded-2xl border p-3", props.className)}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Your days · drag to reorder</span>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-8" onClick={props.onOpenItinerary}><ListChecks className="mr-1.5 h-4 w-4" />View itinerary</Button>
          <button aria-label="Hide days" onClick={props.onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="flex items-end gap-2 overflow-x-auto pb-1 pt-2">
        {plan.stops.map((s, i) => {
          const sel = i === props.selected;
          return (
            <div key={`${i}-${s.lat},${s.lng}`} draggable={!locked(i)}
              onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }}
              onDragOver={(e) => { e.preventDefault(); if (dragOver !== i) setDragOver(i); }}
              onDrop={(e) => { e.preventDefault(); if (dragFrom !== null && dragFrom !== i && !locked(i)) props.onMoveStop(dragFrom, i); end(); }}
              onDragEnd={end}
              onClick={() => props.onSelect(i)}
              className={cn("glass-card relative shrink-0 cursor-pointer rounded-xl border px-2.5 py-2 transition-all",
                sel ? "w-44 border-gold shadow-lg shadow-gold/10" : "w-36 opacity-90 hover:opacity-100",
                dragFrom === i && "scale-105 ring-2 ring-gold",
                dragOver === i && dragFrom !== null && dragFrom !== i && "ring-2 ring-gold/60")}>
              <div className="flex items-center gap-2">
                {!locked(i) && <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />}
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", sel ? "bg-gold text-primary-foreground" : "bg-muted")}>{i + 1}</span>
                <span className={cn("min-w-0 flex-1 truncate font-semibold", sel && "text-base")}>{s.name}</span>
                {locked(i) && <span className="rounded bg-muted px-1.5 text-[10px] uppercase text-muted-foreground">{isStart(i) ? "Start" : "End"}</span>}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Day {i + 1}{props.dates[i]?.checkIn ? ` · ${fmt(props.dates[i]?.checkIn)}` : ""}{props.driveIn?.[i] ? <span className="text-gold"> · 🚗 {props.driveIn[i]}</span> : null}</div>
              <div className="mt-2">
                <TimePlanner stopName={s.name} departure={plan.departures[i] ?? "08:30"} arrival={props.arrivals[i]} drive={props.driveIn?.[i]}
                  hasIncoming={!!props.fixedFirst && i > 0} onDepartureChange={(v) => props.onDepartureChange(i, v)} />
              </div>
              <NightsStepper className="mt-2" label={s.name} value={plan.nights[i] ?? 1} onChange={(v) => props.onNightsChange(i, v)} />
              {sel && (
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                  <button type="button" aria-label={`Move ${s.name} earlier`} disabled={i <= (props.fixedFirst ? 1 : 0) || locked(i)} onClick={() => props.onMoveStop(i, i - 1)} className="hover:text-gold disabled:opacity-30"><ArrowLeft className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Remove ${s.name}`} onClick={() => props.onRemoveStop(i)} className="flex items-center gap-1 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" />Remove</button>
                  <button type="button" aria-label={`Move ${s.name} later`} disabled={locked(i) || i >= n - (props.fixedLast ? 2 : 1)} onClick={() => props.onMoveStop(i, i + 1)} className="hover:text-gold disabled:opacity-30"><ArrowRight className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
