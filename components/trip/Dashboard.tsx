"use client";

import { money } from "@/lib/format";
import { Avatar } from "./Avatar";
import { useState } from "react";
import { SettleUp } from "./SettleUp";
import { CATEGORY_LABEL, type Me, type TripInfo, type TripSnapshot } from "./types";

// First version: plain components. AG Grid / AG Studio widgets replace parts of this in Phase 3.
export function Dashboard({
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
  const name = (id: string) => snapshot.members.find((m) => m.id === id)?.name ?? "?";
  const mine = snapshot.members.find((m) => m.id === me.memberId);
  const active = snapshot.members.filter((m) => m.status === "active" || m.netCents !== 0);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-0">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Group spent" value={fmt(snapshot.totalCents)} />
        <Stat
          label={mine && mine.netCents < 0 ? "You owe" : "You're owed"}
          value={fmt(Math.abs(mine?.netCents ?? 0))}
          tone={mine && mine.netCents < 0 ? "warn" : "ok"}
        />
      </div>

      {snapshot.status === "active" && snapshot.transfers.length > 0 && <SettleButton trip={trip} onDone={onPaid} />}

      <Card title="Balances">
        <ul className="divide-y divide-line">
          {active.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <Avatar member={m} size={28} />
              <span className="flex-1">
                {m.name}
                {m.id === me.memberId && <span className="text-muted"> (you)</span>}
                <span className="block text-xs text-muted">
                  paid {fmt(m.paidCents)} · share {fmt(m.shareCents)}
                </span>
              </span>
              <span className={`font-mono font-semibold ${m.netCents < 0 ? "text-warn" : m.netCents > 0 ? "text-ok" : "text-muted"}`}>
                {m.netCents > 0 ? "+" : ""}
                {fmt(m.netCents)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={snapshot.status === "closed" ? "Settled 🎉" : "Settle up"}>
        {snapshot.settlements.length > 0 ? (
          <SettleUp trip={trip} me={me} snapshot={snapshot} paypalClientId={paypalClientId} onPaid={onPaid} />
        ) : snapshot.transfers.length === 0 ? (
          <p className="text-sm text-muted">Everyone is quits. 🐝</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {snapshot.transfers.map((t, i) => (
              <li key={i} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${t.from === me.memberId ? "bg-honey-soft" : "bg-paper"}`}>
                <span>
                  <strong>{name(t.from)}</strong> → <strong>{name(t.to)}</strong>
                </span>
                <span className="font-mono font-semibold">{fmt(t.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
        {snapshot.settlements.length === 0 && (
          <p className="mt-3 text-xs text-muted">Say &ldquo;let&apos;s settle&rdquo; in the chat when the trip is over. Payments go directly between you on PayPal.</p>
        )}
      </Card>

      <Card title="Budget">
        {snapshot.budget.length === 0 ? (
          <p className="text-sm text-muted">No budget yet. Ask the bee to set one, e.g. &ldquo;budget 250 for food&rdquo;.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {snapshot.budget.map((b) => {
              const pct = b.budgetCents ? Math.min(100, (b.spentCents / b.budgetCents) * 100) : 0;
              const over = b.budgetCents !== null && b.spentCents > b.budgetCents;
              return (
                <li key={b.category} className="text-sm">
                  <div className="flex justify-between">
                    <span>{CATEGORY_LABEL[b.category] ?? b.category}</span>
                    <span className={`font-mono ${over ? "font-semibold text-warn" : "text-muted"}`}>
                      {fmt(b.spentCents)}
                      {b.budgetCents !== null && ` / ${fmt(b.budgetCents)}`}
                    </span>
                  </div>
                  {b.budgetCents !== null && (
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                      <div className={`h-full rounded-full ${over ? "bg-warn" : "bg-honey"}`} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
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
      className="flex items-center justify-center gap-2 rounded-2xl bg-honey px-5 py-4 text-lg font-bold shadow-sm hover:bg-honey-strong disabled:opacity-60"
    >
      {busy ? "🐝 Working out the payments…" : "🤝 Settle up & close the trip"}
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 font-mono text-xl font-bold ${tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : ""}`}>{value}</div>
    </div>
  );
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {children}
    </section>
  );
}
