"use client";

import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";
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
  const name = (id: string) => snapshot.members.find((m) => m.id === id)?.name ?? "?";
  const paid = snapshot.settlements.filter((s) => s.status === "captured").length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">
        {paid} of {snapshot.settlements.length} paid · each payment goes straight to your friend&apos;s PayPal
      </p>
      {snapshot.settlements.map((s) => {
        const done = s.status === "captured";
        const mine = s.from === me.memberId;
        return (
          <div key={s.id} className={`rounded-xl border px-3 py-2 text-sm ${done ? "border-ok/30 bg-ok/5" : mine ? "border-honey-strong bg-honey-soft" : "border-line bg-paper"}`}>
            <div className="flex items-center justify-between gap-3">
              <span>
                {mine ? "You" : <strong>{name(s.from)}</strong>} → <strong>{s.to === me.memberId ? "you" : name(s.to)}</strong>
              </span>
              <span className="font-mono font-semibold">{money(s.amountCents, trip.currency)}</span>
            </div>
            {done ? (
              <p className="mt-0.5 text-xs font-medium text-ok">✓ Paid via PayPal</p>
            ) : mine ? (
              <PayButton
                orderUrl={`/api/settlements/${s.id}/order`}
                label={`Pay ${name(s.to)}`}
                trip={trip}
                clientId={paypalClientId}
                onPaid={onPaid}
              />
            ) : (
              <p className="mt-0.5 text-xs text-muted">Waiting for {name(s.from)} to pay</p>
            )}
          </div>
        );
      })}
    </div>
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

  useEffect(() => {
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
  }, [orderUrl, clientId, trip.currency, onPaid]);

  return (
    <div className="mt-2">
      {label && <p className="mb-1 text-xs font-medium">{label}</p>}
      {state === "loading" && <p className="text-xs text-muted">Loading PayPal…</p>}
      {state === "capturing" && <p className="text-xs text-muted">Confirming payment…</p>}
      <div ref={container} className={state === "capturing" ? "hidden" : ""} />
      {error && <p className="mt-1 text-xs text-warn">{error}</p>}
    </div>
  );
}
