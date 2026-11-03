import { Link } from "react-router-dom";
import Logo from "../Logo";
import ThemeToggle from "../ThemeToggle";

export default function AuthLayout({
  title = "Welcome back!",
  subtitle = "Simplify your workflow and boost your productivity with DevCollab. Get started for free.",
  children,
  footer,
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-fg transition-colors">
      {/* ── Persistent Header with Soft Cool Slate Background ── */}
      <header className="sticky top-0 z-30 h-[76px] w-full border-b border-[#cbd5e1] dark:border-[#27303f] bg-[#e6ebf2] dark:bg-[#161a22] shadow-xs transition-colors">
        <div className="flex h-full w-full items-center justify-between px-6 sm:px-10">
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" aria-label="DevCollab Home" className="flex items-center group shrink-0 mr-1">
              <Logo size="md" />
            </Link>

            <span className="h-5 w-px bg-slate-300 dark:bg-slate-700 shrink-0" />

            <Link
              to="/"
              className="flex items-center gap-2 h-9 px-4 rounded-full text-xs font-semibold bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-300/80 dark:bg-[#202633] dark:hover:bg-[#272e3d] dark:text-slate-200 dark:border-[#333d4e] transition cursor-pointer select-none shrink-0 shadow-2xs"
            >
              <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              <span>Home</span>
            </Link>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* ── Main Mockup Window ── */}
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl transition-all">

          {/* Browser Window Chrome */}
          <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-[#ff5f56]" />
              <span className="size-3 rounded-full bg-[#ffbd2e]" />
              <span className="size-3 rounded-full bg-[#27c93f]" />
            </div>

            <div className="flex items-center gap-2 rounded-full border border-line bg-canvas px-4 py-1 text-xs text-muted font-mono max-w-xs truncate">
              <svg className="size-3 text-muted shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="truncate">https://devcollab.io/auth</span>
            </div>

            <div className="w-12 text-right text-xs text-muted">
              <span>&#x27F3;</span>
            </div>
          </div>

          {/* Window Body: Two Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 p-6 sm:p-10 gap-8 items-center">

            {/* Left Column: Form */}
            <div className="flex flex-col justify-center space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-fg">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>

              {children}

              {/* Divider */}
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-line" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase">
                  <span className="bg-surface px-3 text-faint font-medium">
                    or continue with
                  </span>
                </div>
              </div>

              {/* Social Buttons */}
              <div className="flex justify-center gap-4">
                <button
                  type="button"
                  title="Continue with Google"
                  className="flex size-10 items-center justify-center rounded-full border border-line bg-surface-2 text-fg hover:border-fg/40 hover:bg-surface transition shadow-xs cursor-pointer"
                >
                  <svg className="size-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  title="Continue with Apple"
                  className="flex size-10 items-center justify-center rounded-full border border-line bg-surface-2 text-fg hover:border-fg/40 hover:bg-surface transition shadow-xs cursor-pointer"
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.93-2.85-.9.04-1.99.6-2.63 1.35-.56.65-.96 1.7-0.83 2.73 1.01.08 2.04-.51 2.53-1.23z" />
                  </svg>
                </button>
                <button
                  type="button"
                  title="Continue with GitHub"
                  className="flex size-10 items-center justify-center rounded-full border border-line bg-surface-2 text-fg hover:border-fg/40 hover:bg-surface transition shadow-xs cursor-pointer"
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                </button>
              </div>

              {/* Bottom Footer Link */}
              {footer && (
                <div className="text-center text-xs text-muted pt-1">
                  {footer}
                </div>
              )}
            </div>

            {/* Right Column: Live Collaborative Coding Session Showcase */}
            <div className="hidden md:flex flex-col justify-between rounded-2xl border border-line bg-surface-2/60 p-6 min-h-[460px] relative overflow-hidden">
              
              {/* Header Badge */}
              <div className="flex items-center justify-between w-full mb-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-mono font-bold text-fg uppercase tracking-wider">Live Multiplayer Room</span>
                </div>
                <div className="flex items-center -space-x-1.5">
                  <span className="size-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center justify-center shadow-xs">
                    A
                  </span>
                  <span className="size-6 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-600 dark:text-sky-400 font-bold text-[10px] flex items-center justify-center shadow-xs">
                    J
                  </span>
                </div>
              </div>

              {/* Collaborative Code Editor Window Mockup */}
              <div className="w-full rounded-xl border border-line bg-surface shadow-xl overflow-hidden text-left font-mono my-auto">
                {/* Editor Window Topbar */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-line bg-surface-2">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[#ff5f56]" />
                    <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
                    <span className="size-2.5 rounded-full bg-[#27c93f]" />
                    <span className="text-[10px] font-semibold text-muted ml-2">binarySearch.js</span>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    2 Peers Connected
                  </span>
                </div>

                {/* Editor Lines with Multi-User Cursors */}
                <div className="p-3.5 text-[11px] leading-relaxed space-y-1 bg-canvas/60">
                  <div className="flex items-center gap-3 text-muted/60">
                    <span className="w-3 text-right select-none text-[10px]">1</span>
                    <span className="text-fg"><span className="text-purple-500 font-semibold">function</span> <span className="text-sky-500">search</span>(arr, target) &#123;</span>
                  </div>

                  {/* Line 2 with Anshika's Multiplayer Cursor */}
                  <div className="flex items-center gap-3 relative bg-emerald-500/10 -mx-3.5 px-3.5 py-0.5 rounded">
                    <span className="w-3 text-right select-none text-[10px] text-emerald-600 font-bold">2</span>
                    <span className="text-fg flex items-center">
                      &nbsp;&nbsp;<span className="text-purple-500 font-semibold">let</span> left = <span className="text-amber-500">0</span>, right = arr.length - <span className="text-amber-500">1</span>;
                      {/* Anshika Cursor & Tag */}
                      <span className="relative inline-flex items-center ml-0.5">
                        <span className="w-[2px] h-3.5 bg-emerald-500 animate-pulse inline-block" />
                        <span className="absolute -top-4 left-0 px-1.5 py-0.2 rounded bg-emerald-500 text-white font-sans text-[8px] font-bold shadow-xs whitespace-nowrap">
                          Anshika
                        </span>
                      </span>
                    </span>
                  </div>

                  {/* Line 3 with John's Multiplayer Cursor */}
                  <div className="flex items-center gap-3 relative bg-sky-500/10 -mx-3.5 px-3.5 py-0.5 rounded">
                    <span className="w-3 text-right select-none text-[10px] text-sky-600 font-bold">3</span>
                    <span className="text-fg flex items-center">
                      &nbsp;&nbsp;<span className="text-purple-500 font-semibold">while</span> (left &lt;= right) &#123;
                      {/* John Cursor & Tag */}
                      <span className="relative inline-flex items-center ml-0.5">
                        <span className="w-[2px] h-3.5 bg-sky-500 animate-pulse inline-block" />
                        <span className="absolute -top-4 left-0 px-1.5 py-0.2 rounded bg-sky-500 text-white font-sans text-[8px] font-bold shadow-xs whitespace-nowrap">
                          John
                        </span>
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-muted/60">
                    <span className="w-3 text-right select-none text-[10px]">4</span>
                    <span className="text-fg">&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-purple-500 font-semibold">const</span> mid = Math.floor((left + right) / <span className="text-amber-500">2</span>);</span>
                  </div>

                  <div className="flex items-center gap-3 text-muted/60">
                    <span className="w-3 text-right select-none text-[10px]">5</span>
                    <span className="text-fg">&nbsp;&nbsp;&#125;</span>
                  </div>
                </div>

                {/* Live Peer Review Comment Box */}
                <div className="p-2.5 border-t border-line bg-surface-2/80 flex items-start gap-2.5">
                  <div className="size-5 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    A
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-fg">Anshika Raj</span>
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">Line 3 &bull; Reviewed</span>
                    </div>
                    <p className="text-[10px] text-muted font-sans mt-0.5 leading-tight">
                      &ldquo;Logic looks optimal. Ready to run and compile!&rdquo;
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Quote & Collaboration Tag */}
              <div className="w-full pt-4 text-center">
                <div className="flex justify-center gap-1.5 mb-2">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span className="size-1.5 rounded-full bg-sky-500" />
                  <span className="size-1.5 rounded-full bg-line-strong" />
                </div>
                <p className="text-xs font-medium text-fg max-w-xs mx-auto leading-relaxed">
                  Real-time multiplayer coding, shared rooms, and inline reviews with <span className="font-bold text-emerald-600 dark:text-emerald-400">DevCollab</span>
                </p>
              </div>

            </div>

          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-line py-3 text-center text-xs text-faint font-mono">
        &copy; {new Date().getFullYear()} DevCollab &bull; Collaborative Code Review Platform
      </footer>
    </div>
  );
}
