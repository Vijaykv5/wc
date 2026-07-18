"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useMemo, useState } from "react";
import { COUNTRY_COORDS, getCountryFlag, resolveAtlasCountrySearch } from "@/lib/atlas-globe-data";
import {
  fetchFanPassport,
  fetchMintedMemories,
  getFanPassport,
  getMintedMemories,
  persistFanPassport,
  saveFanPassport,
  shortAddress,
  type FanPassport,
  type MintedMemory,
} from "@/lib/memory-passport";
import { SolanaWalletButton } from "@/components/wallet/SolanaWalletButton";

const COUNTRY_OPTIONS = Object.keys(COUNTRY_COORDS);
const WORLD_CUP_BIRTH_DATE = "Jun 11, 2026";
const WORLD_CUP_EXPIRY_DATE = "Jul 19, 2026";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function passportNumber(address: string) {
  return `WC-${address.slice(0, 3).toUpperCase()}-${address.slice(-5).toUpperCase()}`;
}

function field(label: string, value: string, className = "") {
  return (
    <div className={className}>
      <p className="text-[0.63rem] font-black uppercase tracking-[0.16em] text-[#f7b733]/70">{label}</p>
      <p className="mt-0.5 break-words text-sm font-black leading-5 text-white">{value}</p>
    </div>
  );
}

