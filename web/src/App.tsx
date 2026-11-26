import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, Outlet, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useStay22Lma } from "@/lib/stay22-lma";
import Planner from "@/pages/Planner";
import AuthPage from "@/pages/Auth";

const queryClient = new QueryClient();

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function SiteHeader() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
        <Link to="/" className="font-display text-2xl tracking-tight text-gold">
          Journeys
        </Link>
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em]">
          {user ? (
            <button onClick={() => supabase.auth.signOut()} className="text-muted-foreground hover:text-foreground">
              Sign out
            </button>
          ) : (
            <Link to="/auth" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function AppShell() {
  const location = useLocation();
  const isPlanner = location.pathname === "/";
  useStay22Lma();

  useEffect(() => {
    document.title = isPlanner
      ? "Journeys — Road trip stop planner"
      : "Sign in — Journeys";
  }, [isPlanner]);

  // Keep react-query caches fresh when auth changes.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") return;
      queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // The planner is a full-screen app view without the site header and footer.
  if (isPlanner) {
    return (
      <>
        <Outlet />
        <Toaster />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border/40 py-10 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span className="text-gold">◆</span> Journeys &nbsp;·&nbsp; plan the road trip
      </footer>
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Planner />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
