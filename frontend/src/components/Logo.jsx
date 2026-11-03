/**
 * DevCollab Logo
 * Brand Mark: Two vibrant developer code chevrons (Emerald & Cyan)
 * converging at a central collaborative nexus spark.
 */
export default function Logo({ size = "md", showText = true }) {
  const dims = {
    sm: { wrap: 30, text: "text-sm", gap: "gap-2" },
    md: { wrap: 36, text: "text-[15px] sm:text-base", gap: "gap-2.5" },
    lg: { wrap: 42, text: "text-lg", gap: "gap-3" },
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
            <linearGradient id="logoBg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="50%" stopColor="#090d16" />
              <stop offset="100%" stopColor="#030712" />
            </linearGradient>
            <linearGradient id="logoStroke" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#334155" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="logoEmerald" x1="6" y1="11" x2="13" y2="25" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="logoCyan" x1="23" y1="11" x2="30" y2="25" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>

          {/* Obsidian Squircle Card */}
          <rect width="36" height="36" rx="9" fill="url(#logoBg)" />
          <rect x="0.5" y="0.5" width="35" height="35" rx="8.5" stroke="url(#logoStroke)" strokeWidth="1" />

          {/* Left Developer Chevron (Emerald) */}
          <path
            d="M12.5 11.5 L6.5 18 L12.5 24.5"
            stroke="url(#logoEmerald)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Right Developer Chevron (Cyan) */}
          <path
            d="M23.5 11.5 L29.5 18 L23.5 24.5"
            stroke="url(#logoCyan)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Central Collaborative Nexus Spark */}
          <path
            d="M18 12.5 C18 15.5 16 18 13.5 18 C16 18 18 20.5 18 23.5 C18 20.5 20 18 22.5 18 C20 18 18 15.5 18 12.5 Z"
            fill="#ffffff"
          />
          <circle cx="18" cy="18" r="1.3" fill="#10b981" />
        </svg>
      </span>

      {/* ── Brand Typography: DevCollab ── */}
      {showText && (
        <span className={`${dims.text} font-bold tracking-tight leading-none flex items-baseline`}>
          <span className="text-fg font-extrabold">Dev</span>
          <span className="text-emerald-500 font-bold ml-[1.5px]">Collab</span>
        </span>
      )}
    </span>
  );
}
