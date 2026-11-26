import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { MapPin, X, Plus, Trash2, Crosshair, Star, Bookmark, ListChecks, Map as MapIcon, LogIn, LogOut, Layers, Sparkles, BedDouble, UtensilsCrossed, FileText, Loader2, Wallet, MapPinned, Compass, HelpCircle } from "lucide-react";
import { SavedTrips } from "@/components/saved-trips";
import { Documents } from "@/components/documents";
import { TripOverview } from "@/components/trip-overview";
import { DayPanel } from "@/components/day-panel";
import { StopDock } from "@/components/stop-dock";
import { MapSearch } from "@/components/map-search";
import type { AnywhereResult } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Draft } from "@/components/trip-board";
import { CURRENCIES, categoryForLink, fmtMoney, parsePlan, removeStopItems, moveStopItems, moveInArray, sumCosts, type ItemCategory, type SavedItem } from "@/lib/trip-board";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { searchPlaces, reversePlace, recommendDriveStops, snapRoute } from "@/lib/geo";
import type { SearchBias } from "@/lib/place-search";
import { DEFAULT_RANGE, RANGE_PRESETS } from "@/lib/drive-recommendations";
import type { DriveRecommendation } from "@/lib/drive-recommendations";
import { RENTAL_PICKUPS, STAY22_AID, addDays, extraLinks, formatDuration, klookLink, rentalLinks, searchLinks, stayDates, stay22MapSrc, type PlannerPoint } from "@/lib/travel-help";
import { arrivalTime, DEFAULT_DEPARTURE } from "@/lib/time-planner";

const RoadTripMap = lazy(() => import("@/components/road-trip-map"));

/** Glass loading card shown on the map's blank canvas while tiles/the hotel map load. */
function MapLoader({ label = "Map loading…" }: { label?: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <div className="glass-control flex items-center gap-2.5 rounded-xl border bg-background/40 px-4 py-3 text-sm text-foreground/90 shadow-lg backdrop-blur-md">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gold" />
        <span>{label}</span>
      </div>
    </div>
  );
}

type Leg = { coords: [number, number][]; duration?: number; distance?: number };
const routeCache = new Map<string, Leg>();

/** The trip cost breakdown rows, in display order. */
const CATS_TRIP: { cat: ItemCategory; label: string; icon: typeof BedDouble }[] = [
  { cat: "stay", label: "Accommodation", icon: BedDouble },
  { cat: "eat", label: "Eating out", icon: UtensilsCrossed },
  { cat: "do", label: "Activities", icon: MapPinned },
];

/** The new-user tutorial: five steps, each completed by doing the real thing in the app. */
const TUTORIAL_STEPS: { title: string; body: string; icon: typeof MapPin }[] = [
  { title: "Set your start", body: "Tap the map — or search a town — to set where your road trip begins, then press Confirm.", icon: MapPin },
  { title: "Add a stop", body: "Tap another town on the map and press “Add as stop” to build your route, day by day.", icon: Plus },
  { title: "Find places for a day", body: "Open a day, then use Live hotels, Food or To-do to search — save anything you like and it lands in that day.", icon: Star },
  { title: "Watch your budget", body: "Open the Trip costs pill, type what a place costs and mark it Booked — your total updates itself.", icon: Wallet },
  { title: "It saves itself", body: "Every change autosaves — see the status dot up top. All your trips live under the Trips tab.", icon: Bookmark },
];

async function getLeg(a: PlannerPoint, b: PlannerPoint): Promise<Leg> {
  const key = `${a.lat},${a.lng}>${b.lat},${b.lng}`;
  const hit = routeCache.get(key);
  if (hit) return hit;
  const r = await snapRoute([a.lat, a.lng], [b.lat, b.lng]);
  const leg: Leg = r.coords
    ? { coords: r.coords, duration: r.duration, distance: r.distance }
    : { coords: [[a.lat, a.lng], [b.lat, b.lng]] };
  routeCache.set(key, leg);
  return leg;
}

