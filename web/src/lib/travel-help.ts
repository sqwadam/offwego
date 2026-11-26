import { BedDouble, Car, Caravan, CarFront, Compass, Hotel, KeyRound, MapPinned, Utensils, UtensilsCrossed, type LucideIcon } from "lucide-react";

export type PlannerPoint = { name: string; fullName: string; lat: number; lng: number };

export const RENTAL_PICKUPS: PlannerPoint[] = [
  { name: "Cairns Airport", fullName: "Cairns Airport, Queensland, Australia", lat: -16.8858, lng: 145.7553 },
  { name: "Brisbane Airport", fullName: "Brisbane Airport, Queensland, Australia", lat: -27.3842, lng: 153.1175 },
  { name: "Sydney Airport", fullName: "Sydney Airport, NSW, Australia", lat: -33.9399, lng: 151.1753 },
  { name: "Melbourne Airport", fullName: "Melbourne Airport, Victoria, Australia", lat: -37.669, lng: 144.841 },
  { name: "Perth Airport", fullName: "Perth Airport, WA, Australia", lat: -31.9385, lng: 115.9672 },
  { name: "Auckland Airport", fullName: "Auckland Airport, New Zealand", lat: -37.0082, lng: 174.785 },
  { name: "Christchurch Airport", fullName: "Christchurch Airport, New Zealand", lat: -43.4894, lng: 172.5322 },
  { name: "Queenstown Airport", fullName: "Queenstown Airport, New Zealand", lat: -45.0211, lng: 168.7392 },
  { name: "Vancouver Airport", fullName: "Vancouver International Airport, BC, Canada", lat: 49.1967, lng: -123.1815 },
  { name: "Calgary Airport", fullName: "Calgary International Airport, AB, Canada", lat: 51.1215, lng: -114.0076 },
  { name: "Toronto Pearson", fullName: "Toronto Pearson Airport, ON, Canada", lat: 43.6777, lng: -79.6248 },
  { name: "Los Angeles (LAX)", fullName: "Los Angeles International Airport, CA, USA", lat: 33.9416, lng: -118.4085 },
  { name: "San Francisco (SFO)", fullName: "San Francisco International Airport, CA, USA", lat: 37.6213, lng: -122.379 },
  { name: "Las Vegas Airport", fullName: "Harry Reid International Airport, NV, USA", lat: 36.084, lng: -115.1537 },
  { name: "Keflavík Airport", fullName: "Keflavík International Airport, Iceland", lat: 63.985, lng: -22.6056 },
  { name: "Edinburgh Airport", fullName: "Edinburgh Airport, Scotland, UK", lat: 55.95, lng: -3.3725 },
  { name: "Dublin Airport", fullName: "Dublin Airport, Ireland", lat: 53.4264, lng: -6.2499 },
];

// Paste partner / affiliate IDs here when you have them. Empty = plain links.
export const AFFILIATE = {
  bookingAid: "",
  viatorPid: "",
  getYourGuidePartnerId: "",
  discoverCarsAffiliate: "",
  kayakAffiliate: "",
};

// Activities and to-do links go to Klook (Travelpayouts-tracked). Stays stay on Booking.com and food on Google Maps,
// where those searches actually return the right kind of result. Set to "booking" to also route activities through Viator.
export const LINK_PROVIDER: "klook" | "booking" = "klook";

/** Wrap any Klook URL in the Travelpayouts tracking redirect (marker 803688). */
export function klookLink(query: string) {
  const target = `https://www.klook.com/en-US/search/result/?query=${encodeURIComponent(query)}`;
  return `https://tp.media/r?campaign_id=137&marker=803688&p=4110&trs=598804&u=${encodeURIComponent(target)}`;
}

export type StayDates = { checkIn: string; checkOut: string } | null;

/** Stay22 affiliate ID (public — it only routes commission). The live-price map stays hidden until it's set. */
export const STAY22_AID = import.meta.env.VITE_STAY22_AID as string | undefined;

