import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Absolute base for the share image URLs.
  metadataBase: new URL(process.env.SITE_URL ?? "https://beequits.onrender.com"),
  title: "BeeQuits",
  description: "Agent for your next trip. It tracks, budgets and settles up with PayPal.",
  openGraph: { title: "BeeQuits", description: "Agent for your next trip. It tracks, budgets and settles up with PayPal.", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
