import { useState, useEffect } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { cn } from "../../lib/cn";

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

/**
 * SnapshotModal
 * Props:
 *   snapshots: []
 *   currentCode: string
 *   language: string
 *   isDark: boolean
 *   onSave(name): void
 *   onDelete(id): void
 *   onClose(): void
 *   onLoadSnapshot(code): void
 *   fetchSnapshot(id): Promise<{code}>
 */
export default function SnapshotModal({
  snapshots,
  currentCode,
  language,
  isDark,
  onSave,
  onDelete,
  onClose,
  onLoadSnapshot,
  fetchSnapshot,
}) {
  const [view, setView] = useState("list"); // "list" | "diff"
  const [snapName, setSnapName] = useState("");
  const [saving, setSaving] = useState(false);
  const [diffSnap, setDiffSnap] = useState(null); // snapshot object
  const [diffCode, setDiffCode] = useState(null);  // fetched code
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (view === "list") { setDiffSnap(null); setDiffCode(null); }
  }, [view]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(snapName.trim() || undefined);
    setSnapName("");
    setSaving(false);
  };

  const openDiff = async (snap) => {
    setDiffSnap(snap);
    setLoading(true);
    setView("diff");
    const data = await fetchSnapshot(snap._id);
    setDiffCode(data.code);
    setLoading(false);
  };

  const monacoTheme = isDark ? "devcollab" : "vs";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={cn(
        "flex flex-col rounded-2xl border border-line bg-surface shadow-2xl",
        view === "diff" ? "w-[min(92vw,1100px)] h-[80vh]" : "w-[min(90vw,520px)] max-h-[80vh]"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line shrink-0">
          <div className="flex items-center gap-3">
            {view === "diff" && (
              <button onClick={() => setView("list")} className="text-muted hover:text-fg transition text-xs">
                ← Back
              </button>
            )}
            <h2 className="text-sm font-bold text-fg">
              {view === "diff" ? `Diff: ${diffSnap?.name}` : "Snapshots"}
            </h2>
            {view === "list" && (
              <span className="text-[10px] text-faint bg-canvas px-1.5 py-0.5 rounded-full font-mono">
                {snapshots.length} saved
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition text-xs">✕</button>
        </div>

        {view === "list" ? (
          <>
            {/* Save new snapshot */}
            <div className="px-5 py-3 border-b border-line flex items-center gap-2 shrink-0">
              <input
                value={snapName}
                onChange={(e) => setSnapName(e.target.value)}
                placeholder={`Snapshot ${new Date().toLocaleString()}`}
                className="flex-1 text-xs bg-canvas border border-line rounded px-2.5 py-1.5 text-fg placeholder:text-faint outline-none focus:border-primary"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-fg text-canvas hover:opacity-80 disabled:opacity-40 transition"
              >
                {saving ? "Saving…" : "Save now"}
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {snapshots.length === 0 ? (
                <p className="text-xs text-faint text-center mt-10">
                  No snapshots yet. Save one above.
                </p>
              ) : (
                snapshots.map((s) => (
                  <div key={s._id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-4 py-2.5">
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-fg truncate">{s.name}</span>
                      <span className="text-[10px] text-faint">
                        {new Date(s.createdAt).toLocaleString()} · {s.savedBy?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openDiff(s)}
                        className="text-[11px] font-medium text-muted hover:text-fg transition border border-line px-2.5 py-1 rounded-lg"
                      >
                        Diff
                      </button>
                      <button
                        className="text-[11px] font-medium text-primary hover:opacity-70 transition"
                        title="Load this snapshot into editor"
                        onClick={async () => {
                          const data = await fetchSnapshot(s._id);
                          onLoadSnapshot(data.code);
                          onClose();
                        }}
                      >
                        Load
                      </button>
                      <button
                        onClick={() => onDelete(s._id)}
                        className="text-[11px] text-faint hover:text-red-400 transition"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          /* Diff view */
          <div className="flex-1 min-h-0">
            {loading || diffCode === null ? (
              <div className="flex items-center justify-center h-full text-muted text-xs">
                Loading diff…
              </div>
            ) : (
              <DiffEditor
                height="100%"
                language={language}
                original={diffCode}
                modified={currentCode}
                theme={monacoTheme}
                beforeMount={defineTheme}
                options={{
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', Consolas, monospace",
                  minimap: { enabled: false },
                  readOnly: true,
                  renderSideBySide: true,
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
