import { Minus, Moon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Pill-shaped "− 2 nights +" control, 0–14 nights. */
export function NightsStepper({ value, onChange, label, className }: { value: number; onChange: (v: number) => void; label: string; className?: string }) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div onClick={stop} onPointerDown={stop} draggable={false}
      className={cn("glass-control inline-flex items-center gap-1 rounded-full border p-0.5 text-sm", className)}>
      <button type="button" aria-label={`Fewer nights at ${label}`} disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-gold/15 hover:text-gold disabled:opacity-30">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="flex min-w-[4.5rem] items-center justify-center gap-1 tabular-nums">
        <Moon className="h-3 w-3 text-gold" />{value} night{value === 1 ? "" : "s"}
      </span>
      <button type="button" aria-label={`More nights at ${label}`} disabled={value >= 14} onClick={() => onChange(Math.min(14, value + 1))}
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-gold/15 hover:text-gold disabled:opacity-30">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
