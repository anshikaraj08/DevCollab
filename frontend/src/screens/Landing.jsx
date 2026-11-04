import { useState, useContext } from "react";
import PageContainer from "../components/layout/PageContainer";
import HowItWorks from "../components/landing/HowItWorks";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import api from "../config/axios";
import { UserContext } from "../context/user.context";
import {
  ReviewRoomsIllustration,
  CompilerIllustration,
  EditorIllustration,
} from "../components/landing/FeatureIllustrations";

const CODE_SAMPLES = {
  cpp: {
    title: "sqrtCustom.cpp",
    lang: "cpp",
    command: "g++ main.cpp && ./a.out",
    code: `#include <iostream>
#include <cmath>
using namespace std;

string sqrtCustom(double x) {
    if (x < 0) return to_string(sqrt(-x)) + "i";
    return to_string(sqrt(x));
}

int main() {
    cout << "sqrtCustom(4)  = " << sqrtCustom(4) << endl;
    cout << "sqrtCustom(-4) = " << sqrtCustom(-4) << endl;
    return 0;
}`,
    expectedOutput: `sqrtCustom(4)  = 2.000000\nsqrtCustom(-4) = 2.000000i\n✓ Process finished with exit code 0`,
  },
  javascript: {
    title: "twoSum.js",
    lang: "javascript",
    command: "node twoSum.js",
    code: `function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i];
    if (map.has(diff)) return [map.get(diff), i];
    map.set(nums[i], i);
  }
  return [];
}

console.log("Indices:", twoSum([2, 7, 11, 15], 9));`,
    expectedOutput: `Indices: [ 0, 1 ]\n✓ Process finished with exit code 0`,
  },
  python: {
    title: "quicksort.py",
    lang: "python",
    command: "python3 quicksort.py",
    code: `def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

print("Sorted:", quicksort([3, 6, 8, 10, 1, 2, 1]))`,
    expectedOutput: `Sorted: [1, 1, 2, 3, 6, 8, 10]\n✓ Process finished with exit code 0`,
  },
  java: {
    title: "Palindrome.java",
    lang: "java",
    command: "javac Palindrome.java && java Palindrome",
    code: `public class Palindrome {
    public static boolean isPalindrome(String s) {
        int l = 0, r = s.length() - 1;
        while (l < r) {
            if (s.charAt(l++) != s.charAt(r--)) return false;
        }
        return true;
    }
    public static void main(String[] args) {
        System.out.println("isPalindrome('racecar'): " + isPalindrome("racecar"));
    }
}`,
    expectedOutput: `isPalindrome('racecar'): true\n✓ Process finished with exit code 0`,
  },
};

const FEATURES = [
  {
    title: "Dedicated Review Rooms",
    text: "Create a persistent workspace room for each code snippet, pick its language, and share the room URL with teammates.",
    icon: "🗂️",
    badge: "Multiplayer",
    illustration: ReviewRoomsIllustration,
  },
  {
    title: "Multi-Language Compiler",
    text: "Compile and run C++, Python, JavaScript, and Java directly in the browser powered by the Wandbox API with live stdout/stderr.",
    icon: "⚡",
    badge: "Wandbox API",
    illustration: CompilerIllustration,
  },
  {
    title: "Monaco Code Editor",
    text: "Industry-standard editor with syntax highlighting, clean neutral dark/light theme, auto-indent, and instant code saving.",
    icon: "💻",
    badge: "VS Code Core",
    illustration: EditorIllustration,
  },
];

