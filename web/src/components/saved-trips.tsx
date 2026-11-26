import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Row = { id: string; title: string; updated_at: string | null; plan: unknown };

export function SavedTrips({ userId, currentId, onOpen, onDeleted, refreshKey }: { userId: string | null; currentId?: string; onOpen: (id: string) => void; onDeleted?: (id: string) => void; refreshKey: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase.from("planner_trips").select("id, title, updated_at, plan").eq("owner_id", userId).order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Couldn't load your saved trips.");
        setRows((data ?? []) as Row[]);
      });
  }, [userId, refreshKey]);

  const remove = async (id: string) => {
    if (!confirm("Delete this saved trip?")) return;
    const { error } = await supabase.from("planner_trips").delete().eq("id", id);
    if (error) return toast.error("Couldn't delete that trip.");
    setRows((r) => r?.filter((x) => x.id !== id) ?? null);
    onDeleted?.(id);
    toast.success("Trip deleted");
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl font-bold">Saved trips</h2>
      {!userId ? (
        <p className="text-sm text-muted-foreground"><Link to="/auth" className="text-gold underline">Sign in</Link> to see the trips you've saved.</p>
      ) : rows === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saved trips yet. Plan a route and press Save trip.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const p = (r.plan ?? {}) as { start?: { name?: string }; stops?: { name?: string }[] };
            const route = [p.start?.name, ...(p.stops ?? []).map((s) => s.name)].filter(Boolean).join(" → ");
            return (
              <li key={r.id} className={cn("glass-card flex items-start gap-2 rounded-lg border p-3", r.id === currentId ? "border-gold" : "hover:border-gold/50")}>
                <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(r.id)}>
                  <div className="truncate font-semibold">{r.title}</div>
                  {route && <div className="truncate text-xs text-muted-foreground">{route}</div>}
                  {r.updated_at && <div className="text-[11px] text-muted-foreground">Saved {new Date(r.updated_at).toLocaleDateString()}</div>}
                </button>
                <button aria-label={`Delete ${r.title}`} onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
