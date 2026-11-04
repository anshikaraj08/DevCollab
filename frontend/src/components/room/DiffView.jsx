import { useState, useEffect, useCallback } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { defineThemes } from "../../lib/monacoThemes";
import Button from "../ui/Button";

/**
 * DiffView — overlay positioned over the editor to compare any two versions or Current live code.
 */
export default function DiffView({
  open,
  onClose,
  snapshots = [],
  currentCode = "",
  onRefreshCurrent,
  language = "javascript",
  isDark = true,
  initialSnapshotId = null,
  fetchSnapshotCode,
}) {
  const [leftSource, setLeftSource] = useState(initialSnapshotId || (snapshots[0]?._id ?? "current"));
  const [rightSource, setRightSource] = useState("current");
  const [leftCode, setLeftCode] = useState("");
  const [rightCode, setRightCode] = useState(currentCode);
  const [renderSideBySide, setRenderSideBySide] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cachedCodes, setCachedCodes] = useState({});

  // Reset or load initial snapshot when opened
  useEffect(() => {
    if (open) {
      if (initialSnapshotId) {
        setLeftSource(initialSnapshotId);
        setRightSource("current");
      } else if (snapshots.length > 0) {
        setLeftSource(snapshots[0]._id);
        setRightSource("current");
      }
    }
  }, [open, initialSnapshotId, snapshots]);

  // Helper to load code for a given source
  const getCodeForSource = useCallback(
    async (source) => {
      if (source === "current") {
        return onRefreshCurrent ? onRefreshCurrent() : currentCode;
      }
      if (cachedCodes[source] !== undefined) {
        return cachedCodes[source];
      }
      if (fetchSnapshotCode) {
        const code = await fetchSnapshotCode(source);
        setCachedCodes((prev) => ({ ...prev, [source]: code }));
        return code;
      }
      return "";
    },
    [cachedCodes, currentCode, fetchSnapshotCode, onRefreshCurrent]
  );

  // Update left/right code whenever source changes
  useEffect(() => {
    if (!open) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const [l, r] = await Promise.all([
          getCodeForSource(leftSource),
          getCodeForSource(rightSource),
        ]);
        if (active) {
          setLeftCode(l ?? "");
          setRightCode(r ?? "");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [open, leftSource, rightSource, getCodeForSource]);

  const handleRefresh = async () => {
    const updated = onRefreshCurrent ? onRefreshCurrent() : currentCode;
    if (leftSource === "current") setLeftCode(updated);
    if (rightSource === "current") setRightCode(updated);
  };

  if (!open) return null;

  const monacoTheme = isDark ? "devcollab" : "vs";

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col bg-canvas border-b border-line shadow-2xl transition-colors"
      role="region"
      aria-label="Diff Comparison View"
    >
      {/* Top Bar / Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-surface-2 border-b border-line shrink-0">
        {/* Left: Source Selectors */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-semibold text-fg">Compare:</span>
          <select
            value={leftSource}
            onChange={(e) => setLeftSource(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-line bg-surface text-fg text-xs outline-none focus:border-primary font-medium"
            aria-label="Original comparison source"
          >
            <option value="current">Current (Live Code)</option>
            {snapshots.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name || "Untitled"} ({s.kind === "pre-restore" ? "Pre-restore" : "Version"})
              </option>
            ))}
          </select>

          <span className="text-muted font-semibold">vs</span>

          <select
            value={rightSource}
            onChange={(e) => setRightSource(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-line bg-surface text-fg text-xs outline-none focus:border-primary font-medium"
            aria-label="Modified comparison source"
          >
            <option value="current">Current (Live Code)</option>
            {snapshots.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name || "Untitled"} ({s.kind === "pre-restore" ? "Pre-restore" : "Version"})
              </option>
            ))}
          </select>

          {(leftSource === "current" || rightSource === "current") && (
            <button
              type="button"
              onClick={handleRefresh}
              title="Refresh current live code"
              className="h-8 px-2.5 rounded-lg border border-line text-muted hover:text-fg hover:bg-surface text-xs flex items-center gap-1 transition"
            >
              <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Refresh live</span>
            </button>
          )}
        </div>

        {/* Right: Layout Toggle & Close */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-line bg-surface p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setRenderSideBySide(true)}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                renderSideBySide ? "bg-canvas text-fg shadow-xs font-semibold" : "text-muted hover:text-fg"
              }`}
            >
              Side-by-side
            </button>
            <button
              type="button"
              onClick={() => setRenderSideBySide(false)}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                !renderSideBySide ? "bg-canvas text-fg shadow-xs font-semibold" : "text-muted hover:text-fg"
              }`}
            >
              Inline
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 px-2 text-muted hover:text-fg text-sm cursor-pointer"
            aria-label="Close diff view"
          >
            ✕
          </Button>
        </div>
      </div>

      {/* Diff Editor Body */}
      <div className="flex-1 min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-canvas/60 backdrop-blur-xs">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Loading comparison…</span>
            </div>
          </div>
        )}

        <DiffEditor
          original={leftCode}
          modified={rightCode}
          language={language}
          theme={monacoTheme}
          beforeMount={defineThemes}
          options={{
            readOnly: true,
            renderSideBySide,
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineHeight: 20,
          }}
        />
      </div>
    </div>
  );
}

