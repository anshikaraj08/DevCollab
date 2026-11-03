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

export default function MarketingLayout() {
  const { user, loading } = useContext(UserContext);

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-fg transition-colors">
      {/* ── Consistent Full-Width Header Bar ── */}
      <header className="sticky top-0 z-30 h-16 w-full border-b border-[#e2e5e9] dark:border-[#27272a] bg-[#f0f2f5] dark:bg-[#161616] shadow-xs transition-colors">
        <div className="flex h-full w-full items-center justify-between px-5 sm:px-8 gap-4">

          {/* Left Corner: Brand Logo */}
          <div className="flex items-center gap-4">
            <Link to="/" aria-label="DevCollab home" className="flex items-center group">
              <Logo size="md" />
            </Link>
          </div>

          {/* Center Navigation */}
          <nav aria-label="Sections" className="hidden items-center gap-6 md:flex">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted hover:text-fg transition"
              >
                {link.label}
              </a>
            ))}
            {user && (
              <Link
                to="/dashboard"
                className="text-sm font-semibold text-fg hover:opacity-80 transition"
              >
                Dashboard
              </Link>
            )}
          </nav>

          {/* Right Corner: Theme Toggle & Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
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

        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <PageContainer className="flex h-16 items-center justify-between text-xs text-faint">
          <span className="font-mono">&copy; {new Date().getFullYear()} DevCollab</span>
          <span className="hidden font-mono sm:inline">Collaborative Code Review Platform</span>
        </PageContainer>
      </footer>
    </div>
  );
}
