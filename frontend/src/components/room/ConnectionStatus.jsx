import { cn } from "../../lib/cn";
 
const STATES = {
  connecting: { label: "Connecting", dot: "bg-amber-400 animate-pulse" },
  synced: { label: "Live", dot: "bg-success" },
  disconnected: { label: "Reconnecting", dot: "bg-amber-400 animate-pulse" },
  forbidden: { label: "No access", dot: "bg-danger" },
  error: { label: "Offline", dot: "bg-danger" },
};
 
export default function ConnectionStatus({ status, lastSavedAt }) {
  const state = STATES[status] ?? STATES.error;
  const savedTime = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;
  return (
    <div role="status" className="flex items-center gap-1.5 text-xs text-muted shrink-0" title={`Connection status: ${state.label}`}>
      <span className={cn("size-2 rounded-full", state.dot)} />
      <span className="hidden md:inline">{state.label}</span>
      {savedTime && status === "synced" && <span className="hidden text-faint xl:inline">Saved {savedTime}</span>}
    </div>
  );
}

