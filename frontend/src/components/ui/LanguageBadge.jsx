import { cn } from "../../lib/cn";
 
// Full class names must appear in the source so Tailwind can find them.
export const LANGUAGES = {
  cpp: {
    label: "C++",
    badge: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    dot: "bg-sky-500",
    hover: "hover:border-sky-400",
  },
  javascript: {
    label: "JavaScript",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    dot: "bg-amber-500",
    hover: "hover:border-amber-400",
  },
  python: {
    label: "Python",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    dot: "bg-emerald-500",
    hover: "hover:border-emerald-400",
  },
  java: {
    label: "Java",
    badge: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
    dot: "bg-orange-500",
    hover: "hover:border-orange-400",
  },
};
 
export const languageLabel = (language) => LANGUAGES[language]?.label ?? language;
 
export default function LanguageBadge({ language, className }) {
  const style = LANGUAGES[language];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium",
      style?.badge ?? "bg-surface-2 text-muted", className,
    )}>
      <span className={cn("size-1.5 rounded-full", style?.dot ?? "bg-faint")} />
      {languageLabel(language)}
    </span>
  );
}

