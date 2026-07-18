"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useEffect, useRef, useState } from "react";
import { shortAddress } from "@/lib/memory-passport";

export function SolanaWalletButton({ className = "" }: { className?: string }) {
  const { connected, connecting, disconnect, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const address = publicKey?.toBase58() ?? "";

  useEffect(() => {
    if (!menuOpen) return;

    function closeOnOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  if (!connected) {
    return (
      <button
        type="button"
        className={`atlas-wallet-button atlas-wallet-button-disconnected ${className}`}
        disabled={connecting}
        aria-busy={connecting}
        onClick={() => setVisible(true)}
      >
        {connecting ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div ref={menuRef} className={`atlas-wallet-menu ${className}`}>
      <button
        type="button"
        className="atlas-wallet-button atlas-wallet-button-connected"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="font-mono tabular-nums">{shortAddress(address)}</span>
      </button>

      {menuOpen ? (
        <div className="atlas-wallet-popover" role="menu">
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
          >
            My Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              disconnect();
            }}
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}
