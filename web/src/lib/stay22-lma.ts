import { useEffect } from "react";
import { STAY22_AID } from "@/lib/travel-help";

/**
 * Stay22 "LetMeAllez" script: automatically attributes outbound accommodation links
 * (Booking.com, Expedia, ...) to the user's Stay22 account. Loaded once per page,
 * skipped when no aid is configured or it was already injected.
 */
export function useStay22Lma() {
  useEffect(() => {
    if (!STAY22_AID || document.querySelector('script[src*="lma.stay22.com"]')) return;

    // Register the params before the script runs, exactly as Stay22's snippet does.
    const w = window as typeof window & { Stay22?: { params?: { lmaID: string } } };
    w.Stay22 = w.Stay22 || {};
    w.Stay22.params = { lmaID: STAY22_AID };

    const s = document.createElement("script");
    s.async = true;
    s.src = "https://lma.stay22.com/letmeallez.js";
    document.head.appendChild(s);
  }, []);
}
