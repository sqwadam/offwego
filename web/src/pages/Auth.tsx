import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/");
  }, [user, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Account created. You can sign in now.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
        navigate("/");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      toast.error(error.message || "Google sign-in failed");
      return;
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-6 py-20">
      <Link to="/" className="mb-10 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-gold">
        ← Back
      </Link>
      <h1 className="font-display text-5xl">
        {mode === "signin" ? "Sign in" : "Create account"}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {mode === "signin"
          ? "Welcome back."
          : "The first account becomes admin. After that, signups are visitors only."}
      </p>

      <Button
        type="button"
        variant="outline"
        className="mt-8 border-border bg-card hover:bg-muted"
        onClick={handleGoogle}
      >
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 bg-card"
          />
        </div>
        <div>
          <Label htmlFor="password" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 bg-card"
          />
        </div>
        <Button
          type="submit"
          disabled={busy}
          className="w-full bg-gold text-ink hover:bg-gold-soft"
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-6 text-center text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-gold"
      >
        {mode === "signin" ? "No account? Create one →" : "Have an account? Sign in →"}
      </button>
    </div>
  );
}
