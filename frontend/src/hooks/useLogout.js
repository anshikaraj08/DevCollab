import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import api, { setAccessToken } from "../config/axios";
import { disconnectSocket } from "../config/socket";
import { UserContext } from "../context/user.context";
 
export function useLogout() {
  const { setUser } = useContext(UserContext);
  const navigate = useNavigate();
  return async () => {
    try {
      await api.post("/users/logout");      // clears the refresh cookie
    } finally {
      setAccessToken(null);
      disconnectSocket();
      setUser(null);
      navigate("/");
    }
  };
}

