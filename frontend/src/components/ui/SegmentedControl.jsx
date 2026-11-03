import { cn } from "../../lib/cn";
 
// A row of pill buttons where exactly one is selected (filters, language picker).
export default function SegmentedControl({ options, value, onChange, label, className }) {
  return (
    <div role="group" aria-label={label}
      className={cn("inline-flex max-w-full overflow-x-auto rounded-full border border-line bg-surface p-1", className)}>
      {options.map((option) => (
        <button
          key={option.value} type="button" aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "shrink-0 cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition",
            value === option.value ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

