import { Link } from "react-router-dom";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#f8faf8] dark:bg-[#181818] text-neutral-900 dark:text-[#eff2f6] flex flex-col justify-between transition-colors duration-200">
      {/* Top Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-neutral-200/70 dark:border-[#2b2b2b]">
        <Link to="/" className="hover:opacity-90 transition">
          <Logo size="sm" />
        </Link>
        <ThemeToggle />
      </header>

      {/* Main Centered Card ("div inside a div" with minimal background) */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white dark:bg-[#202020] rounded-2xl border border-neutral-200 dark:border-[#2f2f2f] p-6 sm:p-8 shadow-sm">
          {children}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="py-4 text-center text-xs text-neutral-400 dark:text-[#666666] font-mono border-t border-neutral-200/50 dark:border-[#222222]">
        © {new Date().getFullYear()} DevCollab • Collaborative Code Review Platform
      </footer>
    </div>
  );
}
