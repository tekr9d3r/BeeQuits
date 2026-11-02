import { Info, MessageCircle, UserPlus, Wallet } from "lucide-react";
import { notFound } from "next/navigation";
import { DemoStartForm } from "@/components/DemoStartForm";
import { ChatPreview } from "@/components/home/ChatPreview";
import { Logo } from "@/components/Logo";
import { photoFor } from "@/lib/avatars";
import { DEMO_FRIENDS } from "@/lib/demo";

const STEPS = [
  { icon: UserPlus, title: "Join the trip", text: "You get your own copy of the trip, with three friends already in it." },
  { icon: MessageCircle, title: "Chat with the agent", text: "Tell it what you paid, ask for a budget or for new ski gear." },
  { icon: Wallet, title: "Settle with PayPal", text: "Pay friends back for single costs, or settle everything at the end." },
];

export default function DemoStart() {
  if (process.env.DEMO_MODE !== "true") notFound();
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5">
          <Logo />
        </div>
      </header>

      <div className="border-b border-line bg-accent-soft">
        <p className="mx-auto flex max-w-5xl items-start gap-2 px-5 py-3 text-sm text-ink">
          <Info size={16} className="mt-0.5 shrink-0 text-accent" />
          <span>
            This demo is set up for <strong className="font-semibold">PayPal AI Hackathon judges</strong>. Everything runs on the PayPal
            sandbox, so no real money moves.
          </span>
        </p>
      </div>

      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-12 px-5 py-12 lg:grid-cols-[1fr_400px] lg:py-16">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">A ski week with three friends</h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted">
            You&apos;re in Sölden with Emma, Sam and Olivia. They&apos;ve already paid for the chalet, lift passes and a few dinners. Use
            the BeeQuits agent to add your own costs, pay your friends back with PayPal and settle up at the end.
          </p>

          <DemoStartForm>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">What should your friends call you?</span>
              <input
                name="name"
                defaultValue="Alex"
                maxLength={30}
                className="rounded-xl border border-line px-4 py-3 text-[15px] outline-none focus:border-accent"
              />
            </label>

            <div>
              <span className="text-sm font-medium">Your friends on this trip</span>
              <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
                {DEMO_FRIENDS.map((f) => {
                  const photo = photoFor(f.key);
                  return (
                    <li key={f.key} className="flex items-center gap-3 px-4 py-3">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" className="size-10 rounded-full object-cover" />
                      ) : (
                        <span className="grid size-10 place-items-center rounded-full bg-surface text-sm font-semibold">{f.name[0]}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium">{f.name}</p>
                        <p className="truncate text-xs text-muted">Test PayPal account · {f.email}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">PayPal sandbox</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Each friend has a PayPal sandbox account, so when you pay them in the demo, a real test payment lands in their account.
              </p>
            </div>
          </DemoStartForm>
        </div>

        <aside className="h-fit rounded-3xl border border-line p-6">
          <h2 className="font-semibold">How it works</h2>
          <ol className="mt-5 flex flex-col gap-5">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-ink">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-[15px] font-medium">
                    {i + 1}. {title}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mb-3 mt-7 text-xs font-medium text-muted">A taste of the chat</p>
          <ChatPreview friendPhoto={photoFor("emma")} />
        </aside>
      </main>
    </div>
  );
}
