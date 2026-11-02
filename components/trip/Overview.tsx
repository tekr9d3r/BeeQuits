"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { money } from "@/lib/format";
import { Avatar } from "./Avatar";
import { CategoryIcon } from "./CategoryIcon";
import { SettleUp } from "./SettleUp";
import { CATEGORY_LABEL, type Me, type TripInfo, type TripSnapshot } from "./types";

// The money side of the trip, laid out like a wallet: your balance first, then everyone, then budget.
export function Overview({
  trip,
  me,
  snapshot,
  paypalClientId,
  onPaid,
}: {
  trip: TripInfo;
  me: Me;
  snapshot: TripSnapshot;
  paypalClientId: string;
  onPaid: () => Promise<void>;
}) {
  const fmt = (c: number) => money(c, trip.currency);
  const mine = snapshot.members.find((m) => m.id === me.memberId);
  const net = mine?.netCents ?? 0;
  const people = snapshot.members.filter((m) => m.status === "active" || m.netCents !== 0);
  const budgeted = snapshot.budget.filter((b) => b.budgetCents !== null);

  return (
    <div className="flex flex-col px-5 py-6 lg:px-6">
      <p className="text-sm text-muted">{snapshot.status === "closed" ? "Trip settled" : net < 0 ? "You owe" : net > 0 ? "You're owed" : "You're all square"}</p>
      <p className={`tabular mt-1 text-[34px] font-semibold leading-none tracking-tight ${net < 0 ? "text-ink" : net > 0 ? "text-positive" : "text-ink"}`}>
        {fmt(Math.abs(net))}
      </p>
      <p className="mt-2 text-sm text-muted">
        The group has spent <span className="tabular font-medium text-ink">{fmt(snapshot.totalCents)}</span> so far.
      </p>

      {snapshot.status === "active" && snapshot.transfers.length > 0 && <SettleButton trip={trip} onDone={onPaid} />}

      {snapshot.settlements.length > 0 && (
        <Section title={snapshot.status === "closed" ? "Settled" : "Settle up"}>
          <SettleUp trip={trip} me={me} snapshot={snapshot} paypalClientId={paypalClientId} onPaid={onPaid} />
        </Section>
      )}

      <Section title="Balances">
        <ul className="flex flex-col">
          {people.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <Avatar member={m} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">
                  {m.name}
                  {m.id === me.memberId && <span className="font-normal text-muted"> (you)</span>}
                </p>
                <p className="tabular text-xs text-muted">
                  Paid {fmt(m.paidCents)} · Share {fmt(m.shareCents)}
                </p>
              </div>
              <span className={`tabular text-[15px] font-medium ${m.netCents < 0 ? "text-negative" : m.netCents > 0 ? "text-positive" : "text-muted"}`}>
                {m.netCents > 0 ? "+" : m.netCents < 0 ? "−" : ""}
                {fmt(Math.abs(m.netCents))}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Budget">
        {budgeted.length === 0 ? (
          <p className="text-sm text-muted">No budget yet. Ask the bee to suggest one in the chat.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {budgeted.map((b) => {
              const over = b.spentCents > b.budgetCents!;
              const pct = Math.min(100, (b.spentCents / b.budgetCents!) * 100);
              return (
                <li key={b.category}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted">
                      <CategoryIcon category={b.category} />
                    </span>
                    <span className="flex-1">{CATEGORY_LABEL[b.category] ?? b.category}</span>
                    <span className={`tabular ${over ? "font-medium text-negative" : "text-muted"}`}>
                      {fmt(b.spentCents)} <span className="text-muted">/ {fmt(b.budgetCents!)}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
                    <div className={`h-full rounded-full ${over ? "bg-negative" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {trip.demoBuyer && (
        <Section title="Sandbox account for judges">
          <p className="text-sm leading-relaxed text-muted">
            When the PayPal window opens, log in with this test account. It&apos;s PayPal sandbox money, nothing real is charged.
          </p>
          <div className="mt-3 divide-y divide-line rounded-2xl border border-line">
            <CopyField label="Email" value={trip.demoBuyer.email} />
            <CopyField label="Password" value={trip.demoBuyer.password} />
          </div>
        </Section>
      )}
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
          copied ? "border-positive text-positive" : "border-line text-ink hover:border-accent hover:text-accent"
        }`}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-line pt-5">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {children}
    </section>
  );
}

// Asks the bee to settle up (through the chat, so the transfers and Pay buttons show there too).
function SettleButton({ trip, onDone }: { trip: TripInfo; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (!confirm("Settle up now? The bee works out who pays whom and locks the ledger.")) return;
        setBusy(true);
        const body = new FormData();
        body.set("text", "The trip is over, let's settle up!");
        await fetch(`/api/trips/${trip.publicId}/messages`, { method: "POST", body });
        await onDone();
        setBusy(false);
      }}
      className="mt-6 w-full rounded-full bg-ink px-6 py-3.5 text-[15px] font-semibold text-bg transition hover:bg-ink/90 disabled:opacity-60"
    >
      {busy ? "Working out the payments…" : "Settle up"}
    </button>
  );
}
