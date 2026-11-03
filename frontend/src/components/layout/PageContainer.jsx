import { cn } from "../../lib/cn";
 
// THE width of the app. The navbar, every page and the footer all use this one component,
// so their left and right edges always line up.
export default function PageContainer({ className, children, ...props }) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-6", className)} {...props}>
      {children}
    </div>
  );
}

