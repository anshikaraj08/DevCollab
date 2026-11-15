import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../config/axios";
import getErrorMessage from "../config/getErrorMessage";
import Logo from "../components/Logo";

/** Landing page for the one-click unsubscribe link in notification digest emails. */
export default function UnsubscribeDigest() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "" : "This unsubscribe link is missing its token.");

  useEffect(() => {
    if (!token) return undefined;
    let mounted = true;
    api
      .post("/users/unsubscribe-digest", { token })
      .then((res) => {
        if (!mounted) return;
        setStatus("done");
        setMessage(res.data?.message || "You have been unsubscribed from notification digests.");
      })
      .catch((err) => {
        if (!mounted) return;
        setStatus("error");
        setMessage(getErrorMessage(err, "This unsubscribe link is invalid, expired, or has already been used."));
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-canvas text-fg">
      <div className="w-full max-w-md p-8 rounded-3xl border border-line bg-surface shadow-2xl text-center space-y-4">
        <div className="flex justify-center pb-2">
          <Logo size="md" />
        </div>
        <h1 className="text-xl font-bold">Email digests</h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {status === "loading" ? "Unsubscribing…" : message}
        </p>
        <Link to="/settings" className="inline-block text-sm font-semibold text-emerald-500 hover:underline">
          Manage notification settings
        </Link>
      </div>
    </div>
  );
}
