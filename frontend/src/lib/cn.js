// Joins class names and skips empty ones: cn("a", cond && "b") -> "a b"
export const cn = (...parts) => parts.filter(Boolean).join(" ");

