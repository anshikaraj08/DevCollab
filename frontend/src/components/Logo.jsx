/**
 * DevCollab Logo
 * Brand mark: two overlapping user nodes connected by a live code branch —
 * representing real-time collaborative coding.
 */
export default function Logo({ size = "md", showText = true }) {
  const dims = {
    sm: { wrap: 30, icon: 18, text: "text-sm", gap: "gap-2" },
    md: { wrap: 36, icon: 22, text: "text-[15px]", gap: "gap-2.5" },
    lg: { wrap: 44, icon: 27, text: "text-lg", gap: "gap-3" },
  }[size];

  return (
    <span
      className={`inline-flex items-center ${dims.gap} font-sans select-none`}
    >
      {/* ── Brand Mark ─────────────────────────────────────────────────── */}
      <span
        className="relative shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
        style={{ width: dims.wrap, height: dims.wrap }}
      >
        <svg
          viewBox="0 0 44 44"
          width={dims.wrap}
          height={dims.wrap}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* ── Rounded square bg ── */}
          <rect
            x="0" y="0" width="44" height="44" rx="11"
            className="fill-[#0f172a] dark:fill-[#e8eaf0]"
          />

          {/* ── Left user node ── */}
          {/* head */}
          <circle cx="13" cy="14" r="4"
            className="fill-[#38bdf8]"
          />
          {/* body arc */}
          <path d="M6 28 C6 22 20 22 20 28"
            className="fill-[#38bdf8]"
          />

          {/* ── Right user node ── */}
          {/* head */}
          <circle cx="31" cy="14" r="4"
            className="fill-[#34d399]"
          />
          {/* body arc */}
          <path d="M24 28 C24 22 38 22 38 28"
            className="fill-[#34d399]"
          />

          {/* ── Code merge branch connecting the two ── */}
          {/* left arm → center */}
          <path d="M20 20 Q22 23 22 25"
            stroke="#94a3b8"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* right arm → center */}
          <path d="M24 20 Q22 23 22 25"
            stroke="#94a3b8"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* center stem */}
          <path d="M22 25 L22 30"
            stroke="#94a3b8"
            strokeWidth="1.6"
            strokeLinecap="round"
          />

          {/* ── Live-sync dot at merge point ── */}
          <circle cx="22" cy="25" r="2.4"
            className="fill-[#f59e0b]"
          />
        </svg>

        {/* animated online indicator */}
        <span
          className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-400 ring-[2px] ring-[#f0f2f5] dark:ring-[#161616] animate-pulse"
        />
      </span>

      {/* ── Brand wordmark ─────────────────────────────────────────────── */}
      {showText && (
        <span className={`${dims.text} tracking-tight leading-none flex items-baseline gap-[2px]`}>
          <span className="font-black text-fg">Dev</span>
          <span className="font-black text-emerald-500">Collab</span>
        </span>
      )}
    </span>
  );
}
