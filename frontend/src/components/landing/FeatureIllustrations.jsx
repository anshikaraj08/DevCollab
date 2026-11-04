/**
 * Visual illustrations for Landing page Feature Cards and How-It-Works Cards.
 * Modern, responsive, high-fidelity developer UI mockups.
 */

/* ─── FEATURE 1: Dedicated Review Rooms ─── */
export function ReviewRoomsIllustration() {
  return (
    <div className="relative h-48 w-full overflow-hidden border-b border-line bg-gradient-to-br from-emerald-500/10 via-surface-2 to-teal-500/5 p-3.5 flex items-center justify-center select-none">
      {/* Background radial glow & grid dots */}
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

      {/* Mockup Card */}
      <div className="relative w-full max-w-[310px] rounded-xl border border-line bg-surface shadow-md overflow-hidden transition-transform duration-300 group-hover:scale-[1.02]">
        {/* Window Topbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-line bg-surface-2 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#ff5f56]" />
            <span className="size-2 rounded-full bg-[#ffbd2e]" />
            <span className="size-2 rounded-full bg-[#27c93f]" />
            <span className="ml-1.5 font-mono text-muted text-[10px] truncate max-w-[120px]">
              rooms/quick-sort
            </span>
          </div>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[9px]">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>

        {/* Room Body */}
        <div className="p-2.5 space-y-2 text-xs">
          {/* Active Collaborators Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center -space-x-1.5">
              <span className="size-5 rounded-full bg-emerald-500 text-white font-bold text-[9px] flex items-center justify-center ring-2 ring-surface">
                A
              </span>
              <span className="size-5 rounded-full bg-sky-500 text-white font-bold text-[9px] flex items-center justify-center ring-2 ring-surface">
                J
              </span>
              <span className="size-5 rounded-full bg-purple-500 text-white font-bold text-[9px] flex items-center justify-center ring-2 ring-surface">
                M
              </span>
              <span className="pl-2 text-[10px] text-muted font-mono font-medium">
                3 active peers
              </span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-2 text-muted border border-line">
              C++ 17
            </span>
          </div>

          {/* Share Link Pill */}
          <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-surface-2/80 border border-line text-[10px] font-mono">
            <span className="text-muted truncate mr-2">devcollab.io/room/8f92a</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[9px] shrink-0">
              Copied! ✓
            </span>
          </div>

          {/* Floating Review Comment */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted px-1.5 py-0.5 rounded bg-emerald-500/5 border border-emerald-500/20">
            <span className="text-emerald-500 font-bold">💬</span>
            <span className="truncate text-fg">Line 14: Logic verified & approved</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── FEATURE 2: Multi-Language Compiler ─── */
export function CompilerIllustration() {
  return (
    <div className="relative h-48 w-full overflow-hidden border-b border-line bg-gradient-to-br from-sky-500/10 via-surface-2 to-indigo-500/5 p-3.5 flex items-center justify-center select-none">
      {/* Background radial glow & grid dots */}
      <div className="absolute inset-0 bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-sky-500/20 rounded-full blur-2xl pointer-events-none" />

      {/* Mockup Card */}
      <div className="relative w-full max-w-[310px] rounded-xl border border-line bg-[#0d131f] text-white shadow-md overflow-hidden transition-transform duration-300 group-hover:scale-[1.02] font-mono">
        {/* Language selector chips */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#1e293b] bg-[#090d16] text-[9px]">
          <div className="flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30">
              C++
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
              JS
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
              PY
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
              JAVA
            </span>
          </div>
          <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
            <span className="size-1 rounded-full bg-emerald-400" />
            Wandbox
          </span>
        </div>

        {/* Terminal Screen */}
        <div className="p-2.5 space-y-1.5 text-[10px] leading-snug">
          <div className="text-slate-400 flex items-center gap-1.5">
            <span className="text-emerald-400 font-bold">$</span>
            <span>g++ -O3 main.cpp &amp;&amp; ./a.out</span>
          </div>
          
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-emerald-400 font-semibold">
              ✓ Process finished (exit 0)
            </span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
              0.08s
            </span>
          </div>

          <div className="p-1.5 rounded bg-[#161d2d] border border-[#222f47] text-sky-300 text-[10px]">
            Output: [ 1, 2, 3, 5, 8, 13 ]
          </div>

          <div className="flex items-center justify-between text-[8px] text-slate-500 pt-0.5">
            <span>Memory: 2.1 MB</span>
            <span>GCC 10.3 • Sandboxed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── FEATURE 3: Monaco Code Editor ─── */
export function EditorIllustration() {
  return (
    <div className="relative h-48 w-full overflow-hidden border-b border-line bg-gradient-to-br from-purple-500/10 via-surface-2 to-pink-500/5 p-3.5 flex items-center justify-center select-none">
      {/* Background radial glow & grid dots */}
      <div className="absolute inset-0 bg-[radial-gradient(#a855f7_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

      {/* Mockup Card */}
      <div className="relative w-full max-w-[310px] rounded-xl border border-line bg-surface shadow-md overflow-hidden transition-transform duration-300 group-hover:scale-[1.02] font-mono">
        {/* Editor Tab Bar */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-line bg-surface-2 text-[10px]">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface border border-line text-fg font-semibold text-[9px]">
              <span className="text-purple-500">⚛</span>
              <span>App.tsx</span>
            </span>
            <span className="text-muted text-[9px]">styles.css</span>
          </div>
          <span className="text-[9px] text-purple-600 dark:text-purple-400 font-bold">
            Monaco
          </span>
        </div>

        {/* Editor Code Lines */}
        <div className="p-2.5 text-[10px] space-y-1 relative bg-canvas/70 leading-relaxed">
          <div className="flex items-center gap-2.5">
            <span className="text-muted/60 select-none text-[9px] w-2.5 text-right">1</span>
            <span className="text-fg truncate">
              <span className="text-purple-500 font-semibold">import</span> &#123; useState &#125; <span className="text-purple-500 font-semibold">from</span> <span className="text-emerald-500">"react"</span>;
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-muted/60 select-none text-[9px] w-2.5 text-right">2</span>
            <span className="text-fg truncate">
              <span className="text-purple-500 font-semibold">export</span> <span className="text-purple-500 font-semibold">function</span> <span className="text-sky-500">Room</span>() &#123;
            </span>
          </div>

          {/* Autocomplete Suggestion Popup */}
          <div className="ml-4 mt-1 p-1.5 rounded-lg border border-purple-500/30 bg-surface shadow-lg text-[9px] space-y-0.5 max-w-[190px]">
            <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold">
              <span>✦ useMultiplayerState</span>
              <span className="text-[8px] opacity-75">Hook</span>
            </div>
            <div className="px-1.5 py-0.5 text-muted flex items-center justify-between">
              <span>&nbsp;&nbsp;useEditorTheme</span>
              <span className="text-[8px] opacity-75">Hook</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── HOW IT WORKS 1: Create a workspace ─── */
export function CreateWorkspaceIllustration() {
  return (
    <div className="relative h-44 w-full overflow-hidden border-b border-line bg-gradient-to-br from-emerald-500/10 via-surface-2 to-teal-500/5 p-3 flex items-center justify-center select-none">
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:14px_14px] opacity-15" />
      <span className="absolute top-2 right-3 font-mono font-black text-2xl text-emerald-500/20 select-none">
        01
      </span>

      {/* Modal Dialog Mockup */}
      <div className="relative w-full max-w-[280px] rounded-xl border border-line bg-surface p-3 shadow-md space-y-2 transition-transform duration-300 group-hover:scale-[1.02]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-fg">New Workspace</span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
            Instant
          </span>
        </div>

        {/* Input Field */}
        <div className="px-2 py-1 rounded-md border border-line bg-canvas text-[10px] font-mono text-fg flex items-center justify-between">
          <span className="truncate">leetcode-session</span>
          <span className="text-muted text-[8px]">Room Title</span>
        </div>

        {/* Language selector chips */}
        <div className="grid grid-cols-4 gap-1 text-[9px] font-mono text-center">
          <span className="py-0.5 rounded border border-line bg-surface-2 text-muted">C++</span>
          <span className="py-0.5 rounded border border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">JS ✓</span>
          <span className="py-0.5 rounded border border-line bg-surface-2 text-muted">Python</span>
          <span className="py-0.5 rounded border border-line bg-surface-2 text-muted">Java</span>
        </div>

        {/* Primary CTA */}
        <div className="w-full py-1 rounded-md bg-emerald-500 text-slate-950 font-bold text-[10px] text-center shadow-xs">
          Create Workspace &rarr;
        </div>
      </div>
    </div>
  );
}

/* ─── HOW IT WORKS 2: Write and run ─── */
export function WriteAndRunIllustration() {
  return (
    <div className="relative h-44 w-full overflow-hidden border-b border-line bg-gradient-to-br from-sky-500/10 via-surface-2 to-cyan-500/5 p-3 flex items-center justify-center select-none">
      <div className="absolute inset-0 bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:14px_14px] opacity-15" />
      <span className="absolute top-2 right-3 font-mono font-black text-2xl text-sky-500/20 select-none">
        02
      </span>

      {/* Editor & Run Action Mockup */}
      <div className="relative w-full max-w-[280px] rounded-xl border border-line bg-surface p-3 shadow-md space-y-2 transition-transform duration-300 group-hover:scale-[1.02] font-mono">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-fg font-bold">solution.js</span>
          {/* Active Run Button */}
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[9px] shadow-xs">
            <svg width="7" height="9" viewBox="0 0 10 12" fill="currentColor">
              <path d="M1 1l8 5-8 5V1z" />
            </svg>
            <span>Run</span>
          </span>
        </div>

        {/* Code Snippet */}
        <div className="p-1.5 rounded-md bg-canvas border border-line text-[9px] text-fg space-y-0.5">
          <div className="text-muted/70"><span className="text-purple-500 font-semibold">function</span> <span className="text-sky-500">twoSum</span>(nums, target) &#123;</div>
          <div className="pl-2 text-emerald-500">&nbsp;&nbsp;<span className="text-purple-500 font-semibold">return</span> [0, 1];</div>
          <div className="text-muted/70">&#125;</div>
        </div>

        {/* Output Pill */}
        <div className="flex items-center justify-between px-2 py-1 rounded-md bg-[#0e1420] text-white text-[9px]">
          <span className="text-emerald-400">stdout: [ 0, 1 ]</span>
          <span className="text-slate-400 text-[8px]">0.04s ✓</span>
        </div>
      </div>
    </div>
  );
}

/* ─── HOW IT WORKS 3: Share and review ─── */
export function ShareAndReviewIllustration() {
  return (
    <div className="relative h-44 w-full overflow-hidden border-b border-line bg-gradient-to-br from-amber-500/10 via-surface-2 to-rose-500/5 p-3 flex items-center justify-center select-none">
      <div className="absolute inset-0 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:14px_14px] opacity-15" />
      <span className="absolute top-2 right-3 font-mono font-black text-2xl text-amber-500/20 select-none">
        03
      </span>

      {/* Multiplayer Cursors & Comment Mockup */}
      <div className="relative w-full max-w-[280px] rounded-xl border border-line bg-surface p-3 shadow-md space-y-2 transition-transform duration-300 group-hover:scale-[1.02]">
        {/* Code line with multiplayer cursor tags */}
        <div className="p-1.5 rounded-md bg-canvas border border-line text-[9px] font-mono relative">
          <div className="flex items-center gap-1 text-fg">
            <span>let max = Math.max(...arr);</span>
            {/* Anshika Cursor */}
            <span className="relative inline-flex items-center">
              <span className="w-[1.5px] h-3 bg-emerald-500 animate-pulse" />
              <span className="absolute -top-3.5 left-0 px-1 py-0.2 rounded bg-emerald-500 text-white font-sans text-[7px] font-bold shadow-xs whitespace-nowrap">
                Anshika
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1 text-muted/80 mt-1.5">
            <span>return max;</span>
            {/* John Cursor */}
            <span className="relative inline-flex items-center">
              <span className="w-[1.5px] h-3 bg-sky-500 animate-pulse" />
              <span className="absolute -top-3.5 left-0 px-1 py-0.2 rounded bg-sky-500 text-white font-sans text-[7px] font-bold shadow-xs whitespace-nowrap">
                John
              </span>
            </span>
          </div>
        </div>

        {/* Comment Thread Card */}
        <div className="flex items-start gap-1.5 p-1.5 rounded-md bg-surface-2 border border-line text-[9px]">
          <span className="size-4 rounded-full bg-emerald-500 text-white font-bold text-[8px] flex items-center justify-center shrink-0">
            A
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-fg">Anshika</span>
              <span className="text-[8px] text-emerald-600 dark:text-emerald-400">Line 4</span>
            </div>
            <p className="text-muted text-[8px] truncate mt-0.5">
              &ldquo;Great optimization! Ready to merge.&rdquo;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

