export default function Logo({ size = "md", showText = true }) {
  const textSize = {
    sm: "text-xs sm:text-sm",
    md: "text-sm sm:text-base",
    lg: "text-base sm:text-lg",
  }[size];

  const wrapSize = {
    sm: "size-7 rounded-lg",
    md: "size-8.5 rounded-xl",
    lg: "size-10 rounded-xl",
  }[size];

  const iconSize = {
    sm: 18,
    md: 22,
    lg: 26,
  }[size];

  return (
    <span className={`inline-flex items-center gap-2.5 font-sans select-none tracking-tight ${textSize}`}>
      {/* ── Custom DevCollab Brand Mark ── */}
      <span
        className={`relative inline-flex items-center justify-center ${wrapSize} bg-gradient-to-br from-neutral-900 via-zinc-900 to-black text-white dark:from-white dark:via-zinc-100 dark:to-neutral-200 dark:text-neutral-950 shadow-sm border border-neutral-700/40 dark:border-white/40 shrink-0 transition-transform duration-200 group-hover:scale-105`}
      >
        <svg
          viewBox="0 0 32 32"
          width={iconSize}
          height={iconSize}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Left code chevron */}
          <path d="M10.5 9.5 L4.5 16 L10.5 22.5" />

          {/* Right code chevron */}
          <path d="M21.5 9.5 L27.5 16 L21.5 22.5" />

          {/* Center collaborative nexus diamond with emerald glow */}
          <polygon
            points="16,10.5 20,16 16,21.5 12,16"
            className="fill-emerald-400/80 stroke-emerald-500 dark:fill-emerald-500 dark:stroke-emerald-600"
            strokeWidth="1.6"
          />
        </svg>

        {/* Live sync pulse badge */}
        <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-canvas animate-pulse" />
      </span>

      {/* ── Brand Typography: Dev.Collab ── */}
      {showText && (
        <span className="font-extrabold tracking-tight text-fg flex items-baseline">
          <span>Dev</span>
          <span className="text-emerald-500 font-black mx-0.5">.</span>
          <span className="font-semibold text-muted">Collab</span>
        </span>
      )}
    </span>
  );
}
