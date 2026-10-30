"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";
import { Avatar, BeeAvatar } from "./Avatar";
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

  // Suggestions for the next useful thing to ask the bee, shown as one-tap chips.
  const quickActions = [
    !snapshot.budget.some((b) => b.budgetCents !== null) && snapshot.status === "active" && "💡 Suggest a budget for our trip",
    snapshot.status === "settling" &&
      snapshot.settlements.some((s) => s.status !== "captured") &&
      "🔔 Remind everyone who still has to pay",
  ].filter((a): a is string => !!a);

  async function send(e: React.FormEvent | null, preset?: string) {
    e?.preventDefault();
    const message = preset ?? text;
    if (pending || (!message.trim() && !photo)) return;
    const body = new FormData();
    body.set("text", message);
    if (photo && !preset) body.set("photo", photo);
    setPending({ text: message, photoUrl: photo && !preset ? URL.createObjectURL(photo) : null, afterSeq: messages.at(-1)?.seq ?? 0 });
    if (preset) {
      const res = await fetch(`/api/trips/${trip.publicId}/messages`, { method: "POST", body });
      if (!res.ok) setError(await res.text());
      await onSent();
      setPending(null);
      return;
    }
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
        {quickActions.length > 0 && !pending && (
          <div className="mb-2 flex flex-wrap gap-2">
            {quickActions.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => send(null, a.replace(/^\S+\s/, ""))}
                className="rounded-full border border-honey-strong bg-honey-soft px-3 py-1 text-xs font-medium hover:bg-honey"
              >
                {a}
              </button>
            ))}
          </div>
        )}
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
  const member = snapshot.members.find((m) => m.id === message.memberId);
  return (
    <Bubble
      mine={mine}
      agent={isAgent}
      author={mine ? null : isAgent ? "Bee" : author}
      avatar={mine ? null : isAgent ? <BeeAvatar /> : <Avatar member={member} />}
    >
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
  avatar,
  children,
}: {
  mine: boolean;
  agent?: boolean;
  author: string | null;
  avatar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex min-w-0 max-w-[88%] items-end gap-2 ${mine ? "self-end" : "self-start"}`}>
      {avatar}
      <div className={`flex min-w-0 flex-col ${mine ? "items-end" : "items-start"}`}>
        {author && <span className="mb-0.5 px-1 text-xs text-muted">{author}</span>}
        <div
          className={`min-w-0 max-w-full whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${
            mine ? "bg-ink text-paper" : agent ? "bg-honey-soft" : "border border-line bg-card"
          }`}
        >
          {children}
        </div>
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
  const e = snapshot.expenses.find((x) => x.id === expenseId);
  if (!e || snapshot.status !== "active") return null;
  const member = (id: string) => snapshot.members.find((m) => m.id === id);
  const payer = member(e.paidBy);

  // The payer sees who can pay them back right here.
  if (e.paidBy === me.memberId) {
    const owing = e.splitWith.filter((id) => id !== me.memberId && !e.sharePaidBy.includes(id)).map((id) => member(id)?.name);
    const paid = e.sharePaidBy.map((id) => member(id)?.name);
    if (!owing.length && !paid.length) return null;
    return (
      <p className="mt-1.5 text-xs text-muted">
        {paid.length > 0 && <span className="font-medium text-ok">✓ {paid.join(", ")} paid you back. </span>}
        {owing.length > 0 && `${owing.join(", ")} can pay their share right here, or at the final settle-up.`}
      </p>
    );
  }

  const share = e.shares[me.memberId];
  if (!share) return null;
  if (e.sharePaidBy.includes(me.memberId)) {
    return <p className="mt-1.5 text-xs font-medium text-ok">✓ You paid your share ({money(share, trip.currency)})</p>;
  }
  if (!payer?.joined) {
    return <p className="mt-1.5 text-xs text-muted">You can pay {payer?.name ?? "them"} back once they join with PayPal.</p>;
  }
  return (
    <div className="mt-2 border-t border-line pt-2">
      <PayButton
        orderUrl={`/api/expenses/${expenseId}/pay-share`}
        label={`Your share: ${money(share, trip.currency)} to ${payer.name}. Pay now, or leave it for the final settle-up.`}
        trip={trip}
        clientId={paypalClientId}
        onPaid={onPaid}
      />
    </div>
  );
}