function PlacePicker(props: {
  label: string;
  value: PlannerPoint | null;
  onPick: (p: PlannerPoint | null) => void;
  onPickOnMap: () => void;
  picking: boolean;
  optional?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PlannerPoint[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const t = setTimeout(() => {
      searchPlaces(q).then(setResults).catch(() => setResults([]));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);
  const pickups = RENTAL_PICKUPS.filter((p) => !q || p.fullName.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span>{props.label}{props.optional && " (optional)"}</span>
        {props.value && (
          <button onClick={() => props.onPick(null)} className="hover:text-foreground" aria-label={`Clear ${props.label}`}>
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {props.value ? (
        <div className="glass-card rounded-md border px-3 py-2 text-sm">{props.value.fullName}</div>
      ) : (
        <div className="relative">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Town, city or rental pick-up…"
          />
          {open && (
            <div className="absolute z-[1000] mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-popover text-sm shadow-lg">
              {results.map((r, i) => (
                <button key={`r${i}`} onMouseDown={() => { props.onPick(r); setQ(""); }} className="block w-full px-3 py-2 text-left hover:bg-accent">
                  {r.fullName}
                </button>
              ))}
              {pickups.length > 0 && (
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Car rental pick-ups</div>
              )}
              {pickups.map((p) => (
                <button key={p.name} onMouseDown={() => { props.onPick(p); setQ(""); }} className="block w-full px-3 py-2 text-left hover:bg-accent">
                  {p.name} <span className="text-muted-foreground">· {p.fullName.split(", ").slice(-1)[0]}</span>
                </button>
              ))}
            </div>
          )}
          <Button variant={props.picking ? "default" : "outline"} size="sm" className="mt-2 w-full" onClick={props.onPickOnMap}>
            <Crosshair className="mr-1.5 h-3.5 w-3.5" /> {props.picking ? "Click the map…" : "Pick on map"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Planner() {
  const [start, setStart] = useState<PlannerPoint | null>(null);
  const [end, setEnd] = useState<PlannerPoint | null>(null);
  const [stops, setStops] = useState<PlannerPoint[]>([]);
  const [nights, setNights] = useState<number[]>([]);
  const [departures, setDepartures] = useState<string[]>([]);
  const [startDeparture, setStartDeparture] = useState(DEFAULT_DEPARTURE);
  const [endDeparture, setEndDeparture] = useState(DEFAULT_DEPARTURE);
  const [startDate, setStartDate] = useState("");
  const [driveHours, setDriveHours] = useState(4);
  const [range, setRange] = useState<[number, number]>([DEFAULT_RANGE.min, DEFAULT_RANGE.max]);
  const [recommendations, setRecommendations] = useState<DriveRecommendation[]>([]);
  const [recommendation, setRecommendation] = useState<DriveRecommendation | null>(null);
  const [findingStops, setFindingStops] = useState(false);
  const [recommendationMessage, setRecommendationMessage] = useState("");
  const [showRecs, setShowRecs] = useState(false);
  const searchVersion = useRef(0);
  const [endNights, setEndNights] = useState(1);
  const [startNights, setStartNights] = useState(1);
  const tripEnd = startDate ? addDays(startDate, nights.reduce((a, b) => a + b, 0) || 7) : "";
  const [pickMode, setPickMode] = useState<"start" | "end" | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; n: number } | null>(null);
  const [mapView, setMapView] = useState<SearchBias | null>(null);
  const searchBias = mapView ?? (start ? { lat: start.lat, lng: start.lng, zoom: 6 } : null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [previewLeg, setPreviewLeg] = useState<Leg | null>(null);
  const [finalLeg, setFinalLeg] = useState<Leg | null>(null);
  const n = useRef(0);
  const flyTo = (p: PlannerPoint) => setFocus({ lat: p.lat, lng: p.lng, n: ++n.current });

  const lastPoint = stops.length ? stops[stops.length - 1] : start;

  const [searchParams, setSearchParams] = useSearchParams();
  const tripId = searchParams.get("trip") ?? undefined;
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [currency, setCurrency] = useState("NZD");
  // Board days: Day 1 is the start point (items stop = -2), then stops, then the end destination (items stop = -1).
  const off = start ? 1 : 0;
  const endIdx = off + stops.length;
  const toBoard = (raw: number) => (raw === -2 ? 0 : raw === -1 ? endIdx : raw + off);
  const toRaw = (bi: number) => (start && bi === 0 ? -2 : end && bi === endIdx ? -1 : bi - off);
  const boardPlan = useMemo(() => ({
    start, end, startDate,
    stops: [...(start ? [start] : []), ...stops, ...(end ? [end] : [])],
    nights: [...(start ? [startNights] : []), ...nights, ...(end ? [endNights] : [])],
    departures: [...(start ? [startDeparture] : []), ...departures, ...(end ? [endDeparture] : [])],
    startDeparture, endDeparture,
    currency,
    items: items.filter((i) => (i.stop !== -2 || start) && (i.stop !== -1 || end)).map((i) => ({ ...i, stop: toBoard(i.stop) })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [start, end, stops, nights, departures, endNights, startNights, startDeparture, endDeparture, startDate, items, currency]);
  const dates = useMemo(() => stayDates(startDate, boardPlan.nights), [startDate, boardPlan.nights]);
  const setBoardItems = (next: SavedItem[]) => setItems(next.map((i) => ({ ...i, stop: toRaw(i.stop) })));
  const setBoardNights = (i: number, v: number) => {
    const r = toRaw(i);
    if (r === -2) setStartNights(v); else if (r === -1) setEndNights(v); else setNights((prev) => prev.map((x, j) => (j === r ? v : x)));
  };
  const setBoardDeparture = (i: number, v: string) => {
    const r = toRaw(i);
    if (r === -2) setStartDeparture(v); else if (r === -1) setEndDeparture(v); else setDepartures((prev) => prev.map((x, j) => (j === r ? v : x)));
  };
  const moveBoardStop = (from: number, to: number) => { if (toRaw(from) < 0 || toRaw(to) < 0) return; moveStop(from - off, to - off); };
  const removeBoardStop = (i: number) => {
    const r = toRaw(i);
    setWheelIdx(null);
    if (r === -1) { setEnd(null); setItems((p) => p.filter((x) => x.stop !== -1)); }
    else if (r === -2) { setStart(null); setItems((p) => p.filter((x) => x.stop !== -2)); setPickMode("start"); toast("Click the map or search to choose a new starting point"); }
    else removeStop(r);
  };
  const renameBoardStop = (i: number, name: string) => {
    const r = toRaw(i); const nm = name.trim().slice(0, 80);
    if (!nm) return;
    if (r === -1 && end) setEnd({ ...end, name: nm }); else if (r === -2 && start) setStart({ ...start, name: nm }); else renameStop(r, name);
  };
  // Tapping a pin selects that day and opens the wheel; "Change location" waits for a map click + confirm.
  const [wheelIdx, setWheelIdx] = useState<number | null>(null);
  const [relocate, setRelocate] = useState<number | null>(null);
  const [candidate, setCandidate] = useState<PlannerPoint | null>(null);
  const wheelPoint = wheelIdx !== null ? boardPlan.stops[wheelIdx] ?? null : null;
  const onPointClick = (kind: "start" | "stop" | "end", i: number) => {
    const bi = kind === "start" ? 0 : kind === "end" ? endIdx : i + off;
    setPending(null); setSelectedDay(bi); setWheelIdx(bi); setPanel("day");
    if (boardPlan.stops[bi]) flyTo(boardPlan.stops[bi]);
  };
  const choosing = relocate !== null || pickMode !== null || !start;
  const choosingLabel = relocate !== null ? (relocate === 0 && start ? "your starting point (Day 1)" : `Day ${relocate + 1}`) : pickMode === "end" ? "your end destination" : "your starting point (Day 1)";
  const cancelChoosing = () => { setRelocate(null); setPickMode(null); setCandidate(null); };
  const confirmCandidate = () => {
    if (!candidate) return;
    const p = candidate;
    if (relocate !== null) {
      const r = toRaw(relocate);
      if (r === -2) setStart(p); else if (r === -1) setEnd(p); else setStops((prev) => prev.map((x, j) => (j === r ? p : x)));
      toast.success(`Day ${relocate + 1} is now ${p.name}`);
    } else if (pickMode === "end") { setEnd(p); toast.success(`Ending in ${p.name}`); }
    else { setStart(p); toast.success(`Starting from ${p.name} (Day 1)`); }
    flyTo(p); setRelocate(null); setPickMode(null); setCandidate(null);
  };
  const [title, setTitle] = useState("My road trip");
  const [selectedDay, setSelectedDay] = useState(0);
  const [pending, setPending] = useState<PlannerPoint | null>(null);
  const explorerStops = pending ? [...boardPlan.stops, pending] : boardPlan.stops;
  const explorerStop = Math.min(selectedDay, Math.max(explorerStops.length - 1, 0));
  const overlayCenter = mapView ?? searchBias;
  const overlayDates = dates[explorerStop] ?? null;
  const fmtShort = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const swipe = useRef<{ x: number; y: number; scroll: number } | null>(null);
  const sheetDragRef = useRef(0);
  const [sheetDrag, setSheetDrag] = useState(0);
  const upSwipe = useRef<{ x: number; y: number } | null>(null);
  // Swiping up on the days dock (mobile) re-opens the day sheet it sits under.
  const openOnSwipeUp = {
    onTouchStart: (e: React.TouchEvent) => { const t = e.touches[0]; upSwipe.current = { x: t.clientX, y: t.clientY }; },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = upSwipe.current; upSwipe.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (dy > -56 || Math.abs(dy) < Math.abs(dx) * 1.5) return;
      const i = Math.min(selectedDay, boardPlan.stops.length - 1);
      if (boardPlan.stops[i]) flyTo(boardPlan.stops[i]);
      setPanel("day");
    },
  };
  const [panel, setPanel] = useState<"day" | "trip" | "discover" | "saved" | "docs" | null>("trip");
  const [dayTab, setDayTab] = useState<ItemCategory>("stay");
  // The setup panel gets out of the way once the first stop exists: the day panel takes over.
  useEffect(() => {
    if (stops.length >= 1 && panel === "trip") setPanel("day");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops.length]);
  // Stays/eats/do skip in-app place lists: hotels open the live-price map, eats and activities go
  // straight to Google Maps / Klook for the day's stop (external pages are faster than fetching lists).
  const openExplore = (c: ItemCategory, p: { name: string; lat: number; lng: number } | null | undefined) => {
    if (!p) return;
    if (c === "stay") { setPanel(null); setStayOverlay(true); return; }
    const url = c === "eat"
      ? `https://www.google.com/maps/search/restaurants/@${p.lat},${p.lng},14z`
      : klookLink(p.name);
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const currentPoint = boardPlan.stops[explorerStop] ?? start ?? (mapView ? { name: "map view", lat: mapView.lat, lng: mapView.lng } : null);
  const [savedKey, setSavedKey] = useState(0);
  const [view, setView] = useState<"map" | "overview">("map");
  const [layer, setLayer] = useState<"map" | "satellite">("satellite");
  const [stayOverlay, setStayOverlay] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  // Quick-save a hotel from the live-price overlay into the selected day's Stay list.
  const [hotelSaveOpen, setHotelSaveOpen] = useState(false);
  const [hotelName, setHotelName] = useState("");
  useEffect(() => {
    setHotelsLoading(stayOverlay);
  }, [stayOverlay, overlayCenter?.lat, overlayCenter?.lng, overlayDates?.checkIn, overlayDates?.checkOut]);
  useEffect(() => {
    if (!stayOverlay) setHotelSaveOpen(false);
  }, [stayOverlay]);
  const saveOverlayHotel = () => {
    const p = boardPlan.stops[explorerStop];
    if (!p) return;
    const links = searchLinks(p, dates[explorerStop]);
    const url = (links.find((l) => l.key === "hotels") ?? links[0])?.url;
    const title = hotelName.trim().slice(0, 80) || `Hotel near ${p.name}`;
    setBoardItems([...boardPlan.items, { id: crypto.randomUUID(), stop: explorerStop, category: "stay", title, url, status: "idea" }]);
    toast.success(`Saved ${title} to Day ${explorerStop + 1}`);
    setHotelName("");
    setHotelSaveOpen(false);
  };
  const [dockOpen, setDockOpen] = useState(true);
  const [dirty, setDirty] = useState(false);
  const loadedTrip = useRef<string | null>(null);

  useEffect(() => {
    if (!tripId || !user || loadedTrip.current === tripId) return;
    loadedTrip.current = tripId;
    supabase.from("planner_trips").select("title, plan").eq("id", tripId).maybeSingle().then(({ data }) => {
      if (!data) return toast.error("Couldn't open that saved trip.");
      const p = parsePlan(data.plan);
      setTitle(data.title); setStart(p.start); setEnd(p.end); setStops(p.stops); setNights(p.nights);
      setDepartures(p.departures); setStartDeparture(p.startDeparture); setEndDeparture(p.endDeparture);
      const en = (data.plan as { endNights?: unknown } | null)?.endNights;
      setEndNights(typeof en === "number" ? en : 1);
      const sn = (data.plan as { startNights?: unknown } | null)?.startNights;
      setStartNights(typeof sn === "number" ? sn : 1);
      setStartDate(p.startDate); setItems(p.items); setCurrency(p.currency ?? "NZD"); setDirty(false);
      if (p.start) setFocus({ lat: p.start.lat, lng: p.start.lng, n: ++n.current });
    });
  }, [tripId, user]);

  useEffect(() => { setDirty(true); }, [start, end, stops, nights, departures, startDeparture, endDeparture, startDate, items, title, currency]);

  // ---- Autosave everywhere -------------------------------------------------
  const DRAFT_KEY = "journeys:draft";
  const [sync, setSync] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [booted, setBooted] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // Latest plan values for timers, without widening callback dependencies.
  const stateRef = useRef({ title, start, end, stops, nights, departures, endNights, startNights, startDeparture, endDeparture, startDate, items, currency, tripId });
  stateRef.current = { title, start, end, stops, nights, departures, endNights, startNights, startDeparture, endDeparture, startDate, items, currency, tripId };

  const saveTrip = async (opts?: { silent?: boolean }) => {
    const o = opts && typeof opts === "object" && "silent" in opts ? opts : { silent: false };
    const s = stateRef.current;
    if (!user) { navigate("/auth"); return; }
    setSaving(true); setSync("saving");
    const plan = { start: s.start, end: s.end, stops: s.stops, nights: s.nights, departures: s.departures, endNights: s.endNights, startNights: s.startNights, startDeparture: s.startDeparture, endDeparture: s.endDeparture, startDate: s.startDate, items: s.items, currency: s.currency };
    const res = s.tripId
      ? await supabase.from("planner_trips").update({ title: s.title, plan, updated_at: new Date().toISOString() }).eq("id", s.tripId).select("id").single()
      : await supabase.from("planner_trips").insert({ title: s.title, plan, owner_id: user.id }).select("id").single();
    setSaving(false);
    if (res.error) { setSync("error"); if (!o.silent) toast.error("Couldn't save your trip. Please try again."); return; }
    if (!o.silent) toast.success("Trip saved — find it under Trips");
    setSync("saved");
    setSavedKey((k) => k + 1);
    try { localStorage.setItem(`journeys:lastTrip:${user.id}`, res.data.id); } catch {}
    loadedTrip.current = res.data.id;
    setDirty(false);
    if (!s.tripId) setSearchParams({ trip: res.data.id }, { replace: true });
  };

  // Autosave: a second and a half after the last change, when signed in with a trip on the board.
  useEffect(() => {
    if (!dirty || !user || !hasTrip) return;
    const t = setTimeout(() => { void saveTrip({ silent: true }); }, 1500);
    return () => clearTimeout(t);
  });

  // Local draft: the whole board is mirrored onto this device after every change,
  // so a refresh or accidental close loses nothing — even signed out.
  useEffect(() => {
    if (!booted) return;
    try {
      const s = stateRef.current;
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        tripId: s.tripId, title: s.title,
        plan: { start: s.start, end: s.end, stops: s.stops, nights: s.nights, departures: s.departures, endNights: s.endNights, startNights: s.startNights, startDeparture: s.startDeparture, endDeparture: s.endDeparture, startDate: s.startDate, items: s.items, currency: s.currency },
      }));
    } catch {}
  });

  // First paint: pick up the device draft, or a signed-in user's most recent trip.
  useEffect(() => {
    if (loading || booted) return;
    setBooted(true);
    if (tripId) return; // the ?trip= loader handles it
    let draft: { tripId?: string; title?: string; plan?: unknown } | null = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null"); } catch {}
    const p = draft?.plan ? parsePlan(draft.plan) : null;
    if (p && (p.start || p.end || p.stops.length > 0 || p.items.length > 0)) {
      if (user && draft?.tripId) { setSearchParams({ trip: draft.tripId }, { replace: true }); return; }
      setTitle(draft?.title ?? "My road trip");
      setStart(p.start); setEnd(p.end); setStops(p.stops); setNights(p.nights);
      setDepartures(p.departures); setStartDeparture(p.startDeparture); setEndDeparture(p.endDeparture);
      const dp = draft?.plan as { endNights?: unknown; startNights?: unknown } | undefined;
      setEndNights(typeof dp?.endNights === "number" ? dp.endNights : 1);
      setStartNights(typeof dp?.startNights === "number" ? dp.startNights : 1);
      setStartDate(p.startDate); setItems(p.items); setCurrency(p.currency ?? "NZD");
      setDirty(true); // autosave pushes a guest draft to the account once signed in
      if (p.start) setFocus({ lat: p.start.lat, lng: p.start.lng, n: ++n.current });
      return;
    }
    if (user) {
      supabase.from("planner_trips").select("id").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle()
        .then(({ data }) => { if (data) setSearchParams({ trip: data.id }, { replace: true }); });
    }
  }, [loading, user, tripId, booted]);

  // Welcome sheet, first visit only.
  useEffect(() => {
    if (loading || user) return;
    if (!localStorage.getItem("journeys:welcomed")) setWelcomeOpen(true);
  }, [loading, user]);
  const dismissWelcome = (toAuth?: boolean) => {
    try { localStorage.setItem("journeys:welcomed", "1"); } catch {}
    setWelcomeOpen(false);
    if (toAuth) navigate("/auth");
  };

  // ---- New-user tutorial: advances when the real action happens ------------
  const TUTORIAL_KEY = "journeys:tutorial";
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const startTutorial = () => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(TUTORIAL_KEY); } catch {}
    if (stored === "done") return;
    const n = Number(stored ?? "0");
    setTutorialStep(Number.isFinite(n) && n >= 0 && n < TUTORIAL_STEPS.length ? n : 0);
  };
  const replayTutorial = () => {
    // Resume at the first step whose action hasn't happened yet; all done → final card.
    const stepDone = (s: number) =>
      s === 0 ? !!start : s === 1 ? stops.length >= 1 : s === 2 ? items.length >= 1 : s === 3 ? costOpen || items.some((i) => i.status === "booked") : false;
    const firstUndone = TUTORIAL_STEPS.findIndex((_, i) => !stepDone(i));
    setTutorialStep(firstUndone === -1 ? TUTORIAL_STEPS.length - 1 : firstUndone);
  };
  const finishTutorial = () => setTutorialStep(null);
  // Kick it off once the welcome sheet is out of the way (or was never needed).
  useEffect(() => {
    if (loading || welcomeOpen || tutorialStep !== null) return;
    startTutorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, welcomeOpen]);
  // Persist progress so a refresh resumes at the right step.
  useEffect(() => {
    if (tutorialStep === null) return;
    try { localStorage.setItem(TUTORIAL_KEY, String(tutorialStep)); } catch {}
  }, [tutorialStep]);
  // Advance when the step's real action happens.
  useEffect(() => {
    if (tutorialStep === null || tutorialStep >= TUTORIAL_STEPS.length - 1) return;
    const done = tutorialStep === 0 ? !!start
      : tutorialStep === 1 ? stops.length >= 1
      : tutorialStep === 2 ? items.length >= 1
      : costOpen || items.some((i) => i.status === "booked");
    if (done) setTutorialStep(tutorialStep + 1);
  }, [tutorialStep, start, stops, items, costOpen]);

  // "New trip" wipes the board and starts from scratch.
  const [confirmNew, setConfirmNew] = useState(false);
  const hasTrip = !!start || !!end || stops.length > 0 || items.length > 0;

  const resetTrip = () => {
    loadedTrip.current = null;
    setTitle("My road trip");
    setStart(null); setEnd(null); setStops([]); setNights([]);
    setStartNights(1); setEndNights(1); setStartDate(""); setCurrency("NZD");
    setDepartures([]); setStartDeparture(DEFAULT_DEPARTURE); setEndDeparture(DEFAULT_DEPARTURE);
    setItems([]);
    setPending(null); setCandidate(null); setRelocate(null); setPickMode(null); setWheelIdx(null);
    setRecommendations([]); setRecommendation(null); setRecommendationMessage(""); setFindingStops(false); setShowRecs(false);
    setPreviewLeg(null);
    setCostOpen(false);
    setSelectedDay(0); setDraft(null);
    setDirty(false); setPanel("trip");
    setSearchParams({}, { replace: true });
    toast.success("Started a new trip");
  };

  const askNewTrip = () => {
    if (!hasTrip && !tripId) { toast.info("You're already on a new trip"); return; }
    setConfirmNew(true);
  };

  const starLink = (stop: number, key: string, url: string, label: string) => {
    setSelectedDay(stop);
    setBoardItems([...boardPlan.items, { id: crypto.randomUUID(), stop, category: categoryForLink(key), title: label, url, status: "idea" }]);
    toast.success(`Saved ${label} to Day ${stop + 1}`);
  };

  useEffect(() => {
    searchVersion.current += 1;
    setRecommendations([]); setRecommendation(null); setRecommendationMessage(""); setFindingStops(false); setShowRecs(false);
  }, [lastPoint, driveHours, end, range]);

  const chooseRecommendation = (r: DriveRecommendation) => {
    setRecommendation(r);
    setPending(r.point);
    routeCache.set(`${lastPoint?.lat},${lastPoint?.lng}>${r.point.lat},${r.point.lng}`, r);
    setPreviewLeg(r);
  };

  const removeStop = (i: number) => {
    const name = stops[i]?.name;
    setStops((prev) => prev.filter((_, j) => j !== i));
    setNights((prev) => prev.filter((_, j) => j !== i));
    setDepartures((prev) => prev.filter((_, j) => j !== i));
    setItems((prev) => removeStopItems(prev, i));
    setSelectedDay((d) => Math.max(0, d > i + off ? d - 1 : d));
    if (name) toast.success(`Removed ${name}`);
  };

  const moveStop = (from: number, to: number) => {
    if (to < 0 || to >= stops.length || from === to) return;
    setStops((prev) => moveInArray(prev, from, to));
    setNights((prev) => moveInArray(prev, from, to));
    setDepartures((prev) => moveInArray(prev, from, to));
    setItems((prev) => moveStopItems(prev, from, to));
    setSelectedDay(to + off);
  };

  const addFromSearch = (r: AnywhereResult) => {
    flyTo(r.town);
    if (!start) {
      setStart(r.town);
      toast.success(`Starting from ${r.town.name}`);
      return;
    }
    let idx = stops.findIndex((s) => s.name.toLowerCase() === r.town.name.toLowerCase());
    if (idx < 0) {
      idx = stops.length;
      setStops((prev) => [...prev, r.town]);
      setNights((prev) => [...prev, 1]);
      setDepartures((prev) => [...prev, DEFAULT_DEPARTURE]);
      setPending(null);
    }
    if (r.attraction) {
      const a = r.attraction;
      setItems((prev) => prev.some((it) => it.stop === idx && it.title === a.name) ? prev : [...prev, {
        id: crypto.randomUUID(), stop: idx, category: "do", title: a.name, status: "idea",
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.name} ${r.town.name}`)}`,
        note: r.detail,
      }]);
      toast.success(`Added ${a.name} to ${r.town.name} (Day ${idx + 2})`);
    } else toast.success(`Added ${r.town.name} as a stop`);
    setSelectedDay(idx + 1);
  };

  const renameStop = (i: number, name: string) => {
    const nm = name.trim().slice(0, 80);
    if (!nm) return;
    setStops((prev) => prev.map((s, j) => (j === i ? { ...s, name: nm, fullName: nm } : s)));
  };

  const findStops = async () => {
    if (!lastPoint) return;
    const version = ++searchVersion.current;
    setFindingStops(true); setRecommendationMessage(""); setRecommendations([]); setRecommendation(null); setPending(null);
    try {
      const result = await recommendDriveStops(lastPoint, driveHours, range[0], range[1], end);
      if (version !== searchVersion.current) return;
      setRecommendations(result.recommendations);
      setShowRecs(true);
      if (!result.recommendations.length) setRecommendationMessage(result.error || `No reachable towns found ${range[0]}–${range[1]} hours away. Try a different range or start point.`);
    } catch {
      if (version === searchVersion.current) setRecommendationMessage("Recommendations are temporarily unavailable. Please try again.");
    } finally {
      if (version === searchVersion.current) setFindingStops(false);
    }
  };

  // Saved legs: start -> stops
  useEffect(() => {
    if (!start) return setLegs([]);
    const seq = [start, ...stops];
    let live = true;
    Promise.all(seq.slice(1).map((p, i) => getLeg(seq[i], p))).then((l) => live && setLegs(l));
    return () => { live = false; };
  }, [start, stops]);

  // Optional final leg to end point
  useEffect(() => {
    if (!lastPoint || !end) return setFinalLeg(null);
    let live = true;
    getLeg(lastPoint, end).then((l) => live && setFinalLeg(l));
    return () => { live = false; };
  }, [lastPoint, end]);

  // Preview leg to clicked town
  useEffect(() => {
    if (!lastPoint || !pending) return setPreviewLeg(null);
    let live = true;
    setPreviewLeg(null);
    getLeg(lastPoint, pending).then((l) => live && setPreviewLeg(l));
    return () => { live = false; };
  }, [lastPoint, pending]);

  const onMapClick = async (lat: number, lng: number) => {
    setRecommendation(null);
    const place = await reversePlace(lat, lng);
    const p = { ...place, lat, lng };
    if (choosing) { setCandidate(p); return; }
    setWheelIdx(null);
    setPending(p);
  };

  const totals = useMemo(() => {
    const all = [...legs, ...(finalLeg ? [finalLeg] : [])];
    return {
      duration: all.reduce((s, l) => s + (l.duration ?? 0), 0),
      distance: all.reduce((s, l) => s + (l.distance ?? 0), 0),
    };
  }, [legs, finalLeg]);

  // Drive time and calculated arrival for each board day (none for day 1 / the start).
  const driveDurations: (number | undefined)[] = boardPlan.stops.map((_, i) => {
    const l = start ? (i === 0 ? undefined : i <= stops.length ? legs[i - 1] : finalLeg) : end && i === boardPlan.stops.length - 1 ? finalLeg : undefined;
    return l?.duration;
  });
  const driveIn = driveDurations.map((duration) => duration ? `${formatDuration(duration)} drive` : "");
  const arrivals = driveDurations.map((duration, i) => arrivalTime(boardPlan.departures[i] ?? DEFAULT_DEPARTURE, duration));

  const legInfo = (l?: Leg | null) =>
    l?.duration ? `${formatDuration(l.duration)} · ${Math.round((l.distance ?? 0) / 1000)} km` : l ? "No road route" : "…";

  return (
    <div className="flex h-dvh flex-col-reverse overflow-hidden bg-background lg:flex-row">
      <nav className="flex w-full shrink-0 flex-row items-stretch border-t border-border bg-rail pb-[env(safe-area-inset-bottom)] lg:w-44 lg:flex-col lg:border-r lg:border-t-0 lg:pb-0" aria-label="Planner">
        <Link to="/" className="hidden flex-col items-center px-3 py-6 md:items-start md:px-6 lg:flex">
          <span className="text-2xl text-gold">◆</span>
          <span className="hidden text-xl font-semibold md:block">Jour<span className="font-bold text-gold">neys</span></span>
          <span className="hidden text-[11px] leading-tight text-muted-foreground md:block">Bigger days<br />Brighter places</span>
        </Link>
        {([
          ["trip", "Plan", MapIcon, "Plan"], ["discover", "Discover", Compass, "Discover"], ["docs", "Docs", FileText, "Docs"], ["saved", "Trips", Bookmark, "Trips"],
        ] as const).map(([key, label, Icon, short]) => {
          const active = view === "map" && key === panel;
          return (
            <button key={key} onClick={() => {
              setView("map");
              setPanel(panel === key ? null : key);
            }} aria-pressed={active}
              className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 border-t-[3px] py-2 px-0.5 text-[9px] lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:border-l-[3px] lg:border-t-0 lg:px-5 lg:py-3.5 lg:text-[15px]", active ? "border-gold bg-muted/60 text-foreground" : "border-transparent text-foreground/85 hover:bg-muted/40")}>
              <Icon className="h-5 w-5 shrink-0" /><span className="leading-none lg:hidden">{short}</span><span className="hidden lg:inline">{label}</span>
            </button>
          );
        })}
        <div className="flex lg:mt-auto lg:block lg:pb-5">
          <button onClick={replayTutorial} aria-label="Help — replay the tutorial"
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 px-0.5 text-[9px] lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:py-3 lg:text-[15px] lg:px-6 text-foreground/85 hover:bg-muted/40">
            <HelpCircle className="h-5 w-5" /><span className="leading-none lg:hidden">Help</span><span className="hidden lg:inline">Help</span>
          </button>
          {user ? (
            <button onClick={() => supabase.auth.signOut()} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 px-0.5 text-[9px] lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:py-3 lg:text-[15px] lg:px-6"><LogOut className="h-5 w-5" /><span className="leading-none lg:hidden">Sign out</span><span className="hidden lg:inline">Sign out</span></button>
          ) : (
            <Link to="/auth" className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 px-0.5 text-[9px] lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:py-3 lg:text-[15px] lg:px-6"><LogIn className="h-5 w-5" /><span className="leading-none lg:hidden">Sign in</span><span className="hidden lg:inline">Sign in</span></Link>
          )}
        </div>
      </nav>

      {view === "overview" ? (
        <TripOverview driveIn={driveIn} arrivals={arrivals} plan={boardPlan} fixedLast={!!end} fixedFirst={!!start} title={title} dates={dates}
          saved={!!tripId && !dirty} saving={saving} onSave={saveTrip} onBack={() => setView("map")}
          onAdd={(stop, category) => { setSelectedDay(stop); openExplore(category, boardPlan.stops[stop]); setView("map"); }}
          onSaveItem={(it) => { setBoardItems([...boardPlan.items, it]); toast.success(`Saved ${it.title}`); }}
          onItemChange={(it) => setBoardItems(boardPlan.items.map((x) => x.id === it.id ? it : x))}
          onOpenItem={(stop) => { setSelectedDay(stop); setPanel("trip"); setView("map"); }}
          onRemoveStop={removeBoardStop} onRenameStop={renameBoardStop} onMoveStop={moveBoardStop}
          onNightsChange={setBoardNights} onDepartureChange={setBoardDeparture} selected={selectedDay} onSelectStop={(i) => { setSelectedDay(i); const p = boardPlan.stops[i]; if (p) flyTo(p); }}
          map={<Suspense fallback={<MapLoader />}>
            <RoadTripMap layer={layer} start={start} end={end} stops={stops} pending={null}
              legs={[...legs.map((l) => l.coords), ...(finalLeg ? [finalLeg.coords] : [])]} previewLeg={null}
              focus={focus} onMapClick={() => {}} onPointClick={(k, i) => { const bi = k === "start" ? 0 : k === "end" ? endIdx : i + off; setSelectedDay(bi); flyTo(boardPlan.stops[bi]); }} />
          </Suspense>} />
      ) : (
      <>
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className={cn("h-full w-full", panel === "day" && "max-lg:h-auto max-lg:flex-1 max-lg:min-h-0")}>
        <Suspense fallback={<MapLoader />}>
          <RoadTripMap
            start={start} end={end} stops={stops} pending={pending}
            legs={[...legs.map((l) => l.coords), ...(finalLeg ? [finalLeg.coords] : [])]}
            previewLeg={previewLeg?.coords ?? null}
            focus={focus} onMapClick={onMapClick} pendingDates={dates[endIdx]}
            onPointClick={onPointClick} wheelAt={relocate === null ? wheelPoint : null} wheelDates={wheelIdx !== null ? dates[wheelIdx] : null}
            recommendations={showRecs ? recommendations : []} recommendation={recommendation} onRecommendationClick={chooseRecommendation}
            layer={layer}
            onWheelPick={(k) => { setView("map"); setSelectedDay(pending ? boardPlan.stops.length : wheelIdx ?? selectedDay); openExplore(k, boardPlan.stops[wheelIdx ?? selectedDay]); }}
            onViewChange={setMapView}
          />
        </Suspense>
        </div>

        {stayOverlay && STAY22_AID && overlayCenter && (
          <div className="absolute inset-0 z-[1100] flex max-lg:inset-2 flex-col overflow-hidden rounded-xl border border-border/60 bg-background/95 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
              <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <BedDouble className="h-4 w-4 shrink-0 text-gold" />
                <span className="shrink-0">Live hotel prices</span>
                {overlayDates
                  ? <span className="truncate font-normal text-muted-foreground">· checking in {fmtShort(overlayDates.checkIn)}, out {fmtShort(overlayDates.checkOut)}</span>
                  : <span className="font-normal text-muted-foreground">· set trip dates for exact rates</span>}
              </p>
              {boardPlan.stops[explorerStop] && (hotelSaveOpen ? (
                <div className="hidden h-8 items-center gap-1.5 lg:flex">
                  <Input value={hotelName} onChange={(e) => setHotelName(e.target.value)} autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") saveOverlayHotel(); if (e.key === "Escape") setHotelSaveOpen(false); }}
                    placeholder={`Hotel name (optional) · Day ${explorerStop + 1}`} className="h-8 w-56 text-sm" />
                  <button onClick={saveOverlayHotel} className="flex h-8 items-center gap-1 rounded-lg border border-gold/60 bg-gold/15 px-2.5 text-sm text-gold hover:bg-gold/25">
                    <Plus className="h-4 w-4" />Save
                  </button>
                  <button onClick={() => setHotelSaveOpen(false)} aria-label="Cancel save" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <button onClick={() => setHotelSaveOpen(true)} className="hidden h-8 shrink-0 items-center gap-1.5 rounded-lg border border-gold/60 bg-gold/10 px-2.5 text-sm text-gold hover:bg-gold/20 lg:flex">
                  <Plus className="h-4 w-4" />Save to Day {explorerStop + 1}
                </button>
              ))}
              <button aria-label="Close live hotels" onClick={() => setStayOverlay(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="relative min-h-0 w-full flex-1 pb-14 lg:pb-0">
              <iframe
                key={`${overlayCenter.lat.toFixed(3)},${overlayCenter.lng.toFixed(3)},${overlayDates?.checkIn ?? ""},${overlayDates?.checkOut ?? ""}`}
                src={stay22MapSrc(overlayCenter.lat, overlayCenter.lng, overlayDates, "journeys_big_map")}
                title="Live accommodation prices on the map"
                onLoad={() => setHotelsLoading(false)}
                className="h-full w-full"
              />
              {hotelsLoading && (
                <div className="absolute inset-0">
                  <MapLoader label="Hotels loading…" />
                </div>
              )}
            </div>
            {boardPlan.stops[explorerStop] && (
              <div className="absolute inset-x-0 bottom-0 z-10 border-t border-border/60 bg-background/95 px-3 backdrop-blur-sm lg:hidden"
                style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))", paddingTop: "0.5rem" }}>
                {hotelSaveOpen ? (
                  <div className="flex items-center gap-2">
                    <Input value={hotelName} onChange={(e) => setHotelName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveOverlayHotel(); if (e.key === "Escape") setHotelSaveOpen(false); }}
                      placeholder={`Hotel name (optional) · Day ${explorerStop + 1}`} className="h-9 min-w-0 flex-1 text-sm" />
                    <button onClick={saveOverlayHotel} className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-gold/60 bg-gold/15 px-3 text-sm text-gold">
                      <Plus className="h-4 w-4" />Save
                    </button>
                    <button onClick={() => setHotelSaveOpen(false)} aria-label="Cancel save" className="shrink-0 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                  </div>
                ) : (
                  <button onClick={() => setHotelSaveOpen(true)} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-gold/60 bg-gold/10 text-sm text-gold">
                    <Plus className="h-4 w-4" />Save to Day {explorerStop + 1} · {boardPlan.stops[explorerStop].name}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <MapSearch onPick={addFromSearch} bias={searchBias} biasLabel={mapView ? "the current map view" : start?.name}
          className={cn("absolute left-4 top-[calc(env(safe-area-inset-top,0px)+4rem)] z-[560] w-[min(400px,calc(100%-2rem))] lg:top-20", panel ? "max-lg:hidden lg:left-[372px]" : "left-4")} />

        {boardPlan.stops.length > 0 && panel !== "trip" && (
          <button onClick={() => setCostOpen((v) => !v)} aria-expanded={costOpen}
            className={cn("glass-control absolute top-[calc(env(safe-area-inset-top,0px)+8rem)] z-[560] flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs hover:border-gold lg:top-36", costOpen && "border-gold text-gold", panel ? "max-lg:hidden lg:left-[372px]" : "left-4")}>
            <Wallet className="h-3.5 w-3.5 text-gold" />Trip costs · {fmtMoney(CATS_TRIP.reduce((a, c) => a + sumCosts(boardPlan.items, c.cat, true), 0), currency)}
          </button>
        )}

        {costOpen && boardPlan.stops.length > 0 && (
          <div className={cn("glass-panel absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+11rem)] z-[565] w-[min(320px,calc(100%-2rem))] rounded-xl border p-3 text-sm lg:inset-x-auto lg:left-[372px] lg:top-48", panel ? "max-lg:hidden" : "left-4 max-lg:left-4")}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground"><Wallet className="h-3.5 w-3.5 text-gold" />Trip costs</span>
              <button aria-label="Close costs" onClick={() => setCostOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 space-y-1.5">
              {CATS_TRIP.map(({ cat, label, icon: Icon }) => {
                const booked = sumCosts(boardPlan.items, cat, true);
                const planned = sumCosts(boardPlan.items, cat, false);
                return (
                  <div key={cat} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground"><Icon className="h-4 w-4 shrink-0 text-gold/80" />{label}</span>
                    <span className="shrink-0 text-right text-xs">
                      <b className="text-gold">{fmtMoney(booked, currency)}</b>
                      {planned > 0 && <span className="ml-1.5 text-muted-foreground">planned {fmtMoney(planned, currency)}</span>}
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-1.5 font-semibold">
                <span>Total booked</span>
                <b className="text-gold">{fmtMoney(CATS_TRIP.reduce((a, c) => a + sumCosts(boardPlan.items, c.cat, true), 0), currency)}</b>
              </div>
              <label className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                Currency
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                  className="h-7 rounded border border-border bg-background px-1.5 text-xs text-foreground">
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>
          </div>
        )}

        {panel && (
          <div className={cn("glass-panel absolute bottom-2 left-2 right-2 top-2 z-[550] overflow-y-auto overscroll-contain rounded-2xl border p-5 lg:bottom-4 lg:left-4 lg:right-auto lg:top-4 lg:w-[340px]",
            // On phones the day plan is a half-screen bottom sheet rendered in flow, so the map above
            // stays visible and Leaflet centers the stop in the remaining half; other panels keep the full page.
            panel === "day" && "max-lg:static max-lg:top-auto max-lg:h-[60dvh] max-lg:p-4")}
            onTouchStart={panel === "day" ? (e) => { const t = e.touches[0]; swipe.current = { x: t.clientX, y: t.clientY, scroll: e.currentTarget.scrollTop }; } : undefined}
            onTouchMove={panel === "day" ? (e) => {
              const s = swipe.current;
              if (!s || s.scroll > 0) return; // only drag from a settled top of the list
              const t = e.touches[0];
              const dx = t.clientX - s.x, dy = t.clientY - s.y;
              if (dy > 0 && Math.abs(dy) > Math.abs(dx)) { sheetDragRef.current = dy; setSheetDrag(Math.min(dy, 240)); }
            } : undefined}
            onTouchEnd={panel === "day" ? (e) => {
              const s = swipe.current; swipe.current = null;
              const dragged = sheetDragRef.current; sheetDragRef.current = 0; setSheetDrag(0);
              if (!s) return;
              const t = e.changedTouches[0];
              const dx = t.clientX - s.x, dy = t.clientY - s.y;
              if (dragged > 90) { setPanel(null); return; } // pulled down hard enough: dismiss
              if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
              const next = explorerStop + (dx < 0 ? 1 : -1);
              const p = boardPlan.stops[next];
              if (!p) return;
              setSelectedDay(next); flyTo(p);
            } : undefined}
            style={{ transform: sheetDrag ? `translateY(${sheetDrag}px)` : undefined, transition: sheetDrag ? "none" : "transform 250ms ease" }}>
            <button aria-label="Close panel" onClick={() => setPanel(null)} className="absolute right-4 top-5 z-10 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            {panel === "day" && boardPlan.stops[explorerStop] ? (
              <DayPanel
                stop={boardPlan.stops[explorerStop]}
                stopIndex={explorerStop}
                nights={boardPlan.nights[explorerStop] ?? 1}
                date={dates[explorerStop] ?? undefined}
                items={boardPlan.items.filter((it) => it.stop === explorerStop)}
                currency={currency}
                departure={boardPlan.departures[explorerStop] ?? "08:30"}
                arrival={arrivals[explorerStop]}
                drive={driveIn[explorerStop] || undefined}
                tab={dayTab}
                onTab={setDayTab}
                onNightsChange={(v) => setBoardNights(explorerStop, v)}
                onDepartureChange={(v) => setBoardDeparture(explorerStop, v)}
                onItemChange={(it) => setBoardItems(boardPlan.items.map((x) => (x.id === it.id ? it : x)))}
                onSaveItem={(it) => setBoardItems([...boardPlan.items, it])}
                onOpenItem={() => setPanel("trip")}
                onRecommend={(c) => openExplore(c, boardPlan.stops[explorerStop])}
                hasPrevDay={explorerStop > 0} hasNextDay={explorerStop < boardPlan.stops.length - 1}
                onPrevDay={() => { const n = explorerStop - 1; if (n >= 0) { setSelectedDay(n); flyTo(boardPlan.stops[n]); } }}
                onNextDay={() => { const n = explorerStop + 1; if (boardPlan.stops[n]) { setSelectedDay(n); flyTo(boardPlan.stops[n]); } }}
              />
            ) : panel === "trip" ? (
          <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold">Plan your route</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose where you start, then click towns on the map to see the drive and find places to stay, eat and explore.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Input aria-label="Trip name" value={title} onChange={(e) => setTitle(e.target.value)} className="h-8" />
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_110px] items-end gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Start date (optional)</span>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="min-w-0" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Daily drive (hours)</span>
            <Input type="number" min={1} max={12} step={0.5} value={driveHours} onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value)) setDriveHours(Math.min(12, Math.max(1, value)));
            }} />
          </label>
        </div>

        <PlacePicker label="Start" value={start} picking={pickMode === "start"}
          onPickOnMap={() => setPickMode(pickMode === "start" ? null : "start")}
          onPick={(p) => { setStart(p); if (p) flyTo(p); else { setStops([]); setNights([]); setDepartures([]); setPending(null); } }} />
        <PlacePicker label="End" optional value={end} picking={pickMode === "end"}
          onPickOnMap={() => setPickMode(pickMode === "end" ? null : "end")}
          onPick={(p) => { setEnd(p); }} />


        {start && (
          <div className="glass-card rounded-md border p-3">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Rental cars & campervans</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              {rentalLinks(start, startDate, tripEnd).map((l) => (
                <a key={l.key} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded border border-border px-2 py-1.5 hover:border-gold hover:text-gold"><l.icon className="h-3.5 w-3.5 shrink-0" /> {l.label}</a>
              ))}
            </div>
          </div>
        )}

        {start && (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your route</div>
            <ol className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />{start.name}</li>
              {stops.map((s, i) => (
                <li key={i} className="glass-card rounded-md border p-2">
                  <div className="text-xs text-muted-foreground">↓ {legInfo(legs[i])}</div>
                  <div className="flex items-center justify-between">
                    <button className="text-left hover:text-gold" onClick={() => { flyTo(s); setPending(null); }}>
                      {i + 1}. {s.name}
                    </button>
                    <span className="flex items-center gap-1.5">
                      <button aria-label={`Move ${s.name} earlier`} disabled={i === 0} onClick={() => moveStop(i, i - 1)} className="text-muted-foreground hover:text-gold disabled:opacity-30">
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button aria-label={`Move ${s.name} later`} disabled={i === stops.length - 1} onClick={() => moveStop(i, i + 1)} className="text-muted-foreground hover:text-gold disabled:opacity-30">
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button aria-label={`Remove ${s.name}`} onClick={() => removeStop(i)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <button aria-label="Fewer nights" className="h-5 w-5 rounded border border-border" onClick={() => setNights(nights.map((n, j) => (j === i ? Math.max(0, n - 1) : n)))}>−</button>
                    <span>{nights[i] ?? 1} night{(nights[i] ?? 1) === 1 ? "" : "s"}</span>
                    <button aria-label="More nights" className="h-5 w-5 rounded border border-border" onClick={() => setNights(nights.map((n, j) => (j === i ? n + 1 : n)))}>+</button>
                    {dates[i] && <span className="ml-auto">{dates[i]?.checkIn.slice(5)} → {dates[i]?.checkOut.slice(5)}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    {[...searchLinks(s, dates[i]), ...extraLinks(s, dates[i])].map((l) => (
                      <span key={l.key} className="inline-flex items-center gap-0.5">
                        <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-gold"><l.icon className="h-3 w-3" /> {l.label}</a>
                        <button aria-label={`Save a ${l.label} idea for ${s.name}`} title="Star to save" onClick={() => starLink(i + off, l.key, l.url, l.label)} className="text-muted-foreground hover:text-gold">
                          <Star className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {items.filter((it) => it.stop === i).map((it) => (
                      <button key={it.id} onClick={() => { setSelectedDay(i + off); }} className="inline-flex items-center gap-1 rounded border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[11px] text-gold">
                        <Star className="h-2.5 w-2.5 fill-gold" />{it.title}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
              {end && (
                <li className="rounded-md border border-dashed border-border p-2">
                  <div className="text-xs text-muted-foreground">↓ {legInfo(finalLeg)}</div>
                  <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-400" />{end.name}</div>
                </li>
              )}
            </ol>
            {totals.duration > 0 && (
              <div className="text-sm text-gold">Total: {formatDuration(totals.duration)} · {Math.round(totals.distance / 1000)} km</div>
            )}
          </div>
        )}
          </div>
            ) : panel === "discover" ? (
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold">Discover</h2>
            {!lastPoint && <p className="text-sm text-muted-foreground">Set a start point on the Plan tab first.</p>}
            {boardPlan.stops.length > 0 && (
              <>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pick a day">
                  {boardPlan.stops.map((s, i) => (
                    <button key={`${i}-${s.name}`} onClick={() => { setSelectedDay(i); flyTo(s); }}
                      className={cn("rounded-full border px-3 py-1 text-xs", selectedDay === i ? "border-gold bg-muted/60 text-gold" : "border-border text-muted-foreground hover:border-gold hover:text-foreground")}>
                      Day {i + 1} · {s.name}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Find places for this day">
                  <button onClick={() => openExplore("stay", boardPlan.stops[selectedDay])}
                    className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-2 py-3 text-xs hover:border-gold">
                    <BedDouble className="h-5 w-5 text-gold/80" />Hotels
                  </button>
                  <button onClick={() => openExplore("eat", boardPlan.stops[selectedDay])}
                    className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-2 py-3 text-xs hover:border-gold">
                    <UtensilsCrossed className="h-5 w-5 text-gold/80" />Food
                  </button>
                  <button onClick={() => openExplore("do", boardPlan.stops[selectedDay])}
                    className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-2 py-3 text-xs hover:border-gold">
                    <MapPinned className="h-5 w-5 text-gold/80" />To do
                  </button>
                </div>
              </>
            )}
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recommended stops</h3>
        <section className="space-y-2" aria-label="Recommended stops">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Recommended range (hours of driving)</span>
            <div className="flex flex-wrap gap-1">
              {RANGE_PRESETS.map((r) => (
                <Button key={r.label} type="button" size="sm" variant={range[0] === r.min && range[1] === r.max ? "default" : "outline"}
                  onClick={() => setRange([r.min, r.max])}>{r.label}</Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" aria-label="Minimum hours" min={0.5} max={11} step={0.5} value={range[0]} onChange={(e) => {
                const v = Number(e.target.value); if (Number.isFinite(v)) setRange(([, mx]) => [Math.min(Math.max(0.5, v), mx - 0.5), mx]);
              }} />
              <Input type="number" aria-label="Maximum hours" min={1} max={12} step={0.5} value={range[1]} onChange={(e) => {
                const v = Number(e.target.value); if (Number.isFinite(v)) setRange(([mn]) => [mn, Math.max(Math.min(12, v), mn + 0.5)]);
              }} />
            </div>
          </div>
          <Button variant="outline" className="w-full" disabled={!lastPoint || findingStops} onClick={findStops}>
            <MapPin className="mr-2 h-4 w-4" />{findingStops ? "Finding road routes…" : "Find recommended stops"}
          </Button>
          {lastPoint && <p className="text-xs text-muted-foreground">{range[0]}–{range[1]} hours of driving from {lastPoint.name} · nearest to your {driveHours}h daily target first</p>}
          <div aria-live="polite">
            {recommendationMessage && <p className="text-sm text-muted-foreground">{recommendationMessage}</p>}
          </div>
          {recommendations.map((r) => (
            <Button key={`${r.point.lat},${r.point.lng}`} variant={recommendation === r ? "secondary" : "outline"}
              className="h-auto w-full justify-between gap-3 py-2 text-left" onClick={() => chooseRecommendation(r)}>
              <span className="min-w-0 whitespace-normal">{r.point.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDuration(r.duration)} · {Math.round(r.distance / 1000)} km</span>
            </Button>
          ))}
          {recommendations.length > 0 && <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer" className="block text-xs text-muted-foreground">Town data: GeoNames · CC BY 4.0</a>}
        </section>
          </div>
            ) : panel === "saved" ? (
              <SavedTrips userId={user?.id ?? null} currentId={tripId} refreshKey={savedKey}
                onOpen={(id) => { setPanel("trip"); setSearchParams({ trip: id }); }}
                onDeleted={(id) => { if (id === tripId) { loadedTrip.current = null; setDirty(true); setSearchParams({}, { replace: true }); } }} />
            ) : panel === "docs" ? (
              <Documents userId={user?.id ?? null} />
            ) : null}
          </div>
        )}

        <div
          className={cn("absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+0.5rem)] z-[500] flex items-center gap-2 lg:inset-x-auto lg:right-5 lg:top-5 lg:flex-wrap lg:items-start lg:justify-end lg:gap-3")}
        >
          {STAY22_AID && (
            <button onClick={() => { setStayOverlay((v) => { if (!v) setPanel(null); return !v; }); }} aria-pressed={stayOverlay} aria-label="Live hotel prices"
              className={cn("glass-control flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm hover:border-gold lg:h-11 lg:px-4", stayOverlay && "border-gold text-gold")}>
              <BedDouble className="h-4 w-4" /><span className="max-lg:hidden">{stayOverlay ? "Hide hotels" : "Live hotels"}</span>
            </button>
          )}
          <button onClick={() => setLayer(layer === "satellite" ? "map" : "satellite")} aria-label="Toggle satellite view"
            className="glass-control flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm hover:border-gold lg:h-11 lg:px-4">
            <Layers className="h-4 w-4" /><span className="max-lg:hidden">{layer === "satellite" ? "Map" : "Satellite"}</span>
          </button>
          {recommendations.length > 0 && (
            <button onClick={() => setShowRecs((v) => !v)} aria-pressed={showRecs} aria-label="Toggle recommended stops"
              className="glass-control h-9 shrink-0 rounded-lg border px-3 text-sm hover:text-gold lg:h-11 lg:px-4">
              <Sparkles className="h-4 w-4" />
            </button>
          )}
          <Button variant="outline" aria-label="View itinerary" className="glass-control h-9 shrink-0 px-3 text-sm lg:h-11 lg:px-4 lg:text-[15px]" onClick={() => setView("overview")}>
            <ListChecks className="h-5 w-5" /><span className="max-lg:hidden">View itinerary</span>
          </Button>
          <Button variant="outline" aria-label="New trip" className="glass-control h-9 shrink-0 px-3 text-sm hover:border-gold lg:h-11 lg:px-4 lg:text-[15px]" onClick={askNewTrip}>
            <Plus className="h-5 w-5" /><span className="max-lg:hidden">New trip</span>
          </Button>
          {hasTrip && (
            <div aria-live="polite" className="glass-control flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs lg:h-11 lg:px-4">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", sync === "saving" ? "animate-pulse bg-foreground/50" : sync === "error" ? "bg-destructive" : user ? "bg-gold" : "bg-muted-foreground")} />
              <span className="max-lg:hidden text-muted-foreground">
                {sync === "saving" ? "Saving…" : sync === "error" ? "Save failed — retrying soon" : user ? "Saved" : "On this device"}
              </span>
            </div>
          )}
        </div>

        <AlertDialog open={confirmNew} onOpenChange={setConfirmNew}>
          <AlertDialogContent className="glass-panel z-[700] border">
            <AlertDialogHeader>
              <AlertDialogTitle>Start a new trip?</AlertDialogTitle>
              <AlertDialogDescription>
                {tripId
                  ? "This clears the trip on screen and starts you a fresh one. Your saved copy stays under Trips."
                  : "This clears the stops, nights and saved places on screen and starts you a fresh one."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border">Keep planning</AlertDialogCancel>
              <AlertDialogAction onClick={resetTrip}>Start new trip</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


        {choosing && (
          <div className={cn("glass-panel absolute bottom-[280px] z-[570] w-[min(360px,calc(100%-2rem))] max-lg:bottom-48 rounded-xl border border-gold/60 p-3 text-sm", panel ? "left-[372px] max-lg:left-auto max-lg:right-4" : "left-4")}>
            {candidate ? (
              <>
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-gold" /><span>Use <b>{candidate.name}</b> as {choosingLabel}?</span></div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" className="flex-1" onClick={confirmCandidate}>Confirm</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setCandidate(null)}>Choose again</Button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-gold" /><span className="flex-1">Click the map to choose {choosingLabel}{!start ? ", or search" : ""}</span>
                {start && <button className="text-xs text-muted-foreground hover:text-foreground" onClick={cancelChoosing}>Cancel</button>}</div>
            )}
          </div>
        )}

        {wheelPoint && wheelIdx !== null && !pending && relocate === null && (
          <div className={cn("glass-panel absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+11rem)] z-[560] rounded-xl border p-3 lg:inset-x-auto lg:right-5 lg:top-36 lg:w-72", panel && "max-lg:hidden")}>
            <div className="flex items-start justify-between gap-2">
              <div><div className="text-xs text-gold">Day {wheelIdx + 1}{start && wheelIdx === 0 ? " · Start" : end && wheelIdx === endIdx ? " · End" : ""}</div><div className="font-medium">{wheelPoint.name}</div></div>
              <button aria-label="Close" onClick={() => setWheelIdx(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => { setRelocate(wheelIdx); setCandidate(null); }}><MapPin className="mr-1 h-3.5 w-3.5" />Change location</Button>
              <Button size="sm" variant="outline" className="text-destructive" aria-label={`Remove ${wheelPoint.name}`} onClick={() => removeBoardStop(wheelIdx)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        )}

        {!pending && boardPlan.stops.length > 0 && (
          <div {...openOnSwipeUp}
            className={cn("absolute bottom-4 right-4 z-[540]", panel ? "left-[372px] max-lg:left-4" : "left-4", panel === "day" && "max-lg:hidden")}>
          {dockOpen ? (
            <StopDock driveIn={driveIn} arrivals={arrivals} plan={boardPlan} dates={dates} fixedLast={!!end} fixedFirst={!!start}
              selected={Math.min(selectedDay, boardPlan.stops.length - 1)}
              onSelect={(i) => { setSelectedDay(i); flyTo(boardPlan.stops[i]); setPanel("day"); }}
              onMoveStop={moveBoardStop} onNightsChange={setBoardNights} onDepartureChange={setBoardDeparture} onRemoveStop={removeBoardStop}
              onOpenItinerary={() => setView("overview")}
              onClose={() => setDockOpen(false)}
              className={cn(panel && "lg:left-[372px]")} />
          ) : (
            <button onClick={() => setDockOpen(true)}
              className="glass-control flex h-11 items-center gap-2 rounded-lg border px-4 text-sm hover:border-gold">
              <ListChecks className="h-4 w-4" />Show days
            </button>
          )}
          </div>
        )}

        {pending && (
          <div className={cn("glass-panel absolute bottom-4 right-4 z-[560] w-80 max-w-[calc(100%-2rem)] max-lg:inset-x-4 max-lg:w-auto rounded-xl border p-4", !panel && "left-4 right-auto max-lg:right-4")}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{pending.name}</div>
                {recommendation && <div className="text-xs text-chart-2">Recommended stop</div>}
                <div className="text-xs text-muted-foreground">{pending.fullName}</div>
                <div className="mt-1 text-sm text-gold">
                  {previewLeg ? `${legInfo(previewLeg)} from ${lastPoint?.name}` : "Working out the drive…"}
                </div>
              </div>
              <button aria-label="Dismiss" onClick={() => setPending(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <Button size="sm" className="mt-2 w-full" onClick={() => { setStops([...stops, pending]); setNights([...nights, 1]); setDepartures([...departures, DEFAULT_DEPARTURE]); setPending(null); }}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add as stop
            </Button>
          </div>
        )}

        {tutorialStep !== null && (
          <div role="status" aria-label={`Tutorial step ${tutorialStep + 1} of ${TUTORIAL_STEPS.length}`}
            className={cn("glass-panel pointer-events-none absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+7rem)] z-[575] w-[min(340px,calc(100%-2rem))] overflow-hidden rounded-xl border p-4 lg:inset-x-auto lg:left-[372px] lg:top-[13.5rem]", panel ? "lg:block" : "")}
            key={tutorialStep}>
            <span className="absolute inset-x-0 top-0 h-0.5 bg-muted"><span className="block h-full bg-gold transition-all duration-500" style={{ width: `${((tutorialStep + 1) / TUTORIAL_STEPS.length) * 100}%` }} /></span>
            {(() => {
              const step = TUTORIAL_STEPS[Math.min(tutorialStep, TUTORIAL_STEPS.length - 1)];
              const StepIcon = step.icon;
              return (
                <>
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-gold/40 bg-muted/60"><StepIcon className="h-4 w-4 text-gold" /></span>
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Step {tutorialStep + 1} of {TUTORIAL_STEPS.length}</div>
                      <div className="font-display font-semibold leading-tight">{step.title}</div>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
                  <div className="pointer-events-auto mt-3 flex items-center justify-between gap-2">
                    {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                      <button onClick={() => { try { localStorage.setItem(TUTORIAL_KEY, "done"); } catch {} finishTutorial(); }}
                        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">Skip tutorial</button>
                    ) : <span />}
                    {tutorialStep < TUTORIAL_STEPS.length - 1
                      ? <span className="text-[11px] text-muted-foreground/70">advances when you've done it</span>
                      : <Button size="sm" className="h-8 px-4" onClick={() => { try { localStorage.setItem(TUTORIAL_KEY, "done"); } catch {} finishTutorial(); }}>Done</Button>}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {welcomeOpen && (
          <div className="fixed inset-0 z-[700] grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-sm rounded-2xl border p-6 text-center">
              <span className="text-3xl text-gold">◆</span>
              <h2 className="mt-2 font-display text-2xl font-bold">Kia ora, welcome to Journeys</h2>
              <p className="mt-2 text-sm text-muted-foreground">Plot the route, find places to stay, eat and explore, and keep every day and dollar together — autosaved as you go.</p>
              <Button className="mt-5 w-full" onClick={() => dismissWelcome(false)}>Start planning</Button>
              <Button variant="outline" className="mt-2 w-full border-border" onClick={() => dismissWelcome(true)}>
                <LogIn className="mr-2 h-4 w-4" />Sign in or create an account
              </Button>
              <p className="mt-3 text-[11px] text-muted-foreground">Signing in keeps your trips on every device.</p>
            </div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
