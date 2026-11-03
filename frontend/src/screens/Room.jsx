import { useContext, useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { UserContext } from "../context/user.context";
import { useTheme } from "../context/theme.context";
import { useCollab } from "../hooks/useCollab";
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

// ── Monaco custom dark theme ──────────────────────────────────────────────────

const defineTheme = (monaco) => {
  try {
    monaco.editor.defineTheme("devcollab", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6e7681", fontStyle: "italic" },
        { token: "keyword", foreground: "ff7b72" },
        { token: "string", foreground: "a5d6ff" },
        { token: "number", foreground: "79c0ff" },
        { token: "type", foreground: "ffa657" },
      ],
      colors: {
        "editor.background": "#181818",
        "editorGutter.background": "#181818",
        "editor.lineHighlightBackground": "#222222",
        "editorLineNumber.foreground": "#6e7681",
        "editorLineNumber.activeForeground": "#eff2f6",
        "editor.selectionBackground": "#333a42",
        "editor.inactiveSelectionBackground": "#262b30",
      },
    });
  } catch (_) {}
};

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const collab = useCollab(roomId, user);

  const monacoRef = useRef(null);
  const editorRef = useRef(null);

  // Room metadata (title, language)
  const [room, setRoom] = useState(null);
  const [loadError, setLoadError] = useState("");

  // Save state
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

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

  // Helper to reliably get latest code from collab, editor, or room
  const getCode = useCallback(() => {
    if (collab?.ytext && collab.ytext.length > 0) {
      return collab.ytext.toString();
    }
    if (editorRef.current) {
      return editorRef.current.getValue();
    }
    return room?.code || "";
  }, [collab, room]);

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
      .then((res) => setComments(res.data.comments || []))
      .catch(() => {});
  }, [roomId]);

  // Load snapshots list
  const loadSnapshots = useCallback(() => {
    if (!roomId) return;
    api.get(`/snapshots/${roomId}`)
      .then((res) => setSnapshots(res.data.snapshots || []))
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

  // Handle Save
  const handleSave = async () => {
    if (!room) return;
    setSaving(true);
    try {
      const code = getCode();
      await api.put(`/rooms/${roomId}/code`, { code });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;

  // Dynamically update Monaco theme on dark/light switch
  useEffect(() => {
    if (monacoRef.current) {
      defineTheme(monacoRef.current);
      monacoRef.current.editor.setTheme(isDark ? "devcollab" : "vs");
    }
  }, [isDark]);

  // Attach Collab whenever collab is ready and editor is mounted
  useEffect(() => {
    if (collab && editorRef.current && monacoRef.current) {
      collab.attachEditor(editorRef.current, monacoRef.current);
    }
  }, [collab]);

  // Before mount: define custom theme
  const handleBeforeMount = (monaco) => {
    monacoRef.current = monaco;
    defineTheme(monaco);
  };

  // On mount: store references and keybindings
  const onMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      defineTheme(monaco);
      monaco.editor.setTheme(isDark ? "devcollab" : "vs");

      if (collab) {
        collab.attachEditor(editor, monaco);
      }

      // Bind Ctrl+S / Cmd+S
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        saveRef.current?.();
      });
    },
    [collab, isDark]
  );

  // Run code
  const run = async () => {
    if (!room) return;
    setRunning(true);
    setPanelOpen(true);
    setOutput(null);
    const code = getCode();
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
    const code = getCode();
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
    if (!code) return;
    if (collab?.doc && collab?.ytext) {
      collab.doc.transact(() => {
        collab.ytext.delete(0, collab.ytext.length);
        collab.ytext.insert(0, code);
      });
    } else if (editorRef.current) {
      editorRef.current.setValue(code);
    }
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
        {/* Left: Back button + Logo + Home & Dashboard links + title + language badge */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            title="Go back to previous page"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-muted hover:text-fg border border-line bg-surface-2 hover:bg-surface transition cursor-pointer shrink-0"
          >
            <span>←</span>
            <span className="hidden sm:inline">Back</span>
          </button>

          <Link to="/dashboard" title="DevCollab Workspaces" className="flex items-center hover:opacity-85 transition shrink-0 group">
            <Logo size="sm" showText={false} />
          </Link>

          <div className="hidden lg:flex items-center gap-1 text-xs">
            <Link
              to="/"
              className="px-2 py-1 rounded-md text-muted hover:text-fg hover:bg-surface-2 transition font-medium"
            >
              Home
            </Link>
            <span className="text-faint">/</span>
            <Link
              to="/dashboard"
              className="px-2 py-1 rounded-md text-muted hover:text-fg hover:bg-surface-2 transition font-medium"
            >
              Dashboard
            </Link>
            <span className="text-faint">/</span>
          </div>

          <span className="text-faint lg:hidden">/</span>
          <h1 className="font-bold text-fg truncate text-xs sm:text-sm">{room.title}</h1>
          <LanguageBadge language={room.language} />
        </div>

        {/* Right: presence + status + actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
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
            title="Code comments"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              commentPanelOpen
                ? "border-primary text-primary bg-primary/10"
                : "border-line text-muted hover:text-fg hover:border-fg/30"
            }`}
          >
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            {openComments > 0 && <span>{openComments}</span>}
          </button>

          {/* Snapshots toggle */}
          <button
            onClick={() => setSnapshotOpen(true)}
            title="Version snapshots"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-line text-muted hover:text-fg hover:border-fg/30 transition"
          >
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm0 2h12v10H4V5zm2 2v2h8V7H6zm0 4v2h5v-2H6z" />
            </svg>
            <span className="hidden md:inline">Snapshots</span>
          </button>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            title="Save code (Ctrl+S)"
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold bg-surface-2 border border-line text-fg hover:border-fg/40 active:scale-95 transition disabled:opacity-50"
          >
            {savedFeedback ? (
              <>
                <svg className="size-3 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-emerald-500">Saved</span>
              </>
            ) : saving ? (
              <span>Saving…</span>
            ) : (
              <>
                <svg className="size-3" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6a1 1 0 10-2 0v5.586l-1.293-1.293z" />
                  <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm2 1v8h10V6H5z" />
                </svg>
                <span>Save</span>
              </>
            )}
          </button>

          {/* Run button */}
          <button
            onClick={run}
            disabled={running}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-bold bg-primary text-primary-fg hover:opacity-90 active:scale-95 transition disabled:opacity-50 group shadow-xs"
          >
            {running ? (
              <>
                <svg className="animate-spin size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                <span>Running…</span>
              </>
            ) : (
              <>
                <svg width="9" height="11" viewBox="0 0 10 12" fill="currentColor">
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
        <div className="flex flex-col flex-1 min-w-0 rounded-2xl overflow-hidden border border-line shadow-lg bg-surface">
          {/* Window chrome topbar */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-2 border-b border-line shrink-0">
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

          {/* Monaco Editor */}
          <div className="flex-1 min-h-0 bg-canvas">
            <Editor
              height="100%"
              theme={isDark ? "devcollab" : "vs"}
              beforeMount={handleBeforeMount}
              onMount={onMount}
              defaultValue={room?.code || ""}
              language={room.language}
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', Consolas, monospace",
                minimap: { enabled: false },
                padding: { top: 12 },
                scrollBeyondLastLine: false,
                glyphMargin: true,
              }}
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
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-line bg-surface-2 shrink-0">
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
      {snapshotOpen && (
        <SnapshotModal
          snapshots={snapshots}
          currentCode={getCode()}
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
