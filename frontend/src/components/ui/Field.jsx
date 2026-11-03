import { cn } from "../../lib/cn";
 
// A labelled text input with an optional hint or error message.
export default function Field({ label, error, hint, id, className, ...inputProps }) {
  const inputId = id ?? inputProps.name;
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label htmlFor={inputId} className="text-sm font-medium text-fg">{label}</label>}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(
          "h-11 w-full rounded-full border bg-canvas px-4 text-sm text-fg outline-none transition",
          "placeholder:text-faint focus:border-fg",
          error ? "border-danger" : "border-line-strong",
        )}
        {...inputProps}
      />
      {error ? <p className="text-xs text-danger">{error}</p>
        : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

