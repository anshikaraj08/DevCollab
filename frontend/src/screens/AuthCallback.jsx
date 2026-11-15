import { useContext, useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api, { setAccessToken } from "../config/axios";
import { UserContext } from "../context/user.context";
import Logo from "../components/Logo";

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useContext(UserContext);
  const [error, setError] = useState(searchParams.get("error") || "");

  const rawNext = searchParams.get("next");
  const safeNext = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  useEffect(() => {
    if (error) return;

    let mounted = true;
    api
      .get("/users/refresh")
      .then((res) => {
        if (!mounted) return;
        setAccessToken(res.data.accessToken);
        setUser(res.data.user);
        navigate(safeNext, { replace: true });
      })
      .catch((err) => {
        if (!mounted) return;
        setError(
          err.response?.data?.message ||
            "Authentication verification failed. Please try signing in again."
        );
      });

    return () => {
      mounted = false;
    };
  }, [error, navigate, setUser, safeNext]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-canvas text-fg">
        <div className="w-full max-w-md p-8 rounded-3xl border border-line bg-surface shadow-2xl text-center space-y-4">
          <div className="size-12 rounded-2xl bg-danger/10 border border-danger/20 text-danger text-xl font-bold flex items-center justify-center mx-auto">
            ✕
          </div>
          <h1 className="text-xl font-bold">Sign-in Failed</h1>
          <p className="text-xs text-muted leading-relaxed">{error}</p>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-primary text-primary-fg text-xs font-semibold hover:opacity-90 transition cursor-pointer"
            >
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-canvas text-fg">
      <div className="flex flex-col items-center space-y-4">
        <Logo size="lg" />
        <div className="flex items-center gap-2.5 text-xs text-muted font-medium pt-2">
          <svg className="animate-spin size-4 text-emerald-500" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Completing authentication…</span>
        </div>
      </div>
    </div>
  );
}
