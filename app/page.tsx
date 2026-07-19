import Image from "next/image";
import { FifaScoreStrip } from "./components/fifa-score-strip";
import { FaniqMusicButton } from "@/components/audio/FaniqMusicButton";
import { SolanaWalletButton } from "@/components/wallet/SolanaWalletButton";

const steps = [
  {
    label: "Open the globe",
    text: "Start with a textured night-earth view where countries glow as fan energy gathers.",
  },
  {
    label: "Read the world",
    text: "FANIQ maps chants, reactions and pressure into country-by-country memory signals.",
  },
  {
    label: "Follow the signal",
    text: "Hover countries, inspect memory hubs, and watch routes connect the loudest football moments.",
  },
];

const memories = [
  "Argentina chants spike after a late counter",
  "Japan prediction room turns blue before kickoff",
  "Brazil reactions surge around a VAR check",
  "Morocco watch parties light up the globe",
];

function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-black/82 backdrop-blur-xl">
      <nav className="mx-auto flex min-h-14 w-full max-w-[86rem] items-center justify-between px-4 sm:px-6 lg:px-8">
        <a
          href="#home"
          className="flex min-h-11 items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <span className="atlas-logo-mark" aria-hidden="true" />
          <span className="text-base font-black lowercase tracking-tight text-white">FANIQ</span>
        </a>
        <a
          href="#how-it-works"
          className="hidden min-h-10 items-center rounded-full px-3 text-sm font-semibold text-white/50 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black md:inline-flex"
        >
          How it works
        </a>
        <div className="flex items-center gap-2">
          <FaniqMusicButton />
          <SolanaWalletButton />
        </div>
      </nav>
    </header>
  );
}

function ConnectHeroImage({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/connect-hero.svg"
      alt="FANIQ world map with connected fan energy pins"
      width={984}
      height={344}
      priority
      className={`select-none ${className}`}
    />
  );
}

function HeroSection() {
  return (
    <section id="home" className="relative flex min-h-screen flex-col items-center overflow-hidden px-4 pb-0 pt-24 text-center sm:px-6 lg:px-8">
      <div className="hero-glow hero-glow-amber" aria-hidden="true" />
      <div className="hero-glow hero-glow-purple" aria-hidden="true" />
      <div className="hero-glow hero-glow-green" aria-hidden="true" />

      <div className="relative z-10 flex max-w-5xl flex-col items-center">
        <p className="section-kicker hero-kicker mt-14">
          <span className="h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_22px_rgba(251,191,36,0.9)]" aria-hidden="true" />
          Live World Cup fan energy
        </p>
        <h1 className="atlas-display mt-5 max-w-[56rem] text-3xl leading-[1.08] text-white sm:text-4xl md:text-5xl lg:whitespace-nowrap lg:text-[3.6rem] xl:text-[4rem]">
          The fan world is alive
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/56 sm:text-base">
           Turn your football emotion into a living 3D globe, showing where fans are celebrating, predicting, arguing and reacting in real time.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="/atlas" className="hero-primary-action">
            Enter FANIQ
          </a>
          <a href="#how-it-works" className="hero-secondary-action">
            See how it works
          </a>
        </div>
      </div>

      <div className="relative z-10 mt-8 w-full max-w-[64rem] translate-y-3 sm:translate-y-6">
        <ConnectHeroImage className="w-full object-contain" />
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[86rem]">
        <p className="section-kicker section-rule">How it works</p>
        <h2 className="atlas-display mt-8 max-w-2xl text-3xl leading-[1.16] text-white sm:text-4xl md:text-5xl">
          Watch countries grow louder as fans move.
        </h2>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.label} className="step-card">
              <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="atlas-display text-2xl text-white">{step.label}</h3>
                <p className="mt-4 max-w-xl text-sm leading-6 text-white/56">{step.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArchiveSection() {
  return (
    <section className="relative px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[86rem] gap-5 xl:grid-cols-[1.44fr_0.96fr]">
        <article className="memory-card">
          <p className="section-kicker section-rule">Fan Energy globe</p>
          <h2 className="atlas-display mt-8 max-w-2xl text-3xl leading-[1.16] text-white sm:text-4xl md:text-5xl">
            See football emotion move across the planet.
          </h2>
          <div className="archive-map-panel mt-9">
            <ConnectHeroImage className="w-full object-contain" />
            <div className="archive-note archive-note-left">
              <p>Fan Energy</p>
              <span>country heat rising</span>
            </div>
            <div className="archive-note archive-note-right">
              <p>Live room</p>
              <span>goal call locked</span>
            </div>
          </div>
        </article>

        <aside className="story-panel">
          <p className="section-kicker text-white/58">Live signals</p>
          <div className="mt-14 grid gap-3">
            {memories.map((memory) => (
              <div key={memory} className="memory-row">
                <span className="h-4 w-4 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_28px_rgba(52,211,153,0.86)]" aria-hidden="true" />
                <span>{memory}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto grid grid-cols-2 gap-5 pt-16">
            <div className="stat-box">
              <p className="atlas-display text-3xl text-white">48k</p>
              <p className="mt-1 text-sm text-white/48">fans alive</p>
            </div>
            <div className="stat-box">
              <p className="atlas-display text-3xl text-white">64</p>
              <p className="mt-1 text-sm text-white/48">match rooms</p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="cta-panel mx-auto max-w-[86rem]">
        <ConnectHeroImage className="absolute left-1/2 top-10 w-[60rem] max-w-none -translate-x-1/2 opacity-35 saturate-50" />
        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center py-12 text-center">
          <h2 className="atlas-display text-3xl leading-[1.1] text-white sm:text-4xl md:text-5xl">
            Enter the loudest room in football
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/52 sm:text-base">
            Follow the globe, connect your wallet, and explore the countries carrying the loudest memories.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="/atlas" className="launch-button">
              Open FANIQ
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <Navbar />
      <FifaScoreStrip />
      <HeroSection />
      <HowItWorks />
      <ArchiveSection />
      <FinalCta />
    </main>
  );
}
