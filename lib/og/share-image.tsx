import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { OgBee } from "./bee";

export const shareImageSize = { width: 1200, height: 630 };
export const shareImageAlt = "BeeQuits: Agent for your next trip. It tracks, budgets and settles up with PayPal.";

const NAVY = "#0b1f44";
const MUTED = "#5b6475";
const ACCENT = "#0070e0";

async function dataUrl(file: string, type: string) {
  return `data:${type};base64,${(await readFile(join(process.cwd(), file))).toString("base64")}`;
}

// The social share card: logo, the pitch, and the demo friends settling up.
export async function shareImage() {
  const [medium, bold, emma, sam, olivia] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Inter-500.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Inter-700.ttf")),
    dataUrl("public/people/emma.jpg", "image/jpeg"),
    dataUrl("public/people/sam.jpg", "image/jpeg"),
    dataUrl("public/people/olivia.jpg", "image/jpeg"),
  ]);

  const chip = (text: string) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 20px",
        borderRadius: 999,
        border: "1px solid #e6e9ef",
        background: "#ffffff",
        fontSize: 24,
        color: NAVY,
        boxShadow: "0 4px 14px rgba(11,31,68,0.08)",
      }}
    >
      <div style={{ width: 12, height: 12, borderRadius: 999, background: "#0a7a46" }} />
      {text}
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#ffffff", fontFamily: "Inter", padding: 72 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 720 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 700, color: NAVY }}>
            <OgBee size={48} ink={NAVY} paper="#ffffff" />
            BeeQuits
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 62, fontWeight: 700, color: NAVY, lineHeight: 1.05, letterSpacing: -2 }}>Agent for your next trip.</div>
            <div style={{ fontSize: 40, fontWeight: 500, color: MUTED, lineHeight: 1.25, marginTop: 18, maxWidth: 560 }}>
              It tracks, budgets and settles up with PayPal.
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: ACCENT, fontWeight: 500 }}>Live demo · PayPal AI Hackathon 2026</div>
        </div>

        <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
          <div style={{ display: "flex" }}>
            {[emma, sam, olivia].map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                width={120}
                height={120}
                style={{ borderRadius: 999, border: "6px solid #ffffff", marginLeft: i ? -30 : 0, objectFit: "cover" }}
                alt=""
              />
            ))}
          </div>
          {chip("Alex paid Emma €16.00")}
          {chip("Everyone is quits")}
        </div>
      </div>
    ),
    {
      ...shareImageSize,
      fonts: [
        { name: "Inter", data: medium, weight: 500, style: "normal" },
        { name: "Inter", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
