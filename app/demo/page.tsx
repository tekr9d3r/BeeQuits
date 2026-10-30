import { notFound } from "next/navigation";
import { startDemoTour } from "@/app/actions";
import { Logo } from "@/components/Logo";
import { DEMO_FRIENDS } from "@/lib/demo";

const STEPS = [
  "Log a cost by chatting, and snap a receipt",
  "Pay your share of the drinks with PayPal",
  "Ask the bee for new ski gear",
  "Explore the Insights dashboard",
  "Settle up and close the trip",
];

export default function DemoStart() {
  if (process.env.DEMO_MODE !== "true") notFound();
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <Logo />
      <p className="mt-10 inline-flex rounded-full bg-honey-soft px-3 py-1 text-sm font-medium">Guided demo · about 5 minutes</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Your ski week in Sölden 🎿</h1>
      <p className="mt-2 text-muted">
        You&apos;re organizing a ski week with three friends. They&apos;ve already logged a few days of expenses. You get your own
        private copy of the trip, and every payment is a real PayPal <strong>sandbox</strong> payment, so no real money moves.
      </p>

      <form action={startDemoTour} className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Your name</span>
          <input name="name" defaultValue="Alex" maxLength={30} className="rounded-xl border border-line bg-card px-4 py-3 outline-none focus:border-honey-strong" />
        </label>

        <div>
          <span className="text-sm font-medium">Invite your friends</span>
          <ul className="mt-1.5 divide-y divide-line rounded-xl border border-line bg-card">
            {DEMO_FRIENDS.map((f) => (
              <li key={f.key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="font-medium">{f.name}</span>
                <span className="truncate text-xs text-muted">{f.email}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted">In a real trip you share an invite link and friends join with PayPal.</p>
        </div>

        <button className="rounded-full bg-ink px-6 py-3 font-semibold text-paper hover:opacity-90">Invite friends &amp; open the trip</button>
      </form>

      <div className="mt-10">
        <p className="text-sm font-medium">What you&apos;ll try</p>
        <ol className="mt-2 flex flex-col gap-1.5 text-sm text-muted">
          {STEPS.map((s, i) => (
            <li key={s}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
