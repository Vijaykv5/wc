"use client";

import { useEffect, useRef, useState } from "react";

type AudioKit = {
  context: AudioContext;
  interval: number;
  noise: AudioBufferSourceNode;
};

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

function createNoiseBuffer(context: AudioContext) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * 0.22;
  }
  return buffer;
}

function playPulse(context: AudioContext, destination: AudioNode, step: number) {
  const now = context.currentTime;
  const notes = [
    [196, 246.94, 293.66],
    [220, 261.63, 329.63],
    [196, 246.94, 349.23],
    [174.61, 220, 293.66],
  ][step % 4];

  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index === 0 ? "sine" : "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.024, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 1.15);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(now + index * 0.018);
    oscillator.stop(now + 1.2);
  });
}

async function startAmbientLoop(): Promise<AudioKit> {
  const AudioContextClass = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!AudioContextClass) throw new Error("Audio is not supported in this browser.");

  const context = new AudioContextClass();
  await context.resume();

  const master = context.createGain();
  master.gain.value = 0.096;
  master.connect(context.destination);

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 950;

  const noiseGain = context.createGain();
  noiseGain.gain.value = 0.028;

  const noise = context.createBufferSource();
  noise.buffer = createNoiseBuffer(context);
  noise.loop = true;
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start();

  let step = 0;
  playPulse(context, master, step);
  const interval = window.setInterval(() => {
    step += 1;
    playPulse(context, master, step);
  }, 1450);

  return { context, interval, noise };
}

export function FaniqMusicButton({ className = "" }: { className?: string }) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const kitRef = useRef<AudioKit | null>(null);

  async function stop() {
    const kit = kitRef.current;
    kitRef.current = null;
    if (!kit) return;
    window.clearInterval(kit.interval);
    try {
      kit.noise.stop();
    } catch {
      // The source may already be stopped when the page unloads.
    }
    await kit.context.close().catch(() => undefined);
  }

  async function toggle() {
    setError(false);
    if (kitRef.current) {
      await stop();
      setPlaying(false);
      return;
    }

    try {
      kitRef.current = await startAmbientLoop();
      setPlaying(true);
    } catch {
      setError(true);
      setPlaying(false);
    }
  }

  useEffect(() => {
    return () => {
      void stop();
    };
  }, []);

  return (
    <button
      type="button"
      aria-pressed={playing}
      aria-label={playing ? "Mute FANIQ stadium music" : "Play FANIQ stadium music"}
      title={error ? "Audio unavailable" : playing ? "Mute stadium music" : "Play stadium music"}
      onClick={toggle}
      className={[
        "group grid size-11 place-items-center rounded-full border backdrop-blur-md transition-colors duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7b733] focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        playing
          ? "border-[#f7b733]/40 bg-[#f7b733]/16 text-[#f7b733] shadow-[0_0_28px_rgba(247,183,51,0.16)]"
          : "border-white/10 bg-white/[0.045] text-white/48 hover:border-[#f7b733]/28 hover:text-[#f7b733]",
        error ? "border-red-300/30 text-red-100" : "",
        className,
      ].join(" ")}
    >
      <span className="sr-only">{playing ? "Mute" : "Play"}</span>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="transition-transform duration-150 group-hover:scale-105">
        <path d="M9 18.25C9 19.77 7.66 21 6 21C4.34 21 3 19.77 3 18.25C3 16.73 4.34 15.5 6 15.5C7.66 15.5 9 16.73 9 18.25Z" stroke="currentColor" strokeWidth="2" />
        <path d="M21 15.25C21 16.77 19.66 18 18 18C16.34 18 15 16.77 15 15.25C15 13.73 16.34 12.5 18 12.5C19.66 12.5 21 13.73 21 15.25Z" stroke="currentColor" strokeWidth="2" />
        <path d="M9 18V6.5L21 4V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 10L21 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
