"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";
import { CATEGORY_LABEL, type ChatMessage, type Me, type TripInfo, type TripSnapshot } from "./types";

export function Chat({
  trip,
  me,
  messages,
  snapshot,
  onSent,
}: {
  trip: TripInfo;
  me: Me;
  messages: ChatMessage[];
  snapshot: TripSnapshot;
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
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <Message key={m.seq} message={m} mine={m.memberId === me.memberId} author={m.memberId ? nameOf(m.memberId) : null} snapshot={snapshot} trip={trip} />
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
}: {
  message: ChatMessage;
  mine: boolean;
  author: string | null;
  snapshot: TripSnapshot;
  trip: TripInfo;
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
        a.type === "expense" ? <ExpenseCard key={i} expenseId={a.expenseId} snapshot={snapshot} trip={trip} /> : null,
      )}
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
    <div className={`flex max-w-[85%] flex-col ${mine ? "self-end items-end" : "self-start items-start"}`}>
      {author && <span className="mb-0.5 px-1 text-xs text-muted">{agent ? "🐝 Bee" : author}</span>}
      <div
        className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${
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

function ExpenseCard({ expenseId, snapshot, trip }: { expenseId: string; snapshot: TripSnapshot; trip: TripInfo }) {
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
    </div>
  );
}
