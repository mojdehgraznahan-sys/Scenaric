"use client";

// Auth — login + signup. Faithful Tailwind/shadcn port of the handoff auth.jsx.
// Rendered by both /login and /signup routes via the `mode` prop.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";

const ACCOUNT_TYPES = [
  { id: "self", title: "For myself / my team", body: "Personal or team planning" },
  { id: "client", title: "For client organisations", body: "Multiple client projects" },
];

export function AuthForm({ mode = "login" }: { mode?: "login" | "signup" }) {
  const store = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = React.useState<"login" | "signup">(mode);
  const [email, setEmail] = React.useState("");
  const [pwd, setPwd] = React.useState("");
  const [accountType, setAccountType] = React.useState(store.accountType || "self");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [checkEmail, setCheckEmail] = React.useState(false);

  React.useEffect(() => {
    setTab(mode);
  }, [mode]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setSubmitting(true);
    store.setAccountType(accountType);

    if (tab === "signup") {
      const { error: authError, needsEmailConfirmation } = await store.signUp(email, pwd);
      setSubmitting(false);
      if (authError) {
        setError(authError);
        return;
      }
      if (needsEmailConfirmation) {
        setCheckEmail(true);
        return;
      }
      navigate("/onboarding");
      return;
    }

    const { error: authError } = await store.signIn(email, pwd);
    setSubmitting(false);
    if (authError) {
      setError(authError);
      return;
    }
    navigate("/projects");
  };

  return (
    <div data-screen-label="Auth" className="flex min-h-screen bg-white">
      {/* Left panel — quote (hidden under 900px) */}
      <div className="relative hidden w-1/2 flex-col bg-brand-dark p-10 text-white min-[901px]:flex">
        <div className="flex items-center gap-2.5">
          <Icons.Logo size={26} reverse />
          <span className="text-sm font-semibold">Scenaric.ai</span>
        </div>
        <div className="flex max-w-[460px] flex-1 flex-col justify-center">
          <blockquote className="m-0 text-[21px] italic leading-[1.5] tracking-[-0.005em] text-white/70">
            &quot;Scenarios are not predictions. They are stories about the future that help us make better decisions
            today.&quot;
          </blockquote>
          <div className="mt-[22px] font-mono text-[13px] text-white/40">— PETER SCHWARTZ</div>
        </div>
        <div className="text-xs text-white/40">© 2026 Scenaric.ai</div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center bg-white p-10">
        <div className="w-full max-w-[380px]">
          {checkEmail ? (
            <div className="flex flex-col gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-orangeLight">
                <Icons.Radio size={18} stroke="#F97316" />
              </div>
              <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                We sent a confirmation link to <span className="font-medium text-brand-dark">{email}</span>. Click it to
                activate your account and continue setting up your first project.
              </p>
              <button
                onClick={() => {
                  setCheckEmail(false);
                  setTab("login");
                  navigate("/login");
                }}
                className="mt-2 cursor-pointer self-start text-[13px] text-brand-orange underline"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* Tab toggle */}
              <div className="mb-7 flex gap-6 border-b border-border">
            <button
              onClick={() => {
                setTab("login");
                navigate("/login");
              }}
              className={cn(
                "-mb-px border-b-2 px-0.5 py-2 text-[13px] font-medium",
                tab === "login" ? "border-brand-orange text-brand-orange" : "border-transparent text-muted-foreground"
              )}
            >
              Sign in
            </button>
            <button
              onClick={() => {
                setTab("signup");
                navigate("/signup");
              }}
              className={cn(
                "-mb-px border-b-2 px-0.5 py-2 text-[13px] font-medium",
                tab === "signup" ? "border-brand-orange text-brand-orange" : "border-transparent text-muted-foreground"
              )}
            >
              Create account
            </button>
          </div>

          <h1 className="mb-1.5 text-[26px] font-semibold tracking-[-0.02em]">
            {tab === "login" ? "Welcome back" : "Start planning"}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {tab === "login" ? "Sign in to continue planning." : "Free for 30 days. No credit card needed."}
          </p>

          <form onSubmit={submit} className="flex flex-col gap-3.5">
            <div>
              <Label htmlFor="email" className="mb-1.5 block text-[13px]">
                Email
              </Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" />
            </div>
            <div>
              <Label htmlFor="password" className="mb-1.5 block text-[13px]">
                Password
              </Label>
              <Input id="password" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required placeholder="••••••••" />
            </div>

            {tab === "signup" && (
              <div className="slide-up">
                <div className="mb-2 mt-1 text-[13px] font-medium">I am planning scenarios…</div>
                <div className="grid grid-cols-2 gap-2.5">
                  {ACCOUNT_TYPES.map((opt) => {
                    const selected = accountType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAccountType(opt.id)}
                        className={cn(
                          "rounded-[10px] text-left transition-[border,background] duration-[120ms]",
                          selected
                            ? "border-2 border-brand-orange bg-brand-orangeLight px-[11px] py-[11px]"
                            : "border border-border bg-white px-[14px] py-[12px]"
                        )}
                      >
                        <div className="mb-0.5 text-[13px] font-semibold">{opt.title}</div>
                        <div className="text-[11px] text-muted-foreground">{opt.body}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#7F1D1D]">{error}</div>
            )}

            <Button type="submit" variant="primary" className="mt-1.5 w-full py-[11px]" disabled={submitting}>
              {submitting ? "Please wait…" : tab === "login" ? "Sign in" : "Create account"}
            </Button>

            <div className="text-center text-[13px] text-muted-foreground">
              {tab === "login" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <a
                    onClick={() => {
                      setTab("signup");
                      navigate("/signup");
                    }}
                    className="cursor-pointer text-brand-orange underline"
                  >
                    Sign up
                  </a>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <a
                    onClick={() => {
                      setTab("login");
                      navigate("/login");
                    }}
                    className="cursor-pointer text-brand-orange underline"
                  >
                    Sign in
                  </a>
                </>
              )}
            </div>
          </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
