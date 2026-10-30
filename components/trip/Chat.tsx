"use client";

import { ArrowUp, BellRing, Camera, Check, Paperclip, Sparkles, type LucideIcon } from "lucide-react";
import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { money } from "@/lib/format";
import { Avatar, BeeAvatar } from "./Avatar";
import { CategoryIcon } from "./CategoryIcon";
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
  const hydrated = useHydrated();
  // Pay buttons appear under the bee's latest settle-up message only.
  const lastSettleUpSeq = messages.findLast((m) => m.attachments?.some((a) => a.type === "settle_up"))?.seq;
  const echoed = pending && messages.some((m) => m.seq > pending.afterSeq && m.memberId === me.memberId);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pending]);

  // Suggestions for the next useful thing to ask the bee, shown as one-tap chips.
  const quickActions: { label: string; text: string; icon: LucideIcon }[] = [];
  if (!snapshot.budget.some((b) => b.budgetCents !== null) && snapshot.status === "active") {
    quickActions.push({ label: "Suggest a budget", text: "Suggest a budget for our trip", icon: Sparkles });
  }
  if (snapshot.status === "settling" && snapshot.settlements.some((s) => s.status !== "captured")) {
    quickActions.push({ label: "Remind who still owes", text: "Remind everyone who still has to pay", icon: BellRing });
  }

  // Posts a message and waits for the bee. Presets (quick actions) leave the composer alone.
  async function post(message: string, file: File | null) {
    if (pending || (!message.trim() && !file)) return;
    const body = new FormData();
    body.set("text", message);
    if (file) body.set("photo", file);
    setPending({ text: message, photoUrl: file ? URL.createObjectURL(file) : null, afterSeq: messages.at(-1)?.seq ?? 0 });
    setError(null);
    const res = await fetch(`/api/trips/${trip.publicId}/messages`, { method: "POST", body });
    if (res.status === 403 && trip.isDemo) {
      // A newer tour was started in this browser; the page sends us to it.
      setError("This browser has moved on to a newer demo tour. Taking you there…");
      setTimeout(() => window.location.reload(), 1500);
      return;
    }
    if (!res.ok) setError(await res.text());
    await onSent();
    setPending(null);
  }

  async function send(e: React.FormEvent | null, preset?: string) {
    e?.preventDefault();
    if (preset) return post(preset, null);
    const [message, file] = [text, photo];
    setText("");
    setPhoto(null);
    await post(message, file);
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-surface px-4 py-6">
        <div className="mx-auto flex max-w-[760px] flex-col">
          {messages.map((m, i) => (
            <Message
              key={m.seq}
              message={m}
              previous={messages[i - 1]}
              hydrated={hydrated}
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
                <Bubble mine author="You" startsGroup={!messages.length || messages.at(-1)!.memberId !== me.memberId}>
                  {pending.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pending.photoUrl} alt="Receipt" className="mb-2 max-h-48 rounded-lg" />
                  )}
                  {pending.text}
                </Bubble>
              )}
              <div className="mt-5 flex items-center gap-3 text-sm text-muted">
                <BeeAvatar size={36} />
                <span className="flex gap-1" aria-label="The bee is thinking">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="size-1.5 animate-pulse rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </span>
              </div>
            </>
          )}
          {error && <p className="text-sm text-negative">{error}</p>}
          <div ref={bottom} />
        </div>
      </div>

      <form onSubmit={send} className="border-t border-line bg-bg px-4 py-3">
        <div className="mx-auto max-w-[720px]">
        {quickActions.length > 0 && !pending && (
          <div className="mb-2 flex flex-wrap gap-2">
            {quickActions.map(({ label, text: preset, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => send(null, preset)}
                className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink hover:border-accent hover:text-accent"
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        )}
        {photo && (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-surface px-3 py-1.5 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <Paperclip size={14} /> {photo.name}
            </span>
            <button type="button" onClick={() => setPhoto(null)} className="ml-2 text-accent">
              Remove
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-label="Add receipt photo"
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
          >
            <Camera size={20} strokeWidth={1.75} />
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
            className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border border-line bg-surface px-4 py-2.5 text-[15px] outline-none placeholder:text-muted focus:border-accent focus:bg-bg"
          />
          <button
            aria-label="Send"
            disabled={!!pending || (!text.trim() && !photo)}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-bg transition disabled:opacity-30"
          >
            <ArrowUp size={20} />
          </button>
        </div>
        </div>
      </form>
    </>
  );
}

const GROUP_GAP_MS = 10 * 60_000;

// Times and day labels depend on the viewer's timezone, so they're drawn only in the browser.
function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function Message({
  message,
  previous,
  hydrated,
  mine,
  author,
  snapshot,
  trip,
  settleUp,
  showSettleUp,
  payShare,
}: {
  message: ChatMessage;
  previous?: ChatMessage;
  hydrated: boolean;
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
  const at = new Date(message.createdAt);
  const prevAt = previous ? new Date(previous.createdAt) : null;
  const newDay = hydrated && (!prevAt || prevAt.toDateString() !== at.toDateString());
  // Consecutive messages from one author within a few minutes share one header.
  const startsGroup = !previous || newDay || previous.memberId !== message.memberId || at.getTime() - prevAt!.getTime() > GROUP_GAP_MS;

  return (
    <>
      {newDay && (
        <div className="my-6 flex items-center gap-3 text-xs font-medium text-muted first:mt-0">
          <span className="h-px flex-1 bg-line" />
          {at.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
          <span className="h-px flex-1 bg-line" />
        </div>
      )}
      <Bubble
        mine={mine}
        agent={isAgent}
        startsGroup={startsGroup}
        author={mine ? "You" : isAgent ? "BeeQuits" : author}
        time={hydrated ? at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null}
        avatar={isAgent ? <BeeAvatar size={36} /> : <Avatar member={member} size={36} />}
      >
        {message.attachments?.map((a, i) =>
          a.type === "receipt" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={`/api/receipts/${a.receiptId}`} alt="Receipt" className="mb-2 max-h-48 rounded-xl" />
          ) : null,
        )}
        {message.attachments?.some((a) => a.type === "settlement") ? (
          <span className="flex items-start gap-1.5">
            <Check size={16} className="mt-1 shrink-0 text-positive" />
            <RichText text={message.content} />
          </span>
        ) : (
          <RichText text={message.content} />
        )}
        {message.attachments?.map((a, i) =>
          a.type === "expense" ? (
            <ExpenseCard key={i} expenseId={a.expenseId} snapshot={snapshot} trip={trip}>
              {payShare(a.expenseId)}
            </ExpenseCard>
          ) : null,
        )}
        {message.attachments?.map((a, i) => (a.type === "products" ? <ProductCards key={i} products={a.products} /> : null))}
        {showSettleUp && snapshot.settlements.length > 0 && <div className="mt-3 w-80 max-w-full">{settleUp}</div>}
      </Bubble>
    </>
  );
}

function Bubble({
  mine,
  agent,
  author,
  time,
  avatar,
  startsGroup,
  children,
}: {
  mine: boolean;
  agent?: boolean;
  author: string | null;
  time?: string | null;
  avatar?: React.ReactNode;
  startsGroup: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex w-full min-w-0 gap-3 ${mine ? "flex-row-reverse" : ""} ${startsGroup ? "mt-5 first:mt-0" : "mt-1.5"}`}>
      {/* Avatar column keeps grouped messages aligned under the first one. */}
      <div className={`shrink-0 ${mine ? "hidden sm:block sm:w-9" : "w-9"}`}>{startsGroup && !mine && avatar}</div>
      <div className={`flex min-w-0 max-w-[85%] flex-col sm:max-w-[78%] ${mine ? "items-end" : "items-start"}`}>
        {startsGroup && (
          <div className={`mb-1 flex items-center gap-2 px-1 text-xs ${mine ? "flex-row-reverse" : ""}`}>
            <span className="font-semibold text-ink">{author}</span>
            {agent && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">AI agent</span>}
            {time && <span className="text-muted">{time}</span>}
          </div>
        )}
        <div
          className={`min-w-0 max-w-full whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-[0_1px_2px_rgba(11,31,68,0.06)] ${
            mine
              ? "bg-ink text-bg"
              : agent
                ? "border border-line border-l-[3px] border-l-accent bg-bg"
                : "border border-line bg-bg"
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
    <div id={`expense-${e.id}`} className="mt-3 w-80 max-w-full scroll-mt-24 rounded-2xl border border-line bg-bg p-3 text-sm text-ink">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-ink">
          <CategoryIcon category={e.category} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{e.description}</p>
          <p className="truncate text-xs text-muted">
            {CATEGORY_LABEL[e.category] ?? e.category} · Paid by {name(e.paidBy)}
          </p>
        </div>
        <span className="tabular font-semibold">{money(e.amountCents, trip.currency)}</span>
      </div>
      <p className="mt-2 truncate text-xs text-muted">Split with {e.splitWith.map(name).join(", ")}</p>
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
        <div key={p.url} className="flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-line bg-bg text-ink">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" className="aspect-square w-full bg-white object-contain p-2" />
          ) : (
            <div className="aspect-square bg-surface" />
          )}
          <div className="flex flex-1 flex-col gap-1 p-2 text-xs">
            <p className="line-clamp-2 font-medium leading-tight">{p.title}</p>
            <p className="tabular text-sm font-semibold">
              {p.approxTripCurrency !== null ? `≈ €${p.approxTripCurrency.toFixed(0)}` : `${p.price} ${p.currency}`}
              {p.approxTripCurrency !== null && <span className="ml-1 font-sans text-[11px] font-normal text-muted">${p.price}</span>}
            </p>
            <p className="truncate text-muted">{p.merchant}</p>
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto rounded-full border border-line py-1 text-center font-medium text-accent hover:border-accent"
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
        {paid.length > 0 && <span className="font-medium text-positive">{paid.join(", ")} paid you back. </span>}
        {owing.length > 0 && `${owing.join(", ")} can pay their share right here, or at the final settle-up.`}
      </p>
    );
  }

  const share = e.shares[me.memberId];
  if (!share) return null;
  if (e.sharePaidBy.includes(me.memberId)) {
    return (
      <p className="mt-2 flex items-center gap-1 text-xs font-medium text-positive">
        <Check size={14} /> You paid your share ({money(share, trip.currency)})
      </p>
    );
  }
  if (!payer?.joined) {
    return <p className="mt-1.5 text-xs text-muted">You can pay {payer?.name ?? "them"} back once they join with PayPal.</p>;
  }
  return (
    <div className="mt-3 border-t border-line pt-3">
      <PayButton
        orderUrl={`/api/expenses/${expenseId}/pay-share`}
        label={`Your share is ${money(share, trip.currency)}. Pay ${payer.name} now, or at the final settle-up.`}
        trip={trip}
        clientId={paypalClientId}
        onPaid={onPaid}
      />
    </div>
  );
}