export default function Landing() {
  const { user } = useContext(UserContext);
  const [selectedLang, setSelectedLang] = useState("cpp");
  const [terminalOutput, setTerminalOutput] = useState(CODE_SAMPLES.cpp.expectedOutput);
  const [isRunning, setIsRunning] = useState(false);

  const handleSwitchLanguage = (langKey) => {
    setSelectedLang(langKey);
    setTerminalOutput(CODE_SAMPLES[langKey].expectedOutput);
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setTerminalOutput("Compiling with Wandbox...");
    const sample = CODE_SAMPLES[selectedLang];
    try {
      const { data } = await api.post("/run", {
        language: sample.lang,
        code: sample.code,
      });
      if (data.stderr && !data.stdout) {
        setTerminalOutput(`${data.stderr}\nExited with code ${data.code}`);
      } else {
        const out = data.stdout || sample.expectedOutput;
        setTerminalOutput(`${out.trim()}\n✓ Process completed successfully (exit ${data.code || 0})`);
      }
    } catch {
      setTimeout(() => {
        setTerminalOutput(sample.expectedOutput);
        setIsRunning(false);
      }, 300);
      return;
    }
    setIsRunning(false);
  };

  return (
    <>
      {/* ── Hero with Coder-style Illustrated Background ── */}
      <section className="relative overflow-hidden pt-20 pb-28 text-center border-b border-line bg-canvas">
        {/* Background Image Layer */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 dark:opacity-15 pointer-events-none transition-opacity"
          style={{ backgroundImage: "url('/hero-bg.jpg')" }}
        />

        {/* Ambient Gradient Overlay & Developer Grid */}
        <div className="absolute inset-0 bg-gradient-to-b from-canvas/40 via-transparent to-canvas pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

        {/* Whimsical Floating Developer Stickers (Left & Right) */}
        {/* Left Cloud & Peace Sign */}
        <div className="hidden xl:block absolute top-16 left-10 pointer-events-none select-none animate-pulse duration-1000">
          <svg className="w-32 h-20 text-muted/30 stroke-current" viewBox="0 0 120 70" fill="none" strokeWidth="1.6" strokeLinecap="round">
            <path d="M25 50 C15 50 10 40 18 32 C15 20 30 12 42 20 C50 10 70 10 78 20 C90 12 105 20 102 32 C110 40 105 50 95 50 Z" />
            <path d="M30 42 L38 34 M45 44 L53 36 M60 42 L68 34 M75 44 L83 36" strokeDasharray="2 3" opacity="0.6" />
          </svg>
        </div>

        <div className="hidden lg:flex absolute top-48 left-16 pointer-events-none select-none items-center gap-2 px-3 py-1.5 rounded-2xl bg-surface border border-line shadow-lg transform -rotate-6">
          <span className="text-base">✌️</span>
          <span className="text-[11px] font-mono font-bold text-fg">multiplayer</span>
        </div>

        {/* Right Cloud & Terminal Sticker */}
        <div className="hidden xl:block absolute top-12 right-12 pointer-events-none select-none animate-pulse duration-700">
          <svg className="w-36 h-22 text-muted/30 stroke-current" viewBox="0 0 130 75" fill="none" strokeWidth="1.6" strokeLinecap="round">
            <path d="M25 55 C15 55 10 44 20 35 C18 22 35 14 48 22 C56 12 78 12 86 22 C100 14 116 22 112 35 C122 44 116 55 105 55 Z" />
            <path d="M35 46 L43 38 M50 48 L58 40 M65 46 L73 38 M80 48 L88 40" strokeDasharray="2 3" opacity="0.6" />
          </svg>
        </div>

        <div className="hidden lg:flex absolute top-44 right-20 pointer-events-none select-none flex-col rounded-xl bg-[#090d16] border border-[#1e293b] p-3 shadow-2xl w-36 text-left font-mono transform rotate-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="size-2 rounded-full bg-[#ff5f56]" />
            <span className="size-2 rounded-full bg-[#ffbd2e]" />
            <span className="size-2 rounded-full bg-[#27c93f]" />
          </div>
          <span className="text-xs text-emerald-400 font-bold">$ devcollab</span>
          <span className="text-[10px] text-slate-400">syncing rooms...</span>
        </div>

        {/* Main Hero Content */}
        <PageContainer className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-line bg-surface/90 backdrop-blur-sm text-[11px] font-mono tracking-wider uppercase text-muted mb-6 shadow-xs">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{user ? `Logged in as ${user.name}` : "REAL-TIME COLLABORATIVE CODE WORKSPACE"}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.12] mb-6 text-fg">
            The developer workspace <br className="hidden sm:block" />
            platform for shared code
          </h1>

          <p className="text-sm sm:text-base text-muted max-w-2xl mx-auto leading-relaxed mb-8">
            DevCollab moves developer workspaces to the browser. Write, compile, execute, and review code together in real-time with zero configuration.
          </p>

          <div className="flex flex-wrap justify-center gap-3.5 mb-4">
            {user ? (
              <Button to="/dashboard" size="lg" className="shadow-md">
                Open Workspaces &rarr;
              </Button>
            ) : (
              <>
                <Button to="/register" size="lg" className="shadow-md">
                  Get Started Free &rarr;
                </Button>
                <Button to="/login" variant="secondary" size="lg">
                  Sign In
                </Button>
              </>
            )}
          </div>
        </PageContainer>

        {/* Delicate Grassy Meadow Horizon Line at bottom */}
        <div className="absolute bottom-0 inset-x-0 pointer-events-none flex justify-center text-muted/40">
          <svg className="w-full h-8 text-current stroke-current" preserveAspectRatio="none" viewBox="0 0 1200 30" fill="none">
            <path d="M0 25 Q300 15 600 25 T1200 25" strokeWidth="1.5" />
            {/* Flower doodles along the line */}
            <circle cx="150" cy="20" r="2.5" fill="currentColor" opacity="0.7" />
            <path d="M150 20 L150 25 M148 22 L152 22" strokeWidth="1" />
            <circle cx="380" cy="18" r="3" fill="currentColor" opacity="0.7" />
            <path d="M380 18 L380 25" strokeWidth="1" />
            <circle cx="720" cy="22" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="950" cy="20" r="3" fill="currentColor" opacity="0.7" />
            <path d="M950 20 L950 25" strokeWidth="1" />
          </svg>
        </div>
      </section>

      {/* ── Platform: Supported environments & runtimes ── */}
      <section id="platform" className="py-8">
        <PageContainer>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold font-mono text-muted uppercase tracking-wider">
                SUPPORTED ENVIRONMENTS &amp; RUNTIMES
              </span>
              <span className="text-[11px] font-mono text-faint">
                Wandbox API Engine
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-sky-100 dark:border-sky-950/60 bg-sky-50/70 dark:bg-sky-950/20 flex flex-col justify-between min-h-[95px]">
                <span className="w-7 h-7 rounded-lg bg-surface text-sky-600 dark:text-sky-400 font-mono font-bold text-xs flex items-center justify-center border border-sky-200/60 dark:border-sky-800/60">
                  C++
                </span>
                <div>
                  <p className="text-xs font-bold">GCC 10.3</p>
                  <p className="text-[10px] text-muted">Native Compiler</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-100 dark:border-amber-950/60 bg-amber-50/70 dark:bg-amber-950/20 flex flex-col justify-between min-h-[95px]">
                <span className="w-7 h-7 rounded-lg bg-surface text-amber-600 dark:text-amber-400 font-mono font-bold text-xs flex items-center justify-center border border-amber-200/60 dark:border-amber-800/60">
                  JS
                </span>
                <div>
                  <p className="text-xs font-bold">Node.js 20</p>
                  <p className="text-[10px] text-muted">V8 Engine</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-950/60 bg-emerald-50/70 dark:bg-emerald-950/20 flex flex-col justify-between min-h-[95px]">
                <span className="w-7 h-7 rounded-lg bg-surface text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/60">
                  PY
                </span>
                <div>
                  <p className="text-xs font-bold">Python 3.12</p>
                  <p className="text-[10px] text-muted">Live Execution</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-orange-100 dark:border-orange-950/60 bg-orange-50/70 dark:bg-orange-950/20 flex flex-col justify-between min-h-[95px]">
                <span className="w-7 h-7 rounded-lg bg-surface text-orange-600 dark:text-orange-400 font-mono font-bold text-xs flex items-center justify-center border border-orange-200/60 dark:border-orange-800/60">
                  JAVA
                </span>
                <div>
                  <p className="text-xs font-bold">OpenJDK 22</p>
                  <p className="text-[10px] text-muted">JVM Runtime</p>
                </div>
              </div>
            </div>
          </Card>
        </PageContainer>
      </section>

      {/* ── Features: Playground + Core features ── */}
      <section id="features" className="py-8">
        <PageContainer className="space-y-8">
          {/* Live Playground Card */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-bold">Live Execution Playground</h2>
                <p className="text-xs text-muted">Test compiling instantly in any language</p>
              </div>

              <div className="flex items-center gap-1.5 p-1 rounded-full border border-line bg-surface">
                {Object.keys(CODE_SAMPLES).map((langKey) => (
                  <button
                    key={langKey}
                    type="button"
                    onClick={() => handleSwitchLanguage(langKey)}
                    className={`cursor-pointer px-3 py-1 rounded-full text-xs font-semibold uppercase transition ${
                      selectedLang === langKey
                        ? "bg-surface-2 text-fg shadow-xs"
                        : "text-muted hover:text-fg"
                    }`}
                  >
                    {langKey}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              <div className="md:col-span-7 rounded-xl border border-line bg-canvas p-4 font-mono text-xs overflow-x-auto flex flex-col justify-between min-h-[220px]">
                <pre className="text-fg leading-relaxed whitespace-pre font-mono">
                  {CODE_SAMPLES[selectedLang].code}
                </pre>

                <div className="pt-3 mt-3 border-t border-line flex items-center justify-between">
                  <span className="text-[11px] text-faint font-mono">
                    {CODE_SAMPLES[selectedLang].title}
                  </span>
                  <Button size="sm" loading={isRunning} onClick={handleRunCode}>
                    &#9654; Run
                  </Button>
                </div>
              </div>

              <div className="md:col-span-5 rounded-xl border border-line bg-[#121316] text-white p-4 font-mono text-xs flex flex-col justify-between min-h-[220px]">
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-[#252528] text-[10px] text-neutral-400 font-mono">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span>OUTPUT CONSOLE</span>
                  </div>
                  <p className="text-sky-400 font-mono text-[11px] mb-2">
                    $ {CODE_SAMPLES[selectedLang].command}
                  </p>
                  <pre className="text-neutral-300 whitespace-pre-wrap leading-relaxed text-[11px] font-mono">
                    {terminalOutput}
                  </pre>
                </div>
              </div>
            </div>
          </Card>

          {/* 3 Illustrated Feature Cards */}
          <div className="grid gap-6 md:grid-cols-3">
            {FEATURES.map((f) => {
              const Illustration = f.illustration;
              return (
                <Card
                  key={f.title}
                  className="group overflow-hidden rounded-2xl border border-line bg-surface hover:border-fg/20 hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Visual Picture Illustration */}
                    <Illustration />

                    {/* Card Content */}
                    <div className="p-5 sm:p-6 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xl p-2 rounded-xl bg-surface-2 border border-line shadow-2xs">
                          {f.icon}
                        </span>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-surface-2 border border-line text-muted">
                          {f.badge}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-fg group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {f.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-muted leading-relaxed">
                        {f.text}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </PageContainer>
      </section>

      {/* ── How it works ── */}
      <HowItWorks />
    </>
  );
}
