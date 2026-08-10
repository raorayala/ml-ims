import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ML-IMS | Microbiology Laboratory Inventory",
  description:
    "Real-time reagent inventory, audit ledger, and automated reorder system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
