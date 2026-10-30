import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const PARTNERS = [
  { key: "paypal", name: "PayPal", role: "Payments, login & webhooks" },
  { key: "aggrid", name: "AG Grid", role: "AG Studio insights" },
  { key: "channel3", name: "Channel3", role: "Product search" },
];

// Partner logos from public/logos/<key>.<ext>; falls back to the name until the file is added.
function logoFile(key: string) {
  const dir = path.join(process.cwd(), "public/logos");
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir).find((f) => f.startsWith(key + "."));
  return file ? `/logos/${file}` : null;
}

export function BuiltWith() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {PARTNERS.map((p) => {
        const logo = logoFile(p.key);
        return (
          <li key={p.key} className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line px-6 py-6 text-center">
            <div className="flex h-10 items-center">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={p.name} className="max-h-9 max-w-[140px] object-contain grayscale transition hover:grayscale-0" />
              ) : (
                <span className="text-xl font-semibold tracking-tight">{p.name}</span>
              )}
            </div>
            <span className="text-xs text-muted">{p.role}</span>
          </li>
        );
      })}
    </ul>
  );
}
