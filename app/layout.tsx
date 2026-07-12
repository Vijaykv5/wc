import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Whispo | Live Fan Raids",
  description: "A country-first TxLINE soccer feed demo for live match signals and raid receipts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
