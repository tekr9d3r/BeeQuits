import { ArrowRight, Code } from "lucide-react";
import Link from "next/link";
import { BuiltWith } from "@/components/home/BuiltWith";
import { PaymentCircle } from "@/components/home/PaymentCircle";
import { Logo } from "@/components/Logo";

const REPO = "https://github.com/tekr9d3r/BeeQuits";

// For the hackathon the site is demo-only: every visitor gets a private guided trip.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <Link href="/demo" className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-bg hover:bg-ink/90">
            Try the live demo
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <h1 className="text-[40px] font-semibold leading-[1.08] tracking-tight sm:text-[56px]">
              Agent for your next trip.
              <span className="block text-muted">It tracks, budgets and settles up with PayPal.</span>
            </h1>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 font-semibold text-bg hover:bg-ink/90"
              >
                Try the live demo <ArrowRight size={18} />
              </Link>
              <span className="text-sm text-muted">No sign-up · PayPal sandbox</span>
            </div>
          </div>
          <PaymentCircle />
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <p className="text-center text-sm font-medium text-muted">Built for the PayPal AI Hackathon with</p>
            <div className="mt-6">
              <BuiltWith />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 BeeQuits · Sandbox demo, no real money moves</span>
          <a href={REPO} className="inline-flex items-center gap-1.5 hover:text-ink">
            <Code size={16} /> Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
