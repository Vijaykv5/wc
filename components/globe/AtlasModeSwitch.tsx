import Link from "next/link";

type AtlasMode = "explore" | "create";

export function AtlasModeSwitch({ mode }: { mode: AtlasMode }) {
  const linkClass = (active: boolean) =>
    `flex min-h-9 items-center justify-center rounded-[1rem] px-4 text-center text-[0.64rem] font-black uppercase tracking-[0.24em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:min-h-10 sm:px-5 sm:text-xs ${
      active ? "bg-[#f7b733] text-black shadow-[0_0_44px_rgba(247,183,51,0.18)]" : "text-white/42 hover:bg-white/[0.04] hover:text-white/62"
    }`;

  return (
    <div className="pointer-events-auto fixed left-4 right-4 top-[4.5rem] z-30 mx-auto max-w-[30rem]">
      <nav className="grid grid-cols-2 gap-1 rounded-[1.35rem] border border-white/12 bg-black/60 px-2 py-1 shadow-xl shadow-black/40 backdrop-blur-xl">
        <Link href="/atlas" aria-current={mode === "explore" ? "page" : undefined} className={linkClass(mode === "explore")}>
          Explore Atlas
        </Link>
        <Link href="/create/memory" aria-current={mode === "create" ? "page" : undefined} className={linkClass(mode === "create")}>
          Create Memory
        </Link>
      </nav>
    </div>
  );
}
