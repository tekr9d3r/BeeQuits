import { BeeMark } from "@/components/Logo";
import { photoFor } from "@/lib/avatars";

// Hero illustration: four friends on a circle, with payments flowing between them.
const PEOPLE = [
  { key: "emma", name: "Emma", x: 210, y: 50 },
  { key: "sam", name: "Sam", x: 370, y: 210 },
  { key: "olivia", name: "Olivia", x: 210, y: 370 },
  { key: "you", name: "You", x: 50, y: 210 },
] as const;

// Curved paths between people (quadratic, bending toward the centre), with the amount shown on each.
const PAYMENTS = [
  { d: "M 82 186 Q 140 120 182 76", amount: "€16.00", chip: { x: 112, y: 112 }, dur: "3.2s" },
  { d: "M 236 342 Q 300 290 346 236", amount: "€546.18", chip: { x: 304, y: 304 }, dur: "3.8s" },
  { d: "M 340 182 Q 290 120 238 76", amount: "€80.94", chip: { x: 304, y: 112 }, dur: "3.5s" },
];

export function PaymentCircle() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px]" aria-hidden>
      <svg viewBox="0 0 420 420" className="absolute inset-0 h-full w-full">
        <circle cx="210" cy="210" r="160" fill="none" stroke="var(--line)" strokeDasharray="2 6" />
        {PAYMENTS.map((p, i) => (
          <g key={i}>
            <path id={`pay-${i}`} d={p.d} fill="none" stroke="var(--accent)" strokeOpacity="0.35" strokeWidth="1.5" />
            <circle r="4" fill="var(--accent)">
              <animateMotion dur={p.dur} repeatCount="indefinite" rotate="auto">
                <mpath href={`#pay-${i}`} />
              </animateMotion>
            </circle>
          </g>
        ))}
      </svg>

      <div className="absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-bg shadow-sm">
        <BeeMark size={36} />
      </div>

      {PEOPLE.map((p) => {
        const photo = p.key === "you" ? null : photoFor(p.key);
        return (
          <div
            key={p.key}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
            style={{ left: `${(p.x / 420) * 100}%`, top: `${(p.y / 420) * 100}%` }}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="size-16 rounded-full object-cover shadow-sm ring-4 ring-bg" />
            ) : (
              <span className="grid size-16 place-items-center rounded-full bg-surface text-lg font-semibold ring-4 ring-bg">
                {p.key === "you" ? "You" : p.name[0]}
              </span>
            )}
            <span className="text-xs font-medium text-muted">{p.name}</span>
          </div>
        );
      })}

      {PAYMENTS.map((p) => (
        <span
          key={p.amount}
          className="tabular absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-bg px-2.5 py-1 text-xs font-semibold shadow-sm"
          style={{ left: `${(p.chip.x / 420) * 100}%`, top: `${(p.chip.y / 420) * 100}%` }}
        >
          {p.amount}
        </span>
      ))}
    </div>
  );
}
