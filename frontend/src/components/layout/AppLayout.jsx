import { useContext, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import Logo from "../Logo";
import ThemeToggle from "../ThemeToggle";
import Avatar from "../ui/Avatar";
import NotificationBell from "../notifications/NotificationBell";
import { UserContext } from "../../context/user.context";
import { useLogout } from "../../hooks/useLogout";
import { useToast } from "../ui/Toast";
import api from "../../config/axios";
import getErrorMessage from "../../config/getErrorMessage";
import { cn } from "../../lib/cn";

export default function AppLayout({ children }) {
  const { user } = useContext(UserContext);
  const logout = useLogout();
  const location = useLocation();
  const toast = useToast();

  const [resending, setResending] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    return sessionStorage.getItem("hide_verify_banner") === "true";
  });

  const isHome = location.pathname === "/";
  const isDashboard = location.pathname === "/dashboard";
  const isSettings = location.pathname === "/settings";

  const handleDismissBanner = () => {
    sessionStorage.setItem("hide_verify_banner", "true");
    setBannerDismissed(true);
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const { data } = await api.post("/users/verify-email/request");
      toast.success(data.message || "Verification email sent!");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to send verification email"));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-fg transition-colors">
      {/* ── Optional Unverified Email Banner ── */}
      {user && !user.emailVerified && !bannerDismissed && (
        <div
          role="region"
          aria-label="Email verification notice"
          className="bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2 text-xs font-medium flex items-center justify-between gap-3 shrink-0 select-none z-40"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="size-2 rounded-full bg-amber-500 shrink-0" />
            <span className="truncate">
              Please verify your email address (<strong>{user.email}</strong>) to secure your account.
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="font-bold underline hover:no-underline cursor-pointer disabled:opacity-50"
            >
              {resending ? "Sending…" : "Resend email"}
            </button>
            <button
              type="button"
              onClick={handleDismissBanner}
              aria-label="Dismiss verification banner"
              className="text-amber-900 dark:text-amber-200 hover:opacity-75 transition font-bold text-sm px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Persistent Dark Header Bar ── */}
      <header className="sticky top-0 z-30 h-[76px] w-full border-b border-[#1e293b] bg-[#0f172a] text-white shadow-md transition-colors">
        <div className="flex h-full w-full items-center justify-between px-6 sm:px-10 gap-4">

          {/* Left: Brand Logo + Persistent Nav Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/dashboard" aria-label="DevCollab" className="flex items-center group shrink-0 mr-1">
              <Logo size="md" />
            </Link>

            <span className="h-5 w-px bg-white/20 shrink-0" />

            {/* Home Pill */}
            <Link
              to="/"
              title="Home"
              className={cn(
                "flex items-center gap-2 h-9 px-4 rounded-full text-xs font-semibold select-none transition shrink-0 cursor-pointer border",
                isHome
                  ? "bg-white text-slate-900 border-white shadow-sm font-bold"
                  : "bg-white/[0.08] hover:bg-white/[0.14] text-slate-300 hover:text-white border-white/10"
              )}
            >
              <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              <span>Home</span>
            </Link>

            {/* Dashboard Pill */}
            <Link
              to="/dashboard"
              title="Workspaces Dashboard"
              className={cn(
                "flex items-center gap-2 h-9 px-4 rounded-full text-xs font-semibold select-none transition shrink-0 cursor-pointer border",
                isDashboard
                  ? "bg-white text-slate-900 border-white shadow-sm font-bold"
                  : "bg-white/[0.08] hover:bg-white/[0.14] text-slate-300 hover:text-white border-white/10"
              )}
            >
              <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 8a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zm8-8a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zm0 8a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" clipRule="evenodd" />
              </svg>
              <span>Dashboard</span>
            </Link>
          </div>

          {/* Right: User Profile + Settings + Log Out + ThemeToggle */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {user && (
              <div className="flex items-center gap-2.5">
                <Avatar name={user.name} size="sm" />
                <span className="text-sm font-semibold text-white hidden md:inline">{user.name}</span>
              </div>
            )}

            {user && <NotificationBell user={user} />}

            {user && (
              <Link
                to="/settings"
                title="Account Settings"
                className={cn(
                  "flex items-center gap-1.5 h-8 sm:h-9 px-3 rounded-full text-xs font-semibold transition cursor-pointer select-none border",
                  isSettings
                    ? "bg-white text-slate-900 border-white shadow-sm font-bold"
                    : "bg-white/[0.08] hover:bg-white/[0.14] text-slate-300 hover:text-white border-white/10"
                )}
              >
                <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">Settings</span>
              </Link>
            )}

            <button
              type="button"
              onClick={logout}
              className="text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
            >
              Log out
            </button>
            <ThemeToggle />
          </div>

        </div>
      </header>

      <main className="flex-1">
        {children || <Outlet />}
      </main>
    </div>
  );
}
