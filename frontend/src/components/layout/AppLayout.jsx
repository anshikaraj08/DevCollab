import { Link, Outlet } from "react-router-dom";
import Logo from "../Logo";
import ThemeToggle from "../ThemeToggle";
import PageContainer from "./PageContainer";
import UserMenu from "./UserMenu";

// The shell for logged-in pages: a slim bar with navigation and account.
export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur">
        <PageContainer className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" aria-label="DevCollab Home">
              <Logo />
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                to="/"
                className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-fg transition px-3 py-1.5 rounded-lg hover:bg-surface-2"
              >
                <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                <span>Home</span>
              </Link>
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 text-xs font-semibold text-fg bg-surface-2 px-3 py-1.5 rounded-lg"
              >
                Workspaces
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </PageContainer>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
