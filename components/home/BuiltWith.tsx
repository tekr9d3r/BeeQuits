import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const PARTNERS = [
  { key: "paypal", name: "PayPal", url: "https://www.paypal.com" },
  { key: "aggrid", name: "AG Grid", url: "https://www.ag-grid.com" },
  { key: "channel3", name: "Channel3", url: "https://trychannel3.com" },
  { key: "render", name: "Render", url: "https://render.com" },
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
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {PARTNERS.map((p) => {
        const logo = logoFile(p.key);
        return (
          <li key={p.key}>
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-24 items-center justify-center rounded-2xl border border-line px-6 transition hover:border-ink/20 hover:shadow-sm"
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={p.name} className="max-h-8 max-w-[130px] object-contain" />
              ) : (
                <span className="text-xl font-semibold tracking-tight">{p.name}</span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
