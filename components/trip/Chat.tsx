"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";
import { PayButton, SettleUp } from "./SettleUp";
import type { ProductCard as ProductCardData } from "@/lib/db/schema";
import { CATEGORY_LABEL, type ChatMessage, type Me, type TripInfo, type TripSnapshot } from "./types";

export function Chat({
  trip,
  me,
  messages,
  snapshot,
  paypalClientId,
  onSent,
}: {
  trip: TripInfo;
  me: Me;
  messages: ChatMessage[];
  snapshot: TripSnapshot;
  paypalClientId: string;
  onSent: () => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  // The optimistic bubble shown while the bee works. afterSeq lets us hide it once polling
  // brings back the saved copy, so the message never shows twice.
  const [pending, setPending] = useState<{ text: string; photoUrl: string | null; afterSeq: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const nameOf = (id: string) => snapshot.members.find((m) => m.id === id)?.name ?? "Someone";
  // Pay buttons appear under the bee's latest settle-up message only.
  const lastSettleUpSeq = messages.findLast((m) => m.attachments?.some((a) => a.type === "settle_up"))?.seq;
  const echoed = pending && messages.some((m) => m.seq > pending.afterSeq && m.memberId === me.memberId);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (pending || (!text.trim() && !photo)) return;
    const body = new FormData();
    body.set("text", text);
    if (photo) body.set("photo", photo);
    setPending({ text, photoUrl: photo ? URL.createObjectURL(photo) : null, afterSeq: messages.at(-1)?.seq ?? 0 });
    setText("");
    setPhoto(null);
    setError(null);
    const res = await fetch(`/api/trips/${trip.publicId}/messages`, { method: "POST", body });
    if (!res.ok) setError(await res.text());
    await onSent();
    setPending(null);
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <Message
              key={m.seq}
              message={m}
              mine={m.memberId === me.memberId}
              author={m.memberId ? nameOf(m.memberId) : null}
              snapshot={snapshot}
              trip={trip}
              settleUp={<SettleUp trip={trip} me={me} snapshot={snapshot} paypalClientId={paypalClientId} onPaid={onSent} />}
              payShare={(expenseId) => (
                <PayShare expenseId={expenseId} trip={trip} me={me} snapshot={snapshot} paypalClientId={paypalClientId} onPaid={onSent} />
              )}
              showSettleUp={m.seq === lastSettleUpSeq}
            />
          ))}
          {pending && (
            <>
              {!echoed && (
                <Bubble mine author={null}>
                  {pending.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pending.photoUrl} alt="Receipt" className="mb-2 max-h-48 rounded-lg" />
                  )}
                  {pending.text}
                </Bubble>
              )}
              <div className="flex items-center gap-2 text-sm text-muted">
                <span className="animate-bounce">🐝</span> reading…
              </div>
            </>
          )}
          {error && <p className="text-sm text-warn">{error}</p>}
          <div ref={bottom} />
        </div>
      </div>

      <form onSubmit={send} className="border-t border-line bg-card p-3">
        {photo && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-honey-soft px-3 py-1.5 text-sm">
            <span className="truncate">📎 {photo.name}</span>
            <button type="button" onClick={() => setPhoto(null)} className="ml-2 font-semibold">
              Remove
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-label="Add receipt photo"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-line text-lg hover:bg-honey-soft"
          >
            📷
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) send(e);
            }}
            rows={1}
            placeholder='e.g. "Paid 96€ at Spar, everyone except Sam"'
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-paper px-4 py-2.5 outline-none focus:border-honey-strong"
          />
          <button
            disabled={!!pending || (!text.trim() && !photo)}
            className="h-11 shrink-0 rounded-full bg-ink px-5 font-semibold text-paper disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </>
  );
}

function Message({
  message,
  mine,
  author,
  snapshot,
  trip,
  settleUp,
  showSettleUp,
  payShare,
}: {
  message: ChatMessage;
  mine: boolean;
  author: string | null;
  snapshot: TripSnapshot;
  trip: TripInfo;
  settleUp: React.ReactNode;
  showSettleUp: boolean;
  payShare: (expenseId: string) => React.ReactNode;
}) {
  const isAgent = message.memberId === null;
  return (
    <Bubble mine={mine} agent={isAgent} author={mine ? null : isAgent ? "Bee" : author}>
      {message.attachments?.map((a, i) =>
        a.type === "receipt" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={`/api/receipts/${a.receiptId}`} alt="Receipt" className="mb-2 max-h-48 rounded-lg" />
        ) : null,
      )}
      <RichText text={message.content} />
      {message.attachments?.map((a, i) =>
        a.type === "expense" ? (
          <ExpenseCard key={i} expenseId={a.expenseId} snapshot={snapshot} trip={trip}>
            {payShare(a.expenseId)}
          </ExpenseCard>
        ) : null,
      )}
      {message.attachments?.map((a, i) =>
        a.type === "products" ? <ProductCards key={i} products={a.products} /> : null,
      )}
      {showSettleUp && snapshot.settlements.length > 0 && <div className="mt-2 w-72 max-w-full">{settleUp}</div>}
    </Bubble>
  );
}

