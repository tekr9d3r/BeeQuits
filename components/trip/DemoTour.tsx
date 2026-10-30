"use client";

import Link from "next/link";
import { useState } from "react";
import type { TripSnapshot } from "./types";

type Tour = NonNullable<TripSnapshot["tour"]>;
type Step = { key: keyof Tour; title: string; hint: string; action: string; run: () => void };

// The guided demo checklist. Steps tick themselves off from what actually happened in the trip.
export function DemoTour({
  tour,
  snapshot,
  busy,
  say,
  sendSampleReceipt,
  openInsights,
}: {
  tour: Tour;
  snapshot: TripSnapshot;
  busy: boolean;
  say: (text: string) => void;
  sendSampleReceipt: () => void;
  openInsights: () => void;
}) {
  const [open, setOpen] = useState(true);
  const drinks = snapshot.expenses.find((e) => e.description === "Après-ski round");

  const steps: Step[] = [
    {
      key: "logCost",
      title: "Log a cost by chatting",
      hint: "Type it like you'd tell a friend. The bee parses it into the ledger.",
      action: "Send “I paid 38€ for parking, split with everyone”",
      run: () => say("I paid 38€ for parking, split with everyone"),
    },
    {
      key: "receipt",
      title: "Snap a receipt",
      hint: "The bee reads the total from the photo. You can also use your own photo with 📷.",
      action: "📷 Send a sample bar receipt",
      run: sendSampleReceipt,
    },
    {
      key: "payShare",
      title: "Pay your share of the drinks",
      hint: "Emma paid the après-ski round. Pay her your €16 now with PayPal (sandbox login shown under the button).",
      action: "Show me the drinks",
      run: () => document.getElementById(`expense-${drinks?.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
    },
    {
      key: "gear",
      title: "Find new ski gear",
      hint: "The bee searches shops through Channel3 and shows product cards.",
      action: "Send “I need new ski goggles under 60€”",
      run: () => say("I need new ski goggles under 60€"),
    },
    {
      key: "insights",
      title: "Explore Insights",
      hint: "An AG Studio dashboard of the whole trip. Click a chart to cross-filter.",
      action: "Open Insights",
      run: openInsights,
    },
    {
      key: "closed",
      title: "Settle up and close the trip",
      hint: "The bee works out the fewest payments. Pay yours with PayPal; your friends' payments to each other are simulated.",
      action: "Send “Let's settle up”",
      run: () => say("The trip is over, let's settle up!"),
    },
  ];
  const done = steps.filter((s) => tour[s.key]).length;
  const current = steps.find((s) => !tour[s.key]);

  return (
    <section className="sticky top-0 z-10 -mx-4 -mt-4 mb-3 border-b border-honey-strong/40 bg-honey-soft/95 px-4 py-3 backdrop-blur">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-semibold">
          🎓 Demo tour · {done}/{steps.length}
          {!open && current && <span className="font-normal text-muted"> · next: {current.title}</span>}
        </span>
        <span className="text-xs text-muted">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <>
          {current ? (
            <ol className="mt-2 flex flex-col gap-1.5">
              {steps.map((s, i) => {
                const isCurrent = s === current;
                return (
                  <li key={s.key} className={`text-sm ${tour[s.key] ? "text-muted line-through" : ""} ${!isCurrent && !tour[s.key] ? "hidden sm:block" : ""}`}>
                    {tour[s.key] ? "✅" : isCurrent ? "👉" : "◻️"} {i + 1}. {s.title}
                    {isCurrent && (
                      <div className="mt-1 ml-6 flex flex-col items-start gap-1.5">
                        <span className="text-xs text-muted">{s.hint}</span>
                        <button
                          disabled={busy}
                          onClick={s.run}
                          className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper disabled:opacity-40"
                        >
                          {s.action}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="mt-2 text-sm">
              <p className="font-semibold">🎉 That&apos;s BeeQuits! Everyone is quits.</p>
              <p className="mt-1 text-muted">Chat to log costs, PayPal to pay each other directly, and the bee in between.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href="/demo" className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper">
                  Restart the tour
                </Link>
              </div>
            </div>
          )}
          {current && (
            <Link href="/demo" className="mt-2 inline-block text-xs text-muted underline">
              Restart the tour
            </Link>
          )}
        </>
      )}
    </section>
  );
}
