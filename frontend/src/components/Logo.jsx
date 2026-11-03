export default function Logo({ size = "md", showText = true }) {
  const textSize = {
    sm: "text-xs sm:text-sm",
    md: "text-sm sm:text-base",
    lg: "text-lg sm:text-xl",
  }[size];

  const wrapSize = {
    sm: "size-6.5 rounded-lg",
    md: "size-8 rounded-xl",
    lg: "size-10 rounded-2xl",
  }[size];

  const iconSize = {
    sm: 16,
    md: 20,
    lg: 24,
  }[size];

  return (
    <span className={`inline-flex items-center gap-2.5 font-sans select-none tracking-tight ${textSize}`}>
      {/* ── Modern App Icon Mark ── */}
      <span
        className={`relative inline-flex items-center justify-center ${wrapSize} bg-gradient-to-br from-neutral-900 to-neutral-800 text-white dark:from-neutral-100 dark:to-neutral-200 dark:text-neutral-900 shadow-sm border border-neutral-700/30 dark:border-white/20 shrink-0 transition-transform duration-200 group-hover:scale-105`}
      >
        <svg
          viewBox="0 0 32 32"
          width={iconSize}
          height={iconSize}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Left bracket */}
          <path d="M11 10 L5.5 16 L11 22" />
          {/* Right bracket */}
          <path d="M21 10 L26.5 16 L21 22" />
          {/* Collaborative slash bridge with emerald pulse in dark / cyan in light */}
          <path
            d="M18.5 9.5 L13.5 22.5"
            className="stroke-emerald-400 dark:stroke-emerald-600"
            strokeWidth="2.8"
          />
        </svg>

        {/* Micro Live Sync Dot on Top Corner */}
        <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-canvas animate-pulse" />
      </span>

      {/* ── Brand Typography ── */}
      {showText && (
        <span className="font-extrabold tracking-tight text-fg flex items-baseline">
          <span>Dev</span>
          <span className="text-muted font-bold ml-0.5">Collab</span>
        </span>
      )}
    </span>
  );
}
