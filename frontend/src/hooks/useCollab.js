import { useEffect, useState } from "react";
import { CollabClient } from "../collab/CollabClient";
import { connectSocket } from "../config/socket";

/**
 * Joins the room's live session. Returns the CollabClient (or null until it exists).
 * The component re-renders whenever its status, presence or saved-time changes.
 */
export function useCollab(roomId, user) {
  const [collab, setCollab] = useState(null);
  const [, rerender] = useState(0);

  useEffect(() => {
    const userId = user?._id || user?.id;
    if (!roomId || !userId) return undefined;

    const client = new CollabClient({
      socket: connectSocket(),
      roomId,
      user: { id: String(userId), name: user.name || "Collaborator" },
    });

    setCollab(client);
    const unsubscribe = client.subscribe(() => rerender((n) => n + 1));

    return () => {
      unsubscribe();
      client.destroy();
      setCollab(null);
    };
  }, [roomId, user?._id, user?.id, user?.name]);

  return collab;
}
