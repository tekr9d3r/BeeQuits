import { headers } from "next/headers";
import QRCode from "qrcode";

export async function inviteLink(publicId: string, inviteCode: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}/t/${publicId}/join?code=${inviteCode}`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: "#1b1a17", light: "#ffffff" } });
  return { url, qr };
}
