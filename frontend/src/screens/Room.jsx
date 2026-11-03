import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../config/axios";
import getErrorMessage from "../config/getErrorMessage";
import PageLoader from "../components/PageLoader";
import ThemeToggle from "../components/ThemeToggle";
import Logo from "../components/Logo";
import { LANGUAGES, getLanguageStyle } from "../config/languages";

const defineTheme = (monaco) => {
  monaco.editor.defineTheme("devcollab", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#1e1e1e",
      "editorGutter.background": "#1e1e1e",
      "editor.lineHighlightBackground": "#282828",
      "editorLineNumber.foreground": "#6e7681",
      "editorLineNumber.activeForeground": "#ffffff",
    },
  });
};

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [room, setRoom]         = useState(null);
  const [code, setCode]         = useState("");
  const [status, setStatus]     = useState({ text: "", error: false });
  const [saving, setSaving]     = useState(false);
  const [loadError, setLoadError] = useState("");

  // Run / output state
  const [running, setRunning]   = useState(false);
  const [output, setOutput]     = useState(null);   // { stdout, stderr, code }
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    api
      .put(`/rooms/join/${roomId}`)
      .then((res) => {
        setRoom(res.data.room);
        setCode(res.data.room.code);
      })
      .catch((err) => setLoadError(getErrorMessage(err, "Room not found")));
  }, [roomId]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/rooms/${roomId}/code`, { code });
      setStatus({ text: "Saved", error: false });
    } catch (err) {
      setStatus({ text: getErrorMessage(err, "Save failed"), error: true });
    } finally {
      setSaving(false);
      setTimeout(() => setStatus({ text: "", error: false }), 2500);
    }
  };

  const run = async () => {
    setRunning(true);
    setPanelOpen(true);
    setOutput(null);
    try {
      const { data } = await api.post("/run", { language: room.language, code });
      setOutput(data);
    } catch (err) {
      setOutput({ stdout: "", stderr: getErrorMessage(err, "Execution failed"), code: 1 });
    } finally {
      setRunning(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f8faf8] dark:bg-[#1a1a1a]">
        <p className="text-xs font-medium text-neutral-500 dark:text-[#8a8a8e]">{loadError}</p>
        <Link
          to="/dashboard"
          className="px-6 py-2.5 rounded-full border border-neutral-300 dark:border-[#383838] text-xs font-semibold text-neutral-800 dark:text-[#eff2f6] hover:bg-neutral-100 dark:hover:bg-[#282828] transition"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!room) return <PageLoader />;

  const langStyle = getLanguageStyle(room.language);
  const hasError = output && (output.stderr || output.code !== 0);

  return (
    <div className="flex flex-col h-screen bg-[#f8faf8] dark:bg-[#1a1a1a] transition-colors">
      {/* ── Toolbar ── */}
      <header className="flex items-center justify-between px-5 h-14 flex-shrink-0 border-b border-neutral-200 dark:border-[#2b2b2b] bg-white/90 dark:bg-[#222222]/95 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard">
            <Logo size="sm" />
          </Link>
          <span className="text-neutral-300 dark:text-[#444444]">/</span>
          <h1 className="font-bold text-neutral-900 dark:text-white truncate text-xs sm:text-sm">{room.title}</h1>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-mono font-semibold transition-all ${langStyle.pill}`}>
            <span className={`w-2 h-2 rounded-full ${langStyle.dot}`} />
            {LANGUAGES[room.language] || room.language}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {status.text && (
            <span className={`text-xs font-mono font-semibold ${status.error ? "text-red-500" : "text-neutral-600 dark:text-[#a0a0a0]"}`}>
              {status.text}
            </span>
          )}

          {/* Run button with language hover accent */}
          <button
            onClick={run}
            disabled={running}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold border border-neutral-300 dark:border-[#3c3c3c] text-neutral-800 dark:text-[#eff2f6] hover:bg-neutral-100 dark:hover:bg-[#333333] ${langStyle.hoverBorder} bg-white dark:bg-[#2c2c2c] transition disabled:opacity-50 shadow-xs group`}
          >
            {running ? (
              <>
                <svg className="animate-spin w-3 h-3 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                <span>Running…</span>
              </>
            ) : (
              <>
                <svg width="9" height="11" viewBox="0 0 10 12" fill="currentColor" className={`transition-colors ${langStyle.hoverText}`}>
                  <path d="M1 1l8 5-8 5V1z"/>
                </svg>
                <span>Run</span>
              </>
            )}
          </button>

          {/* Save button */}
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-1.5 rounded-full text-xs font-bold bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition shadow-xs active:scale-95 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* ── Main area: editor + output panel ── */}
      <div className="flex flex-1 min-h-0 mx-4 my-3 gap-3">

        {/* Editor window frame */}
        <div className="flex flex-col flex-1 min-w-0 rounded-2xl overflow-hidden border border-neutral-300 dark:border-[#333333] shadow-lg bg-[#1e1e1e]">
          {/* Window chrome topbar */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-neutral-100 dark:bg-[#252526] border-b border-neutral-200 dark:border-[#333333] flex-shrink-0">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-0.5 rounded bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-[#383838] font-mono text-[11px] text-neutral-600 dark:text-[#a0a0a0] max-w-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${langStyle.dot}`} />
              <span className="truncate">{room.title}</span>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              theme="devcollab"
              beforeMount={defineTheme}
              language={room.language}
              value={code}
              onChange={(value) => setCode(value ?? "")}
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', Consolas, monospace",
                minimap: { enabled: false },
                padding: { top: 12 },
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        </div>

        {/* Output console panel */}
        {panelOpen && (
          <div className="flex flex-col w-84 shrink-0 rounded-2xl overflow-hidden border border-neutral-300 dark:border-[#333333] bg-white dark:bg-[#1e1e1e] text-neutral-900 dark:text-[#eff2f6] shadow-xl">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-200 dark:border-[#333333] bg-neutral-50 dark:bg-[#252526] flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${langStyle.dot}`} />
                <span className="text-[11px] font-mono font-bold text-neutral-700 dark:text-[#cccccc] uppercase tracking-wider">
                  CONSOLE OUTPUT
                </span>
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-neutral-400 hover:text-black dark:text-[#888888] dark:hover:text-white transition-colors text-xs leading-none"
              >
                ✕
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
              {running && (
                <div className="flex items-center gap-2 text-neutral-500 dark:text-[#8a8a8e] italic">
                  <span className={langStyle.hoverText}>$</span>
                  <span>Compiling &amp; executing code…</span>
                </div>
              )}

              {!running && output && (
                <>
                  <div className={`text-[11px] mb-2 font-mono font-bold ${langStyle.hoverText}`}>$ run {room.language}</div>
                  {output.stdout && (
                    <pre className="text-neutral-900 dark:text-[#f4f4f5] whitespace-pre-wrap break-all mb-3 font-mono">
                      {output.stdout}
                    </pre>
                  )}
                  {output.stderr && (
                    <pre className="text-red-500 dark:text-red-400 whitespace-pre-wrap break-all mb-3 font-mono">
                      {output.stderr}
                    </pre>
                  )}
                  {!output.stdout && !output.stderr && (
                    <span className="text-neutral-400 dark:text-[#777777] italic block mb-2">(program returned no output)</span>
                  )}
                  <div className={`mt-3 text-[11px] font-bold ${hasError ? "text-red-500 dark:text-red-400" : "text-neutral-700 dark:text-[#a0a0a0]"}`}>
                    {hasError ? "✕" : "✓"} Exited with code {output.code}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
