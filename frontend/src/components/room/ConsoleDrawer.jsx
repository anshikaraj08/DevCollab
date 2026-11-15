import { useState, useEffect, useRef, useCallback } from "react";
import { can } from "../../lib/permissions";
import Button from "../ui/Button";

const MAX_STDIN_CHARS = 10000;
const MAX_TEST_CASES = 10;
const MAX_TEST_NAME_CHARS = 60;
const MAX_TEST_INPUT_CHARS = 2000;

export default function ConsoleDrawer({
  open,
  onClose,
  roomId,
  role = "viewer",
  running = false,
  output = null,
  onRun,
  testCases = [],
  onUpdateTestCases,
  lang = {},
  hasError = false,
  activeTab,
  setActiveTab,
}) {
  const [internalTab, setInternalTab] = useState("output");
  const tab = activeTab !== undefined ? activeTab : internalTab;
  const setTab = (t) => {
    if (setActiveTab) setActiveTab(t);
    else setInternalTab(t);
  };
  const [stdin, setStdin] = useState(() => {
    try {
      return localStorage.getItem(`devcollab:stdin:${roomId}`) || "";
    } catch {
      return "";
    }
  });

  const [cases, setCases] = useState(testCases);
  const [testResults, setTestResults] = useState({});
  const [runningTests, setRunningTests] = useState(false);
  const canEditTests = can(role, "tests.write");
  const saveTimeoutRef = useRef(null);

  // Sync testCases prop when updated from server/sockets
  useEffect(() => {
    setCases(testCases || []);
  }, [testCases]);

  // Persist stdin to localStorage
  const handleStdinChange = (e) => {
    const val = e.target.value.slice(0, MAX_STDIN_CHARS);
    setStdin(val);
    try {
      localStorage.setItem(`devcollab:stdin:${roomId}`, val);
    } catch {
      // storage unavailable (private mode / quota): stdin still works for this session
    }
  };

  // Debounced auto-save of test cases
  const triggerSave = useCallback(
    (updatedCases) => {
      if (!canEditTests || !onUpdateTestCases) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        onUpdateTestCases(updatedCases);
      }, 600);
    },
    [canEditTests, onUpdateTestCases]
  );

  const handleAddCase = () => {
    if (!canEditTests || cases.length >= MAX_TEST_CASES) return;
    const newCase = {
      name: `Case ${cases.length + 1}`,
      input: "",
      expected: "",
    };
    const updated = [...cases, newCase];
    setCases(updated);
    triggerSave(updated);
  };

  const handleUpdateCase = (index, field, value) => {
    if (!canEditTests) return;
    const updated = cases.map((c, i) => (i === index ? { ...c, [field]: value } : c));
    setCases(updated);
    triggerSave(updated);
  };

  const handleDeleteCase = (index) => {
    if (!canEditTests) return;
    const updated = cases.filter((_, i) => i !== index);
    setCases(updated);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    triggerSave(updated);
  };

  // Run a single test case
  const runSingleTest = async (index) => {
    const tc = cases[index];
    if (!tc || !onRun) return;
    setTestResults((prev) => ({ ...prev, [index]: { status: "running" } }));
    const start = Date.now();
    try {
      const res = await onRun(tc.input);
      const duration = Date.now() - start;
      const actualTrimmed = (res.stdout || "").trim();
      const expectedTrimmed = (tc.expected || "").trim();
      const passed = actualTrimmed === expectedTrimmed && res.code === 0;
      setTestResults((prev) => ({
        ...prev,
        [index]: {
          status: passed ? "pass" : "fail",
          stdout: res.stdout || "",
          stderr: res.stderr || "",
          durationMs: duration,
        },
      }));
    } catch (err) {
      const isRateLimit = err?.response?.status === 429;
      setTestResults((prev) => ({
        ...prev,
        [index]: {
          status: isRateLimit ? "rate_limited" : "fail",
          stdout: "",
          stderr: isRateLimit ? "Rate limited, please wait." : (err?.message || "Execution error"),
          durationMs: Date.now() - start,
        },
      }));
    }
  };

  // Sequential execution of all test cases (never in parallel)
  const runAllTests = async () => {
    if (!onRun || cases.length === 0 || runningTests) return;
    setRunningTests(true);

    for (let i = 0; i < cases.length; i++) {
      const tc = cases[i];
      setTestResults((prev) => ({ ...prev, [i]: { status: "running" } }));
      const start = Date.now();
      try {
        const res = await onRun(tc.input);
        const duration = Date.now() - start;
        const actualTrimmed = (res.stdout || "").trim();
        const expectedTrimmed = (tc.expected || "").trim();
        const passed = actualTrimmed === expectedTrimmed && res.code === 0;

        setTestResults((prev) => ({
          ...prev,
          [i]: {
            status: passed ? "pass" : "fail",
            stdout: res.stdout || "",
            stderr: res.stderr || "",
            durationMs: duration,
          },
        }));
      } catch (err) {
        const isRateLimit = err?.response?.status === 429;
        setTestResults((prev) => ({
          ...prev,
          [i]: {
            status: isRateLimit ? "rate_limited" : "fail",
            stdout: "",
            stderr: isRateLimit ? "Rate limit reached" : (err?.message || "Error"),
            durationMs: Date.now() - start,
          },
        }));

        if (isRateLimit) {
          // Stop remaining cases and mark them as rate-limited
          for (let j = i + 1; j < cases.length; j++) {
            setTestResults((prev) => ({
              ...prev,
              [j]: {
                status: "rate_limited",
                stderr: "Rate limited, try again in a moment.",
              },
            }));
          }
          break;
        }
      }
    }

    setRunningTests(false);
  };

  if (!open) return null;

  // Passed test cases count
  const passedCount = Object.values(testResults).filter((r) => r?.status === "pass").length;
  const testedCount = Object.values(testResults).filter((r) => r?.status === "pass" || r?.status === "fail").length;

  return (
    <div
      className="flex flex-col w-full sm:w-96 max-w-full shrink-0 rounded-2xl border border-line bg-surface shadow-xl overflow-hidden select-none max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-20"
      role="region"
      aria-label="Console Drawer"
    >
      {/* Drawer Header with Tabs */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-2 border-b border-line shrink-0">
        <div className="flex items-center gap-1">
          {/* Output Tab */}
          <button
            type="button"
            onClick={() => setTab("output")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              tab === "output"
                ? "bg-canvas text-fg shadow-xs font-bold"
                : "text-muted hover:text-fg"
            }`}
          >
            <span className={`size-1.5 rounded-full ${hasError ? "bg-red-400" : "bg-emerald-500 animate-pulse"}`} />
            <span>Output</span>
          </button>

          {/* Input Tab */}
          <button
            type="button"
            onClick={() => setTab("input")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              tab === "input"
                ? "bg-canvas text-fg shadow-xs font-bold"
                : "text-muted hover:text-fg"
            }`}
          >
            <span>Input</span>
            {stdin.trim() && <span className="size-1.5 rounded-full bg-primary" />}
          </button>

          {/* Tests Tab */}
          <button
            type="button"
            onClick={() => setTab("tests")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              tab === "tests"
                ? "bg-canvas text-fg shadow-xs font-bold"
                : "text-muted hover:text-fg"
            }`}
          >
            <span>Tests</span>
            <span className="text-[10px] bg-surface text-muted px-1.5 py-0.2 rounded-full font-mono">
              {cases.length}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-fg text-sm cursor-pointer p-1"
          aria-label="Close console"
        >
          &times;
        </button>
      </div>

      {/* Tab 1: Output */}
      {tab === "output" && (
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed flex flex-col">
          {running && (
            <div className="flex items-center gap-2 text-muted italic">
              <span className={lang.dot ? lang.dot.replace("bg-", "text-") : "text-fg"}>$</span>
              <span>Compiling &amp; executing…</span>
            </div>
          )}

          {!running && output && (
            <div>
              <div className={`text-[11px] mb-2 font-bold ${lang.dot ? lang.dot.replace("bg-", "text-") : "text-fg"}`}>
                $ run {lang.label || "code"}
              </div>
              {output.stdout && (
                <pre className="text-fg whitespace-pre-wrap break-all mb-3 font-mono">{output.stdout}</pre>
              )}
              {output.stderr && (
                <pre className="text-red-400 whitespace-pre-wrap break-all mb-3 font-mono">{output.stderr}</pre>
              )}
              {!output.stdout && !output.stderr && (
                <span className="text-faint italic block mb-2">(no output)</span>
              )}
              <div className={`mt-3 text-[11px] font-bold ${hasError ? "text-red-400" : "text-muted"}`}>
                {hasError ? "✕" : "✓"} Exited with code {output.code}
              </div>
            </div>
          )}

          {!running && !output && (
            <div className="text-center my-auto py-8 text-muted italic text-xs">
              Hit Run to execute your code.
            </div>
          )}

          {/* Privacy Note */}
          <div className="mt-auto pt-3 border-t border-line/40 text-[10px] text-faint flex items-center justify-between">
            <span>🔒 Your code is sent to Wandbox to run.</span>
          </div>
        </div>
      )}

      {/* Tab 2: Input (stdin) */}
      {tab === "input" && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-fg">Standard Input (stdin)</span>
            <span className="text-[11px] text-muted font-mono">
              {stdin.length} / {MAX_STDIN_CHARS.toLocaleString()}
            </span>
          </div>

          <textarea
            value={stdin}
            onChange={handleStdinChange}
            placeholder="Type input passed to your program here..."
            className="flex-1 min-h-[160px] p-3 rounded-xl border border-line bg-canvas font-mono text-xs text-fg placeholder:text-muted focus:outline-none focus:border-primary resize-none leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-muted italic">Persisted automatically for this room</span>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setTab("output");
                onRun?.(stdin);
              }}
              disabled={running}
              className="text-xs"
            >
              Run with input
            </Button>
          </div>
        </div>
      )}

      {/* Tab 3: Tests */}
      {tab === "tests" && (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {/* Tests Toolbar */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-line shrink-0">
            <div className="flex items-center gap-1.5">
              {!canEditTests && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-2 border border-line text-muted font-medium">
                  View-only
                </span>
              )}
              {testedCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface-2 border border-line text-fg font-mono">
                  {passedCount} of {testedCount} passed
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {canEditTests && cases.length < MAX_TEST_CASES && (
                <button
                  type="button"
                  onClick={handleAddCase}
                  className="px-2.5 py-1 rounded-lg border border-line text-xs font-semibold text-fg hover:bg-surface-2 transition cursor-pointer"
                >
                  + Add case
                </button>
              )}

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={runAllTests}
                disabled={cases.length === 0 || runningTests}
                className="text-xs font-semibold"
              >
                {runningTests ? "Running…" : "Run all"}
              </Button>
            </div>
          </div>

          {/* Test Cases List */}
          {cases.length === 0 ? (
            <div className="text-center py-10 text-muted text-xs">
              <p className="font-semibold text-fg mb-1">No test cases configured</p>
              <p className="text-[11px] text-faint">
                {canEditTests
                  ? "Click '+ Add case' to create input/output test cases shared with your team."
                  : "Workspace editors have not added test cases yet."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {cases.map((tc, idx) => {
                const res = testResults[idx];
                const isRunning = res?.status === "running";
                const isPass = res?.status === "pass";
                const isFail = res?.status === "fail";
                const isRateLimited = res?.status === "rate_limited";

                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-line bg-surface p-3 flex flex-col gap-2 shadow-xs transition"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {canEditTests ? (
                          <input
                            type="text"
                            value={tc.name}
                            maxLength={MAX_TEST_NAME_CHARS}
                            onChange={(e) => handleUpdateCase(idx, "name", e.target.value)}
                            placeholder="Case name"
                            className="bg-transparent text-xs font-semibold text-fg border-b border-transparent hover:border-line focus:border-primary outline-none px-0.5 py-0.5 truncate"
                          />
                        ) : (
                          <span className="text-xs font-semibold text-fg truncate">{tc.name}</span>
                        )}

                        {/* Status Badge */}
                        {isRunning && (
                          <span className="text-[10px] text-amber-500 font-mono animate-pulse">Running…</span>
                        )}
                        {isPass && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                            ✓ Pass {res.durationMs ? `(${res.durationMs}ms)` : ""}
                          </span>
                        )}
                        {isFail && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold">
                            ✕ Fail {res.durationMs ? `(${res.durationMs}ms)` : ""}
                          </span>
                        )}
                        {isRateLimited && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            Rate limited
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => runSingleTest(idx)}
                          disabled={runningTests || isRunning}
                          className="px-2 py-0.5 text-xs text-primary hover:bg-primary/10 rounded font-semibold transition cursor-pointer"
                        >
                          Run
                        </button>
                        {canEditTests && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCase(idx)}
                            className="text-faint hover:text-red-400 p-0.5 text-xs transition cursor-pointer"
                            title="Delete case"
                            aria-label={`Delete ${tc.name}`}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted font-medium">Input</span>
                        <textarea
                          value={tc.input}
                          readOnly={!canEditTests}
                          maxLength={MAX_TEST_INPUT_CHARS}
                          onChange={(e) => handleUpdateCase(idx, "input", e.target.value)}
                          placeholder="e.g. 5"
                          rows={2}
                          className="p-1.5 rounded-lg border border-line bg-canvas font-mono text-[11px] text-fg placeholder:text-faint outline-none focus:border-primary resize-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted font-medium">Expected Output</span>
                        <textarea
                          value={tc.expected}
                          readOnly={!canEditTests}
                          maxLength={MAX_TEST_INPUT_CHARS}
                          onChange={(e) => handleUpdateCase(idx, "expected", e.target.value)}
                          placeholder="e.g. 10"
                          rows={2}
                          className="p-1.5 rounded-lg border border-line bg-canvas font-mono text-[11px] text-fg placeholder:text-faint outline-none focus:border-primary resize-none"
                        />
                      </div>
                    </div>

                    {/* Fail Diff View */}
                    {isFail && res.stdout !== undefined && (
                      <div className="mt-1 pt-1.5 border-t border-line/40 text-[11px] font-mono flex flex-col gap-1 bg-canvas/40 p-2 rounded-lg">
                        <div className="text-[10px] text-muted font-bold">Output mismatch:</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-emerald-400 font-semibold block mb-0.5">Expected:</span>
                            <pre className="p-1.5 rounded bg-surface border border-line text-muted text-[10px] overflow-x-auto">
                              {tc.expected ? tc.expected.trim() : "(empty)"}
                            </pre>
                          </div>
                          <div>
                            <span className="text-[10px] text-red-400 font-semibold block mb-0.5">Actual:</span>
                            <pre className="p-1.5 rounded bg-surface border border-line text-red-400 text-[10px] overflow-x-auto">
                              {res.stdout ? res.stdout.trim() : (res.stderr ? `Error: ${res.stderr}` : "(empty)")}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
