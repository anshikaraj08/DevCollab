import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // send the refresh-token cookie
});

// The access token lives in memory only (not in localStorage)
let accessToken = null;
export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// If a request fails with 401, get a new access token once and retry
let refreshing = null;
const skipRefresh = ["/users/login", "/users/register", "/users/refresh"];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !skipRefresh.includes(original.url)) {
      original._retry = true;
      try {
        refreshing = refreshing || api.post("/users/refresh");
        const { data } = await refreshing;
        setAccessToken(data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        setAccessToken(null);
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith("/login") &&
          !window.location.pathname.startsWith("/register") &&
          !window.location.pathname.startsWith("/auth/callback")
        ) {
          window.dispatchEvent(
            new CustomEvent("toast:show", {
              detail: { message: "Your session ended. Please sign in again.", type: "info" },
            })
          );
          window.location.href = `/login?next=${encodeURIComponent(
            window.location.pathname + window.location.search
          )}`;
        }
      } finally {
        refreshing = null;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
