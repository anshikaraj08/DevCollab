import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../config/axios";
import getErrorMessage from "../config/getErrorMessage";
import AuthLayout from "../components/layout/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/users/forgot-password", { email });
      setSubmitted(true);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to submit request"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Enter your verified email and we'll send you a recovery link."
      footer={
        <>
          Remember your password?{" "}
          <Link to="/login" className="font-bold text-fg hover:underline">
            Back to login
          </Link>
        </>
      }
    >
      {submitted ? (
        <div className="space-y-4 text-center">
          <div className="size-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xl font-bold flex items-center justify-center mx-auto">
            ✓
          </div>
          <h2 className="text-sm font-bold text-fg">Check your inbox</h2>
          <p className="text-xs text-muted leading-relaxed">
            If an account with that email exists, we have dispatched a password reset link. The link
            expires in 1 hour.
          </p>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full h-11 rounded-full bg-surface-2 border border-line text-fg text-xs font-semibold hover:bg-line transition"
            >
              Return to login
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-xs text-danger font-medium"
            >
              {error}
            </p>
          )}

          <div>
            <input
              type="email"
              autoComplete="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-11 px-4 rounded-xl border border-line bg-surface text-fg text-sm placeholder:text-muted focus:outline-none focus:border-fg transition"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-full bg-primary text-primary-fg font-bold text-sm tracking-wide hover:opacity-90 active:scale-[0.99] transition disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {submitting ? "Sending link…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
