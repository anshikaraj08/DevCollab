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
import Avatar from "../components/ui/Avatar";
import LanguageBadge, { LANGUAGES } from "../components/ui/LanguageBadge";
import PresenceBar from "../components/room/PresenceBar";
import ConnectionStatus from "../components/room/ConnectionStatus";
import CommentPanel from "../components/room/CommentPanel";
import HistoryPanel from "../components/room/HistoryPanel";
import DiffView from "../components/room/DiffView";
import ShareDialog from "../components/room/ShareDialog";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import { defineThemes } from "../lib/monacoThemes";
import { can } from "../lib/permissions";

export default function Room() {
  const { roomId } = useParams();
  const { user } = useContext(UserContext);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();
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

  // Toast & Side Panel
  const toast = useToast();
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [activeSideTab, setActiveSideTab] = useState("comments"); // "comments" | "history"

  // Comments
  const [comments, setComments] = useState([]);

  // Snapshots & Diff View
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffSnapshotId, setDiffSnapshotId] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Share & People dialog
  const [shareOpen, setShareOpen] = useState(false);

  // Effective role
  const role = collab?.role || room?.role || "editor";
  const isOwner = role === "owner";
  const isViewer = role === "viewer";
  const canEdit = can(role, "doc.edit");

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

  // Load room metadata on mount (GET /rooms/:roomId)
  useEffect(() => {
    api
      .get(`/rooms/${roomId}`)
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
    setSnapshotsLoading(true);
    api.get(`/rooms/${roomId}/snapshots`)
      .then((res) => setSnapshots(res.data.snapshots || []))
      .catch(() => {})
      .finally(() => setSnapshotsLoading(false));
  }, [roomId]);

  useEffect(() => { loadSnapshots(); }, [loadSnapshots]);

  // Live comment & snapshot socket events
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

    const onSnapshotsChanged = () => loadSnapshots();
    const onRoomRestored = ({ name, by }) => {
      toast.info(`${by || "A collaborator"} restored "${name || "a snapshot"}"`);
      loadSnapshots();
    };

    socket.on("comment:new", onNew);
    socket.on("comment:resolved", onResolved);
    socket.on("comment:reply", onReply);
    socket.on("comment:deleted", onDeleted);
    socket.on("snapshots:changed", onSnapshotsChanged);
    socket.on("room:restored", onRoomRestored);

    return () => {
      socket.off("comment:new", onNew);
      socket.off("comment:resolved", onResolved);
      socket.off("comment:reply", onReply);
      socket.off("comment:deleted", onDeleted);
      socket.off("snapshots:changed", onSnapshotsChanged);
      socket.off("room:restored", onRoomRestored);
    };
  }, [collab?.socket, loadSnapshots, toast]);

  // Handle Save
  const handleSave = async () => {
    if (!room || isViewer) return;
    setSaving(true);
    try {
      const codeToSave = getCode();
      await api.put(`/rooms/${roomId}/code`, { code: codeToSave });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } catch {
      // quiet fail
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Handle Run
  const run = async () => {
    setRunning(true);
    setPanelOpen(true);
    setOutput(null);
    try {
      const codeToRun = getCode();
      const payload = { language: room.language, code: codeToRun };
      if (stdin.trim()) payload.stdin = stdin;
      const { data } = await api.post("/run", payload);
      setOutput(data);
    } catch (err) {
      setOutput({ stderr: getErrorMessage(err, "Execution failed"), code: -1 });
    } finally {
      setRunning(false);
    }
  };

  const handleBeforeMount = (monaco) => {
    defineThemes(monaco);
  };

  const onMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    collab?.attachEditor(editor, monaco);
  };

  // Comment handlers
  const handleAddComment = async ({ line, text }) => {
    const { data } = await api.post(`/comments/${roomId}`, { line, text });
    setComments((prev) => (prev.some((c) => c._id === data.comment._id) ? prev : [...prev, data.comment]));
  };
  const handleResolveComment = async (id) => {
    const { data } = await api.patch(`/comments/${id}/resolve`);
    setComments((prev) => prev.map((c) => (c._id === id ? data.comment : c)));
  };
  const handleReplyComment = async (id, text) => {
    const { data } = await api.post(`/comments/${id}/reply`, { text });
    setComments((prev) => prev.map((c) => (c._id === id ? data.comment : c)));
  };
  const handleDeleteComment = async (id) => {
    await api.delete(`/comments/${id}`);
    setComments((prev) => prev.filter((c) => c._id !== id));
  };

  // Snapshot handlers
  const handleSaveSnapshot = async (name) => {
    try {
      const { data } = await api.post(`/rooms/${roomId}/snapshots`, { name });
      toast.success(`Saved snapshot "${data.snapshot.name}"`);
      loadSnapshots();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    setActionLoading(true);
    try {
      await api.post(`/rooms/${roomId}/snapshots/${restoreTarget._id}/restore`);
      toast.success(`Restored "${restoreTarget.name}"`);
      setRestoreTarget(null);
      loadSnapshots();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await api.delete(`/rooms/${roomId}/snapshots/${deleteTarget._id}`);
      toast.success("Snapshot deleted");
      setDeleteTarget(null);
      loadSnapshots();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const fetchSnapshotCode = async (id) => {
    const { data } = await api.get(`/rooms/${roomId}/snapshots/${id}`);
    return data.snapshot.code;
  };

  // ── Error / loading / removed states ────────────────────────────────────
  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-canvas text-fg p-6 text-center select-none">
        <div className="w-full max-w-md p-8 rounded-3xl border border-line bg-surface shadow-2xl space-y-4">
          <div className="size-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xl font-bold flex items-center justify-center mx-auto">
            ✕
          </div>
          <h1 className="text-xl font-bold">Room not found</h1>
          <p className="text-xs text-muted leading-relaxed">
            {loadError === "Room not found"
              ? "This workspace does not exist or you do not have permission to access it."
              : loadError}
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-primary text-primary-fg text-xs font-semibold hover:opacity-90 transition"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (collab?.status === "removed") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-canvas text-fg p-6 text-center select-none">
        <div className="w-full max-w-md p-8 rounded-3xl border border-line bg-surface shadow-2xl space-y-4">
          <div className="size-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xl font-bold flex items-center justify-center mx-auto">
            ✕
          </div>
          <h1 className="text-xl font-bold">Access Revoked</h1>
          <p className="text-xs text-muted leading-relaxed">
            You no longer have access to this workspace.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-primary text-primary-fg text-xs font-semibold hover:opacity-90 transition"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!room) return <PageLoader />;

  const lang = LANGUAGES[room.language] || {};
  const hasError = output && (output.stderr || output.code !== 0);
  const presence = collab?.awareness
    ? Array.from(collab.awareness.getStates().values())
        .map((s) => s.user)
        .filter(Boolean)
    : [];
  const openComments = comments.filter((c) => !c.resolved).length;

  return (
    <div className="flex flex-col h-screen bg-canvas transition-colors">
      {/* ── Persistent Dark Header Bar ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 sm:px-10 h-[76px] shrink-0 border-b border-[#1e293b] bg-[#0f172a] text-white shadow-md transition-colors">

        {/* Left: Brand Logo + Persistent Nav Buttons */}
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard" title="DevCollab" className="flex items-center group shrink-0 mr-1">
            <Logo size="md" />
          </Link>

          <span className="h-5 w-px bg-white/20 shrink-0" />

          {/* Home Pill */}
          <Link
            to="/"
            title="Home"
            className="flex items-center gap-2 h-9 px-4 rounded-full text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.14] text-slate-300 hover:text-white border border-white/10 transition cursor-pointer select-none shrink-0"
          >
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            <span className="hidden sm:inline">Home</span>
          </Link>

          {/* Dashboard Pill */}
          <Link
            to="/dashboard"
            title="Workspaces Dashboard"
            className="flex items-center gap-2 h-9 px-4 rounded-full text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.14] text-slate-300 hover:text-white border border-white/10 transition cursor-pointer select-none shrink-0"
          >
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 8a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zm8-8a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zm0 8a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" clipRule="evenodd" />
            </svg>
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          {/* Divider + Room title metadata */}
          <span className="hidden md:inline-block h-5 w-px bg-white/20 shrink-0 mx-0.5" />
          <h1 className="font-bold text-white truncate text-xs sm:text-sm">{room.title}</h1>
          <LanguageBadge language={room.language} />
        </div>

        {/* Right: Presence + Status + ViewOnly + Share/People + Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {presence.length > 0 && <PresenceBar people={presence} />}

          <ConnectionStatus
            status={collab?.status ?? "connecting"}
            lastSavedAt={collab?.lastSavedAt}
          />

          {/* View only indicator for viewers */}
          {isViewer && (
            <span className="flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[11px] font-bold select-none">
              <span className="size-1.5 rounded-full bg-sky-400" />
              View only
            </span>
          )}

          {/* Share / People Modal Button */}
          <button
            onClick={() => setShareOpen(true)}
            title={isOwner ? "Share and invite collaborators" : "View workspace members"}
            className="flex items-center gap-1.5 h-9 px-3.5 sm:px-4 rounded-full text-xs font-semibold border border-white/10 text-slate-300 hover:text-white bg-white/[0.08] hover:bg-white/[0.14] transition cursor-pointer select-none"
          >
            {isOwner ? (
              <>
                <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                </svg>
                <span className="hidden sm:inline">Share</span>
              </>
            ) : (
              <>
                <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                <span className="hidden sm:inline">People</span>
              </>
            )}
          </button>

          {/* Comments */}
          <button
            onClick={() => {
              if (sidePanelOpen && activeSideTab === "comments") {
                setSidePanelOpen(false);
              } else {
                setSidePanelOpen(true);
                setActiveSideTab("comments");
              }
            }}
            title="Code comments"
            className={`flex items-center gap-1.5 h-9 px-3.5 sm:px-4 rounded-full text-xs font-semibold border transition cursor-pointer select-none ${
              sidePanelOpen && activeSideTab === "comments"
                ? "bg-white text-slate-900 border-white shadow-sm font-bold"
                : "border-white/10 text-slate-300 hover:text-white bg-white/[0.08] hover:bg-white/[0.14]"
            }`}
          >
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            <span className="hidden sm:inline">Comments</span>
            {openComments > 0 && <span className="text-[11px] font-bold">{openComments}</span>}
          </button>

          {/* Snapshots / History */}
          <button
            onClick={() => {
              if (sidePanelOpen && activeSideTab === "history") {
                setSidePanelOpen(false);
              } else {
                setSidePanelOpen(true);
                setActiveSideTab("history");
              }
            }}
            title="Version history"
            className={`flex items-center gap-1.5 h-9 px-3.5 sm:px-4 rounded-full text-xs font-semibold border transition cursor-pointer select-none ${
              sidePanelOpen && activeSideTab === "history"
                ? "bg-white text-slate-900 border-white shadow-sm font-bold"
                : "border-white/10 text-slate-300 hover:text-white bg-white/[0.08] hover:bg-white/[0.14]"
            }`}
          >
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <span className="hidden md:inline">History</span>
            {snapshots.length > 0 && (
              <span className="text-[10px] opacity-75 font-mono">({snapshots.length})</span>
            )}
          </button>

          {/* Save (only for editors and owner) */}
          {!isViewer && (
            <button
              onClick={handleSave}
              disabled={saving}
              title="Save (Ctrl+S)"
              className="flex items-center gap-1.5 h-9 px-3.5 sm:px-4 rounded-full text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-white active:scale-95 transition cursor-pointer select-none disabled:opacity-50"
            >
              {savedFeedback ? (
                <>
                  <svg className="size-3 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-emerald-400 font-bold">Saved</span>
                </>
              ) : saving ? (
                <span>Saving…</span>
              ) : (
                <>
                  <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6a1 1 0 10-2 0v5.586l-1.293-1.293z" />
                    <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm2 1v8h10V6H5z" />
                  </svg>
                  <span>Save</span>
                </>
              )}
            </button>
          )}

          {/* Run */}
          <button
            onClick={run}
            disabled={running}
            className="flex items-center gap-1.5 h-9 px-4 sm:px-5 rounded-full text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-95 transition disabled:opacity-50 cursor-pointer shadow-sm select-none"
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

          <span className="hidden sm:inline-block h-5 w-px bg-white/20 shrink-0 mx-0.5" />

          {/* User Avatar */}
          {user && (
            <div className="hidden sm:flex items-center">
              <Avatar name={user.name} size="sm" />
            </div>
          )}

          <ThemeToggle />
        </div>
      </header>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 mx-4 my-3 gap-3">

        {/* Editor frame */}
        <div className="flex flex-col flex-1 min-w-0 rounded-2xl overflow-hidden border border-line shadow-lg bg-surface relative">
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
          <div className="flex-1 min-h-0" style={{ background: isDark ? "#181818" : "#ffffff" }}>
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
                readOnly: !canEdit || collab?.status !== "synced",
                domReadOnly: !canEdit || collab?.status !== "synced",
              }}
            />
          </div>

          {/* Diff View Overlay */}
          <DiffView
            open={diffOpen}
            onClose={() => {
              setDiffOpen(false);
              setDiffSnapshotId(null);
            }}
            snapshots={snapshots}
            currentCode={getCode()}
            onRefreshCurrent={getCode}
            language={room.language}
            isDark={isDark}
            initialSnapshotId={diffSnapshotId}
            fetchSnapshotCode={fetchSnapshotCode}
          />
        </div>

        {/* Tabbed Side panel (Comments & History) */}
        {sidePanelOpen && (
          <div className="flex flex-col w-80 shrink-0 rounded-2xl overflow-hidden border border-line bg-surface shadow-xl">
            {/* Header with Tabs */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-line bg-surface-2 shrink-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveSideTab("comments")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    activeSideTab === "comments"
                      ? "bg-canvas text-fg shadow-xs font-bold"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  <span>Comments</span>
                  {openComments > 0 && (
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.2 rounded-full font-mono">
                      {openComments}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSideTab("history")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    activeSideTab === "history"
                      ? "bg-canvas text-fg shadow-xs font-bold"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  <span>History</span>
                  <span className="text-[10px] bg-surface text-muted px-1.5 py-0.2 rounded-full font-mono">
                    {snapshots.length}
                  </span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSidePanelOpen(false)}
                className="text-muted hover:text-fg text-xs p-1 cursor-pointer"
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {activeSideTab === "comments" ? (
                <CommentPanel
                  comments={comments}
                  onAdd={handleAddComment}
                  onResolve={handleResolveComment}
                  onReply={handleReplyComment}
                  onDelete={handleDeleteComment}
                  isEmbedded
                />
              ) : (
                <HistoryPanel
                  snapshots={snapshots}
                  role={role}
                  currentUserId={user?._id || user?.id}
                  onSaveVersion={handleSaveSnapshot}
                  onRestore={(snap) => setRestoreTarget(snap)}
                  onDelete={(snap) => setDeleteTarget(snap)}
                  onCompare={(snap) => {
                    setDiffSnapshotId(snap._id);
                    setDiffOpen(true);
                  }}
                  loading={snapshotsLoading}
                />
              )}
            </div>
          </div>
        )}

        {/* Console / Output Drawer */}
        {panelOpen && (
          <div className="flex flex-col w-96 rounded-2xl border border-line bg-surface shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-surface-2 border-b border-line">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">Console</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowStdin((v) => !v)}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded cursor-pointer transition ${
                    showStdin ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg"
                  }`}
                >
                  stdin {stdin.trim() ? "•" : ""}
                </button>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="text-muted hover:text-fg text-sm cursor-pointer p-0.5"
                  aria-label="Close output"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Standard input area */}
            {showStdin && (
              <div className="p-3 border-b border-line bg-surface-2/40">
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Enter stdin for your program..."
                  className="w-full h-16 p-2 rounded-lg border border-line bg-canvas font-mono text-xs text-fg placeholder:text-muted focus:outline-none"
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

      {/* ── Share & Access Modal ─────────────────────────────────────────────── */}
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        roomId={roomId}
        isOwner={isOwner}
        currentUserId={user?.id}
        onLeaveWorkspace={() => navigate("/dashboard")}
      />

      {/* ── Restore Confirm Dialog ─────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleConfirmRestore}
        title="Restore version?"
        message={`Replace the current code with "${restoreTarget?.name || "this version"}"? A backup of the current code is saved first.`}
        confirmText="Restore version"
        variant="primary"
        loading={actionLoading}
      />

      {/* ── Delete Snapshot Confirm Dialog ───────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete snapshot?"
        message={`Permanently delete snapshot "${deleteTarget?.name || "this snapshot"}"?`}
        confirmText="Delete snapshot"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
