"use client";

import { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/bclient";

type LoginProp = {
  user: User | null;
};

type Mode = "signup" | "signin";

function IconMail(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M4 8.5v8.25c0 .69.56 1.25 1.25 1.25h13.5c.69 0 1.25-.56 1.25-1.25V8.5m-16 0c0-.69.56-1.25 1.25-1.25h13.5c.69 0 1.25.56 1.25 1.25m-16 0 8 5.5 8-5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M7.5 10V8.25A4.5 4.5 0 0 1 12 3.75a4.5 4.5 0 0 1 4.5 4.5V10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.25 10h11.5c.69 0 1.25.56 1.25 1.25v7.5c0 .69-.56 1.25-1.25 1.25H6.25C5.56 20 5 19.44 5 18.75v-7.5C5 10.56 5.56 10 6.25 10Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 13.25v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Login({ user }: LoginProp) {
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(user);
  const [rememberMe, setRememberMe] = useState(true);

  const supabase = getSupabaseBrowserClient();
  const router = useRouter();

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatus(error.message);
      return;
    }
    setCurrentUser(null);
    setStatus("Signed out successfully.");
  }

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/welcome`,
        },
      });

      if (error) setStatus(error.message);
      else setStatus("Check your inbox to confirm your new account.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus(error.message);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,0,110,0.35),transparent_40%),radial-gradient(circle_at_75%_25%,rgba(0,170,255,0.35),transparent_45%),radial-gradient(circle_at_40%_80%,rgba(140,0,255,0.30),transparent_45%),linear-gradient(135deg,rgba(10,10,20,1),rgba(15,12,30,1),rgba(8,8,18,1))]" />
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-[420px] rounded-[44px] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
            <div className="h-9 w-9 rounded-full bg-white/15" />
          </div>

          {!currentUser ? (
            <>
              <h1 className="text-center text-lg font-semibold tracking-[0.28em] text-white/80">
                {mode === "signup" ? "SIGN UP" : "LOGIN"}
              </h1>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <div className="flex items-center gap-3 border-b border-white/20 pb-2 text-white/85">
                    <IconMail className="h-5 w-5 text-white/60" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="Email ID"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-white/45"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-3 border-b border-white/20 pb-2 text-white/85">
                    <IconLock className="h-5 w-5 text-white/60" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Password"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-white/45"
                    />
                  </div>
                </div>

                  <button
                    type="button"
                    className="text-white/55 hover:text-white/80"
                    onClick={() => setStatus("Password reset not wired yet.")}
                  >
                    Forgot Password?
                  </button>

                <button
                  type="submit"
                  className="mt-4 w-full rounded-2xl bg-gradient-to-r from-fuchsia-500/70 via-indigo-500/70 to-sky-500/70 py-3 text-sm font-semibold tracking-[0.28em] text-white shadow-lg shadow-black/30 hover:from-fuchsia-500/80 hover:via-indigo-500/80 hover:to-sky-500/80"
                >
                  {mode === "signup" ? "CREATE" : "LOGIN"}
                </button>
              </form>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/55">
                <span>
                  {mode === "signup" ? "Already have an account?" : "Don't have an account?"}
                </span>
                <button
                  type="button"
                  onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                  className="font-semibold text-white/80 underline underline-offset-4 hover:text-white"
                >
                  {mode === "signup" ? "Log In" : "Create account"}
                </button>
              </div>

              {status && (
                <p className="mt-5 text-center text-sm text-white/75" role="status" aria-live="polite">
                  {status}
                </p>
              )}
            </>
          ) : (
            <>
              <h1 className="text-center text-lg font-semibold tracking-[0.28em] text-white/80">
                ACCOUNT
              </h1>

              <p className="mt-6 text-center text-sm text-white/70">
                Signed in as <b className="text-white/90">{currentUser.email}</b>
              </p>

              <div className="mt-8 grid gap-3">
                <button
                  type="button"
                  onClick={() => {
                    router.push("/dashboard");
                    router.refresh();
                  }}
                  className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-500/70 via-indigo-500/70 to-sky-500/70 py-3 text-sm font-semibold tracking-[0.18em] text-white shadow-lg shadow-black/30 hover:from-fuchsia-500/80 hover:via-indigo-500/80 hover:to-sky-500/80"
                >
                  GO TO DASHBOARD
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full rounded-2xl border border-white/20 bg-white/10 py-3 text-sm font-semibold tracking-[0.18em] text-white/85 hover:bg-white/15"
                >
                  SIGN OUT
                </button>
              </div>

              {status && (
                <p className="mt-5 text-center text-sm text-white/75" role="status" aria-live="polite">
                  {status}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
