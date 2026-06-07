"use client";

// Landing (marketing) page — faithful Tailwind/shadcn port of the handoff landing.jsx.
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@/lib/use-navigate";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#method", label: "Methodology" },
  { href: "#pricing", label: "Pricing" },
];

const FEATURES = [
  { icon: <Icons.Radio size={20} />, title: "Identify Signals", body: "Capture STEEP forces from news, interviews, and research as they emerge." },
  { icon: <Icons.Layers size={20} />, title: "Build Scenarios", body: "Plot critical uncertainties on a 2×2 matrix and develop coherent futures." },
  { icon: <Icons.Eye size={20} />, title: "Monitor Reality", body: "Know which future is unfolding first — set indicators and track them automatically." },
];

const STEPS = [
  "Focal question",
  "Key forces",
  "Driving forces",
  "Rank forces",
  "Scenario logics",
  "Narratives",
  "Implications",
  "Indicators",
  "Strategic options",
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div data-screen-label="Landing" className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex h-14 items-center border-b border-border bg-white px-8">
        <div className="flex items-center gap-2">
          <Icons.Logo size={26} />
          <span className="text-[15px] font-semibold">Scenaric.ai</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="px-3.5 py-2 text-[13px] font-medium text-muted-foreground">
              {l.label}
            </a>
          ))}
          <button onClick={() => navigate("/login")} className="cursor-pointer px-3.5 py-2 text-[13px] font-medium">
            Sign in
          </button>
          <Button variant="primary" size="sm" onClick={() => navigate("/signup")}>
            Get started
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-brand-dark px-8 pb-28 pt-24 text-center text-white">
        <div className="mx-auto max-w-[880px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.08] px-3.5 py-1.5 text-xs tracking-[0.02em] text-white/85">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
            Based on <em className="font-medium not-italic">The Art of the Long View</em> · Peter Schwartz
          </div>
          <h1 className="my-5 mt-7 text-[76px] font-semibold leading-[1.02] tracking-[-0.035em] [text-wrap:balance]">
            Shape your future
            <br />
            with confidence
          </h1>
          <p className="mx-auto mb-9 max-w-[620px] text-[19px] leading-[1.55] text-white/55">
            The AI-powered scenario planning platform built on Peter Schwartz&apos;s proven 9-step methodology. Build
            strategy that holds up against any future.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="primary" size="lg" onClick={() => navigate("/signup")}>
              Start planning free <Icons.ArrowRight size={16} />
            </Button>
            <Button variant="onInk" size="lg">
              See how it works
            </Button>
          </div>
          {/* Trusted by row */}
          <div className="mt-[72px] opacity-50">
            <div className="mb-4 text-[11px] uppercase tracking-[0.14em] text-white/50">Used by strategy teams at</div>
            <div className="flex flex-wrap justify-center gap-10 text-sm font-semibold tracking-[-0.01em] text-white/70">
              <span>NORTHWIND</span>
              <span>· ACME CO ·</span>
              <span>HORIZON LABS</span>
              <span>· VANTA GROUP ·</span>
              <span>MIDWAY CAPITAL</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-white px-8 py-24">
        <div className="mx-auto max-w-[1080px]">
          <div className="mb-14 text-center">
            <div className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-brand-orange">
              THE METHODOLOGY
            </div>
            <h2 className="mb-3.5 text-[40px] font-semibold tracking-[-0.02em]">
              The proven methodology, made interactive
            </h2>
            <p className="mx-auto max-w-[580px] text-base text-muted-foreground">
              Schwartz&apos;s framework guided Shell through the 1970s oil shocks. Now it guides you — with AI as your
              analyst.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-[18px]">
            {FEATURES.map((f, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-7 shadow-card">
                <div className="mb-[18px] inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-brand-orangeLight text-brand-orange">
                  {f.icon}
                </div>
                <h3 className="mb-1.5 text-[17px] font-semibold tracking-[-0.01em]">{f.title}</h3>
                <p className="text-sm leading-[1.55] text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9 Steps */}
      <section id="method" className="bg-bg px-8 py-24">
        <div className="mx-auto max-w-[1080px]">
          <div className="mb-12 text-center">
            <h3 className="mb-3 text-[32px] font-semibold tracking-[-0.02em]">9 steps from question to strategy</h3>
            <p className="text-muted-foreground">The full Schwartz methodology, adapted for the AI era.</p>
          </div>
          <div className="grid grid-cols-3 gap-3.5">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-white px-5 py-[18px]">
                <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-orange font-mono text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product quote */}
      <section className="bg-white px-8 py-24">
        <div className="mx-auto max-w-[880px] text-center">
          <blockquote className="mb-7 text-[28px] font-normal italic leading-[1.4] tracking-[-0.015em] text-brand-dark [text-wrap:balance]">
            &quot;Scenarios are not predictions. They are stories about the future that help us make better decisions
            today.&quot;
          </blockquote>
          <div className="font-mono text-[13px] text-muted-foreground">— PETER SCHWARTZ</div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-dark px-8 py-20 text-white">
        <div className="mx-auto max-w-[720px] text-center">
          <h3 className="mb-7 text-[36px] font-semibold tracking-[-0.02em]">Ready to plan for any future?</h3>
          <Button variant="primary" size="lg" onClick={() => navigate("/signup")}>
            Start planning free <Icons.ArrowRight size={16} />
          </Button>
          <div className="mt-4 text-xs text-white/50">No credit card required</div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-brand-dark px-8 py-8 text-white/50">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Icons.Logo size={22} reverse />
            <span className="text-[13px]">© 2026 Scenaric.ai</span>
          </div>
          <div className="flex gap-[22px] text-[13px]">
            <a className="cursor-pointer">Privacy</a>
            <a className="cursor-pointer">Terms</a>
            <a className="cursor-pointer">Security</a>
            <a className="cursor-pointer">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
