import { useContext, useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { UserContext } from "../context/user.context";
import { useCollab } from "../hooks/useCollab";
import { useIsDark } from "../hooks/useIsDark";
import api from "../config/axios";
import getErrorMessage from "../config/getErrorMessage";
import PageLoader from "../components/PageLoader";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import LanguageBadge, { LANGUAGES } from "../components/ui/LanguageBadge";
import PresenceBar from "../components/room/PresenceBar";
import ConnectionStatus from "../components/room/ConnectionStatus";
import CommentPanel from "../components/room/CommentPanel";
import SnapshotModal from "../components/room/SnapshotModal";

// ── Monaco dark theme ──────────────────────────────────────────────────────────
const defineTheme = (monaco) => {
  try {
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
  } catch (_) {}
};

export default function Room() {
  const { roomId } = useParams();
  const { user } = useContext(UserContext);
  const isDark = useIsDark();
  const collab = useCollab(roomId, user);

  // Room metadata (title, language)
  const [room, setRoom] = useState(null);
  const [loadError, setLoadError] = useState("");

  // Run / output state
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [stdin, setStdin] = useState("");
  const [showStdin, setShowStdin] = useState(false);

  // Comments
  const [comments, setComments] = useState([]);
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);

  // Snapshots
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotOpen, setSnapshotOpen] = useState(false);

  // Load room metadata on mount
  useEffect(() => {
    api
      .put(`/rooms/join/${roomId}`)
      .then((res) => setRoom(res.data.room))
      .catch((err) => setLoadError(getErrorMessage(err, "Room not found")));
  }, [roomId]);

  // Load comments
  useEffect(() => {
    if (!roomId) return;
    api.get(`/comments/${roomId}`)
      .then((res) => setComments(res.data.comments))
      .catch(() => {});
  }, [roomId]);

  // Load snapshots list
  const loadSnapshots = useCallback(() => {
    if (!roomId) return;
    api.get(`/snapshots/${roomId}`)
      .then((res) => setSnapshots(res.data.snapshots))
      .catch(() => {});
  }, [roomId]);

  useEffect(() => { loadSnapshots(); }, [loadSnapshots]);

  // Live comment socket events
  useEffect(() => {
    if (!collab?.socket) return;
    const socket = collab.socket;
    const onNew = ({ comment }) => setComments((prev) => [...prev, comment]);
    const onResolved = ({ commentId, resolved }) =>
      setComments((prev) =>
        prev.map((c) => (String(c._id) === String(commentId) ? { ...c, resolved: resolved ?? true } : c))
      );
    const onReply = ({ comment }) =>
      setComments((prev) => prev.map((c) => (String(c._id) === String(comment._id) ? comment : c)));
    const onDeleted = ({ commentId }) =>
      setComments((prev) => prev.filter((c) => String(c._id) !== String(commentId)));

    socket.on("comment:new", onNew);
    socket.on("comment:resolved", onResolved);
    socket.on("comment:reply", onReply);
    socket.on("comment:deleted", onDeleted);
    return () => {
      socket.off("comment:new", onNew);
      socket.off("comment:resolved", onResolved);
      socket.off("comment:reply", onReply);
      socket.off("comment:deleted", onDeleted);
    };
  }, [collab?.socket]);

  // Wire Monaco to Yjs collab
  const onMount = useCallback(
    (editor, monaco) => {
      if (isDark) defineTheme(monaco);
      monaco.editor.setTheme(isDark ? "devcollab" : "vs");
      if (collab) collab.attachEditor(editor, monaco);
    },
    [collab, isDark]
  );

  // Run code
  const run = async () => {
    if (!room || !collab) return;
    setRunning(true);
    setPanelOpen(true);
    setOutput(null);
    const code = collab.ytext.toString();
    try {
      const { data } = await api.post("/run", { language: room.language, code, stdin });
      setOutput(data);
    } catch (err) {
      setOutput({ stdout: "", stderr: getErrorMessage(err, "Execution failed"), code: 1 });
    } finally {
      setRunning(false);
    }
  };

  // Comment handlers
  const handleAddComment = async (line, text) => {
    try {
      const { data } = await api.post(`/comments/${roomId}`, { line, text });
      setComments((prev) => [...prev, data.comment]);
    } catch (_) {}
  };
  const handleResolveComment = async (id, resolved) => {
    try {
      await api.patch(`/comments/${id}/${resolved ? "resolve" : "unresolve"}`);
    } catch (_) {}
  };
  const handleReplyComment = async (id, text) => {
    try {
      await api.post(`/comments/${id}/reply`, { text });
    } catch (_) {}
  };
  const handleDeleteComment = async (id) => {
    try {
      await api.delete(`/comments/${id}`);
      setComments((prev) => prev.filter((c) => String(c._id) !== String(id)));
    } catch (_) {}
  };

  // Snapshot handlers
  const handleSaveSnapshot = async (name) => {
    if (!collab) return;
    const code = collab.ytext.toString();
    try {
      await api.post(`/snapshots/${roomId}`, { name, code });
      loadSnapshots();
    } catch (_) {}
  };
  const handleDeleteSnapshot = async (id) => {
    try {
      await api.delete(`/snapshots/single/${id}`);
      setSnapshots((prev) => prev.filter((s) => String(s._id) !== String(id)));
    } catch (_) {}
  };
  const fetchSnapshot = async (id) => {
    const { data } = await api.get(`/snapshots/single/${id}`);
    return data.snapshot;
  };
  const handleLoadSnapshot = (code) => {
    if (!collab || !code) return;
    // Replace ytext content
    const doc = collab.doc;
    const ytext = collab.ytext;
    doc.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, code);
    });
  };

  // ── Error / loading states ────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-canvas">
        <p className="text-xs font-medium text-muted">{loadError}</p>
        <Link
          to="/dashboard"
          className="px-6 py-2.5 rounded-full border border-line text-xs font-semibold text-fg hover:bg-surface transition"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!room) return <PageLoader />;

  const lang = LANGUAGES[room.language] || {};
  const hasError = output && (output.stderr || output.code !== 0);
  const presence = collab?.getPresence() ?? [];
  const openComments = comments.filter((c) => !c.resolved).length;

  return (
    <div className="flex flex-col h-screen bg-canvas transition-colors">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 h-14 shrink-0 border-b border-line bg-surface/90 backdrop-blur-md">
        {/* Left: Logo + breadcrumb + language badge */}
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard">
            <Logo size="sm" />
          </Link>
          <span className="text-faint">/</span>
          <h1 className="font-bold text-fg truncate text-xs sm:text-sm">{room.title}</h1>
          <LanguageBadge language={room.language} />
        </div>

        {/* Right: presence + status + actions */}
        <div className="flex items-center gap-3">
          {/* Presence avatars */}
          {presence.length > 0 && <PresenceBar people={presence} />}

          {/* Connection status */}
          <ConnectionStatus
            status={collab?.status ?? "connecting"}
            lastSavedAt={collab?.lastSavedAt}
          />

          {/* Comments toggle */}
          <button
            onClick={() => setCommentPanelOpen((o) => !o)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              commentPanelOpen
                ? "border-primary text-primary bg-primary/10"
                : "border-line text-muted hover:text-fg hover:border-fg/30"
            }`}
          >
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd" />
            </svg>
            {openComments > 0 && <span>{openComments}</span>}
          </button>

          {/* Snapshots toggle */}
          <button
            onClick={() => setSnapshotOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-line text-muted hover:text-fg hover:border-fg/30 transition"
          >
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm0 2h12v10H4V5zm2 2v2h8V7H6zm0 4v2h5v-2H6z" />
            </svg>
            Snapshots
          </button>

          {/* Run button */}
          <button
            onClick={run}
            disabled={running || !collab}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold border border-line text-fg hover:bg-surface-2 transition disabled:opacity-50 group ${lang.hover ?? ""}`}
          >
            {running ? (
              <>
                <svg className="animate-spin size-3 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                <span>Running…</span>
              </>
            ) : (
              <>
                <svg width="9" height="11" viewBox="0 0 10 12" fill="currentColor" className={`transition-colors group-hover:${lang.dot ? lang.dot.replace("bg-", "text-") : "text-fg"}`}>
                  <path d="M1 1l8 5-8 5V1z" />
                </svg>
                <span>Run</span>
              </>
            )}
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 mx-4 my-3 gap-3">

        {/* Editor frame */}
        <div className="flex flex-col flex-1 min-w-0 rounded-2xl overflow-hidden border border-line shadow-lg bg-[#1e1e1e]">
          {/* Window chrome */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-surface border-b border-line shrink-0">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-[#ff5f56]" />
              <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="size-2.5 rounded-full bg-[#27c93f]" />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-0.5 rounded bg-canvas border border-line font-mono text-[11px] text-muted max-w-xs">
              <span className={`size-1.5 rounded-full ${lang.dot ?? "bg-faint"}`} />
              <span className="truncate">{room.title}</span>
            </div>
          </div>

          {/* Monaco */}
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              theme={isDark ? "devcollab" : "vs"}
              beforeMount={isDark ? defineTheme : undefined}
              language={room.language}
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', Consolas, monospace",
                minimap: { enabled: false },
                padding: { top: 12 },
                scrollBeyondLastLine: false,
                glyphMargin: true,
              }}
              onMount={onMount}
            />
          </div>
        </div>

        {/* Comment panel */}
        {commentPanelOpen && (
          <CommentPanel
            comments={comments}
            onAdd={handleAddComment}
            onResolve={handleResolveComment}
            onReply={handleReplyComment}
            onDelete={handleDeleteComment}
            onClose={() => setCommentPanelOpen(false)}
          />
        )}

        {/* Output console */}
        {panelOpen && (
          <div className="flex flex-col w-80 shrink-0 rounded-2xl overflow-hidden border border-line bg-surface shadow-xl">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-line bg-canvas shrink-0">
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${lang.dot ?? "bg-faint"}`} />
                <span className="text-[11px] font-mono font-bold text-fg uppercase tracking-wider">Console</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowStdin((s) => !s)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition ${showStdin ? "border-primary text-primary" : "border-line text-muted hover:text-fg"}`}
                >
                  stdin
                </button>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="text-muted hover:text-fg transition text-xs"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Stdin textarea */}
            {showStdin && (
              <div className="px-3 py-2 border-b border-line shrink-0">
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Custom stdin (e.g. 5\n3 1 4 1 5)"
                  rows={3}
                  className="w-full text-xs font-mono bg-canvas border border-line rounded px-2 py-1.5 text-fg placeholder:text-faint outline-none focus:border-primary resize-none"
                />
              </div>
            )}

            {/* Output body */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
              {running && (
                <div className="flex items-center gap-2 text-muted italic">
                  <span className={lang.dot ? lang.dot.replace("bg-", "text-") : "text-fg"}>$</span>
                  <span>Compiling &amp; executing…</span>
                </div>
              )}
              {!running && output && (
                <>
                  <div className={`text-[11px] mb-2 font-bold ${lang.dot ? lang.dot.replace("bg-", "text-") : "text-fg"}`}>
                    $ run {room.language}
                  </div>
                  {output.stdout && (
                    <pre className="text-fg whitespace-pre-wrap break-all mb-3">{output.stdout}</pre>
                  )}
                  {output.stderr && (
                    <pre className="text-red-400 whitespace-pre-wrap break-all mb-3">{output.stderr}</pre>
                  )}
                  {!output.stdout && !output.stderr && (
                    <span className="text-faint italic block mb-2">(no output)</span>
                  )}
                  <div className={`mt-3 text-[11px] font-bold ${hasError ? "text-red-400" : "text-muted"}`}>
                    {hasError ? "✕" : "✓"} Exited with code {output.code}
                  </div>
                </>
              )}
              {!running && !output && (
                <span className="text-faint italic">Hit Run to execute code.</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Snapshot Modal ───────────────────────────────────────────────────── */}
      {snapshotOpen && collab && (
        <SnapshotModal
          snapshots={snapshots}
          currentCode={collab.ytext.toString()}
          language={room.language}
          isDark={isDark}
          onSave={handleSaveSnapshot}
          onDelete={handleDeleteSnapshot}
          onClose={() => { setSnapshotOpen(false); loadSnapshots(); }}
          onLoadSnapshot={handleLoadSnapshot}
          fetchSnapshot={fetchSnapshot}
        />
      )}
    </div>
  );
}
