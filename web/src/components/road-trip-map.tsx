import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Tooltip, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { PlannerPoint, StayDates } from "@/lib/travel-help";
import { searchLinks, formatDuration } from "@/lib/travel-help";
import type { DriveRecommendation } from "@/lib/drive-recommendations";
import type { NearbyPlace } from "@/lib/geo";

function dot(color: string, label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:30px;height:38px"><div style="position:absolute;left:0;top:0;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px 9999px 9999px 9999px;background:${color};color:#111;font:700 14px Inter,sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.5)">${label}</div><div style="position:absolute;left:10px;top:24px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:10px solid ${color}"></div></div>`,
    iconSize: [30, 38],
    iconAnchor: [15, 36],
    tooltipAnchor: [14, -20],
  });
}

/** Inline SVG bodies for the wheel's raw-HTML buttons (lucide icons, Explorer set). */
const WHEEL_ICONS: Record<string, string> = {
  hotels: '<path d="M10 22v-6.57"/><path d="M12 11h.01"/><path d="M12 7h.01"/><path d="M14 15.43V22"/><path d="M15 16a5 5 0 0 0-6 0"/><path d="M16 11h.01"/><path d="M16 7h.01"/><path d="M8 11h.01"/><path d="M8 7h.01"/><rect x="4" y="2" width="16" height="20" rx="2"/>',
  hostels: '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>',
  food: '<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>',
  todo: '<path d="M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0"/><circle cx="12" cy="8" r="2"/><path d="M8.714 14h-3.71a1 1 0 0 0-.948.683l-2.004 6A1 1 0 0 0 3 22h18a1 1 0 0 0 .948-1.316l-2-6a1 1 0 0 0-.949-.684h-3.712"/>',
};

