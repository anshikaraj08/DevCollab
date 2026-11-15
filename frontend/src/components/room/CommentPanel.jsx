import { useState, useRef, useEffect } from "react";
import { cn } from "../../lib/cn";

/**
 * Renders comment text with highlighted @Name mentions
 */
export function renderFormattedContent(text) {
  if (!text) return null;
  // Match @mentions (single or two-word names like @Alice or @Bob Editor)
  const parts = text.split(/(@[A-Za-z0-9_]+(?:\s+[A-Za-z0-9_]+)?)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@") && part.length > 1) {
      return (
        <span
          key={i}
          className="inline-block px-1 py-0.5 rounded text-[11px] font-semibold bg-primary/15 text-primary"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

/**
 * Autocomplete composer with @ member mention dropdown
 */
function MentionComposer({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  submitting = false,
  members = [],
  onMentionsChange,
  mentions = [],
  autoFocus = false,
  minRows = 2,
  onKeyDownExtra,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef(null);

  const filteredMembers = members
    .filter((m) => {
      if (!mentionQuery) return true;
      return m.name?.toLowerCase().includes(mentionQuery.toLowerCase());
    })
    .slice(0, 6);

  const handleTextChange = (e) => {
    const val = e.target.value;
    onChange(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/);

    if (match) {
      setMentionQuery(match[1]);
      setDropdownOpen(true);
      setSelectedIndex(0);
    } else {
      setDropdownOpen(false);
    }
  };

  const insertMention = (member) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);

    const match = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/);
    if (!match) return;

    const prefix = textBeforeCursor.slice(0, match.index);
    const inserted = `@${member.name} `;
    const newVal = `${prefix}${inserted}${textAfterCursor}`;
    onChange(newVal);

    const memberId = String(member._id || member.id);
    if (!mentions.map(String).includes(memberId)) {
      onMentionsChange?.([...mentions, memberId]);
    }

    setDropdownOpen(false);
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = prefix.length + inserted.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (dropdownOpen && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredMembers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        insertMention(filteredMembers[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDropdownOpen(false);
        return;
      }
    }

    if (e.key === "Escape" && onCancel) {
      e.preventDefault();
      onCancel();
      return;
    }

    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!submitting) onSubmit?.();
      return;
    }

    onKeyDownExtra?.(e);
  };

  return (
    <div className="relative flex flex-col gap-1.5 w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={minRows}
        autoFocus={autoFocus}
        className="w-full text-xs bg-surface border border-line rounded-lg px-2.5 py-2 text-fg placeholder:text-faint outline-none focus:border-primary resize-none transition"
      />

      {dropdownOpen && filteredMembers.length > 0 && (
        <div
          role="listbox"
          aria-label="Room members to mention"
          className="absolute z-50 bottom-full mb-1 left-0 w-64 max-h-48 overflow-y-auto rounded-xl border border-line bg-surface shadow-2xl p-1 flex flex-col gap-0.5"
        >
          <div className="px-2 py-1 text-[10px] font-bold text-faint uppercase tracking-wider">
            Mention Member
          </div>
          {filteredMembers.map((member, idx) => (
            <button
              key={member._id || member.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(member);
              }}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs cursor-pointer transition select-none",
                selectedIndex === idx
                  ? "bg-primary text-white"
                  : "hover:bg-surface-2 text-fg"
              )}
            >
              <div
                className={cn(
                  "size-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                  selectedIndex === idx ? "bg-white/20 text-white" : "bg-surface-2 text-muted"
                )}
              >
                {member.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold truncate">{member.name}</span>
                {member.role && (
                  <span className="text-[10px] opacity-75 capitalize">{member.role}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * CommentThread — a single comment card with inline edit, replies, and mentions.
 */
function CommentThread({
  comment,
  currentUserId,
  members = [],
  onResolve,
  onReply,
  onEdit,
  onDelete,
  isHighlighted = false,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text || "");
  const [editMentions, setEditMentions] = useState(
    (comment.mentions || []).map((m) => String(m._id || m))
  );
  const [savingEdit, setSavingEdit] = useState(false);

  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyMentions, setReplyMentions] = useState([]);
  const [submittingReply, setSubmittingReply] = useState(false);

  const cardRef = useRef(null);

  // Scroll to highlighted thread on mount or highlight change
  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
  }, [isHighlighted]);

  const authorId = String(comment.author?.id || comment.author?._id);
  const isAuthor = currentUserId && authorId === String(currentUserId);

  const handleStartEdit = () => {
    setEditText(comment.text || "");
    setEditMentions((comment.mentions || []).map((m) => String(m._id || m)));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText(comment.text || "");
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    setSavingEdit(true);
    try {
      await onEdit(comment._id, editText.trim(), editMentions);
      setIsEditing(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      await onReply(comment._id, replyText.trim(), replyMentions);
      setReplyText("");
      setReplyMentions([]);
      setShowReply(false);
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div
      ref={cardRef}
      id={`thread-${comment._id}`}
      className={cn(
        "rounded-xl border p-3 flex flex-col gap-2 transition-all duration-300",
        isHighlighted && "ring-2 ring-primary border-primary bg-primary/5",
        comment.resolved
          ? "border-line bg-canvas opacity-65"
          : !isHighlighted && "border-line bg-surface"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-fg truncate">{comment.author?.name}</span>
            <span className="text-[10px] text-faint font-mono">L{comment.line}</span>
            {comment.editedAt && (
              <span
                className="text-[10px] text-faint italic cursor-help"
                title={`Edited at ${new Date(comment.editedAt).toLocaleString()}`}
              >
                (edited)
              </span>
            )}
          </div>

          {/* Comment Body or Inline Editor */}
          {isEditing ? (
            <div className="mt-2 flex flex-col gap-2">
              <MentionComposer
                value={editText}
                onChange={setEditText}
                onSubmit={handleSaveEdit}
                onCancel={handleCancelEdit}
                placeholder="Edit your comment…"
                members={members}
                mentions={editMentions}
                onMentionsChange={setEditMentions}
                autoFocus
                minRows={2}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={savingEdit}
                  className="text-xs px-2.5 py-1 rounded-md text-muted hover:text-fg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editText.trim()}
                  className="text-xs font-semibold px-3 py-1 rounded-md bg-fg text-canvas disabled:opacity-40 hover:opacity-85 transition cursor-pointer"
                >
                  {savingEdit ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-fg mt-1 whitespace-pre-wrap break-words leading-relaxed">
              {renderFormattedContent(comment.text)}
            </p>
          )}
        </div>

        {/* Actions */}
        {!isEditing && (
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            {isAuthor && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="text-[10px] text-muted hover:text-fg px-1.5 py-0.5 rounded border border-transparent hover:border-line transition cursor-pointer"
                title="Edit comment"
              >
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={() => onResolve(comment._id, !comment.resolved)}
              className="text-[10px] text-muted hover:text-fg px-1.5 py-0.5 rounded border border-transparent hover:border-line transition cursor-pointer"
            >
              {comment.resolved ? "Reopen" : "Resolve"}
            </button>
            <button
              type="button"
              onClick={() => onDelete(comment._id)}
              className="text-[10px] text-faint hover:text-red-400 p-1 transition cursor-pointer"
              title="Delete"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Replies */}
      {comment.replies?.length > 0 && (
        <div className="ml-2 pl-2.5 border-l-2 border-line/60 flex flex-col gap-2 mt-1">
          {comment.replies.map((r, i) => (
            <div key={i} className="text-xs flex flex-col gap-0.5">
              <span className="font-semibold text-fg text-[11px]">{r.author?.name}</span>
              <p className="text-muted leading-relaxed whitespace-pre-wrap break-words">
                {renderFormattedContent(r.text)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Reply input with mention picker */}
      {!comment.resolved && !isEditing && (
        <div className="mt-1">
          {showReply ? (
            <div className="flex flex-col gap-1.5 mt-1">
              <MentionComposer
                value={replyText}
                onChange={setReplyText}
                onSubmit={handleSendReply}
                onCancel={() => {
                  setShowReply(false);
                  setReplyText("");
                  setReplyMentions([]);
                }}
                placeholder="Write a reply… (@name to mention)"
                members={members}
                mentions={replyMentions}
                onMentionsChange={setReplyMentions}
                autoFocus
                minRows={2}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReply(false);
                    setReplyText("");
                    setReplyMentions([]);
                  }}
                  className="text-xs px-2.5 py-1 rounded text-muted hover:text-fg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendReply}
                  disabled={submittingReply || !replyText.trim()}
                  className="text-xs font-semibold px-3 py-1 rounded bg-fg text-canvas disabled:opacity-40 hover:opacity-85 transition cursor-pointer"
                >
                  {submittingReply ? "Sending…" : "Reply"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowReply(true)}
              className="text-[11px] font-medium text-muted hover:text-fg transition cursor-pointer"
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
 * CommentPanel — slide-in or tabbed drawer listing all comments with editing and mentions.
 */
export default function CommentPanel({
  comments = [],
  members = [],
  currentUserId,
  onAdd,
  onEdit,
  onResolve,
  onReply,
  onDelete,
  onClose,
  isEmbedded = false,
  activeThreadId = null,
}) {
  const [newLine, setNewLine] = useState("");
  const [newText, setNewText] = useState("");
  const [newMentions, setNewMentions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState("open"); // "open" | "resolved" | "all"

  const handleAdd = async () => {
    const line = parseInt(newLine, 10);
    if (!line || !newText.trim()) return;
    setSubmitting(true);
    try {
      await onAdd(line, newText.trim(), newMentions);
      setNewLine("");
      setNewText("");
      setNewMentions([]);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = comments.filter((c) => {
    if (filter === "open") return !c.resolved;
    if (filter === "resolved") return c.resolved;
    return true;
  });

  return (
    <div
      className={
        isEmbedded
          ? "flex flex-col h-full overflow-hidden"
          : "flex flex-col w-80 shrink-0 rounded-2xl overflow-hidden border border-line bg-surface shadow-xl"
      }
    >
      {/* Header (hidden in embedded tab mode) */}
      {!isEmbedded && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-canvas shrink-0">
          <div className="flex items-center gap-2">
            <svg className="size-4 text-primary" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs font-bold text-fg uppercase tracking-wider">Comments</span>
            <span className="text-[10px] text-faint bg-surface-2 px-1.5 py-0.5 rounded-full font-mono">
              {comments.filter((c) => !c.resolved).length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-fg transition text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 px-3 pt-2 pb-0 border-b border-line shrink-0">
        {["open", "resolved", "all"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "text-[11px] font-semibold px-3 py-1.5 rounded-t capitalize transition cursor-pointer",
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
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {filtered.length === 0 ? (
          <p className="text-xs text-faint text-center mt-8">
            {filter === "open" ? "No open comments." : "No comments."}
          </p>
        ) : (
          filtered.map((c) => (
            <CommentThread
              key={c._id}
              comment={c}
              currentUserId={currentUserId}
              members={members}
              onResolve={onResolve}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              isHighlighted={String(c._id) === String(activeThreadId)}
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
            className="w-16 text-xs bg-surface border border-line rounded-md px-2 py-1 text-fg placeholder:text-faint outline-none focus:border-primary"
          />
        </div>
        <MentionComposer
          value={newText}
          onChange={setNewText}
          onSubmit={handleAdd}
          placeholder="Add a comment… (@name to mention, Ctrl+Enter to post)"
          members={members}
          mentions={newMentions}
          onMentionsChange={setNewMentions}
          minRows={2}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={submitting || !newLine || !newText.trim()}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-fg text-canvas disabled:opacity-40 hover:opacity-85 transition self-end cursor-pointer"
        >
          {submitting ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}
