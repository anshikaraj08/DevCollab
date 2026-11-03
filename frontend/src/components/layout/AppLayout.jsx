import { useContext } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import Logo from "../Logo";
import ThemeToggle from "../ThemeToggle";
import Avatar from "../ui/Avatar";
import { UserContext } from "../../context/user.context";
import { useLogout } from "../../hooks/useLogout";
import { cn } from "../../lib/cn";

const NAV_PILL =
  "flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-semibold transition cursor-pointer border shrink-0 select-none";

export default function AppLayout() {
  const { user } = useContext(UserContext);
  const logout = useLogout();
  const location = useLocation();

  const isHome      = location.pathname === "/";
  const isDashboard = location.pathname === "/dashboard";

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-fg transition-colors">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 h-[68px] w-full border-b border-[#e2e5e9] dark:border-[#27272a] bg-[#f0f2f5] dark:bg-[#161616] shadow-sm transition-colors">
        <div className="flex h-full w-full items-center justify-between px-6 sm:px-10 gap-4">

          {/* Left: Logo + nav pills */}
          <div className="flex items-center gap-3">
            <Link to="/dashboard" aria-label="DevCollab" className="flex items-center group shrink-0 mr-2">
              <Logo size="md" />
            </Link>

            {/* separator */}
            <span className="h-5 w-px bg-line shrink-0" />

            {/* Home */}
            <Link
              to="/"
              className={cn(NAV_PILL,
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

            {/* Dashboard */}
            <Link
              to="/dashboard"
              className={cn(NAV_PILL,
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
          </div>

          {/* Right: user info + log out + theme */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {user && (
              <div className="flex items-center gap-2.5">
                <Avatar name={user.name} size="sm" />
                <span className="text-sm font-semibold text-fg hidden md:inline">{user.name}</span>
              </div>
            )}
            <button
              onClick={logout}
              className="text-xs font-medium text-muted hover:text-fg transition cursor-pointer"
            >
              Log out
            </button>
            <ThemeToggle />
          </div>

        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
