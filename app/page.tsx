import Link from "next/link";
import { Logo } from "@/components/Logo";
import { payPalUser } from "@/lib/auth";

// Reads the session cookie, so it renders per request.
export const instant = false;

export default async function Home() {
  const user = await payPalUser();
  const startHref = user ? "/new" : "/api/auth/paypal/login?next=/new";
  const demo = process.env.DEMO_MODE === "true";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <Logo />
        {user && <span className="text-sm text-muted">Hi, {user.name.split(" ")[0]}</span>}
      </header>

      <section className="flex flex-1 flex-col justify-center py-16">
        <p className="mb-4 inline-flex w-fit rounded-full bg-honey-soft px-3 py-1 text-sm font-medium">Group trips, minus the awkward money talk</p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          Chat what you paid.
          <br />
          <span className="bg-honey px-2">Be quits</span> with PayPal.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Tell the money bee &ldquo;Paid 96€ at Spar, everyone except Sam&rdquo; or snap a receipt. It keeps the shared ledger and
          budget, then settles everyone up with direct PayPal payments between friends. Money never touches the app.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href={startHref} className="rounded-full bg-ink px-6 py-3 text-center font-semibold text-paper hover:opacity-90">
            Start a trip
          </Link>
          {demo && (
            <Link href="/demo" className="rounded-full border-2 border-ink px-6 py-3 text-center font-semibold hover:bg-honey-soft">
              Try the demo ski trip
            </Link>
          )}
        </div>
      </section>

      <section className="grid gap-4 pb-10 sm:grid-cols-3">
        {[
          ["💬", "Chat it", "Messy messages and receipt photos become a clean ledger. The bee asks when something is unclear."],
          ["📊", "Track it", "Live balances and spend vs budget, with a heads-up before the group overspends."],
          ["🤝", "Settle it", "Minimal transfers, each a direct PayPal payment to the friend you owe."],
        ].map(([icon, title, text]) => (
          <div key={title} className="rounded-2xl border border-line bg-card p-5">
            <div className="text-2xl">{icon}</div>
            <h2 className="mt-2 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
