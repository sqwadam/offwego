import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Doc = { id: string; name: string; path: string; mime: string; size: number; created_at: string };

const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const fmtWhen = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** One place for confirmation emails and tickets: upload a file, name it, find it later. */
export function Documents({ userId }: { userId: string | null }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("trip_documents")
      .select("id, name, path, mime, size, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setDocs(error ? [] : data ?? []);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (!userId) {
    return (
      <div className="space-y-2 pr-6">
        <h2 className="flex items-center gap-2 text-xl font-bold"><FileText className="h-5 w-5 text-gold" />Documents</h2>
        <p className="text-sm text-muted-foreground">Sign in to keep your confirmation emails and tickets here — one place to find them.</p>
      </div>
    );
  }

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    const safe = file.name.replace(/[^\w.-]+/g, "_");
    const path = `${userId}/${crypto.randomUUID()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
    if (upErr) {
      toast.error(upErr.message);
      setBusy(false);
      return;
    }
    const { error: dbErr } = await supabase.from("trip_documents").insert({
      owner_id: userId,
      name: name.trim() || file.name.replace(/\.[^.]+$/, ""),
      path,
      mime: file.type || "application/octet-stream",
      size: file.size,
    });
    if (dbErr) {
      toast.error(dbErr.message);
      await supabase.storage.from("documents").remove([path]);
    } else {
      toast.success(`Saved ${name.trim() || file.name}`);
      setName("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    }
    setBusy(false);
  };

  const open = async (d: Doc, download: boolean) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.path, 3600, download ? { download: d.name } : undefined);
    if (error || !data) { toast.error(error?.message ?? "Couldn't open the file"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const remove = async (d: Doc) => {
    await supabase.storage.from("documents").remove([d.path]);
    const { error } = await supabase.from("trip_documents").delete().eq("id", d.id);
    if (error) toast.error(error.message);
    else { toast.success(`Deleted ${d.name}`); setDocs((prev) => prev?.filter((x) => x.id !== d.id) ?? prev); }
  };

  return (
    <div className="space-y-4 pr-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold"><FileText className="h-5 w-5 text-gold" />Documents</h2>
        <p className="mt-1 text-xs text-muted-foreground">Confirmation emails, tickets, bookings — upload them here and name them so you can find them on the road.</p>
      </div>

      <form className="glass-card space-y-2 rounded-xl border p-3"
        onSubmit={(e) => { e.preventDefault(); upload(); }}>
        <input ref={fileRef} type="file" required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full cursor-pointer rounded-md border border-border text-xs text-muted-foreground file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1.5 file:text-xs file:text-foreground" />
        <Input aria-label="Name for this document" value={name} onChange={(e) => setName(e.target.value)}
          placeholder={file ? file.name.replace(/\.[^.]+$/, "") : "Name, e.g. Cairns hostel confirmation"} />
        <Button type="submit" size="sm" disabled={!file || busy} className="w-full">
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
          {busy ? "Uploading…" : "Upload"}
        </Button>
      </form>

      {docs === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents yet. Upload your first confirmation above.</p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((d) => (
            <li key={d.id} className="glass-card flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{d.name}</div>
                <div className="text-[11px] text-muted-foreground">{fmtWhen(d.created_at)} · {fmtSize(d.size)}</div>
              </div>
              <button type="button" aria-label={`Open ${d.name}`} onClick={() => open(d, false)}
                className="shrink-0 text-muted-foreground hover:text-gold"><ExternalLink className="h-4 w-4" /></button>
              <button type="button" aria-label={`Delete ${d.name}`} onClick={() => remove(d)}
                className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
