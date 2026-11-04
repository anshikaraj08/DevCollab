import { useState } from "react";
import { can } from "../../lib/permissions";
import Button from "../ui/Button";
import Modal from "../ui/Modal";

function formatRelativeTime(dateInput) {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * HistoryPanel — Side panel displaying version history with Save, Compare, Restore, and Delete.
 */
export default function HistoryPanel({
  snapshots = [],
  role = "viewer",
  currentUserId,
  onSaveVersion,
  onRestore,
  onDelete,
  onCompare,
  loading = false,
}) {
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [saving, setSaving] = useState(false);

  const canCreate = can(role, "snapshot.create");
  const canRestore = can(role, "snapshot.restore");

  const canDeleteSnapshot = (snapshot) => {
    if (role === "owner") return true;
    if (role === "editor") {
      const creatorId = snapshot?.createdBy?._id || snapshot?.createdBy?.id || snapshot?.createdBy;
      return String(creatorId) === String(currentUserId);
    }
    return false;
  };

  const handleSaveSubmit = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await onSaveVersion(versionName.trim() || undefined);
      setVersionName("");
      setSaveModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden select-none" role="region" aria-label="Version history">
      {/* Top action header */}
      <div className="p-3 border-b border-line flex items-center justify-between shrink-0 bg-surface">
        <span className="text-xs font-semibold text-fg">
          Versions ({snapshots.length})
        </span>
        {canCreate && (
          <Button
            type="button"
            size="sm"
            onClick={() => setSaveModalOpen(true)}
            className="text-xs font-semibold px-2.5 py-1 bg-primary text-primary-fg rounded-lg hover:opacity-90 transition cursor-pointer"
          >
            + Save version
          </Button>
        )}
      </div>

      {/* Snapshot List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted text-xs gap-2">
            <span className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Loading versions…</span>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="text-center p-8 text-muted text-xs flex flex-col gap-2">
            <p className="font-semibold text-fg">No versions saved yet</p>
            <p className="text-faint text-[11px] leading-relaxed">
              {canCreate
                ? "Save a version of your code to compare changes or restore earlier states anytime."
                : "Versions saved by workspace editors will appear here."}
            </p>
          </div>
        ) : (
          snapshots.map((snap) => {
            const isPreRestore = snap.kind === "pre-restore";
            const author = snap.createdBy?.name || "Unknown";
            const dateStr = formatRelativeTime(snap.createdAt);

            return (
              <div
                key={snap._id}
                className="rounded-xl border border-line bg-surface p-3 flex flex-col gap-2 hover:border-line-hover transition shadow-xs"
              >
                {/* Title & Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-fg truncate">
                        {snap.name || "Untitled version"}
                      </span>
                      {isPreRestore && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium">
                          Pre-restore
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted mt-0.5">
                      <span>{author}</span>
                      <span>•</span>
                      <span>{dateStr}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-line/50 text-[11px]">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onCompare(snap)}
                      className="px-2 py-0.5 rounded text-primary hover:bg-primary/10 font-medium transition cursor-pointer"
                      title="Compare against Current or another version"
                    >
                      Compare
                    </button>
                    {canRestore && (
                      <button
                        type="button"
                        onClick={() => onRestore(snap)}
                        className="px-2 py-0.5 rounded text-fg hover:bg-surface-2 font-medium transition cursor-pointer"
                        title="Restore this version into the editor"
                      >
                        Restore
                      </button>
                    )}
                  </div>

                  {canDeleteSnapshot(snap) && (
                    <button
                      type="button"
                      onClick={() => onDelete(snap)}
                      className="text-faint hover:text-red-400 p-1 text-xs transition cursor-pointer"
                      title="Delete this snapshot"
                      aria-label={`Delete snapshot ${snap.name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Save Version Modal */}
      <Modal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Save version"
      >
        <form onSubmit={handleSaveSubmit} className="space-y-4">
          <p className="text-xs text-muted leading-relaxed">
            Create a named snapshot of the current workspace code to revisit or restore later.
          </p>

          <div>
            <label className="block text-xs font-medium text-fg mb-1">
              Version name (optional)
            </label>
            <input
              type="text"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="e.g. Added user login logic"
              maxLength={80}
              className="w-full text-xs bg-surface border border-line rounded-lg px-3 py-2 text-fg placeholder:text-faint outline-none focus:border-primary"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSaveModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={saving}
            >
              Save snapshot
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

