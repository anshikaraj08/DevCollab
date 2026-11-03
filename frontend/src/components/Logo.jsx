export default function Logo({ size = "md" }) {
  const textSize = { sm: "text-xs sm:text-sm", md: "text-sm sm:text-base", lg: "text-lg sm:text-xl" }[size];
  const iconSize = { sm: 12, md: 15, lg: 20 }[size];
  const wrapSize = { sm: "w-6 h-6", md: "w-7 h-7", lg: "w-9 h-9" }[size];

  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${textSize} text-neutral-900 dark:text-white select-none`}>
      <span className={`flex items-center justify-center ${wrapSize} rounded-lg bg-black text-white dark:bg-white dark:text-black shadow-xs`}>
        <svg
          viewBox="0 0 24 24"
          width={iconSize}
          height={iconSize}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 7l-5 5 5 5" />
          <path d="M16 7l5 5-5 5" />
        </svg>
      </span>
      <span>DevCollab</span>
    </span>
  );
}
