import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DontCrossMe — Orchid Breeding Coordinator",
  description:
    "Coordinate a decentralized orchid breeding program: culture tips, cross-viability, and interventions that learn over time.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
