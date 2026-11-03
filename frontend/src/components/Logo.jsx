/**
 * DevCollab Logo
 * Clean, timeless monochrome developer brand mark:
 * Two crisp white code chevrons converging at a central collaborative nexus spark.
 */
export default function Logo({ size = "md", showText = true, inverted = false }) {
  const dims = {
    sm: { wrap: 30, text: "text-sm", gap: "gap-2.5" },
    md: { wrap: 36, text: "text-[15px] sm:text-base", gap: "gap-3" },
    lg: { wrap: 42, text: "text-lg", gap: "gap-3.5" },
  }[size];

  return (
    <span className={`inline-flex items-center ${dims.gap} font-sans select-none tracking-tight`}>
      {/* ── Brand Icon Mark ── */}
      <span
        className="relative inline-flex items-center justify-center shrink-0 rounded-[10px] overflow-hidden shadow-sm transition-transform duration-200 group-hover:scale-105"
        style={{ width: dims.wrap, height: dims.wrap }}
      >
        <svg
          viewBox="0 0 36 36"
          width={dims.wrap}
          height={dims.wrap}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="monoBg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="50%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
            <linearGradient id="monoStroke" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#475569" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Deep Obsidian Card */}
          <rect width="36" height="36" rx="9" fill="url(#monoBg)" />
          <rect x="0.5" y="0.5" width="35" height="35" rx="8.5" stroke="url(#monoStroke)" strokeWidth="1" />

          {/* Left Developer Chevron (Pure White) */}
          <path
            d="M12.5 11.5 L6.5 18 L12.5 24.5"
            stroke="#ffffff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Right Developer Chevron (Pure White) */}
          <path
            d="M23.5 11.5 L29.5 18 L23.5 24.5"
            stroke="#ffffff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Central Collaborative Nexus Spark (White) */}
          <path
            d="M18 12.5 C18 15.5 16 18 13.5 18 C16 18 18 20.5 18 23.5 C18 20.5 20 18 22.5 18 C20 18 18 15.5 18 12.5 Z"
            fill="#ffffff"
          />
          <circle cx="18" cy="18" r="1.2" fill="#0f172a" />
        </svg>
      </span>

      {/* ── Brand Typography: DevCollab ── */}
      {showText && (
        <span className={`${dims.text} tracking-tight leading-none flex items-baseline select-none`}>
          <span className={`font-extrabold ${inverted ? "text-white" : "text-fg dark:text-white"}`}>
            Dev
          </span>
          <span className={`font-semibold ml-[2px] ${inverted ? "text-slate-300" : "text-muted dark:text-slate-300"}`}>
            Collab
          </span>
        </span>
      )}
    </span>
  );
}
