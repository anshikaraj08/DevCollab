import { useEffect, useMemo, useState } from "react";
import api from "../config/axios";
import getErrorMessage from "../config/getErrorMessage";
import PageContainer from "../components/layout/PageContainer";
import RoomCard from "../components/dashboard/RoomCard";
import CreateRoomModal from "../components/dashboard/CreateRoomModal";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import SegmentedControl from "../components/ui/SegmentedControl";
import { LANGUAGES, languageLabel } from "../components/ui/LanguageBadge";
 
const FILTERS = [
  { value: "all", label: "All" },
  ...Object.entries(LANGUAGES).map(([value, { label }]) => ({ value, label })),
];
 
// The workspaces dashboard: ONE header, ONE toolbar (search + filter), then the list.
export default function Home() {
  const [rooms, setRooms] = useState(null);        // null = still loading
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
 
  useEffect(() => {
    api.get("/rooms/all")
      .then((res) => setRooms(res.data.rooms))
      .catch((err) => {
        setRooms([]);
        setError(getErrorMessage(err, "Could not load your workspaces"));
      });
  }, []);
 
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (rooms ?? []).filter((room) =>
      (filter === "all" || room.language === filter) &&
      (!text || `${room.title} ${languageLabel(room.language)}`.toLowerCase().includes(text)));
  }, [rooms, query, filter]);
 
  const clearFilters = () => { setQuery(""); setFilter("all"); };
 
  return (
    <PageContainer className="py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Workspaces</h1>
          <p className="mt-1 text-sm text-muted">Create a workspace for your code, or open one you already have.</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ New workspace</Button>
      </div>
 
      {error && <p role="alert" className="mt-6 text-sm text-danger">{error}</p>}
 
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <input
          type="search" aria-label="Search workspaces" placeholder="Search workspaces..."
          value={query} onChange={(e) => setQuery(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-full border border-line-strong bg-canvas px-4 text-sm outline-none placeholder:text-faint focus:border-fg sm:min-w-64"
        />
        <SegmentedControl label="Filter by language" options={FILTERS} value={filter} onChange={setFilter} />
      </div>
 
      <div className="mt-6">
        {rooms === null && <p className="text-sm text-muted">Loading your workspaces...</p>}
 
        {rooms && rooms.length === 0 && (
          <EmptyState title="No workspaces yet" text="Create your first workspace to start writing and reviewing code."
            action={<Button onClick={() => setCreating(true)}>+ New workspace</Button>} />
        )}
 
        {rooms && rooms.length > 0 && visible.length === 0 && (
          <EmptyState title="No matches" text="Nothing fits that search or filter."
            action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>} />
        )}
 
        {visible.length > 0 && (
          <>
            <p className="mb-3 text-xs text-faint">{visible.length} {visible.length === 1 ? "workspace" : "workspaces"}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((room) => <RoomCard key={room._id} room={room} />)}
            </div>
          </>
        )}
      </div>
 
      <CreateRoomModal open={creating} onClose={() => setCreating(false)} />
    </PageContainer>
  );
}
