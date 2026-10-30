import { Check } from "lucide-react";
import { notFound } from "next/navigation";
import { DemoStartForm } from "@/components/DemoStartForm";
import { Logo } from "@/components/Logo";
import { photoFor } from "@/lib/avatars";
import { DEMO_FRIENDS } from "@/lib/demo";

const STEPS = [
  "Log a cost by chatting with the bee",
  "Pay your share of the drinks with PayPal",
  "Ask for new ski gear ideas",
  "Explore the Insights dashboard",
  "Settle up and close the trip",
];

export default function DemoStart() {
  if (process.env.DEMO_MODE !== "true") notFound();
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5">
          <Logo />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-12 px-5 py-12 lg:grid-cols-[1fr_380px] lg:py-20">
        <div>
          <p className="text-sm font-semibold text-accent">Live demo · about 5 minutes</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Your ski week in Sölden</h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted">
            You&apos;re organizing a ski week with three friends who have already logged the first days. You get your own private copy
            of the trip. Every payment is a real PayPal <span className="font-medium text-ink">sandbox</span> payment, so no real money
            moves.
          </p>

          <DemoStartForm>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Your name</span>
              <input
                name="name"
                defaultValue="Alex"
                maxLength={30}
                className="rounded-xl border border-line px-4 py-3 text-[15px] outline-none focus:border-accent"
              />
            </label>

            <div>
              <span className="text-sm font-medium">Your friends</span>
              <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
                {DEMO_FRIENDS.map((f) => {
                  const photo = photoFor(f.key);
                  return (
                    <li key={f.key} className="flex items-center gap-3 px-4 py-3">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" className="size-9 rounded-full object-cover" />
                      ) : (
                        <span className="grid size-9 place-items-center rounded-full bg-surface text-sm font-semibold">{f.name[0]}</span>
                      )}
                      <span className="flex-1 text-[15px] font-medium">{f.name}</span>
                      <span className="hidden truncate text-xs text-muted sm:block">{f.email}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </DemoStartForm>
        </div>

        <aside className="h-fit rounded-3xl bg-surface p-6">
          <h2 className="font-semibold">What you&apos;ll try</h2>
          <ol className="mt-4 flex flex-col gap-3">
            {STEPS.map((s, i) => (
              <li key={s} className="flex gap-3 text-[15px]">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-bg text-xs font-semibold">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <p className="mt-6 flex items-start gap-2 text-sm text-muted">
            <Check size={16} className="mt-0.5 shrink-0 text-positive" />
            The PayPal sandbox login for checkout is shown right under each Pay button.
          </p>
        </aside>
      </main>
    </div>
  );
}
