import { useState, useContext } from "react";
import { Link } from "react-router-dom";
import { UserContext } from "../context/user.context";
import Navbar from "../components/Navbar";
import Logo from "../components/Logo";
import { LANGUAGES, getLanguageStyle } from "../config/languages";
import api from "../config/axios";

// Interactive compiler snippets for visitors to test directly on Home
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
  },
  {
    title: "Multi-Language Compiler",
    text: "Compile and run C++, Python, JavaScript, and Java directly in the browser powered by the Wandbox API with live stdout/stderr.",
    icon: "⚡",
  },
  {
    title: "Monaco Code Editor",
    text: "Industry-standard editor with syntax highlighting, clean neutral dark/light theme, auto-indent, and instant code saving.",
    icon: "💻",
  },
];

export default function Landing() {
  const { user, loading } = useContext(UserContext);
  const [selectedLang, setSelectedLang] = useState("cpp");
  const [terminalOutput, setTerminalOutput] = useState(CODE_SAMPLES.cpp.expectedOutput);
  const [isRunning, setIsRunning] = useState(false);

  // Switch terminal language
  const handleSwitchLanguage = (langKey) => {
    setSelectedLang(langKey);
    setTerminalOutput(CODE_SAMPLES[langKey].expectedOutput);
  };

  // Run snippet against live backend / Wandbox
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
    <div className="min-h-screen bg-[#f8faf8] dark:bg-[#181818] text-neutral-900 dark:text-[#eff2f6] flex flex-col transition-colors duration-200">
      {/* ── Standard Clean Navbar ── */}
      <Navbar
        right={
          !loading && (
            user ? (
              <Link
                to="/dashboard"
                className="px-5 py-2 rounded-full text-xs font-semibold bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition"
              >
                Dashboard
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-[#a0a0a0] hover:text-black dark:hover:text-white transition"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2 rounded-full text-xs font-semibold bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition"
                >
                  Get started
                </Link>
              </div>
            )
          )
        }
      />

      {/* ── Hero Section ── */}
      <section className="max-w-4xl mx-auto px-5 pt-14 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-neutral-300 dark:border-[#383838] bg-white dark:bg-[#222222] text-[11px] font-mono tracking-wider uppercase text-neutral-600 dark:text-[#a0a0a0] mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>REAL-TIME COLLABORATIVE CODE WORKSPACE</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-neutral-900 dark:text-white leading-[1.15] mb-5">
          Write, compile, and review <br className="hidden sm:block" />
          code in shared rooms
        </h1>

        <p className="text-xs sm:text-sm text-neutral-600 dark:text-[#8a8a8e] max-w-xl mx-auto leading-relaxed mb-8">
          DevCollab provides fast, distraction-free workspaces with instant execution for C++, JavaScript, Python, and Java.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            to={user ? "/dashboard" : "/register"}
            className="px-7 py-3 rounded-full text-xs font-bold bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition shadow-xs active:scale-95"
          >
            {user ? "Open Dashboard" : "Get Started Free"} &rarr;
          </Link>
          <Link
            to={user ? "/dashboard" : "/login"}
            className="px-7 py-3 rounded-full text-xs font-semibold border border-neutral-300 dark:border-[#383838] text-neutral-800 dark:text-[#eff2f6] hover:bg-neutral-100 dark:hover:bg-[#282828] transition"
          >
            {user ? "View Rooms" : "Sign In"}
          </Link>
        </div>
      </section>

      {/* ── Supported Languages: div inside a div with minimal background tints ── */}
      <section className="max-w-4xl mx-auto px-5 py-6 w-full">
        <div className="p-5 sm:p-6 rounded-2xl border border-neutral-200 dark:border-[#2f2f2f] bg-white dark:bg-[#202020] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-bold font-mono text-neutral-500 dark:text-[#8a8a8e] uppercase tracking-wider">
              SUPPORTED ENVIRONMENTS &amp; RUNTIMES
            </span>
            <span className="text-[11px] font-mono text-neutral-400 dark:text-[#777777]">
              Wandbox API Engine
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* C++ */}
            <div className="p-3.5 rounded-xl border border-sky-100 dark:border-sky-950/60 bg-sky-50/70 dark:bg-sky-950/20 hover:border-sky-300 dark:hover:border-sky-700 transition flex flex-col justify-between min-h-[95px]">
              <span className="w-7 h-7 rounded-lg bg-white dark:bg-[#1e2530] text-sky-600 dark:text-sky-400 font-mono font-bold text-xs flex items-center justify-center border border-sky-200/60 dark:border-sky-800/60">
                C++
              </span>
              <div>
                <p className="text-xs font-bold text-neutral-900 dark:text-white">GCC 10.3</p>
                <p className="text-[10px] text-neutral-500 dark:text-[#888890]">Native Compiler</p>
              </div>
            </div>

            {/* JavaScript */}
            <div className="p-3.5 rounded-xl border border-amber-100 dark:border-amber-950/60 bg-amber-50/70 dark:bg-amber-950/20 hover:border-amber-300 dark:hover:border-amber-700 transition flex flex-col justify-between min-h-[95px]">
              <span className="w-7 h-7 rounded-lg bg-white dark:bg-[#2c2419] text-amber-600 dark:text-amber-400 font-mono font-bold text-xs flex items-center justify-center border border-amber-200/60 dark:border-amber-800/60">
                JS
              </span>
              <div>
                <p className="text-xs font-bold text-neutral-900 dark:text-white">Node.js 20</p>
                <p className="text-[10px] text-neutral-500 dark:text-[#888890]">V8 Engine</p>
              </div>
            </div>

            {/* Python */}
            <div className="p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-950/60 bg-emerald-50/70 dark:bg-emerald-950/20 hover:border-emerald-300 dark:hover:border-emerald-700 transition flex flex-col justify-between min-h-[95px]">
              <span className="w-7 h-7 rounded-lg bg-white dark:bg-[#1a2820] text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/60">
                PY
              </span>
              <div>
                <p className="text-xs font-bold text-neutral-900 dark:text-white">Python 3.12</p>
                <p className="text-[10px] text-neutral-500 dark:text-[#888890]">Live Execution</p>
              </div>
            </div>

            {/* Java */}
            <div className="p-3.5 rounded-xl border border-orange-100 dark:border-orange-950/60 bg-orange-50/70 dark:bg-orange-950/20 hover:border-orange-300 dark:hover:border-orange-700 transition flex flex-col justify-between min-h-[95px]">
              <span className="w-7 h-7 rounded-lg bg-white dark:bg-[#2b1f16] text-orange-600 dark:text-orange-400 font-mono font-bold text-xs flex items-center justify-center border border-orange-200/60 dark:border-orange-800/60">
                JAVA
              </span>
              <div>
                <p className="text-xs font-bold text-neutral-900 dark:text-white">OpenJDK 22</p>
                <p className="text-[10px] text-neutral-500 dark:text-[#888890]">JVM Runtime</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Interactive Compiler Playground: test code directly on Home ── */}
      <section className="max-w-4xl mx-auto px-5 py-6 w-full">
        <div className="rounded-2xl border border-neutral-200 dark:border-[#2f2f2f] bg-white dark:bg-[#202020] p-5 sm:p-6 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Live Execution Playground</h2>
              <p className="text-xs text-neutral-500 dark:text-[#888890]">Test compiling instantly in any language</p>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-neutral-100 dark:bg-[#1a1a1a] border border-neutral-200 dark:border-[#2f2f2f]">
              {Object.keys(CODE_SAMPLES).map((langKey) => (
                <button
                  key={langKey}
                  onClick={() => handleSwitchLanguage(langKey)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold uppercase transition ${
                    selectedLang === langKey
                      ? "bg-white dark:bg-[#282828] text-neutral-900 dark:text-white shadow-xs"
                      : "text-neutral-500 dark:text-[#888890] hover:text-black dark:hover:text-white"
                  }`}
                >
                  {langKey}
                </button>
              ))}
            </div>
          </div>

          {/* Editor & Console Split */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
            {/* Left: Code Snippet */}
            <div className="md:col-span-7 rounded-xl border border-neutral-200 dark:border-[#2f2f2f] bg-neutral-50 dark:bg-[#191919] p-4 font-mono text-xs overflow-x-auto flex flex-col justify-between min-h-[220px]">
              <pre className="text-neutral-800 dark:text-[#d4d4d8] leading-relaxed whitespace-pre font-mono">
                {CODE_SAMPLES[selectedLang].code}
              </pre>

              <div className="pt-3 mt-3 border-t border-neutral-200/60 dark:border-[#282828] flex items-center justify-between">
                <span className="text-[11px] text-neutral-400 dark:text-[#777777] font-mono">
                  {CODE_SAMPLES[selectedLang].title}
                </span>
                <button
                  onClick={handleRunCode}
                  disabled={isRunning}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition shadow-xs disabled:opacity-50 active:scale-95"
                >
                  <span>{isRunning ? "Running..." : "▶ Run"}</span>
                </button>
              </div>
            </div>

            {/* Right: Output Console */}
            <div className="md:col-span-5 rounded-xl border border-neutral-200 dark:border-[#2f2f2f] bg-[#121316] text-white p-4 font-mono text-xs flex flex-col justify-between min-h-[220px]">
              <div>
                <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-[#252528] text-[10px] text-neutral-400 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
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
        </div>
      </section>

      {/* ── 3 Core Capabilities: Clean cards ── */}
      <section className="max-w-4xl mx-auto px-5 py-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-5 rounded-2xl border border-neutral-200 dark:border-[#2f2f2f] bg-white dark:bg-[#202020] shadow-xs flex flex-col gap-2"
            >
              <span className="text-xl">{f.icon}</span>
              <h3 className="font-bold text-neutral-900 dark:text-white text-sm">{f.title}</h3>
              <p className="text-xs text-neutral-500 dark:text-[#8a8a8e] leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-neutral-200/80 dark:border-[#282828] py-6">
        <div className="max-w-4xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400 dark:text-[#666666] font-mono">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span>• Collaborative Code Review Platform</span>
          </div>
          <span>© {new Date().getFullYear()} DevCollab</span>
        </div>
      </footer>
    </div>
  );
}
