import { Check } from "lucide-react";
import { BeeMark } from "@/components/Logo";

// A three-message preview of what the demo is about; the messages appear one after another.
export function ChatPreview({ friendPhoto }: { friendPhoto: string | null }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4 text-sm">
      <div className="pop-in ml-auto max-w-[85%] rounded-2xl bg-ink px-3.5 py-2 text-bg" style={{ animationDelay: "0.4s" }}>
        I paid 38€ for parking, split with everyone
      </div>
      <div className="pop-in flex max-w-[90%] items-start gap-2" style={{ animationDelay: "1.4s" }}>
        <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-bg">
          <BeeMark size={16} />
        </span>
        <span className="rounded-2xl border border-line border-l-[3px] border-l-accent bg-bg px-3.5 py-2">
          Logged €38.00 for parking, split 4 ways (€9.50 each).
        </span>
      </div>
      <div className="pop-in flex max-w-[90%] items-start gap-2" style={{ animationDelay: "2.6s" }}>
        {friendPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={friendPhoto} alt="" className="size-7 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="size-7 shrink-0 rounded-full bg-line" />
        )}
        <span className="flex items-center gap-1.5 rounded-2xl border border-line bg-bg px-3.5 py-2">
          <Check size={15} className="text-positive" /> Emma paid you €9.50 with PayPal
        </span>
      </div>
    </div>
  );
}
