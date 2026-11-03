import { useContext } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { UserContext } from "../../context/user.context";
import { useLogout } from "../../hooks/useLogout";
import Logo from "../Logo";
import ThemeToggle from "../ThemeToggle";
import Avatar from "../ui/Avatar";
import PageContainer from "./PageContainer";
import { cn } from "../../lib/cn";

const SECTIONS = [
  { href: "#features", label: "Features" },
  { href: "#platform", label: "Platform" },
  { href: "#how-it-works", label: "How it works" },
];

export default function MarketingLayout() {
  const { user, loading } = useContext(UserContext);
  const logout = useLogout();
  const location = useLocation();

  const isHome = location.pathname === "/";
  const isDashboard = location.pathname === "/dashboard";

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-fg transition-colors">
      {/* ── Persistent Header Bar ── */}
      <header className="sticky top-0 z-30 h-[76px] w-full border-b border-[#e2e5e9] dark:border-[#27272a] bg-[#f0f2f5] dark:bg-[#161616] shadow-xs transition-colors">
        <div className="flex h-full w-full items-center justify-between px-6 sm:px-10 gap-4">

          {/* Left: Brand Logo + Persistent Nav Buttons (same exact spot on all pages) */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to={user ? "/dashboard" : "/"} aria-label="DevCollab" className="flex items-center group shrink-0 mr-1">
              <Logo size="md" />
            </Link>

            <span className="h-5 w-px bg-line shrink-0" />

            {/* Home Pill */}
            <Link
              to="/"
              title="Home"
              className={cn(
                "flex items-center gap-2 h-9 px-4 rounded-full text-xs font-semibold select-none transition shrink-0 cursor-pointer border",
                isHome
                  ? "bg-fg text-canvas border-fg shadow-xs"
                  : "bg-surface text-muted hover:text-fg border-line hover:border-fg/30 hover:bg-surface-2"
              )}
            >
              <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              <span>Home</span>
            </Link>

            {/* Dashboard Pill (shown when user is authenticated) */}
            {user && (
              <Link
                to="/dashboard"
                title="Workspaces Dashboard"
                className={cn(
                  "flex items-center gap-2 h-9 px-4 rounded-full text-xs font-semibold select-none transition shrink-0 cursor-pointer border",
                  isDashboard
                    ? "bg-fg text-canvas border-fg shadow-xs"
                    : "bg-surface text-muted hover:text-fg border-line hover:border-fg/30 hover:bg-surface-2"
                )}
              >
                <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 8a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zm8-8a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zm0 8a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" clipRule="evenodd" />
                </svg>
                <span>Dashboard</span>
              </Link>
            )}
          </div>

          {/* Center: Anchor links only (clean, non-repeating) */}
          <nav aria-label="Page Sections" className="hidden items-center gap-6 md:flex">
            {SECTIONS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-xs font-semibold text-muted hover:text-fg transition select-none"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right: User Profile or Auth Buttons + ThemeToggle */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {!loading && (
              user ? (
                <>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={user.name} size="sm" />
                    <span className="text-sm font-semibold text-fg hidden md:inline">{user.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="text-xs font-semibold text-muted hover:text-fg transition cursor-pointer"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="h-9 px-4 rounded-full text-xs font-semibold text-muted hover:text-fg hover:bg-surface-2 transition flex items-center justify-center cursor-pointer"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    className="h-9 px-4 rounded-full text-xs font-bold bg-primary text-primary-fg hover:opacity-90 shadow-xs transition flex items-center justify-center cursor-pointer"
                  >
                    Get started
                  </Link>
                </div>
              )
            )}
            <ThemeToggle />
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
