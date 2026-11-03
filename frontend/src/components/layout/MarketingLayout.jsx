import { useContext } from "react";
import { Link, Outlet } from "react-router-dom";
import { UserContext } from "../../context/user.context";
import Logo from "../Logo";
import ThemeToggle from "../ThemeToggle";
import Button from "../ui/Button";
import PageContainer from "./PageContainer";
 
const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#platform", label: "Platform" },
  { href: "#how-it-works", label: "How it works" },
];
 
// The shell for public pages: navigation with section links, the page, and a footer.
export default function MarketingLayout() {
  const { user, loading } = useContext(UserContext);
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur">
        <PageContainer className="flex h-14 items-center justify-between gap-4">
          <Link to="/" aria-label="DevCollab home"><Logo /></Link>
          <nav aria-label="Sections" className="hidden items-center gap-6 md:flex">
            {LINKS.map((link) => (
              <a key={link.href} href={link.href} className="text-sm text-muted transition hover:text-fg">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {!loading && (user ? (
              <Button to="/dashboard" size="sm">Dashboard</Button>
            ) : (
              <>
                <Button to="/login" variant="ghost" size="sm">Log in</Button>
                <Button to="/register" size="sm">Get started</Button>
              </>
            ))}
          </div>
        </PageContainer>
      </header>
 
      <main className="flex-1"><Outlet /></main>
 
      <footer className="border-t border-line">
        <PageContainer className="flex h-16 items-center justify-between text-xs text-faint">
          <span className="font-mono">&copy; {new Date().getFullYear()} DevCollab</span>
          <span className="hidden font-mono sm:inline">Collaborative Code Review Platform</span>
        </PageContainer>
      </footer>
    </div>
  );
}