function wheel(p: PlannerPoint, dates: StayDates) {
  const links = searchLinks(p, dates).map((l) => ({ ...l, url: l.url.replace(/&/g, "&amp;").replace(/"/g, "%22") }));
  const pos = links.map((_, i) => {
    const a = -Math.PI / 4 + (i * 2 * Math.PI) / links.length;
    return { x: Math.round(Math.cos(a) * 62), y: Math.round(Math.sin(a) * 62) };
  });
  const btns = links
    .map(
      (l, i) =>
        `<a class="map-wheel-button" data-wheel-key="${l.key}" data-wheel-url="${l.url}" href="${l.url}" target="_blank" rel="noopener noreferrer" title="${l.label} near ${p.name}" style="position:absolute;left:${80 + pos[i].x - 24}px;top:${80 + pos[i].y - 24}px;width:48px;height:48px;border-radius:9999px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-decoration:none;color:#d4af37"><svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${WHEEL_ICONS[l.key] ?? ""}</svg><span style="font:600 7px sans-serif;letter-spacing:0;text-transform:uppercase;margin-top:2px">${l.label}</span></a>`,
    )
    .join("");
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:160px;height:160px"><div style="position:absolute;inset:18px;border-radius:9999px;border:2px dashed rgba(245,183,61,.6)"></div><div style="position:absolute;left:69px;top:69px;width:22px;height:22px;border-radius:9999px;background:#60a5fa;border:3px solid #0a0a0a"></div>${btns}</div>`,
    iconSize: [160, 160],
    iconAnchor: [80, 80],
  });
}

function priceTag(p: NearbyPlace) {
  const label = p.priceExact ?? (p.price === 0 ? "Free" : "$".repeat(p.price));
  return L.divIcon({
    className: "",
    html: `<div class="map-price-tag" style="display:inline-block;padding:3px 9px;border-radius:9999px;font:700 12px Inter,sans-serif;white-space:nowrap;transform:translateX(-50%)">${label}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 14],
  });
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => {
    // Clicks on the icon ring or any pin must not move the point.
    const target = e.originalEvent?.target as HTMLElement | null;
    if (target?.closest?.(".leaflet-marker-icon")) return;
    onClick(e.latlng.lat, e.latlng.lng);
  } });
  return null;
}

function ZoomBottomRight() {
  const map = useMap();
  useEffect(() => {
    const c = L.control.zoom({ position: "bottomright" }).addTo(map);
    return () => { c.remove(); };
  }, [map]);
  return null;
}

function FlyTo({ focus }: { focus: { lat: number; lng: number; n: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) {
      map.invalidateSize(); // container may have just shrunk/grown around the day sheet
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 10), { duration: 1 });
    }
  }, [focus, map]);
  return null;
}

/** New Zealand's two islands, the default view for a fresh map. */
const NZ_HOME = { lat: -41.2, lng: 172.6, zoom: 5 };

/** Flies back to New Zealand whenever a trip becomes empty again (new journey / reset). */
function HomeView({ empty }: { empty: boolean }) {
  const map = useMap();
  const hadPoints = useRef(false);
  useEffect(() => {
    if (empty) {
      if (hadPoints.current) {
        hadPoints.current = false;
        map.invalidateSize();
        map.flyTo([NZ_HOME.lat, NZ_HOME.lng], NZ_HOME.zoom, { duration: 1 });
      }
    } else {
      hadPoints.current = true;
    }
  }, [empty, map]);
  return null;
}

/** Keeps Leaflet's internal size in sync when its container resizes (day sheet open/close on phones). */
function SizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function ViewTracker({ onViewChange }: { onViewChange?: (view: { lat: number; lng: number; zoom: number }) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onViewChange) return;
    const report = () => {
      const center = map.getCenter();
      onViewChange({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
    };
    map.on("moveend", report);
    return () => { map.off("moveend", report); };
  }, [map, onViewChange]);
  return null;
}

function RecommendationView({ route }: { route: DriveRecommendation | null }) {
  const map = useMap();
  useEffect(() => {
    if (route?.coords.length) map.fitBounds(L.latLngBounds(route.coords), { padding: [35, 70], maxZoom: 10 });
  }, [map, route]);
  return null;
}

export default function RoadTripMap(props: {
  start: PlannerPoint | null;
  end: PlannerPoint | null;
  stops: PlannerPoint[];
  pending: PlannerPoint | null;
  legs: [number, number][][];
  previewLeg: [number, number][] | null;
  focus: { lat: number; lng: number; n: number } | null;
  onMapClick: (lat: number, lng: number) => void;
  pendingDates?: StayDates;
  recommendations?: DriveRecommendation[];
  recommendation?: DriveRecommendation | null;
  onRecommendationClick?: (r: DriveRecommendation) => void;
  layer?: "map" | "satellite";
  zoomControl?: boolean;
  onPointClick?: (kind: "start" | "stop" | "end", index: number) => void;
  wheelAt?: PlannerPoint | null;
  wheelDates?: StayDates;
  onWheelPick?: (kind: "stay" | "eat" | "do") => void;
  placePins?: NearbyPlace[];
  placePinDay?: number;
  placePinAdded?: Set<string>;
  onPlacePinAdd?: (p: NearbyPlace) => void;
  onViewChange?: (view: { lat: number; lng: number; zoom: number }) => void;
}) {
  const { layer = "satellite", zoomControl = true } = props;
  const { start, end, stops, pending, legs, previewLeg, focus, onMapClick, pendingDates = null, recommendations = [], recommendation = null, onRecommendationClick, onWheelPick, wheelAt = null, wheelDates = null, placePins = [], placePinDay = 1, placePinAdded, onPlacePinAdd } = props;
  const pickWheel = (ev: MouseEvent) => {
    L.DomEvent.stop(ev);
    const link = (ev.target as HTMLElement | null)?.closest?.("a[data-wheel-url]") as HTMLAnchorElement | null;
    if (!link) return;
    const k = link.dataset.wheelKey ?? "";
    const kind = k === "hotels" || k === "hostels" ? "stay" : k === "food" ? "eat" : k === "activities" || k === "todo" ? "do" : null;
    if (kind && onWheelPick) onWheelPick(kind);
    else window.open(link.href, "_blank", "noopener,noreferrer");
  };
  return (
    <MapContainer center={[NZ_HOME.lat, NZ_HOME.lng]} zoom={NZ_HOME.zoom} minZoom={2} maxBounds={[[-85, -540], [85, 540]]} maxBoundsViscosity={1} className="h-full w-full" worldCopyJump zoomControl={false}>
      {layer === "satellite" ? (
        <>
          <TileLayer key="sat" attribution="Imagery &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" className="satellite-tiles" />
          <TileLayer key="lbl" url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
        </>
      ) : (
        <TileLayer key="osm"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" className="free-map-dark-tiles" />
      )}
      {zoomControl && <ZoomBottomRight />}
      <ClickHandler onClick={onMapClick} />
      <ViewTracker onViewChange={props.onViewChange} />
      <FlyTo focus={focus} />
      <HomeView empty={!props.start && !props.end && stops.length === 0 && !pending} />
      <SizeWatcher />
      <RecommendationView route={recommendation} />
      {recommendation && <Polyline positions={recommendation.coords} pathOptions={{ color: "#009689", weight: 6, dashArray: "12 7" }} />}
      {recommendations.map((r) => (
        <CircleMarker key={`${r.point.lat},${r.point.lng}`} center={[r.point.lat, r.point.lng]} radius={9}
          pathOptions={{ color: "#009689", fillColor: "#009689", fillOpacity: 0.45, weight: 3 }}
          eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e.originalEvent); onRecommendationClick?.(r); } }}>
          <Tooltip>{r.point.name} · {formatDuration(r.duration)} drive</Tooltip>
        </CircleMarker>
      ))}
      {legs.map((c, i) => (
        <Polyline key={i} positions={c} pathOptions={{ color: "#f5b73d", weight: 5, opacity: 0.9 }} />
      ))}
      {previewLeg && (
        <Polyline positions={previewLeg} pathOptions={{ color: "#60a5fa", weight: 5, dashArray: "8 8" }} />
      )}
      {start && <Marker position={[start.lat, start.lng]} icon={dot("#34d399", "1")} bubblingMouseEvents={false}
        eventHandlers={{ click: () => props.onPointClick?.("start", 0) }}><Tooltip permanent direction="right" className="stop-label">{start.name}</Tooltip></Marker>}
      {stops.map((s, i) => (
        <Marker key={`${i}-${s.lat},${s.lng}`} position={[s.lat, s.lng]} icon={dot("#f5b73d", String(i + (start ? 2 : 1)))} bubblingMouseEvents={false}
          eventHandlers={{ click: () => props.onPointClick?.("stop", i) }}>
          <Tooltip permanent direction="right" className="stop-label">{s.name}</Tooltip>
        </Marker>
      ))}
      {end && <Marker position={[end.lat, end.lng]} icon={dot("#f87171", "B")} bubblingMouseEvents={false}
        eventHandlers={{ click: () => props.onPointClick?.("end", 0) }}><Tooltip permanent direction="right" className="stop-label">{end.name}</Tooltip></Marker>}
      {wheelAt && !pending && <Marker position={[wheelAt.lat, wheelAt.lng]} icon={wheel(wheelAt, wheelDates)} zIndexOffset={1000} bubblingMouseEvents={false}
        eventHandlers={{ click: (e) => pickWheel(e.originalEvent) }} />}
      {pending && <Marker position={[pending.lat, pending.lng]} icon={wheel(pending, pendingDates)} zIndexOffset={1000} bubblingMouseEvents={false}
        eventHandlers={{ click: (e) => pickWheel(e.originalEvent) }} />}
      {placePins.map((p) => {
        const added = placePinAdded?.has(p.name) ?? false;
        return (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={priceTag(p)} bubblingMouseEvents={false}>
            <Popup className="place-pin-pop" closeButton={false} offset={[0, -6]}>
              <div className="min-w-[170px]">
                <div className="font-semibold leading-tight">{p.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground capitalize">
                  {p.type} · {p.priceExact ?? (p.price === 0 ? "Free" : "$".repeat(p.price))} · {p.distanceKm} km
                </div>
                <button
                  disabled={added}
                  onClick={() => onPlacePinAdd?.(p)}
                  className="mt-2 w-full rounded-md bg-gold px-2.5 py-1.5 text-xs font-semibold text-background hover:bg-gold/90 disabled:opacity-60"
                >
                  {added ? "Added" : `Add to Day ${placePinDay}`}
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
