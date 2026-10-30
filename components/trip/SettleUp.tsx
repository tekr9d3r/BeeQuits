"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { money } from "@/lib/format";
import { Avatar } from "./Avatar";
import type { Me, TripInfo, TripSnapshot } from "./types";

type PayPalButtons = (options: {
  style?: Record<string, string | number | boolean>;
  createOrder: () => Promise<string>;
  onApprove: () => Promise<void>;
  onError?: (err: unknown) => void;
}) => { render: (el: HTMLElement) => Promise<void>; close: () => Promise<void> };

declare global {
  interface Window {
    paypal?: { Buttons: PayPalButtons };
  }
}

let sdkPromise: Promise<void> | null = null;
function loadPayPal(clientId: string, currency: string) {
  sdkPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}&intent=capture&components=buttons`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PayPal failed to load"));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

// The settle-up transfers. The signed-in debtor gets a PayPal button per open transfer.
export function SettleUp({
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
  const member = (id: string) => snapshot.members.find((m) => m.id === id);
  const name = (id: string) => member(id)?.name ?? "?";
  const paid = snapshot.settlements.filter((s) => s.status === "captured").length;
  return (
    <div className="flex flex-col">
      <p className="mb-2 text-xs text-muted">
        {paid} of {snapshot.settlements.length} paid · each payment goes straight to your friend&apos;s PayPal
      </p>
      {snapshot.settlements.map((s) => {
        const done = s.status === "captured";
        const mine = s.from === me.memberId;
        return (
          <div key={s.id} className={`border-b border-line py-3 last:border-0 ${mine && !done ? "-mx-3 rounded-2xl border-0 bg-accent-soft px-3" : ""}`}>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex -space-x-2">
                <Avatar member={member(s.from)} size={28} ring />
                <Avatar member={member(s.to)} size={28} ring />
              </div>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{mine ? "You" : name(s.from)}</span>
                <span className="text-muted"> pay{mine ? "" : "s"} </span>
                <span className="font-medium">{s.to === me.memberId ? "you" : name(s.to)}</span>
              </span>
              <span className="tabular font-semibold">{money(s.amountCents, trip.currency)}</span>
            </div>
            {done ? (
              <p className="mt-1 flex items-center gap-1 pl-[68px] text-xs font-medium text-positive">
                <Check size={14} /> Paid
              </p>
            ) : mine ? (
              <PayButton
                orderUrl={`/api/settlements/${s.id}/order`}
                label={`Pay ${name(s.to)}`}
                trip={trip}
                clientId={paypalClientId}
                onPaid={onPaid}
              />
            ) : (
              <div className="mt-1 flex items-center justify-between pl-[68px] text-xs text-muted">
                <span>Waiting for {name(s.from)} to pay</span>
                {s.to === me.memberId && (
                  <NudgeButton
                    trip={trip}
                    text={`Can you remind ${name(s.from)} to pay me ${money(s.amountCents, trip.currency)}?`}
                    onSent={onPaid}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Demo only: the PayPal sandbox account to use in the checkout popup.
function SandboxLogin({ email, password }: { email: string; password: string }) {
  return (
    <div className="mt-2 rounded-xl border border-line bg-bg px-3 py-2 text-[11px] text-muted">
      <span className="font-medium text-ink">PayPal sandbox login for this demo</span>
      <CopyRow label="Email" value={email} />
      <CopyRow label="Password" value={password} />
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate">
        {label}: <span className="tabular text-ink">{value}</span>
      </span>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="shrink-0 font-semibold text-ink underline"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

// Asks the bee (through the chat) to remind one person; the bee writes the reminder.
function NudgeButton({ trip, text, onSent }: { trip: TripInfo; text: string; onSent: () => Promise<void> }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  if (state === "sent") return <span className="font-medium text-positive">Reminder sent</span>;
  return (
    <button
      disabled={state === "sending"}
      onClick={async () => {
        setState("sending");
        const body = new FormData();
        body.set("text", text);
        await fetch(`/api/trips/${trip.publicId}/messages`, { method: "POST", body });
        await onSent();
        setState("sent");
      }}
      className="font-medium text-accent hover:underline disabled:opacity-50"
    >
      {state === "sending" ? "Sending…" : "Remind"}
    </button>
  );
}

// A PayPal button for one transfer. orderUrl creates the order and returns which settlement it pays.
export function PayButton({
  orderUrl,
  label,
  trip,
  clientId,
  onPaid,
}: {
  orderUrl: string;
  label?: string;
  trip: TripInfo;
  clientId: string;
  onPaid: () => Promise<void>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "capturing">("loading");
  const [visible, setVisible] = useState(false);

  // PayPal buttons are iframes; only create them once the card scrolls into view.
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let buttons: ReturnType<PayPalButtons> | null = null;
    let cancelled = false;
    let settlementId: string | null = null;
    loadPayPal(clientId, trip.currency)
      .then(() => {
        if (cancelled || !container.current || !window.paypal) return;
        buttons = window.paypal.Buttons({
          style: { layout: "horizontal", color: "gold", shape: "pill", label: "pay", height: 40, tagline: false },
          createOrder: async () => {
            setError(null);
            const res = await fetch(orderUrl, { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
              setError(data.error ?? "Could not start the payment");
              throw new Error(data.error);
            }
            settlementId = data.settlementId;
            return data.orderId;
          },
          onApprove: async () => {
            setState("capturing");
            const res = await fetch(`/api/settlements/${settlementId}/capture`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) setError(data.error ?? "Payment failed");
            await onPaid();
            setState("ready");
          },
          onError: (err) => setError((prev) => prev ?? (err instanceof Error && err.message ? err.message : "PayPal error, please try again")),
        });
        return buttons.render(container.current).then(() => setState("ready"));
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
      buttons?.close().catch(() => {});
    };
  }, [visible, orderUrl, clientId, trip.currency, onPaid]);

  return (
    <div className="mt-2">
      {label && <p className="mb-1 text-xs font-medium">{label}</p>}
      {state === "loading" && <p className="text-xs text-muted">Loading PayPal…</p>}
      {state === "capturing" && <p className="text-xs text-muted">Confirming payment…</p>}
      <div ref={container} className={`min-h-10 ${state === "capturing" ? "hidden" : ""}`} />
      {error && <p className="mt-1 text-xs text-negative">{error}</p>}
      {trip.demoBuyer && <SandboxLogin {...trip.demoBuyer} />}
    </div>
  );
}
