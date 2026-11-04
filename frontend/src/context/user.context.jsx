import { createContext, useState, useEffect } from "react";
import api, { setAccessToken } from "../config/axios";

export const UserContext = createContext({ user: null, setUser: () => {}, loading: false });

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On page load, use the refresh cookie to get a new access token and the user
    api.post("/users/refresh")
      .then((res) => {
        setAccessToken(res.data.accessToken);
        setUser(res.data.user);
      })
      .catch(() => { }) // not logged in
      .finally(() => setLoading(false));
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, loading }}>
      {children}
    </UserContext.Provider>
  );
}

