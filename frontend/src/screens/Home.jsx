import { useState, useEffect, useContext, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { setAccessToken } from "../config/axios";
import getErrorMessage from "../config/getErrorMessage";
import { UserContext } from "../context/user.context";
import Navbar from "../components/Navbar";
import { LANGUAGES, getLanguageStyle } from "../config/languages";

const formatDate = (date) =>
  new Date(date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function Home() {
  const [rooms, setRooms] = useState(null);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { user, setUser } = useContext(UserContext);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get("/rooms/all")
      .then((res) => setRooms(res.data.rooms))
      .catch((err) => {
        setRooms([]);
        setError(getErrorMessage(err, "Could not load your rooms"));
      });
  }, []);

  const createRoom = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError("");
    try {
      const { data } = await api.post("/rooms/create", { title, language });
      navigate(`/room/${data.room._id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not create the room"));
    }
  };

  const logout = async () => {
    try {
      await api.post("/users/logout");
    } catch {
      // Ignore network errors on logout
    }
    setAccessToken(null);
    setUser(null);
    navigate("/");
  };

  // Filtered rooms based on selected language tab and search
  const filteredRooms = useMemo(() => {
    if (!rooms) return [];
    return rooms.filter((r) => {
      const matchesFilter =
        activeFilter === "all" ||
        (r.language || "").toLowerCase() === activeFilter.toLowerCase();
      const matchesSearch =
        searchQuery.trim() === "" ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.language || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [rooms, activeFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#f8faf8] dark:bg-[#181818] text-neutral-900 dark:text-[#eff2f6] flex flex-col transition-colors duration-200">
      {/* ── Standard Navbar ── */}
      <Navbar
        right={
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-black text-white dark:bg-white dark:text-black text-xs font-bold flex items-center justify-center shadow-xs">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
            <span className="text-xs font-semibold text-neutral-700 dark:text-[#a0a0a0] hidden sm:block">
              {user?.name}
            </span>
            <button
              onClick={logout}
              className="text-xs font-medium text-neutral-500 hover:text-black dark:text-[#8a8a8e] dark:hover:text-white transition"
            >
              Log out
            </button>
          </div>
        }
      />

      {/* ── Main Content Area ── */}
      <main className="max-w-4xl mx-auto px-5 py-8 w-full flex flex-col gap-6">
        
        {/* Page Title */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            Workspaces
          </h1>
          <p className="text-xs text-neutral-500 dark:text-[#8a8a8e] mt-1">
            Create a workspace room for your code or open one you already have.
          </p>
        </div>

        {/* ── Create New Room Card ("div inside a div" with minimal background) ── */}
        <section className="p-5 sm:p-6 rounded-2xl border border-neutral-200 dark:border-[#2f2f2f] bg-white dark:bg-[#202020] shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-[11px] font-bold font-mono text-neutral-500 dark:text-[#8a8a8e] uppercase tracking-wider">
              + CREATE NEW WORKSPACE
            </span>
            <span className="text-[11px] font-mono text-neutral-400 dark:text-[#666666]">
              Instant Wandbox compile
            </span>
          </div>

          <form onSubmit={createRoom} className="flex flex-col sm:flex-row items-center gap-3">
            <input
              className="flex-1 w-full px-4 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-[#191919] border border-neutral-300 dark:border-[#383838] text-neutral-900 dark:text-[#eff2f6] placeholder-neutral-400 dark:placeholder-[#666666] focus:outline-none focus:ring-2 focus:ring-neutral-400/40 dark:focus:ring-neutral-600 transition"
              placeholder="Room title, e.g. Binary Search Tree Review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <select
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-[#191919] border border-neutral-300 dark:border-[#383838] text-neutral-900 dark:text-[#eff2f6] focus:outline-none cursor-pointer"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {Object.entries(LANGUAGES).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition shadow-xs whitespace-nowrap active:scale-95"
            >
              Create Room
            </button>
          </form>
          {error && <p className="mt-2.5 text-xs text-red-500 dark:text-red-400">{error}</p>}
        </section>

        {/* ── Active Rooms Section ── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Active Rooms</h2>
              {rooms && (
                <span className="px-2.5 py-0.5 rounded-full bg-neutral-200/70 dark:bg-[#2c2c2c] text-neutral-700 dark:text-[#a0a0a0] text-[11px] font-mono font-semibold">
                  {filteredRooms.length}
                </span>
              )}
            </div>

            {/* Language filter pills */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-neutral-100 dark:bg-[#202020] border border-neutral-200 dark:border-[#2f2f2f]">
              {["all", "cpp", "javascript", "python", "java"].map((key) => {
                const label = key === "all" ? "All" : LANGUAGES[key];
                const active = activeFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveFilter(key)}
                    className={`px-3 py-0.5 rounded-full text-xs font-semibold transition ${
                      active
                        ? "bg-white dark:bg-[#2c2c2c] text-neutral-900 dark:text-white shadow-xs"
                        : "text-neutral-500 dark:text-[#888890] hover:text-black dark:hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-[#777777]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search your workspaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-[#202020] border border-neutral-200 dark:border-[#2f2f2f] text-neutral-900 dark:text-[#eff2f6] placeholder-neutral-400 dark:placeholder-[#666666] focus:outline-none focus:ring-1 focus:ring-neutral-400 transition"
            />
          </div>

          {/* Loading state */}
          {rooms === null && (
            <p className="text-xs text-neutral-400 dark:text-[#777777] font-mono py-10 text-center">
              Loading rooms…
            </p>
          )}

          {/* Empty rooms state */}
          {rooms?.length === 0 && (
            <div className="text-center py-14 rounded-2xl border border-dashed border-neutral-300 dark:border-[#333333] bg-white/40 dark:bg-[#202020]/40">
              <span className="text-2xl block mb-2">📂</span>
              <p className="text-sm font-bold text-neutral-700 dark:text-[#a0a0a0]">No rooms created yet</p>
              <p className="text-xs text-neutral-400 dark:text-[#666666] mt-1">
                Type a title above and click Create Room to start writing and compiling code.
              </p>
            </div>
          )}

          {/* No matches for search */}
          {rooms && rooms.length > 0 && filteredRooms.length === 0 && (
            <div className="text-center py-10 rounded-2xl border border-neutral-200 dark:border-[#2f2f2f] bg-white/40 dark:bg-[#202020]/40">
              <p className="text-xs text-neutral-400 dark:text-[#777777]">
                No workspaces match the current search or filter.
              </p>
            </div>
          )}

          {/* Rooms Grid */}
          {filteredRooms.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {filteredRooms.map((r) => {
                const langStyle = getLanguageStyle(r.language);
                return (
                  <Link
                    key={r._id}
                    to={`/room/${r._id}`}
                    className={`group p-4 rounded-2xl border border-neutral-200 dark:border-[#2f2f2f] bg-white dark:bg-[#202020] hover:dark:bg-[#252525] ${langStyle.hoverBorder} hover:shadow-lg ${langStyle.hoverShadow} transition-all duration-200 flex flex-col justify-between min-h-[120px]`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-semibold transition-all duration-200 ${langStyle.pill}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${langStyle.dot}`} />
                          {LANGUAGES[r.language] || r.language}
                        </span>
                        <span
                          className={`text-xs font-semibold text-neutral-400 dark:text-neutral-500 ${langStyle.hoverText} transition-all duration-200 flex items-center gap-1`}
                        >
                          <span>Open</span>
                          <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                            &rarr;
                          </span>
                        </span>
                      </div>
                      <h3 className="font-bold text-neutral-900 dark:text-white text-xs sm:text-sm truncate transition-colors duration-200 group-hover:text-black dark:group-hover:text-white">
                        {r.title}
                      </h3>
                    </div>
                    <p className="text-[10px] text-neutral-400 dark:text-[#787882] font-mono mt-3">
                      Updated {formatDate(r.updatedAt)}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
