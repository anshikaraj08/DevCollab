export const LANGUAGES = {
  javascript: "JavaScript",
  python: "Python",
  cpp: "C++",
  java: "Java",
};

export const LANGUAGE_STYLES = {
  cpp: {
    name: "C++",
    pill: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/80",
    dot: "bg-sky-500 shadow-sm shadow-sky-500/50",
    hoverBorder: "hover:border-sky-400 dark:hover:border-sky-500",
    hoverText: "group-hover:text-sky-600 dark:group-hover:text-sky-400",
    hoverShadow: "hover:shadow-sky-500/10 dark:hover:shadow-sky-500/20",
    accentColor: "#0284c7",
  },
  javascript: {
    name: "JavaScript",
    pill: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/80",
    dot: "bg-amber-500 shadow-sm shadow-amber-500/50",
    hoverBorder: "hover:border-amber-400 dark:hover:border-amber-500",
    hoverText: "group-hover:text-amber-600 dark:group-hover:text-amber-400",
    hoverShadow: "hover:shadow-amber-500/10 dark:hover:shadow-amber-500/20",
    accentColor: "#f59e0b",
  },
  python: {
    name: "Python",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/80",
    dot: "bg-emerald-500 shadow-sm shadow-emerald-500/50",
    hoverBorder: "hover:border-emerald-400 dark:hover:border-emerald-500",
    hoverText: "group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
    hoverShadow: "hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20",
    accentColor: "#10b981",
  },
  java: {
    name: "Java",
    pill: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/80",
    dot: "bg-orange-500 shadow-sm shadow-orange-500/50",
    hoverBorder: "hover:border-orange-400 dark:hover:border-orange-500",
    hoverText: "group-hover:text-orange-600 dark:group-hover:text-orange-400",
    hoverShadow: "hover:shadow-orange-500/10 dark:hover:shadow-orange-500/20",
    accentColor: "#f97316",
  },
};

export const getLanguageStyle = (lang) => {
  const key = (lang || "").toLowerCase();
  return (
    LANGUAGE_STYLES[key] || {
      name: lang || "Code",
      pill: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/80",
      dot: "bg-purple-500",
      hoverBorder: "hover:border-purple-400 dark:hover:border-purple-500",
      hoverText: "group-hover:text-purple-600 dark:group-hover:text-purple-400",
      hoverShadow: "hover:shadow-purple-500/10 dark:hover:shadow-purple-500/20",
      accentColor: "#a855f7",
    }
  );
};

