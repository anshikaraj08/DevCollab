import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../config/axios";
import { connectSocket } from "../../config/socket";
import Avatar from "../ui/Avatar";
import { cn } from "../../lib/cn";

function formatRelativeTime(dateInput) {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NotificationBell({ user }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef(null);
  const navigate = useNavigate();

  // Load unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get?.("/notifications/unread-count");
      if (res?.data?.count !== undefined) {
        setUnreadCount(res.data.count);
      }
    } catch {
      // quiet fail
    }
  }, [user]);

  // Load recent notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.get?.("/notifications?limit=25");
      if (res?.data?.notifications) {
        setNotifications(res.data.notifications);
      }
    } catch {
      // quiet fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Connect socket and listen for real-time notifications
  useEffect(() => {
    if (!user) return;
    fetchUnreadCount();

    const socket = connectSocket();

    const handleNewNotification = ({ notification }) => {
      setUnreadCount((prev) => prev + 1);
      setNotifications((prev) => [notification, ...prev.filter((n) => n._id !== notification._id)]);
    };

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, [user, fetchUnreadCount]);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!open) return;

    const handleDocumentClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleToggle = () => {
    if (!open) {
      fetchNotifications();
      fetchUnreadCount();
    }
    setOpen((prev) => !prev);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post("/notifications/read", { all: true });
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
    } catch {
      // quiet fail
    }
  };

  const handleNotificationClick = async (notif) => {
    // Mark this notification read if not already
    if (!notif.readAt) {
      api.post("/notifications/read", { ids: [notif._id] }).catch(() => {});
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    }

    setOpen(false);

    // Navigate to room with ?thread= if comment is associated
    const targetRoomId = notif.room?._id || notif.room;
    if (!targetRoomId) return;

    const commentId = notif.comment?._id || notif.comment;
    const targetUrl = commentId
      ? `/room/${targetRoomId}?thread=${commentId}`
      : `/room/${targetRoomId}`;

    navigate(targetUrl);
  };

  const badgeText = unreadCount > 9 ? "9+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Bell Button */}
      <button
        type="button"
        onClick={handleToggle}
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        className={cn(
          "relative flex items-center justify-center size-9 rounded-full text-slate-300 hover:text-white transition cursor-pointer border",
          open
            ? "bg-white/[0.16] border-white/20 text-white"
            : "bg-white/[0.08] hover:bg-white/[0.14] border-white/10"
        )}
      >
        <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>

        {badgeText && (
          <span
            data-testid="notification-badge"
            className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none shadow-sm animate-in fade-in"
          >
            {badgeText}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-line bg-surface text-fg shadow-2xl overflow-hidden z-50 flex flex-col max-h-[480px] animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-canvas shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-fg uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-mono font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] text-muted hover:text-fg font-medium transition cursor-pointer"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-line/40">
            {loading && notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted">Loading notifications…</div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center gap-2 text-faint">
                <svg className="size-8 opacity-40" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
                <p className="text-xs">No notifications yet.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.readAt;
                const actorName = notif.actor?.name || "A collaborator";
                const roomTitle = notif.room?.title || "Workspace";

                let actionText = "notified you";
                if (notif.type === "mention") actionText = "mentioned you in a comment";
                if (notif.type === "reply") actionText = "replied to your thread";
                if (notif.type === "invite_accepted") actionText = "accepted your workspace invite";

                return (
                  <button
                    key={notif._id}
                    type="button"
                    onClick={() => handleNotificationClick(notif)}
                    className={cn(
                      "w-full text-left p-3.5 flex items-start gap-3 transition cursor-pointer hover:bg-surface-2/60 relative",
                      isUnread && "bg-primary/[0.04]"
                    )}
                  >
                    <div className="shrink-0 mt-0.5">
                      <Avatar
                        name={actorName}
                        src={notif.actor?.avatarUrl}
                        size="sm"
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <p className="text-xs text-fg leading-snug">
                        <span className="font-bold">{actorName}</span>{" "}
                        <span className="text-muted">{actionText}</span>{" "}
                        <span className="font-medium text-fg">"{roomTitle}"</span>
                      </p>
                      {notif.comment?.text && (
                        <p className="text-[11px] text-faint line-clamp-1 italic mt-0.5">
                          "{notif.comment.text}"
                        </p>
                      )}
                      <span className="text-[10px] text-faint mt-1">
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>

                    {isUnread && (
                      <span
                        className="size-2 rounded-full bg-primary shrink-0 mt-2"
                        title="Unread"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
