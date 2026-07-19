import type { Metadata } from "next";
import { SolanaWalletProvider } from "@/components/wallet/SolanaWalletProvider";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "FANIQ | Live World Cup Fan Energy",
  description: "Explore a living football globe where countries glow with fan reactions, predictions, chants, and match-room energy.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SolanaWalletProvider>{children}</SolanaWalletProvider>
      </body>
    </html>
  );
}
