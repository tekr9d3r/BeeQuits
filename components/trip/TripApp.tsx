"use client";

import { ChartColumn, MessageCircle, RotateCcw, Wallet, type LucideIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { Avatar } from "./Avatar";
import { Chat } from "./Chat";
import { Overview } from "./Overview";
import { PeopleSheet } from "./PeopleSheet";
import type { ChatMessage, Me, TripInfo, TripSnapshot } from "./types";

const POLL_MS = 2500;
type Tab = "chat" | "overview" | "insights";

// AG Studio is heavy and browser-only, so it loads when Insights is first opened.
const Insights = dynamic(() => import("./Insights"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted">Loading insights…</p>,
});

export function TripApp(props: {
  trip: TripInfo;
  me: Me;
  invite: { url: string; qr: string };
  paypalClientId: string;
  initialMessages: ChatMessage[];
  initialSnapshot: TripSnapshot;
}) {
  const { me } = props;
  const [trip, setTrip] = useState(props.trip);
  const [messages, setMessages] = useState(props.initialMessages);
  const [snapshot, setSnapshot] = useState(props.initialSnapshot);
  const [tab, setTab] = useState<Tab>("chat");
  const [peopleOpen, setPeopleOpen] = useState(false);
  const lastSeq = useRef(props.initialMessages.at(-1)?.seq ?? 0);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/trips/${trip.publicId}/feed?after=${lastSeq.current}`, { cache: "no-store" });
    if (!res.ok) return;
    const data: { messages: ChatMessage[]; snapshot: TripSnapshot; locked: boolean } = await res.json();
    if (data.messages.length) {
      lastSeq.current = data.messages.at(-1)!.seq;
      setMessages((prev) => [...prev, ...data.messages.filter((m) => m.seq > (prev.at(-1)?.seq ?? 0))]);
    }
    setSnapshot(data.snapshot);
    setTrip((t) => (t.locked === data.locked ? t : { ...t, locked: data.locked }));
  }, [trip.publicId]);

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const myName = snapshot.members.find((m) => m.id === me.memberId)?.name ?? "You";
  const active = snapshot.members.filter((m) => m.status === "active");

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line px-4 lg:px-6">
        <div className="hidden lg:block">
          <Logo />
        </div>
        <div className="min-w-0 flex-1 lg:flex-none lg:border-l lg:border-line lg:pl-4">
          <p className="truncate text-[15px] font-semibold leading-tight">{trip.name}</p>
          <p className="truncate text-xs text-muted">
            {tripDates(trip)}
            {trip.locked && " · Settling up"}
          </p>
        </div>

        <div className="mx-auto hidden rounded-full bg-surface p-1 lg:flex">
          {(
            [
              ["chat", "Trip"],
              ["insights", "Insights"],
            ] as const
          ).map(([t, label]) => {
            const selected = (tab === "insights") === (t === "insights");
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-5 py-1.5 text-sm font-medium transition ${selected ? "bg-bg text-ink shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <button onClick={() => setPeopleOpen(true)} className="flex shrink-0 items-center -space-x-2" aria-label="People in this trip">
          {active.slice(0, 4).map((m) => (
            <Avatar key={m.id} member={m} size={30} ring />
          ))}
        </button>
        {trip.isDemo && (
          <a href="/demo" className="hidden shrink-0 items-center gap-1 text-xs text-muted hover:text-ink sm:flex" title="Start the demo over">
            <RotateCcw size={14} /> Restart demo
          </a>
        )}
      </header>

      <main className="min-h-0 flex-1">
        {tab === "insights" ? (
          <div className="h-full overflow-y-auto bg-surface lg:p-6">
            <div className="mx-auto h-full max-w-6xl">
              <Insights snapshot={snapshot} publicId={trip.publicId} />
            </div>
          </div>
        ) : (
          <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]">
            <section className={`min-h-0 flex-col ${tab === "chat" ? "flex" : "hidden"} lg:flex`}>
              <Chat trip={trip} me={me} messages={messages} snapshot={snapshot} paypalClientId={props.paypalClientId} onSent={refresh} />
            </section>
            <aside className={`min-h-0 overflow-y-auto border-line lg:block lg:border-l ${tab === "overview" ? "block" : "hidden"}`}>
              <Overview trip={trip} me={me} snapshot={snapshot} paypalClientId={props.paypalClientId} onPaid={refresh} />
            </aside>
          </div>
        )}
      </main>

      <nav className="grid shrink-0 grid-cols-3 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden">
        <TabButton icon={MessageCircle} label="Chat" active={tab === "chat"} onClick={() => setTab("chat")} />
        <TabButton icon={Wallet} label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
        <TabButton icon={ChartColumn} label="Insights" active={tab === "insights"} onClick={() => setTab("insights")} />
      </nav>

      {peopleOpen && (
        <PeopleSheet
          trip={trip}
          me={me}
          myName={myName}
          invite={props.invite}
          snapshot={snapshot}
          onChange={refresh}
          onClose={() => setPeopleOpen(false)}
        />
      )}
    </div>
  );
}

function TabButton({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}>
      <Icon size={22} strokeWidth={active ? 2 : 1.75} />
      {label}
    </button>
  );
}

function tripDates(trip: TripInfo) {
  if (!trip.startDate || !trip.endDate) return "Group trip";
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(trip.startDate)} – ${fmt(trip.endDate)}`;
}
