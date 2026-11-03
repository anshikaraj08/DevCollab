import Avatar from "../ui/Avatar";
 
// Who is in the room right now. Each person keeps the color of their cursor.
export default function PresenceBar({ people, max = 4 }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-2" aria-label={`${people.length} in this room`}>
      {shown.map((person) => (
        <Avatar key={person.id} name={person.self ? `${person.name} (you)` : person.name}
          colorIndex={person.colorIndex} className="ring-2 ring-canvas" />
      ))}
      {extra > 0 && (
        <span className="inline-grid size-8 place-items-center rounded-full bg-surface-2 text-xs font-semibold ring-2 ring-canvas">
          +{extra}
        </span>
      )}
    </div>
  );
}

