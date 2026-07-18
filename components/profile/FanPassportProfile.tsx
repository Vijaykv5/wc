"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMemo, useState } from "react";
import { getMintedMemories, shortAddress, type MintedMemory } from "@/lib/memory-passport";
import { SolanaWalletButton } from "@/components/wallet/SolanaWalletButton";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function FanPassportProfile() {
  const { connected, publicKey } = useWallet();
  const [copied, setCopied] = useState(false);
  const address = publicKey?.toBase58() ?? "";
  const memories = useMemo<MintedMemory[]>(() => (address ? getMintedMemories(address) : []), [address]);
  const countries = useMemo(() => Array.from(new Set(memories.map((memory) => memory.country))), [memories]);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-[#05070d] text-white">
      <div className="absolute inset-0 bg-[url('/textures/night-sky.png')] bg-cover bg-center opacity-70" aria-hidden="true" />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_24%_16%,rgba(247,183,51,0.16),transparent_22rem),radial-gradient(circle_at_80%_38%,rgba(124,58,237,0.18),transparent_24rem),linear-gradient(180deg,rgba(5,7,13,0.2),rgba(5,7,13,0.82))]"
        aria-hidden="true"
      />

      <header className="pointer-events-auto fixed inset-x-0 top-0 z-30">
        <nav className="mx-auto flex min-h-16 w-full max-w-[92rem] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/atlas"
            className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 backdrop-blur-md transition-colors duration-100 hover:bg-white/[0.06] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b4fe] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070d]"
          >
            <span className="atlas-logo-mark" aria-hidden="true" />
            <span className="text-base font-black lowercase tracking-tight text-white">atlas</span>
          </Link>
          <SolanaWalletButton />
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-6xl gap-5 px-4 pb-10 pt-24 sm:px-6 lg:px-8">
        {!connected ? (
          <div className="mx-auto grid w-full max-w-[30rem] gap-5 rounded-2xl border border-white/12 bg-[#05070d]/78 p-5 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
            <div className="grid gap-2">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/46">Fan Passport</p>
              <h1 className="text-3xl font-black tracking-tight text-white">Connect your wallet</h1>
              <p className="mx-auto max-w-[22rem] text-sm font-bold leading-6 text-white/56">
                Your minted Atlas memories are tied to the wallet that created them.
              </p>
            </div>
            <div className="mx-auto">
              <SolanaWalletButton />
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 rounded-2xl border border-white/12 bg-[#05070d]/78 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl md:grid-cols-[1.35fr_0.65fr]">
              <div className="grid gap-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f7b733]">Fan Passport</p>
                    <h1 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">Atlas Memory Holder</h1>
                  </div>
                  <span className="rounded-full border border-[#f7b733]/35 bg-[#f7b733]/12 px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.16em] text-[#f7b733]">
                    Devnet
                  </span>
                </div>

                <div className="grid gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/44">Wallet</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={copyAddress}
                      className="min-h-11 rounded-full bg-white px-4 py-2 font-mono text-sm font-black tabular-nums text-black transition-colors duration-100 hover:bg-white/88 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                      {copied ? "Copied" : shortAddress(address)}
                    </button>
                    <a
                      href={`https://explorer.solana.com/address/${address}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-11 rounded-full border border-white/12 bg-white/[0.045] px-4 py-2 text-sm font-black text-white transition-colors duration-100 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                      Explorer
                    </a>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-2xl font-black tabular-nums text-white">{memories.length}</p>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-white/42">Memories</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-2xl font-black tabular-nums text-white">{countries.length}</p>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-white/42">Countries</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-2xl font-black tabular-nums text-white">{memories.length ? "Live" : "New"}</p>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-white/42">Status</p>
                </div>
              </div>
            </section>

            <section className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/52">Minted Memories</h2>
                <Link
                  href="/create/memory"
                  className="min-h-10 rounded-full bg-[#f7b733] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-black transition-colors duration-100 hover:bg-[#fcd34d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Mint Memory
                </Link>
              </div>

              {memories.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {memories.map((memory) => (
                    <article key={memory.asset} className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d14]/80 backdrop-blur-xl">
                      <div className="aspect-[4/3] bg-white/[0.04]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={memory.imageUri} alt={memory.title} className="h-full w-full object-cover" loading="lazy" />
                      </div>
                      <div className="grid gap-3 p-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f7b733]">{memory.country}</p>
                          <h3 className="mt-1 line-clamp-2 text-xl font-black text-white">{memory.title}</h3>
                        </div>
                        <p className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-white/50">
                          {memory.note || `${memory.name} minted this Atlas fan memory.`}
                        </p>
                        <div className="flex items-center justify-between gap-3 text-xs font-bold text-white/38">
                          <span>{formatDate(memory.mintedAt)}</span>
                          <span className="font-mono tabular-nums">{shortAddress(memory.asset, 3)}</span>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={memory.coreExplorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="min-h-10 flex-1 rounded-full bg-white px-3 py-2 text-center text-xs font-black uppercase tracking-[0.14em] text-black transition-colors duration-100 hover:bg-white/88 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                          >
                            NFT
                          </a>
                          <a
                            href={memory.explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="min-h-10 flex-1 rounded-full border border-white/12 bg-white/[0.045] px-3 py-2 text-center text-xs font-black uppercase tracking-[0.14em] text-white transition-colors duration-100 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                          >
                            Tx
                          </a>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 rounded-2xl border border-white/12 bg-[#05070d]/72 p-5 text-center backdrop-blur-xl">
                  <p className="text-xl font-black text-white">No memories minted yet</p>
                  <p className="mx-auto max-w-[28rem] text-sm font-bold leading-6 text-white/52">
                    Mint your first country celebration and it will appear here as your fan passport proof.
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
