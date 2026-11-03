import { useContext } from "react";
import { Link, Outlet } from "react-router-dom";
import Logo from "../Logo";
import ThemeToggle from "../ThemeToggle";
import PageContainer from "./PageContainer";
import Avatar from "../ui/Avatar";
import { UserContext } from "../../context/user.context";
import { useLogout } from "../../hooks/useLogout";

// Clean, organized app header with only working elements
export default function AppLayout() {
  const { user } = useContext(UserContext);
  const logout = useLogout();

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-fg transition-colors">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <PageContainer className="flex h-14 items-center justify-between">
          {/* Left: Brand Logo */}
          <Link to="/dashboard" aria-label="DevCollab Workspaces" className="flex items-center">
            <Logo />
          </Link>

          {/* Right: User info, logout, theme toggle */}
          <div className="flex items-center gap-3 sm:gap-4">
            {user && (
              <div className="flex items-center gap-2">
                <Avatar name={user.name} size="sm" />
                <span className="text-xs font-semibold text-fg hidden sm:inline">{user.name}</span>
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
        </PageContainer>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
