import { useState, useMemo } from "react";
import { resolveAnchorToLine } from "../../lib/anchors";

const FOCUS_OPTIONS = [
  { value: "all", label: "All issues" },
  { value: "bugs", label: "Bugs & correctness" },
  { value: "security", label: "Security vulnerabilities" },
  { value: "performance", label: "Performance & efficiency" },
  { value: "style", label: "Style & readability" },
];

const SEVERITY_CONFIG = {
  error: {
    label: "Errors",
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    dot: "bg-red-500",
  },
  warning: {
    label: "Warnings",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    dot: "bg-amber-500",
  },
  info: {
    label: "Info",
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    dot: "bg-purple-500",
  },
};

export default function AiReviewPanel({
  reviews = [],
  activeReview = null,
  onSelectReview,
  onRunReview,
  running = false,
  onCancelRun,
  canReview = false,
  provider = "AI provider",
  onJumpToLine,
  onAddAsComment,
  onDeleteReview,
  currentUserId,
  roomOwnerId,
  ytext,
  editorModel,
  error = null,
}) {
  const [focus, setFocus] = useState("all");
  const [dismissedMap, setDismissedMap] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [commentingId, setCommentingId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const activeReviewId = activeReview?._id || (reviews[0]?._id ?? null);
  const selectedReview = reviews.find((r) => r._id === activeReviewId) || reviews[0] || null;

  // Resolve dynamic line numbers from Yjs anchors
  const findingsWithLines = useMemo(() => {
    if (!selectedReview || !selectedReview.findings) return [];
    return selectedReview.findings.map((f, idx) => {
      let resolvedLine = f.line;
      let isOutdated = false;
      if (f.anchor && ytext && editorModel) {
        const liveLine = resolveAnchorToLine(f.anchor, ytext, editorModel);
        if (liveLine !== null) {
          resolvedLine = liveLine;
        } else {
          isOutdated = true;
        }
      }
      return {
        ...f,
        uid: f._id || `${selectedReview._id}-${idx}`,
        resolvedLine,
        isOutdated,
      };
    });
  }, [selectedReview, ytext, editorModel]);

  // Filter out locally dismissed findings
  const activeFindings = useMemo(() => {
    const dismissed = dismissedMap[selectedReview?._id] || new Set();
    return findingsWithLines.filter((f) => !dismissed.has(f.uid));
  }, [findingsWithLines, dismissedMap, selectedReview]);

  // Group by severity: error -> warning -> info
  const groupedFindings = useMemo(() => {
    const groups = { error: [], warning: [], info: [] };
    for (const f of activeFindings) {
      if (groups[f.severity]) {
        groups[f.severity].push(f);
      } else {
        groups.info.push(f);
      }
    }
    return groups;
  }, [activeFindings]);

  const handleDismiss = (findingUid) => {
    if (!selectedReview?._id) return;
    setDismissedMap((prev) => {
      const currentSet = new Set(prev[selectedReview._id] || []);
      currentSet.add(findingUid);
      return { ...prev, [selectedReview._id]: currentSet };
    });
  };

  const handleCopySuggestion = async (findingUid, suggestionText) => {
    if (!suggestionText) return;
    try {
      await navigator.clipboard.writeText(suggestionText);
      setCopiedId(findingUid);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleAddComment = async (finding) => {
    if (!onAddAsComment) return;
    setCommentingId(finding.uid);
    try {
      const commentText = `AI suggestion: ${finding.suggestion || finding.message}`;
      await onAddAsComment({
        line: finding.resolvedLine || finding.line,
        content: commentText,
      });
    } finally {
      setCommentingId(null);
    }
  };

  const isOwner = String(currentUserId) === String(roomOwnerId);

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs text-fg">
      {/* ── Review Trigger & Focus Controls ── */}
      <div className="p-3 border-b border-line bg-surface flex flex-col gap-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <label htmlFor="ai-focus-select" className="sr-only">
            Review focus
          </label>
          <select
            id="ai-focus-select"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            disabled={running}
            className="flex-1 px-2.5 py-1.5 rounded-lg border border-line bg-surface-2 text-fg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {FOCUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {running ? (
            <button
              type="button"
              onClick={onCancelRun}
              className="px-3 py-1.5 rounded-lg border border-line text-muted hover:text-fg hover:bg-surface-2 font-medium transition cursor-pointer"
            >
              Cancel
            </button>
          ) : (
            canReview && (
              <button
                type="button"
                onClick={() => onRunReview({ focus })}
                disabled={running}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold bg-primary text-primary-fg hover:opacity-90 active:scale-95 transition cursor-pointer shadow-sm disabled:opacity-50"
              >
                <svg className="size-3 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 011.393 1.157l-.427 1.745 1.745-.427a1 1 0 011.157 1.393l-.8 1.599L19.897 15A1 1 0 0118.9 16H17.58l-1.582 3.954a1 1 0 01-1.157 1.393l-1.745-.427.427 1.745a1 1 0 01-1.393 1.157l-1.599-.8L9 23.897A1 1 0 018 22.9V21.58l-3.954-1.582-1.599.8A1 1 0 011.054 19.44l.427-1.745-1.745.427A1 1 0 01-.421 16.73l.8-1.599L-1.897 13A1 1 0 01-.9 12H.42l1.582-3.954a1 1 0 011.157-1.393l1.745.427-.427-1.745a1 1 0 011.393-1.157l1.599.8L9 4.103V3a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span>Run AI review</span>
              </button>
            )
          )}
        </div>

        {/* Privacy Line */}
        <p className="text-[11px] text-muted leading-tight">
          Your code is sent to <span className="font-semibold capitalize">{provider}</span> for this review.
        </p>

        {/* Running state progress indicator */}
        {running && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-2 border border-line animate-pulse">
            <svg className="animate-spin size-3.5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <span className="text-xs text-fg font-medium">Analyzing workspace code with {provider}...</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-1.5">
            <svg className="size-3.5 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── Active Review Results or Empty State ── */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {!selectedReview ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4">
            <div className="size-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 mb-2">
              <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="font-semibold text-fg">No AI reviews yet</p>
            <p className="text-[11px] text-muted max-w-xs mt-1">
              Click &quot;Run AI review&quot; above to scan for bugs, security vulnerabilities, and code quality suggestions.
            </p>
          </div>
        ) : (
          <>
            {/* Review Header Banner */}
            <div className="p-2.5 rounded-xl border border-line bg-surface-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span className="font-medium text-fg">
                  Review by {selectedReview.requestedBy?.name || "Collaborator"}
                </span>
                <span className="capitalize px-1.5 py-0.5 rounded bg-surface border border-line font-mono text-[10px]">
                  {selectedReview.focus} focus
                </span>
              </div>
              <p className="text-xs text-fg leading-relaxed">
                {selectedReview.summary || "Code review completed."}
              </p>
            </div>

            {/* Findings Grouped by Severity */}
            {activeFindings.length === 0 ? (
              <div className="p-4 rounded-xl border border-line text-center text-muted bg-surface">
                ✨ No open issues reported in this review.
              </div>
            ) : (
              ["error", "warning", "info"].map((sev) => {
                const list = groupedFindings[sev];
                if (!list || list.length === 0) return null;
                const config = SEVERITY_CONFIG[sev];

                return (
                  <div key={sev} className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 font-semibold text-muted text-[11px]">
                      <span className={`size-1.5 rounded-full ${config.dot}`} />
                      <span>{config.label} ({list.length})</span>
                    </div>

                    {list.map((finding) => (
                      <div
                        key={finding.uid}
                        className="flex flex-col gap-2 p-3 rounded-xl border border-line bg-surface shadow-xs transition hover:border-line-strong"
                      >
                        {/* Header: Line Button + Category + Outdated Badge */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onJumpToLine?.(finding.resolvedLine || finding.line)}
                              title={`Jump to line ${finding.resolvedLine || finding.line}`}
                              className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-surface-2 border border-line text-fg hover:bg-line transition cursor-pointer"
                            >
                              Line {finding.resolvedLine || finding.line}
                            </button>

                            <span
                              className={`px-1.5 py-0.5 rounded border text-[10px] uppercase font-bold tracking-wider ${config.badge}`}
                            >
                              {finding.category}
                            </span>
                          </div>

                          {finding.isOutdated && (
                            <span
                              title="The code surrounding this finding was edited or removed"
                              className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-medium"
                            >
                              Outdated
                            </span>
                          )}
                        </div>

                        {/* Finding Message */}
                        <p className="text-xs text-fg leading-relaxed">
                          {finding.message}
                        </p>

                        {/* Suggestion Code Block */}
                        {finding.suggestion && (
                          <div className="rounded-lg bg-surface-2 border border-line p-2 overflow-x-auto font-mono text-[11px] text-fg leading-relaxed">
                            <pre className="whitespace-pre-wrap">{finding.suggestion}</pre>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-line/50">
                          {finding.suggestion && (
                            <button
                              type="button"
                              onClick={() => handleCopySuggestion(finding.uid, finding.suggestion)}
                              className="px-2 py-1 rounded text-muted hover:text-fg hover:bg-surface-2 transition cursor-pointer"
                            >
                              {copiedId === finding.uid ? "Copied!" : "Copy"}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDismiss(finding.uid)}
                            className="px-2 py-1 rounded text-muted hover:text-fg hover:bg-surface-2 transition cursor-pointer"
                          >
                            Dismiss
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAddComment(finding)}
                            disabled={commentingId === finding.uid}
                            className="px-2.5 py-1 rounded font-semibold bg-surface-2 hover:bg-line text-fg transition cursor-pointer disabled:opacity-50"
                          >
                            {commentingId === finding.uid ? "Adding…" : "Add as comment"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })
            )}

            {/* Collapsible Past Reviews List */}
            {reviews.length > 1 && (
              <div className="pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="w-full flex items-center justify-between py-1 text-[11px] font-semibold text-muted hover:text-fg cursor-pointer transition"
                >
                  <span>Earlier reviews ({reviews.length - 1})</span>
                  <svg
                    className={`size-3.5 transition-transform ${historyOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>

                {historyOpen && (
                  <div className="flex flex-col gap-1.5 mt-2">
                    {reviews.map((r) => {
                      const isSelected = r._id === selectedReview._id;
                      const canDelete = isOwner || String(r.requestedBy?._id || r.requestedBy) === String(currentUserId);

                      return (
                        <div
                          key={r._id}
                          className={`flex items-center justify-between p-2 rounded-lg border text-[11px] transition cursor-pointer ${
                            isSelected
                              ? "bg-surface-2 border-primary/40 font-semibold"
                              : "bg-surface border-line hover:bg-surface-2"
                          }`}
                          onClick={() => onSelectReview?.(r)}
                        >
                          <div className="flex flex-col gap-0.5 truncate pr-2">
                            <span className="truncate">{r.summary || "Review"}</span>
                            <span className="text-[10px] text-muted">
                              {new Date(r.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>

                          {canDelete && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteReview?.(r._id);
                              }}
                              title="Delete this review"
                              className="size-6 flex items-center justify-center rounded text-muted hover:text-danger hover:bg-red-500/10 transition cursor-pointer shrink-0"
                            >
                              <svg className="size-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
