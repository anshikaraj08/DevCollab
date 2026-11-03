import { cn } from "../../lib/cn";
import Card from "../ui/Card";
import LanguageBadge, { LANGUAGES } from "../ui/LanguageBadge";
import { Link } from "react-router-dom";
 
const formatDate = (date) =>
  new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
 
export default function RoomCard({ room }) {
  return (
    <Card
      as={Link}
      to={`/room/${room._id}`}
      className={cn(
        "group flex flex-col gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-lg",
        LANGUAGES[room.language]?.hover ?? "hover:border-line-strong",
      )}
    >
      <div className="flex items-center justify-between">
        <LanguageBadge language={room.language} />
        <span className="text-xs text-faint transition group-hover:text-fg">Open &rarr;</span>
      </div>
      <h3 className="truncate text-base font-semibold">{room.title}</h3>
      <p className="font-mono text-xs text-faint">Updated {formatDate(room.updatedAt)}</p>
    </Card>
  );
}

