import { useEffect, useState } from "react";
import { Search, MapPin, Ticket } from "lucide-react";
import { searchAnywhere, type AnywhereResult } from "@/lib/geo";
import type { SearchBias } from "@/lib/place-search";

export function MapSearch({ onPick, className, bias = null, biasLabel }: { onPick: (r: AnywhereResult) => void; className?: string; bias?: SearchBias | null; biasLabel?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<AnywhereResult[]>([]);
  useEffect(() => {
    if (q.trim().length < 3) { setResults([]); return; }
    setBusy(true);
    const t = setTimeout(() => {
      searchAnywhere(q, bias)
        .then(setResults).catch(() => setResults([])).finally(() => setBusy(false));
    }, 400);
    return () => clearTimeout(t);
  }, [q, bias?.lat, bias?.lng, bias?.zoom]);

  return (
    <div className={className}>
      <div className="glass-control flex items-center gap-2 rounded-full border px-4 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)} aria-label="Search places and attractions"
          placeholder="Search a town or attraction, e.g. Bundaberg Rum…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </div>
      {open && q.trim().length >= 3 && (
        <div className="glass-panel mt-2 max-h-80 overflow-y-auto rounded-xl border text-sm">
          <div className="border-b border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
            {biasLabel ? `Prioritising places near ${biasLabel}` : "Searching worldwide"}
          </div>
          {busy && results.length === 0 && <div className="px-4 py-3 text-muted-foreground">Searching…</div>}
          {!busy && results.length === 0 && <div className="px-4 py-3 text-muted-foreground">No places found</div>}
          {results.map((r, i) => (
            <button key={i} onMouseDown={() => { onPick(r); setQ(""); setOpen(false); }}
              className="flex w-full gap-3 px-4 py-2.5 text-left hover:bg-background/45 focus-visible:bg-background/45">
              {r.kind === "attraction" ? <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> : <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />}
              <span className="min-w-0">
                <span className="block font-medium">{r.name}</span>
                <span className="block text-xs text-muted-foreground">{r.detail}</span>
                <span className="block text-xs text-gold">
                  {r.kind === "attraction" ? `Adds ${r.town.name} as a stop + saves this to Activities` : "Add as a stop"}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