function CountryChooser({
  address,
  onChoose,
}: {
  address: string;
  onChoose: (country: string) => void;
}) {
  const [countryIndex, setCountryIndex] = useState(0);
  const [query, setQuery] = useState("");
  const selectedCountry = COUNTRY_OPTIONS[countryIndex] ?? COUNTRY_OPTIONS[0];
  const matches = useMemo(() => {
    const cleaned = query.trim().toLowerCase();
    if (!cleaned) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter((country) => country.toLowerCase().includes(cleaned));
  }, [query]);

  function moveCountry(direction: -1 | 1) {
    setCountryIndex((index) => (index + direction + COUNTRY_OPTIONS.length) % COUNTRY_OPTIONS.length);
  }

  function chooseCountry(country: string) {
    const resolved = resolveAtlasCountrySearch(country) ?? country;
    const index = COUNTRY_OPTIONS.indexOf(resolved);
    if (index >= 0) setCountryIndex(index);
    setQuery("");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/82 px-4 py-8 backdrop-blur-md">
      <section className="grid w-full max-w-[32rem] gap-4 rounded-[1.5rem] border border-[#f7b733]/28 bg-[#08090f] p-5 shadow-2xl shadow-black/70">
        <div className="grid gap-2 text-center">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f7b733]">World Cup Passport</p>
          <h2 className="text-3xl font-black tracking-tight text-white">Choose your country</h2>
          <p className="mx-auto max-w-[24rem] text-sm font-bold leading-6 text-white/52">
            Pick the country you support. Your passport will use that flag as your fan identity.
          </p>
        </div>

        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white/46">Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Argentina"
            className="min-h-11 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-white outline-none placeholder:text-white/28 focus-visible:ring-2 focus-visible:ring-[#f7b733]"
          />
        </label>

        {query.trim() ? (
          <div className="grid max-h-40 gap-2 overflow-auto rounded-xl border border-white/10 bg-white/[0.035] p-2">
            {matches.length ? (
              matches.map((country) => (
                <button
                  key={country}
                  type="button"
                  onClick={() => chooseCountry(country)}
                  className="flex min-h-10 items-center justify-between rounded-lg px-3 text-left text-sm font-black text-white transition-colors duration-100 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733]"
                >
                  <span>{country}</span>
                  <span aria-hidden="true">{getCountryFlag(country)}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm font-bold text-white/46">No matching country.</p>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[1.25rem] border border-[#f7b733]/18 bg-[#f7b733]/8 p-3">
          <button
            type="button"
            aria-label="Previous country"
            onClick={() => moveCountry(-1)}
            className="grid min-h-11 min-w-11 place-items-center rounded-full border border-white/10 text-xl font-black text-white transition-colors duration-100 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733]"
          >
            ‹
          </button>
          <div className="grid place-items-center gap-2 text-center">
            <div className="grid h-28 w-28 place-items-center rounded-2xl border border-[#f7b733]/30 bg-[#f8f1dc] text-6xl shadow-lg shadow-black/30" aria-hidden="true">
              {getCountryFlag(selectedCountry)}
            </div>
            <p className="text-2xl font-black uppercase tracking-[0.08em] text-white">{selectedCountry}</p>
          </div>
          <button
            type="button"
            aria-label="Next country"
            onClick={() => moveCountry(1)}
            className="grid min-h-11 min-w-11 place-items-center rounded-full border border-white/10 text-xl font-black text-white transition-colors duration-100 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733]"
          >
            ›
          </button>
        </div>

        <button
          type="button"
          onClick={() => onChoose(selectedCountry)}
          className="min-h-12 rounded-full bg-[#f7b733] px-5 text-sm font-black uppercase tracking-[0.18em] text-black transition-colors duration-100 hover:bg-[#fcd34d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          Stamp My Passport
        </button>
        <p className="text-center font-mono text-xs font-bold text-white/34">{shortAddress(address)}</p>
      </section>
    </div>
  );
}

export function FanPassportProfile() {
  const { connected, publicKey } = useWallet();
  const [copied, setCopied] = useState(false);
  const [choosingCountry, setChoosingCountry] = useState(false);
  const [passport, setPassport] = useState<FanPassport | null>(null);
  const [memories, setMemories] = useState<MintedMemory[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [memorySource, setMemorySource] = useState("local");
  const address = publicKey?.toBase58() ?? "";
  const memoryCountries = useMemo(() => Array.from(new Set(memories.map((memory) => memory.country))), [memories]);
  const country = passport?.country ?? "Argentina";
  const flag = getCountryFlag(country);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (!alive) return;

      if (!address) {
        setPassport(null);
        setMemories([]);
        return;
      }

      const localPassport = getFanPassport(address);
      const localMemories = getMintedMemories(address);
      setPassport(localPassport);
      setMemories(localMemories);
      setLoadingProfile(true);
      setLoadingMemories(true);

      void fetchFanPassport(address)
        .then((profile) => {
          if (alive) setPassport(profile);
        })
        .catch(() => {
          if (alive) setPassport(localPassport);
        })
        .finally(() => {
          if (alive) setLoadingProfile(false);
        });

      void fetchMintedMemories(address)
        .then((payload) => {
          if (!alive) return;
          setMemories(payload.memories.length ? payload.memories : localMemories);
          setMemorySource(payload.source);
        })
        .catch(() => {
          if (!alive) return;
          setMemories(localMemories);
          setMemorySource("local");
        })
        .finally(() => {
          if (alive) setLoadingMemories(false);
        });
    })();

    return () => {
      alive = false;
    };
  }, [address]);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function saveCountry(countryName: string) {
    const nextPassport = {
      owner: address,
      country: countryName,
      createdAt: new Date().toISOString(),
    };
    setPassport(nextPassport);
    saveFanPassport(nextPassport);
    void persistFanPassport(nextPassport)
      .then(setPassport)
      .catch(() => undefined);
    setChoosingCountry(false);
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-[#05070d] text-white">
      <div className="absolute inset-0 bg-[url('/textures/night-sky.png')] bg-cover bg-center opacity-70" aria-hidden="true" />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_24%_16%,rgba(247,183,51,0.16),transparent_22rem),radial-gradient(circle_at_80%_38%,rgba(236,72,153,0.16),transparent_24rem),linear-gradient(180deg,rgba(5,7,13,0.2),rgba(5,7,13,0.86))]"
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
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/46">World Cup Passport</p>
              <h1 className="text-3xl font-black tracking-tight text-white">Connect your wallet</h1>
              <p className="mx-auto max-w-[22rem] text-sm font-bold leading-6 text-white/56">
                Your fan passport and minted memories are tied to your connected wallet.
              </p>
            </div>
            <div className="mx-auto">
              <SolanaWalletButton />
            </div>
          </div>
        ) : (
          <>
            {!loadingProfile && (!passport || choosingCountry) ? <CountryChooser address={address} onChoose={saveCountry} /> : null}

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="relative overflow-hidden rounded-[1.75rem] border border-[#f7b733]/32 bg-[#12141b] p-4 shadow-2xl shadow-black/60">
                <div className="absolute inset-0" aria-hidden="true">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(247,183,51,0.18),transparent_16rem),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_40%)]" />
                  <div className="absolute inset-0 opacity-[0.08] bg-[repeating-linear-gradient(135deg,#f7b733_0,#f7b733_1px,transparent_1px,transparent_13px)]" />
                </div>
                <div className="relative grid gap-6 rounded-[1.25rem] border border-[#f7b733]/24 bg-[#08090f]/74 p-5 sm:grid-cols-[9rem_1fr] sm:gap-x-10 lg:gap-x-14 lg:gap-y-8">
                  <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 border-b border-[#f7b733]/18 pb-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f7b733]">FIFA World Cup 2026</p>
                      <h1 className="mt-1 text-3xl font-black uppercase tracking-[0.08em] text-white">Fan Passport</h1>
                    </div>
                    <span className="rounded-full border border-[#f7b733]/35 bg-[#f7b733]/12 px-3 py-1 text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#f7b733]">
                      Valid Supporter
                    </span>
                  </div>

                  <div className="grid gap-3 sm:pl-4 lg:pl-6">
                    <div className="grid aspect-[3/4] place-items-center rounded-[1rem] border border-[#f7b733]/30 bg-[#f8f1dc] p-2 shadow-inner" aria-label={`${country} flag`}>
                      <div className="grid h-full w-full place-items-center rounded-[0.75rem] border border-black/10 bg-white text-7xl">{flag}</div>
                    </div>
                    <div className="rounded-xl border border-[#f7b733]/18 bg-[#f7b733]/10 p-3 text-center">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#f7b733]">Team Stamp</p>
                      <p className="mt-1 text-xl font-black uppercase text-white">{country}</p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {field("Surname", "ATLAS")}
                      {field("Passport No.", passportNumber(address))}
                      {field("Given Name", shortAddress(address))}
                      {field("Date of Issue", passport ? formatDate(passport.createdAt) : "Pending")}
                      {field("Date of Birth", WORLD_CUP_BIRTH_DATE)}
                      {field("Date of Expiry", WORLD_CUP_EXPIRY_DATE)}
                      {field("Place of Birth", country)}
                      {field("Country Code", country.slice(0, 3).toUpperCase())}
                    </div>

                    <div className="grid gap-2 rounded-xl border border-[#f7b733]/18 bg-white/[0.045] p-3">
                      <p className="text-[0.63rem] font-black uppercase tracking-[0.16em] text-[#f7b733]/70">Wallet Signature</p>
                      <p className="font-mono text-sm font-black tabular-nums text-white">{shortAddress(address, 6)}</p>
                      <button
                        type="button"
                        onClick={copyAddress}
                        className="min-h-10 justify-self-start rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-black transition-colors duration-100 hover:bg-white/88 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      >
                        Copy Address
                      </button>
                      {copied ? (
                        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#f7b733]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#f7b733]" aria-hidden="true" />
                          Copied address
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <aside className="grid content-start gap-4 rounded-2xl border border-[#f7b733]/18 bg-[#05070d]/76 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
                <div className="grid gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f7b733]">Proof Stamps</p>
                      <p className="mt-2 text-xs font-bold leading-5 text-white/46">
                        {loadingMemories ? "Scanning wallet memories..." : memorySource === "local" ? "Saved app history." : "Wallet-wide memory NFTs."}
                      </p>
                    </div>
                    <span className="rounded-full border border-[#f7b733]/28 bg-[#f7b733]/10 px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#f7b733]">
                      Valid
                    </span>
                  </div>
                  <a
                    href={`https://explorer.solana.com/address/${address}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.045] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white transition-colors duration-100 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    View Wallet on Explorer
                  </a>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div>
                      <p className="text-2xl font-black tabular-nums text-white">{memories.length}</p>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/42">Memories</p>
                    </div>
                    <span className="text-2xl text-white/22" aria-hidden="true">●</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div>
                      <p className="text-2xl font-black tabular-nums text-white">{memoryCountries.length}</p>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/42">Countries</p>
                    </div>
                    <span className="text-2xl text-white/22" aria-hidden="true">●</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div>
                      <p className="text-2xl font-black tabular-nums text-white">{flag}</p>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/42">Fan Team</p>
                    </div>
                    <span className="rounded-full border border-[#f7b733]/24 bg-[#f7b733]/10 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#f7b733]">
                      Stamp
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setChoosingCountry(true)}
                  className="min-h-10 rounded-full border border-[#f7b733]/20 bg-[#f7b733]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#f7b733] transition-colors duration-100 hover:bg-[#f7b733]/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Change Country
                </button>
              </aside>
            </section>

            <section className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/52">Wallet Memories</h2>
                <Link
                  href={`/create/memory?country=${encodeURIComponent(country)}`}
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
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f7b733]">
                            {memory.country} <span aria-hidden="true">{getCountryFlag(memory.country)}</span>
                          </p>
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
                    Mint any country celebration with this wallet and it will appear here as passport proof.
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
