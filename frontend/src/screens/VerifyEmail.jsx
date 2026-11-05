import { useContext, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../config/axios";
import getErrorMessage from "../config/getErrorMessage";
import { UserContext } from "../context/user.context";
import Logo from "../components/Logo";

export default function VerifyEmail() {
  const { token } = useParams();
  const { user, setUser } = useContext(UserContext);

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    api
      .post("/users/verify-email", { token })
      .then(() => {
        if (!mounted) return;
        setSuccess(true);
        setUser((prev) => (prev ? { ...prev, emailVerified: true } : prev));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(
          getErrorMessage(
            err,
            "Verification link is invalid, expired, or has already been used."
          )
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [token, setUser]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-canvas text-fg">
      <div className="w-full max-w-md p-8 rounded-3xl border border-line bg-surface shadow-2xl text-center space-y-4">
        <div className="flex justify-center pb-2">
          <Logo size="md" />
        </div>

        {loading ? (
          <div className="space-y-3 py-6">
            <svg
              className="animate-spin size-8 text-emerald-500 mx-auto"
              viewBox="0 0 24 24"
              fill="none"
            >
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
            <p className="text-xs text-muted font-medium">Verifying your email address…</p>
          </div>
        ) : success ? (
          <div className="space-y-4 py-2">
            <div className="size-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-2xl font-bold flex items-center justify-center mx-auto">
              ✓
            </div>
            <h1 className="text-xl font-bold">Email Verified</h1>
            <p className="text-xs text-muted leading-relaxed">
              Your email address has been successfully verified! You have full access to DevCollab
              collaboration workspaces.
            </p>
            <div className="pt-2">
              <Link
                to={user ? "/dashboard" : "/login"}
                className="inline-flex items-center justify-center w-full h-11 rounded-full bg-primary text-primary-fg text-xs font-semibold hover:opacity-90 transition"
              >
                {user ? "Continue to Dashboard" : "Sign in to your account"}
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="size-14 rounded-2xl bg-danger/10 border border-danger/20 text-danger text-2xl font-bold flex items-center justify-center mx-auto">
              ✕
            </div>
            <h1 className="text-xl font-bold">Verification Failed</h1>
            <p className="text-xs text-muted leading-relaxed">{error}</p>
            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                to={user ? "/settings" : "/login"}
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-primary text-primary-fg text-xs font-semibold hover:opacity-90 transition"
              >
                {user ? "Go to Settings" : "Return to Login"}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
