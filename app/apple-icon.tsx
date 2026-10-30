import { ImageResponse } from "next/og";
import { OgBee } from "@/lib/og/bee";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Home-screen icon: the bee mark in white on navy (iOS rounds the corners itself).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b1f44" }}>
        <OgBee size={128} ink="#ffffff" paper="#0b1f44" />
      </div>
    ),
    size,
  );
}
