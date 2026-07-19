"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { COUNTRY_COORDS, resolveAtlasCountrySearch } from "@/lib/atlas-globe-data";
import { fetchOnChainFanPassport } from "@/lib/faniq-passport-program";
import { persistMintedMemory, saveMintedMemory, shortAddress } from "@/lib/memory-passport";
import { mintMemoryNft } from "@/lib/memory-nft";
import { isWalletConnected, walletConnectionMessage } from "@/lib/wallet-status";
import { FaniqMusicButton } from "@/components/audio/FaniqMusicButton";
import { AtlasModeSwitch } from "@/components/globe/AtlasModeSwitch";
import { SolanaWalletButton } from "@/components/wallet/SolanaWalletButton";

const ATLAS_COUNTRY_OPTIONS = Object.keys(COUNTRY_COORDS);
const MINT_TOAST_MS = 8000;
const FLOW_STEPS = [
  { key: "passport", label: "Passport" },
  { key: "upload", label: "Upload" },
  { key: "mint", label: "Mint + Link" },
] as const;

type MintStage = "idle" | (typeof FLOW_STEPS)[number]["key"] | "done";

type MintToast = {
  title: string;
  message: string;
  href: string;
};

export function CreateMemoryExperience({ initialCountry = "Argentina" }: { initialCountry?: string }) {
  const wallet = useWallet();
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintToast, setMintToast] = useState<MintToast | null>(null);
  const [needsPassport, setNeedsPassport] = useState(false);
  const [mintStage, setMintStage] = useState<MintStage>("idle");
  const selectedInitialCountry = resolveAtlasCountrySearch(initialCountry) ?? "Argentina";
  const walletReady = isWalletConnected(wallet);

  useEffect(() => {
    if (!mintToast) return;

    const timeout = window.setTimeout(() => setMintToast(null), MINT_TOAST_MS);
    return () => window.clearTimeout(timeout);
  }, [mintToast]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setMintToast(null);
    setNeedsPassport(false);
    setMintStage("idle");

    if (!walletReady) {
      setStatus(walletConnectionMessage(wallet));
      return;
    }

    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const country = String(formData.get("country") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    const image = formData.get("image");
    const name = wallet.publicKey ? shortAddress(wallet.publicKey.toBase58()) : "FANIQ Fan";

    if (!title || !country || !(image instanceof File) || image.size === 0) {
      setError("Add a title, country, and celebration image before minting.");
      return;
    }

    try {
      setMinting(true);
      setMintStage("passport");
      setStatus("Checking your FANIQ passport...");
      const onChainPassport = wallet.publicKey ? await fetchOnChainFanPassport(wallet.publicKey) : null;
      if (!onChainPassport) {
        setStatus(null);
        setNeedsPassport(true);
        return;
      }
      setMintStage("upload");
      const result = await mintMemoryNft({
        wallet,
        title,
        name,
        country,
        note,
        image,
        passportPublicKey: onChainPassport.publicKey,
        onStatus: (nextStatus) => {
          setStatus(nextStatus);
          if (/upload|metadata/i.test(nextStatus)) setMintStage("upload");
          if (/mint|link/i.test(nextStatus)) setMintStage("mint");
        },
      });
      const mintedMemory = {
        ...result,
        owner: wallet.publicKey?.toBase58() ?? "",
        title,
        name,
        country,
        note,
        mintedAt: new Date().toISOString(),
        passport: result.passport ?? onChainPassport.publicKey,
        memoryRecord: result.memoryRecord ?? "",
      };
      saveMintedMemory(mintedMemory);
      void persistMintedMemory(mintedMemory).catch(() => undefined);
      setMintStage("done");
      setMintToast({
        title: "Memory minted",
        message: `${country} NFT is live on devnet.`,
        href: result.coreExplorerUrl,
      });
      setStatus(null);
      form.reset();
      setFileName("");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Mint failed. Please try again.";
      const rejected = /reject|decline|cancel/i.test(message);
      setStatus(null);
      setMintStage("idle");
      if (/Create your FANIQ fan passport/i.test(message)) {
        setNeedsPassport(true);
      } else {
        setError(rejected ? "Mint cancelled in your wallet." : message);
      }
    } finally {
      setMinting(false);
    }
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-[#05070d] text-white">
      <div className="absolute inset-0 bg-[url('/textures/night-sky.png')] bg-cover bg-center opacity-70" aria-hidden="true" />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(247,183,51,0.12),transparent_24rem),linear-gradient(180deg,rgba(5,7,13,0.1),rgba(5,7,13,0.72))]"
        aria-hidden="true"
      />

      <header className="pointer-events-auto fixed inset-x-0 top-0 z-30">
        <nav className="mx-auto flex min-h-16 w-full max-w-[92rem] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 backdrop-blur-md transition-colors duration-100 hover:bg-white/[0.06] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b4fe] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070d]"
          >
            <span className="atlas-logo-mark" aria-hidden="true" />
            <span className="text-base font-black lowercase tracking-tight text-white">FANIQ</span>
          </Link>
          <div className="flex items-center gap-2">
            <FaniqMusicButton />
            <SolanaWalletButton />
          </div>
        </nav>
      </header>

      <AtlasModeSwitch mode="create" />

      <section className="relative z-10 mx-auto grid min-h-svh w-full max-w-[58rem] place-items-center px-4 pb-6 pt-28">
        {!walletReady ? (
          <div className="grid w-full gap-5 rounded-2xl border border-white/12 bg-[#05070d]/78 p-5 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
            <div className="grid gap-2">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/46">Wallet Required</p>
              <h1 className="text-3xl font-black tracking-tight text-white">Mint a {selectedInitialCountry} memory</h1>
              <p className="mx-auto max-w-[22rem] text-sm font-bold leading-6 text-white/52">
                Connect a devnet wallet to upload your celebration image and approve the NFT mint transaction.
              </p>
            </div>
            <div className="mx-auto">
              <SolanaWalletButton />
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            aria-busy={minting}
            className="grid w-full gap-4 overflow-hidden rounded-[1.4rem] border border-white/12 bg-[#05070d]/74 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-5"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3">
              <div className="grid gap-1">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/46">Create Memory</p>
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{selectedInitialCountry} fan NFT</h1>
              </div>
              <div className="grid justify-items-end gap-2">
                <span className="rounded-full border border-[#f7b733]/35 bg-[#f7b733]/12 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#f7b733]">
                  Devnet
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/45">
                  {wallet.publicKey ? shortAddress(wallet.publicKey.toBase58()) : "Wallet"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/24 p-1.5" aria-label="Minting flow">
              {FLOW_STEPS.map((step) => {
                const currentIndex = FLOW_STEPS.findIndex((item) => item.key === mintStage);
                const stepIndex = FLOW_STEPS.findIndex((item) => item.key === step.key);
                const active = mintStage === step.key;
                const complete = mintStage === "done" || (currentIndex > -1 && stepIndex < currentIndex);

                return (
                  <div
                    key={step.key}
                    className={[
                      "flex min-h-9 items-center justify-center rounded-xl px-2 text-center text-[0.62rem] font-black uppercase tracking-[0.12em] transition-colors duration-150",
                      active ? "bg-[#f7b733] text-black" : complete ? "bg-[#f7b733]/18 text-[#f7b733]" : "bg-white/[0.035] text-white/42",
                    ].join(" ")}
                  >
                    {step.label}
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
              <div className="grid gap-1.5">
                <label htmlFor="memory-title" className="text-xs font-black uppercase tracking-[0.2em] text-white/46">
                  Title
                </label>
                <input
                  id="memory-title"
                  name="title"
                  required
                  maxLength={80}
                  placeholder="Midnight goal roar"
                  disabled={minting}
                  className="min-h-11 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-white outline-none placeholder:text-white/28 focus-visible:ring-2 focus-visible:ring-[#f7b733]"
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="memory-country" className="text-xs font-black uppercase tracking-[0.2em] text-white/46">
                  Country
                </label>
                <select
                  id="memory-country"
                  name="country"
                  required
                  defaultValue={selectedInitialCountry}
                  autoComplete="country-name"
                  disabled={minting}
                  className="min-h-11 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733]"
                >
                  {ATLAS_COUNTRY_OPTIONS.map((country) => (
                    <option key={country} value={country} className="bg-[#05070d] text-white">
                      {country}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[0.95fr_1.05fr]">
              <div className="grid gap-1.5">
                <label htmlFor="memory-image" className="text-xs font-black uppercase tracking-[0.2em] text-white/46">
                  Celebration Image
                </label>
                <label
                  htmlFor="memory-image"
                  className="group flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/18 bg-white/[0.035] px-4 text-center text-sm font-black text-white/50 transition-colors duration-100 hover:border-[#f7b733]/45 hover:bg-[#f7b733]/[0.055] focus-within:ring-2 focus-within:ring-[#f7b733] md:min-h-36"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-[#f7b733] text-lg text-black transition-transform duration-150 group-hover:scale-105">
                    +
                  </span>
                  <span className="max-w-full truncate">{fileName || "Upload fan photo"}</span>
                  <input
                    id="memory-image"
                    name="image"
                    type="file"
                    accept="image/*"
                    required
                    disabled={minting}
                    className="sr-only"
                    onChange={(event) => {
                      setFileName(event.target.files?.[0]?.name ?? "");
                      setStatus(null);
                    }}
                  />
                </label>
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="memory-note" className="text-xs font-black uppercase tracking-[0.2em] text-white/46">
                  Fan Note
                </label>
                <textarea
                  id="memory-note"
                  name="note"
                  rows={4}
                  maxLength={180}
                  placeholder="What happened in the room?"
                  disabled={minting}
                  className="min-h-32 resize-none rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 text-sm font-bold leading-6 text-white outline-none placeholder:text-white/28 focus-visible:ring-2 focus-visible:ring-[#f7b733] md:min-h-36"
                />
              </div>
            </div>

            <div className="grid gap-3 border-t border-white/10 pt-3 md:grid-cols-[1fr_auto] md:items-center">
              <p className="text-xs font-bold leading-5 text-white/44">
                This mints a devnet memory NFT and links it to your locked FANIQ passport in one on-chain transaction.
              </p>
              <button
                type="submit"
                disabled={minting}
                className="min-h-12 rounded-full bg-[#f7b733] px-8 text-sm font-black uppercase tracking-[0.18em] text-black transition-colors duration-100 hover:bg-[#fcd34d] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black md:min-w-56"
              >
                {minting ? "Follow Wallet Prompt" : "Mint Memory"}
              </button>
            </div>

            {status ? <p className="text-center text-sm font-bold text-white/54">{status}</p> : null}
            {error ? (
              <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-center text-sm font-bold text-red-100">{error}</p>
            ) : null}
          </form>
        )}
      </section>

      {mintToast ? (
        <button
          type="button"
          className="fixed bottom-5 right-5 z-50 grid w-[min(22rem,calc(100vw-2rem))] gap-1 rounded-2xl border border-[#f7b733]/35 bg-[#08090f]/92 p-4 text-left shadow-2xl shadow-black/60 backdrop-blur-xl transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          onClick={() => window.open(mintToast.href, "_blank", "noreferrer")}
        >
          <span className="text-xs font-black uppercase tracking-[0.22em] text-[#f7b733]">{mintToast.title}</span>
          <span className="text-sm font-black text-white">{mintToast.message}</span>
          <span className="text-xs font-bold text-white/42">Click to open the NFT explorer.</span>
        </button>
      ) : null}

      {needsPassport ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/78 px-4 py-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="passport-required-title">
          <section className="relative grid w-full max-w-[28rem] gap-4 overflow-hidden rounded-[1.5rem] border border-[#f7b733]/32 bg-[#08090f] p-5 text-center shadow-2xl shadow-black/70">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(247,183,51,0.18),transparent_18rem)]" aria-hidden="true" />
            <div className="relative grid gap-2">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f7b733]">Passport Required</p>
              <h2 id="passport-required-title" className="text-3xl font-black tracking-tight text-white">
                Mint your FANIQ passport first
              </h2>
              <p className="mx-auto max-w-[22rem] text-sm font-bold leading-6 text-white/56">
                Memories are linked to an on-chain fan passport. Stamp your supporter country once, then come back to mint this memory.
              </p>
            </div>

            <div className="relative grid gap-2 sm:grid-cols-2">
              <Link
                href="/profile"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#f7b733] px-5 text-sm font-black uppercase tracking-[0.14em] text-black transition-colors hover:bg-[#fcd34d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                Mint Passport
              </Link>
              <button
                type="button"
                onClick={() => setNeedsPassport(false)}
                className="min-h-11 rounded-full border border-white/12 bg-white/[0.045] px-5 text-sm font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                Stay Here
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
