import { Link } from "react-router-dom";
import Logo from "../Logo";
import ThemeToggle from "../ThemeToggle";
import Card from "../ui/Card";
import PageContainer from "./PageContainer";
 
// Login and Register: logo + theme toggle on top, one centered card, a footer line.
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-fg">
      <header className="border-b border-line">
        <PageContainer className="flex h-14 items-center justify-between">
          <Link to="/" aria-label="DevCollab home"><Logo /></Link>
          <ThemeToggle />
        </PageContainer>
      </header>
      <main className="grid flex-1 place-items-center px-4 py-10">
        <Card className="w-full max-w-md p-8">
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <p className="mt-6 text-center text-sm text-muted">{footer}</p>}
        </Card>
      </main>
      <footer className="border-t border-line">
        <PageContainer className="flex h-14 items-center justify-center font-mono text-xs text-faint">
          &copy; {new Date().getFullYear()} DevCollab &bull; Collaborative Code Review Platform
        </PageContainer>
      </footer>
    </div>
  );
}

