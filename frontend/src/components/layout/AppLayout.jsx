import { Link, Outlet } from "react-router-dom";
import Logo from "../Logo";
import ThemeToggle from "../ThemeToggle";
import PageContainer from "./PageContainer";
import UserMenu from "./UserMenu";
 
// The shell for logged-in pages: a slim bar (logo + account) and the page below it.
// No marketing links here, because inside the app they only add noise.
export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur">
        <PageContainer className="flex h-14 items-center justify-between">
          <Link to="/dashboard" aria-label="Workspaces"><Logo /></Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </PageContainer>
      </header>
      <main className="flex-1"><Outlet /></main>
    </div>
  );
}

