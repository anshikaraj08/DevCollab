import { useState } from "react";
import { cn } from "../../lib/cn";

/**
 * CommentThread — a single comment card with replies.
 */
function CommentThread({ comment, onResolve, onReply, onDelete }) {
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    await onReply(comment._id, replyText.trim());
    setReplyText("");
    setShowReply(false);
    setSubmitting(false);
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-3 flex flex-col gap-2 transition-all",
        comment.resolved
          ? "border-line bg-canvas opacity-60"
          : "border-line bg-surface"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-fg truncate">{comment.author.name}</span>
            <span className="text-[10px] text-faint font-mono">L{comment.line}</span>
          </div>
          <p className="text-xs text-fg mt-1 whitespace-pre-wrap break-words leading-relaxed">
            {comment.text}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button
            onClick={() => onResolve(comment._id, !comment.resolved)}
            className="text-[10px] text-muted hover:text-fg px-2 py-0.5 rounded border border-transparent hover:border-line transition"
          >
            {comment.resolved ? "Reopen" : "Resolve"}
          </button>
          <button
            onClick={() => onDelete(comment._id)}
            className="text-[10px] text-faint hover:text-red-400 transition"
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Replies */}
      {comment.replies?.length > 0 && (
        <div className="ml-2 pl-2 border-l border-line flex flex-col gap-1.5">
          {comment.replies.map((r, i) => (
            <div key={i} className="text-xs">
              <span className="font-semibold text-fg">{r.author.name}: </span>
              <span className="text-muted">{r.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {!comment.resolved && (
        <div>
          {showReply ? (
            <div className="flex gap-1 mt-1">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleReply()}
                placeholder="Reply…"
                className="flex-1 text-xs bg-canvas border border-line rounded px-2 py-1 text-fg placeholder:text-faint outline-none focus:border-primary"
                autoFocus
              />
              <button
                onClick={handleReply}
                disabled={submitting || !replyText.trim()}
                className="text-[11px] font-semibold px-2.5 py-1 rounded bg-fg text-canvas disabled:opacity-40 hover:opacity-80 transition"
              >
                Send
              </button>
              <button
                onClick={() => { setShowReply(false); setReplyText(""); }}
                className="text-[11px] text-muted hover:text-fg transition"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowReply(true)}
              className="text-[11px] text-muted hover:text-fg transition"
            >
              + Reply
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * CommentPanel — slide-in drawer listing all comment threads.
 * Props:
 *   comments: Comment[]
 *   onAdd(line, text): void
 *   onResolve(id, resolved): void
 *   onReply(id, text): void
 *   onDelete(id): void
 *   onClose(): void
 */
export default function CommentPanel({ comments, onAdd, onResolve, onReply, onDelete, onClose }) {
  const [newLine, setNewLine] = useState("");
  const [newText, setNewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState("open"); // "open" | "resolved" | "all"

  const handleAdd = async () => {
    const line = parseInt(newLine, 10);
    if (!line || !newText.trim()) return;
    setSubmitting(true);
    await onAdd(line, newText.trim());
    setNewLine("");
    setNewText("");
    setSubmitting(false);
  };

  const filtered = comments.filter((c) => {
    if (filter === "open") return !c.resolved;
    if (filter === "resolved") return c.resolved;
    return true;
  });

  return (
    <div className="flex flex-col w-80 shrink-0 rounded-2xl overflow-hidden border border-line bg-surface shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-canvas shrink-0">
        <div className="flex items-center gap-2">
          <svg className="size-4 text-primary" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-bold text-fg uppercase tracking-wider">Comments</span>
          <span className="text-[10px] text-faint bg-surface-2 px-1.5 py-0.5 rounded-full font-mono">
            {comments.filter((c) => !c.resolved).length}
          </span>
        </div>
        <button onClick={onClose} className="text-muted hover:text-fg transition text-xs">✕</button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-3 pt-2 pb-0 border-b border-line shrink-0">
        {["open", "resolved", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "text-[11px] font-semibold px-3 py-1.5 rounded-t capitalize transition",
              filter === f
                ? "text-fg border-b-2 border-primary"
                : "text-muted hover:text-fg"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-faint text-center mt-8">
            {filter === "open" ? "No open comments." : "No comments."}
          </p>
        ) : (
          filtered.map((c) => (
            <CommentThread
              key={c._id}
              comment={c}
              onResolve={onResolve}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))
        )}
      </div>

      {/* New comment form */}
      <div className="border-t border-line p-3 shrink-0 flex flex-col gap-2 bg-canvas">
        <div className="flex gap-2 items-center">
          <label className="text-[11px] text-muted shrink-0 font-medium">Line</label>
          <input
            type="number"
            value={newLine}
            onChange={(e) => setNewLine(e.target.value)}
            placeholder="42"
            min={1}
            className="w-16 text-xs bg-surface border border-line rounded px-2 py-1 text-fg placeholder:text-faint outline-none focus:border-primary"
          />
        </div>
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.ctrlKey && handleAdd()}
          placeholder="Add a comment… (Ctrl+Enter to submit)"
          rows={2}
          className="w-full text-xs bg-surface border border-line rounded px-2 py-1.5 text-fg placeholder:text-faint outline-none focus:border-primary resize-none"
        />
        <button
          onClick={handleAdd}
          disabled={submitting || !newLine || !newText.trim()}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-fg text-canvas disabled:opacity-40 hover:opacity-80 transition self-end"
        >
          {submitting ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}

