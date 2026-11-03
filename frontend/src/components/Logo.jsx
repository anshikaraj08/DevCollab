/**
 * DevCollab Logo
 * Brand mark: Code brackets connected by a collaborative sync nexus diamond.
 * Represents development + real-time multiplayer collaboration.
 */
export default function Logo({ size = "md", showText = true }) {
  const dims = {
    sm: { wrap: 32, icon: 20, text: "text-sm", gap: "gap-2.5" },
    md: { wrap: 38, icon: 24, text: "text-[16px]", gap: "gap-3" },
    lg: { wrap: 44, icon: 28, text: "text-lg", gap: "gap-3.5" },
  }[size];

  return (
    <span className={`inline-flex items-center ${dims.gap} font-sans select-none tracking-tight`}>
      {/* ── Brand Mark Icon ──────────────────────────────────────────────── */}
      <span
        className="relative inline-flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-neutral-900 via-zinc-900 to-black text-white dark:from-white dark:via-zinc-100 dark:to-neutral-200 dark:text-neutral-950 shadow-sm border border-neutral-800 dark:border-white/40 transition-transform duration-200 group-hover:scale-105"
        style={{ width: dims.wrap, height: dims.wrap }}
      >
        <svg
          viewBox="0 0 32 32"
          width={dims.icon}
          height={dims.icon}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Left code bracket: < */}
          <path d="M11 9 L4.5 16 L11 23" />

          {/* Right code bracket: > */}
          <path d="M21 9 L27.5 16 L21 23" />

          {/* Center collaborative nexus: glowing diamond node linking both coders */}
          <polygon
            points="16,10.5 19.5,16 16,21.5 12.5,16"
            className="fill-emerald-400 stroke-emerald-400 dark:fill-emerald-500 dark:stroke-emerald-500"
            strokeWidth="1.2"
          />

          {/* Center collaborative pulse core */}
          <circle cx="16" cy="16" r="1.5" className="fill-white dark:fill-neutral-950" />
        </svg>

        {/* Live sync online pulse indicator */}
        <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-emerald-500 ring-2 ring-[#f0f2f5] dark:ring-[#161616] animate-pulse" />
      </span>

      {/* ── Brand Typography: DevCollab ──────────────────────────────────── */}
      {showText && (
        <span className={`${dims.text} font-black tracking-tight leading-none flex items-baseline`}>
          <span className="text-fg">Dev</span>
          <span className="text-emerald-500 font-extrabold ml-[1px]">Collab</span>
        </span>
      )}
    </span>
  );
}