/** Stay22 live-pricing accommodation map iframe URL (dev.stay22.com): centered on lat/lng, with the trip's dates. */
export function stay22MapSrc(lat: number, lng: number, dates: StayDates, campaign: string) {
  const params = new URLSearchParams({ aid: STAY22_AID!, lat: String(lat), lng: String(lng), campaign });
  if (dates) {
    params.set("checkin", dates.checkIn);
    params.set("checkout", dates.checkOut);
  }
  return `https://www.stay22.com/embed/gm?${params.toString()}`;
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Check-in/out for each stop: start date + nights of earlier stops. */
export function stayDates(startDate: string, nights: number[]): StayDates[] {
  if (!startDate) return nights.map(() => null);
  let offset = 0;
  return nights.map((n) => {
    const checkIn = addDays(startDate, offset);
    offset += n;
    return { checkIn, checkOut: addDays(startDate, offset) };
  });
}

export type LinkChip = { key: string; label: string; icon: LucideIcon; url: string };

export function searchLinks(p: PlannerPoint, dates: StayDates = null): LinkChip[] {
  const q = encodeURIComponent(p.fullName);
  const city = encodeURIComponent(p.name);
  let booking = `https://www.booking.com/searchresults.html?ss=${q}&group_adults=2&no_rooms=1&order=price`;
  if (dates) booking += `&checkin=${dates.checkIn}&checkout=${dates.checkOut}`;
  if (AFFILIATE.bookingAid) booking += `&aid=${AFFILIATE.bookingAid}`;
  // Hostelworld has no working search-by-text link, so use Booking.com filtered to hostels.
  const hostel = `${booking}&nflt=ht_id%3D203`;
  let viator = `https://www.viator.com/searchResults/all?text=${city}`;
  if (dates) viator += `&startDate=${dates.checkIn}&endDate=${dates.checkOut}`;
  if (AFFILIATE.viatorPid) viator += `&pid=${AFFILIATE.viatorPid}&mcid=42383&medium=link`;
  if (LINK_PROVIDER === "klook") {
    return [
      { key: "hotels", label: "Hotels", icon: Hotel, url: booking },
      { key: "hostels", label: "Hostels", icon: BedDouble, url: hostel },
      { key: "food", label: "Food", icon: UtensilsCrossed, url: `https://www.google.com/maps/search/restaurants/@${p.lat},${p.lng},14z` },
      { key: "todo", label: "To do", icon: MapPinned, url: klookLink(`things to do ${p.name}`) },
    ];
  }
  return [
    { key: "hotels", label: "Hotels", icon: Hotel, url: booking },
    { key: "hostels", label: "Hostels", icon: BedDouble, url: hostel },
    { key: "food", label: "Food", icon: UtensilsCrossed, url: `https://www.google.com/maps/search/restaurants/@${p.lat},${p.lng},14z` },
    { key: "todo", label: "To do", icon: MapPinned, url: viator },
  ];
}

export function extraLinks(p: PlannerPoint, dates: StayDates = null): LinkChip[] {
  let gyg = `https://www.getyourguide.com/s/?q=${encodeURIComponent(p.name)}`;
  if (dates) gyg += `&date_from=${dates.checkIn}&date_to=${dates.checkOut}`;
  if (AFFILIATE.getYourGuidePartnerId) gyg += `&partner_id=${AFFILIATE.getYourGuidePartnerId}`;
  return [
    { key: "gyg", label: "GetYourGuide", icon: Compass, url: gyg },
    { key: "ta-food", label: "Tripadvisor food", icon: Utensils, url: `https://www.tripadvisor.com/Search?q=${encodeURIComponent("restaurants " + p.fullName)}` },
  ];
}

export function rentalLinks(p: PlannerPoint, startDate: string, endDate: string) {
  const from = startDate || addDays(new Date().toISOString().slice(0, 10), 14);
  const to = endDate && endDate > from ? endDate : addDays(from, 7);
  let kayak = `https://www.kayak.com/cars/${encodeURIComponent(p.fullName.replace(/,/g, ""))}/${from}/${to}`;
  if (AFFILIATE.kayakAffiliate) kayak += `?aid=${AFFILIATE.kayakAffiliate}`;
  let dc = `https://www.discovercars.com/search?location=${encodeURIComponent(p.fullName)}&pick_date=${from}&drop_date=${to}`;
  if (AFFILIATE.discoverCarsAffiliate) dc += `&a_aid=${AFFILIATE.discoverCarsAffiliate}`;
  return [
    { key: "kayak", label: "Kayak car hire", icon: Car, url: kayak },
    { key: "imoova", label: "imoova relocations", icon: Caravan, url: "https://www.imoova.com/en/relocations" },
    { key: "discovercars", label: "DiscoverCars", icon: KeyRound, url: dc },
    { key: "rentalcars", label: "Rentalcars.com", icon: CarFront, url: `https://www.rentalcars.com/SearchResults.do?location=${encodeURIComponent(p.fullName)}&puDay=${from.slice(8)}&puMonth=${from.slice(5, 7)}&puYear=${from.slice(0, 4)}&doDay=${to.slice(8)}&doMonth=${to.slice(5, 7)}&doYear=${to.slice(0, 4)}` },
  ];
}

export function formatDuration(seconds: number) {
  const m = Math.round(seconds / 60);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}
