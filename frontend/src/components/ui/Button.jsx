import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
 
const VARIANTS = {
  primary: "bg-primary text-primary-fg hover:opacity-90",
  secondary: "border border-line-strong bg-surface text-fg hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger text-white hover:opacity-90",
};
const SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-sm",
};
 
/** One button for the whole app. Give it `to` and it becomes a link. */
export default function Button({
  variant = "primary", size = "md", to, loading = false, disabled = false,
  className, children, ...props
}) {
  const classes = cn(
    "inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 rounded-full font-semibold transition",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant], SIZES[size], className,
  );
  if (to) return <Link to={to} className={classes} {...props}>{children}</Link>;
  return (
    <button type="button" className={classes} disabled={disabled || loading} {...props}>
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