function Bubble({
  mine,
  agent,
  author,
  children,
}: {
  mine: boolean;
  agent?: boolean;
  author: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex min-w-0 max-w-[85%] flex-col ${mine ? "self-end items-end" : "self-start items-start"}`}>
      {author && <span className="mb-0.5 px-1 text-xs text-muted">{agent ? "🐝 Bee" : author}</span>}
      <div
        className={`min-w-0 max-w-full whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${
          mine ? "bg-ink text-paper" : agent ? "bg-honey-soft" : "border border-line bg-card"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

// Supports the bits of markdown the agent uses: **bold** and "- " bullets.
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part.replace(/^- /gm, "• ")}</Fragment>,
      )}
    </>
  );
}

function ExpenseCard({
  expenseId,
  snapshot,
  trip,
  children,
}: {
  expenseId: string;
  snapshot: TripSnapshot;
  trip: TripInfo;
  children?: React.ReactNode;
}) {
  const e = snapshot.expenses.find((x) => x.id === expenseId);
  if (!e) return null;
  const name = (id: string) => snapshot.members.find((m) => m.id === id)?.name ?? "?";
  return (
    <div className="mt-2 rounded-xl border border-line bg-card px-3 py-2 text-sm">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-medium">{e.description}</span>
        <span className="font-mono font-semibold">{money(e.amountCents, trip.currency)}</span>
      </div>
      <div className="mt-0.5 text-xs text-muted">
        {CATEGORY_LABEL[e.category] ?? e.category} · paid by {name(e.paidBy)} · split {e.splitWith.map(name).join(", ")}
      </div>
      {children}
    </div>
  );
}

// Channel3 results. Prices come from US shops, so the trip-currency value is approximate.
// The row scrolls sideways on its own; max-w-full keeps it from widening the bubble or the page.
function ProductCards({ products }: { products: ProductCardData[] }) {
  return (
    <div className="mt-2 flex w-full max-w-full snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1">
      {products.map((p) => (
        <div key={p.url} className="flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-line bg-card">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" className="aspect-square w-full bg-white object-contain p-2" />
          ) : (
            <div className="grid aspect-square place-items-center text-3xl">🛍️</div>
          )}
          <div className="flex flex-1 flex-col gap-1 p-2 text-xs">
            <p className="line-clamp-2 font-medium leading-tight">{p.title}</p>
            <p className="font-mono text-sm font-semibold">
              {p.approxTripCurrency !== null ? `≈ €${p.approxTripCurrency.toFixed(0)}` : `${p.price} ${p.currency}`}
              {p.approxTripCurrency !== null && <span className="ml-1 font-sans text-[11px] font-normal text-muted">${p.price}</span>}
            </p>
            <p className="truncate text-muted">{p.merchant}</p>
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto rounded-full border border-ink py-1 text-center font-semibold hover:bg-honey-soft"
            >
              View
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

// Lets a member pay their part of one expense right away, straight to whoever paid it.
// Whatever isn't paid early stays in their balance for the final settle-up.
function PayShare({
  expenseId,
  trip,
  me,
  snapshot,
  paypalClientId,
  onPaid,
}: {
  expenseId: string;
  trip: TripInfo;
  me: Me;
  snapshot: TripSnapshot;
  paypalClientId: string;
  onPaid: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const e = snapshot.expenses.find((x) => x.id === expenseId);
  const share = e?.shares[me.memberId];
  if (!e || !share || e.paidBy === me.memberId) return null;
  const payer = snapshot.members.find((m) => m.id === e.paidBy);

  if (e.sharePaidBy.includes(me.memberId)) {
    return <p className="mt-1.5 text-xs font-medium text-ok">✓ You paid your share ({money(share, trip.currency)})</p>;
  }
  if (snapshot.status !== "active" || !payer?.joined) return null;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 rounded-full bg-honey px-3 py-1 text-xs font-semibold hover:bg-honey-strong">
        Pay my share now · {money(share, trip.currency)}
      </button>
    );
  }
  return (
    <div className="mt-2 border-t border-line pt-2">
      <PayButton
        orderUrl={`/api/expenses/${expenseId}/pay-share`}
        label={`Pay ${payer.name} ${money(share, trip.currency)}, or leave it for the final settle-up`}
        trip={trip}
        clientId={paypalClientId}
        onPaid={onPaid}
      />
    </div>
  );
}
