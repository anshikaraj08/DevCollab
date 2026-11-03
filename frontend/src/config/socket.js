import { io } from "socket.io-client";
import api, { getAccessToken, setAccessToken } from "./axios";

let socket = null;
let refreshAttempts = 0;

/** One socket for the whole app. */
export function getSocket() {
  if (socket) return socket;

  socket = io(import.meta.env.VITE_API_URL, {
    autoConnect: false,
    withCredentials: true,
    auth: (send) => send({ token: getAccessToken() }),
  });

  socket.on("connect", () => {
    refreshAttempts = 0;
  });

  socket.on("connect_error", async (error) => {
    if (error.message !== "AUTH" || refreshAttempts >= 2) return;
    refreshAttempts += 1;
    try {
      const { data } = await api.post("/users/refresh");
      setAccessToken(data.accessToken);
      socket.auth = { token: data.accessToken };
      socket.connect();
    } catch {
      /* refresh failed: the normal login flow will take over */
    }
  });

  return socket;
}

export function connectSocket() {
  const s = getSocket();
  const token = getAccessToken();
  if (token) {
    s.auth = { token };
  }
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}
