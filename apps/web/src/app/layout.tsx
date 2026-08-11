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
    // Extensions (e.g. Grammarly) may inject attributes onto html/body before hydrate.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
