"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { COUNTRY_COORDS } from "@/lib/atlas-globe-data";
import { AtlasModeSwitch } from "@/components/globe/AtlasModeSwitch";
import { SolanaWalletButton } from "@/components/wallet/SolanaWalletButton";

const ATLAS_COUNTRY_OPTIONS = Object.keys(COUNTRY_COORDS);

export function CreateMemoryExperience() {
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Memory ready to mint. Connect your wallet to finish it on-chain.");
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
        <form onSubmit={handleSubmit} className="grid w-full gap-4 rounded-2xl border border-white/12 bg-[#05070d]/72 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
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
                defaultValue="Argentina"
                autoComplete="country-name"
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
              className="resize-none rounded-xl border border-white/10 bg-white/[0.045] px-3 py-3 text-sm font-bold leading-6 text-white outline-none placeholder:text-white/28 focus-visible:ring-2 focus-visible:ring-[#f7b733]"
            />
          </div>

          <button
            type="submit"
            className="min-h-12 rounded-full bg-[#f7b733] px-5 text-sm font-black uppercase tracking-[0.18em] text-black transition-colors duration-100 hover:bg-[#fcd34d] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Mint Memory
          </button>

          {status ? <p className="text-center text-sm font-bold text-white/54">{status}</p> : null}
        </form>
      </section>
    </main>
  );
}
