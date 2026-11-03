import { useEffect, useMemo, useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../config/axios";
import getErrorMessage from "../config/getErrorMessage";
import PageContainer from "../components/layout/PageContainer";
import { UserContext } from "../context/user.context";
import { LANGUAGES, languageLabel } from "../components/ui/LanguageBadge";
import { cn } from "../lib/cn";

const FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "javascript", label: "JavaScript" },
  { value: "cpp", label: "C++" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
];

const formatDate = (date) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default function Home() {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  const [rooms, setRooms] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  // Inline creation state
  const [newTitle, setNewTitle] = useState("");
  const [newLang, setNewLang] = useState("javascript");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchRooms = () => {
    api.get("/rooms/all")
      .then((res) => setRooms(res.data.rooms))
      .catch((err) => {
        setRooms([]);
        setError(getErrorMessage(err, "Could not load your workspaces"));
      });
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const { data } = await api.post("/rooms/create", {
        title: newTitle.trim(),
        language: newLang,
      });
      setNewTitle("");
      navigate(`/room/${data.room._id}`);
    } catch (err) {
      setCreateError(getErrorMessage(err, "Could not create workspace"));
      setCreating(false);
    }
  };

  const handleDeleteRoom = async (roomId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this workspace?")) return;
    try {
      await api.delete(`/rooms/${roomId}`);
      setRooms((prev) => (prev ? prev.filter((r) => r._id !== roomId) : []));
    } catch (err) {
      alert(getErrorMessage(err, "Failed to delete workspace"));
    }
  };

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (rooms ?? []).filter((room) => {
      const matchFilter = filter === "all" || room.language === filter;
      const matchQuery =
        !text ||
        `${room.title} ${languageLabel(room.language)}`.toLowerCase().includes(text);
      return matchFilter && matchQuery;
    });
  }, [rooms, query, filter]);

  return (
    <PageContainer className="py-8 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-8">

        {/* ── 1. Page Header ── */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-fg">
            Workspaces
          </h1>
          <p className="mt-1 text-sm text-muted">
            Create a workspace room for your code or open one you already have.
          </p>
        </div>

        {/* ── 2. Integrated Create Workspace Box ("div inside a div") ── */}
        <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-sm space-y-3.5 transition-colors">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono font-bold tracking-wider text-muted uppercase">
              CREATE NEW WORKSPACE
            </span>
          </div>

          <form
            onSubmit={handleCreateRoom}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <input
              type="text"
              placeholder="Room title, e.g. Binary Search Tree Review"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1 h-11 rounded-full border border-line-strong bg-surface-2 px-4 text-sm text-fg placeholder:text-faint outline-none focus:border-fg transition"
              required
            />

            <div className="relative shrink-0">
              <select
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                className="h-11 w-full sm:w-36 rounded-full border border-line-strong bg-surface-2 px-4 pr-9 text-sm font-medium text-fg outline-none focus:border-fg appearance-none cursor-pointer transition"
              >
                <option value="javascript">JavaScript</option>
                <option value="cpp">C++</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
              </select>
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted text-xs">
                ▼
              </span>
            </div>

            <button
              type="submit"
              disabled={creating || !newTitle.trim()}
              className="h-11 px-6 rounded-full font-bold text-sm bg-primary text-primary-fg hover:opacity-90 active:scale-95 transition disabled:opacity-50 shrink-0 cursor-pointer shadow-xs"
            >
              {creating ? "Creating…" : "Create Room"}
            </button>
          </form>

          {createError && (
            <p className="text-xs text-danger font-medium">{createError}</p>
          )}
        </div>

        {/* ── 3. Search & Filter Bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <input
              type="search"
              aria-label="Search workspaces"
              placeholder="Search workspaces…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-10 rounded-full border border-line bg-surface px-4 text-xs sm:text-sm text-fg outline-none placeholder:text-faint focus:border-fg transition"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {FILTER_TABS.map((tab) => {
              const active = filter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setFilter(tab.value)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer border",
                    active
                      ? "bg-fg text-canvas border-fg"
                      : "bg-surface text-muted border-line hover:text-fg hover:border-fg/30"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger font-medium">
            {error}
          </p>
        )}

        {/* ── 4. Active Rooms Section ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base sm:text-lg font-bold text-fg">Active Rooms</h2>
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-surface-2 text-muted border border-line">
              {visible.length}
            </span>
          </div>

          {rooms === null ? (
            <div className="p-12 text-center text-sm text-muted">
              Loading workspaces…
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-line border-dashed bg-surface/50 p-12 text-center">
              <p className="text-sm font-semibold text-fg">No workspaces found</p>
              <p className="mt-1 text-xs text-muted">
                {query || filter !== "all"
                  ? "Try adjusting your search or language filter."
                  : "Create your first room above to start coding."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {visible.map((room) => {
                const langStyle = LANGUAGES[room.language] || {};
                const isOwner = user && (room.createdBy === user._id || room.createdBy === user.id);

                return (
                  <div
                    key={room._id}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-2xl border border-line bg-surface p-5 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                      langStyle.hover ?? "hover:border-fg/40"
                    )}
                  >
                    {/* Top Row: Language Badge + Open link */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-mono font-semibold transition",
                          langStyle.badge ?? "bg-surface-2 text-muted border-line"
                        )}
                      >
                        <span className={cn("size-2 rounded-full", langStyle.dot ?? "bg-faint")} />
                        {languageLabel(room.language)}
                      </span>

                      <Link
                        to={`/room/${room._id}`}
                        className="text-xs font-semibold text-muted group-hover:text-fg transition flex items-center gap-1"
                      >
                        <span>Open</span>
                        <span className="transition-transform group-hover:translate-x-0.5">→</span>
                      </Link>
                    </div>

                    {/* Room Title */}
                    <Link to={`/room/${room._id}`} className="mt-4 block min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-fg truncate group-hover:text-primary transition">
                        {room.title}
                      </h3>
                    </Link>

                    {/* Footer Row: Timestamp + Owner delete */}
                    <div className="mt-4 pt-2 border-t border-line/60 flex items-center justify-between text-xs text-muted font-mono">
                      <span>Updated {formatDate(room.updatedAt || room.createdAt)}</span>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRoom(room._id, e)}
                          title="Delete workspace"
                          className="opacity-0 group-hover:opacity-100 text-faint hover:text-danger transition p-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </PageContainer>
  );
}
