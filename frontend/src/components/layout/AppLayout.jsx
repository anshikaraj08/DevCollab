import { useContext } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import Logo from "../Logo";
import ThemeToggle from "../ThemeToggle";
import Avatar from "../ui/Avatar";
import { UserContext } from "../../context/user.context";
import { useLogout } from "../../hooks/useLogout";
import { cn } from "../../lib/cn";

export default function AppLayout() {
  const { user } = useContext(UserContext);
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === "/";
  const isDashboard = location.pathname === "/dashboard";

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-fg transition-colors">
      {/* ── Consistent Full-Width Header Bar ── */}
      <header className="sticky top-0 z-30 h-16 w-full border-b border-line bg-surface/95 backdrop-blur-md shadow-xs transition-colors">
        <div className="flex h-full w-full items-center justify-between px-5 sm:px-8 gap-4">

          {/* Left Corner: Brand Logo + Back button */}
          <div className="flex items-center gap-3 sm:gap-3.5">
            <Link to="/dashboard" aria-label="DevCollab" className="flex items-center group">
              <Logo size="md" />
            </Link>

            <button
              type="button"
              onClick={() => navigate(-1)}
              title="Go back to previous page"
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-muted hover:text-fg border border-line bg-surface-2 hover:bg-surface transition cursor-pointer"
            >
              <span>←</span>
              <span className="hidden sm:inline">Back</span>
            </button>
          </div>

          {/* Center: Home & Dashboard Navigation */}
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/"
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer border",
                isHome
                  ? "bg-fg text-canvas border-fg"
                  : "bg-surface-2/80 text-muted border-line hover:text-fg hover:border-fg/30 hover:bg-surface-2"
              )}
            >
              <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              <span>Home</span>
            </Link>

            <Link
              to="/dashboard"
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer border",
                isDashboard
                  ? "bg-fg text-canvas border-fg"
                  : "bg-surface-2/80 text-muted border-line hover:text-fg hover:border-fg/30 hover:bg-surface-2"
              )}
            >
              <svg className="size-3.5 text-muted" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm0 2h12v10H4V5zm2 2v2h8V7H6zm0 4v2h5v-2H6z" />
              </svg>
              <span>Dashboard</span>
            </Link>
          </nav>

          {/* Right Corner: User info, logout, theme toggle */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {user && (
              <div className="flex items-center gap-2">
                <Avatar name={user.name} size="sm" />
                <span className="text-xs font-semibold text-fg hidden md:inline">{user.name}</span>
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
