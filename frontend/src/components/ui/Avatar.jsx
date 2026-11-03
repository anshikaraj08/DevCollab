import { cn } from "../../lib/cn";
 
const SIZES = { sm: "size-6 text-[10px]", md: "size-8 text-xs" };
 
// tone="plain" = the brand color. Pass colorIndex (0-7) to use a collaborator color.
export default function Avatar({ name = "?", size = "md", colorIndex, className, ...props }) {
  const colored = colorIndex !== undefined;
  return (
    <span
      title={name}
      style={colored ? { backgroundColor: `var(--c${colorIndex})` } : undefined}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-bold uppercase",
        colored ? "text-white" : "bg-primary text-primary-fg",
        SIZES[size], className,
      )}
      {...props}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

