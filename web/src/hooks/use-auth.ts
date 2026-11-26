import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AuthState = {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
};

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return;
      setSession(s);
      if (s?.user) {
        // Defer to avoid deadlock per Supabase guidance
        setTimeout(async () => {
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", s.user.id)
            .eq("role", "admin")
            .maybeSingle();
          if (!cancelled) setIsAdmin(!!data);
        }, 0);
      } else {
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (cancelled) return;
      setSession(s);
      if (s?.user) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", s.user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (!cancelled) setIsAdmin(!!data);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user: session?.user ?? null, session, isAdmin, loading };
}
