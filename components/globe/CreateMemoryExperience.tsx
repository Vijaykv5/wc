"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { COUNTRY_COORDS, resolveAtlasCountrySearch } from "@/lib/atlas-globe-data";
import { saveMintedMemory } from "@/lib/memory-passport";
import { mintMemoryNft } from "@/lib/memory-nft";
import { isWalletConnected, walletConnectionMessage } from "@/lib/wallet-status";
import { AtlasModeSwitch } from "@/components/globe/AtlasModeSwitch";
import { SolanaWalletButton } from "@/components/wallet/SolanaWalletButton";

const ATLAS_COUNTRY_OPTIONS = Object.keys(COUNTRY_COORDS);
const MINT_TOAST_MS = 8000;

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

    if (!walletReady) {
      setStatus(walletConnectionMessage(wallet));
      return;
    }

    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const country = String(formData.get("country") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    const image = formData.get("image");

    if (!title || !name || !country || !(image instanceof File) || image.size === 0) {
      setError("Add a title, name, country, and celebration image before minting.");
      return;
    }

    try {
      setMinting(true);
      setStatus("Preparing your memory mint...");
      const result = await mintMemoryNft({ wallet, title, name, country, note, image, onStatus: setStatus });
      saveMintedMemory({
        ...result,
        owner: wallet.publicKey?.toBase58() ?? "",
        title,
        name,
        country,
        note,
        mintedAt: new Date().toISOString(),
      });
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
      setError(rejected ? "Mint cancelled in your wallet." : message);
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
            <span className="text-base font-black lowercase tracking-tight text-white">atlas</span>
          </Link>
          <SolanaWalletButton />
        </nav>
      </header>

      <AtlasModeSwitch mode="create" />

      <section className="relative z-10 mx-auto grid min-h-svh w-full max-w-[30rem] place-items-center px-4 pb-10 pt-36">
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
            className="grid w-full gap-4 rounded-2xl border border-white/12 bg-[#05070d]/72 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/46">Create Memory</p>
                <h1 className="text-2xl font-black tracking-tight text-white">{selectedInitialCountry} fan NFT</h1>
              </div>
              <span className="rounded-full border border-[#f7b733]/35 bg-[#f7b733]/12 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#f7b733]">
                Devnet
              </span>
            </div>

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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="memory-name" className="text-xs font-black uppercase tracking-[0.2em] text-white/46">
                  Name
                </label>
                <input
                  id="memory-name"
                  name="name"
                  required
                  autoComplete="name"
                  placeholder="Vijay"
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

            <div className="grid gap-1.5">
              <label htmlFor="memory-image" className="text-xs font-black uppercase tracking-[0.2em] text-white/46">
                Celebration Image
              </label>
              <label
                htmlFor="memory-image"
                className="flex min-h-24 cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/18 bg-white/[0.035] px-4 text-center text-sm font-black text-white/48 transition-colors duration-100 hover:bg-white/[0.055] focus-within:ring-2 focus-within:ring-[#f7b733]"
              >
                {fileName || "Upload image"}
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
                rows={3}
                maxLength={180}
                placeholder="What happened in the room?"
                disabled={minting}
                className="resize-none rounded-xl border border-white/10 bg-white/[0.045] px-3 py-3 text-sm font-bold leading-6 text-white outline-none placeholder:text-white/28 focus-visible:ring-2 focus-visible:ring-[#f7b733]"
              />
            </div>

            <button
              type="submit"
              disabled={minting}
              className="min-h-12 rounded-full bg-[#f7b733] px-5 text-sm font-black uppercase tracking-[0.18em] text-black transition-colors duration-100 hover:bg-[#fcd34d] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {minting ? "Approve in Wallet..." : "Mint Memory"}
            </button>

            {status ? <p className="text-center text-sm font-bold text-white/54">{status}</p> : null}
            {minting ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center text-xs font-bold leading-5 text-white/42">
                Devnet mints can ask for more than one approval because the image upload, metadata upload, and NFT mint are separate steps.
              </p>
            ) : null}
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
    </main>
  );
}
