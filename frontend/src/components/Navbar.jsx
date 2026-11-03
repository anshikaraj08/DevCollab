import { Link } from "react-router-dom";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

export default function Navbar({ right }) {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 dark:border-[#2b2b2b] bg-white/95 dark:bg-[#1f1f1f]/95 backdrop-blur-md transition-colors">
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition">
          <Logo size="sm" />
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-600 dark:text-[#a0a0a0]">
          <a href="#features" className="hover:text-black dark:hover:text-white transition">Features</a>
          <a href="#workspace" className="hover:text-black dark:hover:text-white transition">Platform</a>
          <a href="#how" className="hover:text-black dark:hover:text-white transition">How it works</a>
        </nav>

        <div className="flex items-center gap-3">
          {right}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
