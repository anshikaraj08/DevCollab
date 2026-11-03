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
    if (!roomId || !user) return undefined;
    const client = new CollabClient({
      socket: connectSocket(),
      roomId,
      user: { id: user._id, name: user.name },
    });
    setCollab(client);
    const unsubscribe = client.subscribe(() => rerender((n) => n + 1));
    return () => {
      unsubscribe();
      client.destroy();
      setCollab(null);
    };
  }, [roomId, user?._id, user?.name]);
 
  return collab;
}

