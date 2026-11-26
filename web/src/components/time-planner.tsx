import { Clock3, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Editable departure with a read-only arrival calculated from the incoming road leg. */
export function TimePlanner(props: {
  stopName: string;
  departure: string;
  arrival?: string;
  drive?: string;
  hasIncoming: boolean;
  detailed?: boolean;
  onDepartureChange: (value: string) => void;
}) {
  return (
    <div
      className={cn("w-full text-left", props.detailed && "glass-card rounded-lg border p-3 max-lg:p-2")}
      onClick={(e) => e.stopPropagation()}
      onDragStart={(e) => e.stopPropagation()}
    >
      {props.detailed && (
        <div className="mb-3 flex items-center justify-between gap-2 max-lg:mb-2">
          <h4 className="flex items-center gap-2 text-sm font-medium"><Clock3 className="h-4 w-4 text-gold" />Driving plan</h4>
          {props.hasIncoming && <span className="text-xs text-gold">{props.drive || "Drive time loading…"}</span>}
        </div>
      )}
      <div className={cn("grid items-end gap-2", props.hasIncoming ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
        <label className="min-w-0 space-y-1">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3" />Set off</span>
          <Input
            type="time"
            draggable={false}
            aria-label={`Set off time for ${props.stopName}`}
            value={props.departure}
            onChange={(e) => props.onDepartureChange(e.target.value)}
            className="glass-control h-8 min-w-0 px-2 text-xs"
          />
        </label>
        {props.hasIncoming ? (
          <div className="min-w-0 space-y-1">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              Arrive <span className="ml-auto flex items-center gap-0.5 text-gold"><Sparkles className="h-3 w-3" />Auto</span>
            </span>
            <output
              aria-label={`Arrival time for ${props.stopName}`}
              className="flex h-8 items-center rounded-md border border-gold/40 bg-gold/10 px-2 text-xs font-medium text-gold"
            >
              {props.arrival || "—"}
            </output>
          </div>
        ) : (
          <span className="pb-1 text-[11px] text-muted-foreground">Starting point</span>
        )}
      </div>
      {props.detailed && props.hasIncoming && (
        <p className="mt-2 text-xs text-muted-foreground max-lg:hidden">Change the departure time to update your arrival.</p>
      )}
    </div>
  );
}
