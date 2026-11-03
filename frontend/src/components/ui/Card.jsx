import { cn } from "../../lib/cn";
 
// The "div inside a div" container. Use as={Link} to make a clickable card.
export default function Card({ as: Tag = "div", className, children, ...props }) {
  return (
    <Tag className={cn("rounded-2xl border border-line bg-surface", className)} {...props}>
      {children}
    </Tag>
  );
}

