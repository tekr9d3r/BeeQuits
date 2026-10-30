import { ArrowRight, ChartColumn, Code, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { BuiltWith } from "@/components/home/BuiltWith";
import { PaymentCircle } from "@/components/home/PaymentCircle";
import { Logo } from "@/components/Logo";

const REPO = "https://github.com/tekr9d3r/BeeQuits";

const STEPS = [
  {
    icon: MessageCircle,
    title: "Chat it",
    text: "Type “Paid 96€ at Spar, everyone except Sam” or snap a receipt. The AI turns it into a clean shared ledger and asks when something is unclear.",
  },
  {
    icon: ChartColumn,
    title: "Track it",
    text: "Live balances, spend against the group budget, and a heads-up before a category runs over.",
  },
  {
    icon: ShieldCheck,
    title: "Settle it",
    text: "The fewest possible payments, each one sent directly from friend to friend with PayPal. Pay your share right away or at the end.",
  },
];

// For the hackathon the site is demo-only: every visitor gets a private guided trip.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <Link href="/demo" className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-bg hover:bg-ink/90">
            Try the live demo
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="text-sm font-semibold text-accent">Group trips, without the awkward money talk</p>
            <h1 className="mt-4 text-[40px] font-semibold leading-[1.08] tracking-tight sm:text-[56px]">
              Split trip costs in a chat. Settle up with PayPal.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
              BeeQuits is an AI money assistant for your group. It keeps the shared ledger and budget from plain chat messages, then
              everyone pays each other back directly with PayPal. The app never holds your money.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 font-semibold text-bg hover:bg-ink/90"
              >
                Try the live demo <ArrowRight size={18} />
              </Link>
              <span className="text-sm text-muted">No sign-up · PayPal sandbox · about 5 minutes</span>
            </div>
          </div>
          <PaymentCircle />
        </section>

        {/* How it works */}
        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl bg-bg p-6">
                  <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent">
                    <Icon size={22} strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI vs code */}
        <section className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">AI where it helps, code where it counts</h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Claude reads messy messages and receipt photos, asks when a split is unclear, suggests budgets, finds gear and reminds
            people to pay. The money math is plain, tested code: balances and the minimal set of transfers are computed
            deterministically. And money only ever moves on PayPal, directly between friends.
          </p>
        </section>

        {/* Hackathon */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-accent">PayPal AI Hackathon 2026</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">Built to explore what agentic payments can feel like</h2>
              <p className="mt-5 text-lg leading-relaxed text-muted">
                BeeQuits was built for the PayPal AI Hackathon to see how far an AI agent can take everyday group money: from a chat
                message to a real, direct PayPal payment between friends. Everything here runs on the PayPal sandbox, so try anything.
              </p>
            </div>
            <p className="mt-12 text-xs font-semibold uppercase tracking-wider text-muted">Built with</p>
            <div className="mt-4">
              <BuiltWith />
            </div>
            <p className="mt-4 text-sm text-muted">Plus Claude by Anthropic for the AI, and Render for hosting.</p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-ink">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-14 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-bg">See it in five minutes</h2>
              <p className="mt-1 text-bg/70">Your own private ski trip with three friends. Log costs, pay with PayPal, settle up.</p>
            </div>
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-full bg-bg px-6 py-3 font-semibold text-ink hover:bg-bg/90">
              Try the live demo <ArrowRight size={18} />
            </Link>
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
