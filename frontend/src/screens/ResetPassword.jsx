import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../config/axios";
import getErrorMessage from "../config/getErrorMessage";
import AuthLayout from "../components/layout/AuthLayout";
import { useToast } from "../components/ui/Toast";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/users/reset-password", { token, password });
      setSuccess(true);
      toast.success("Password reset successfully!");
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "This password reset link is invalid, expired, or has already been used."
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create new password"
      subtitle="Set a new secure password for your DevCollab account."
      footer={
        <>
          Need to request a new link?{" "}
          <Link to="/forgot-password" className="font-bold text-fg hover:underline">
            Forgot password
          </Link>
        </>
      }
    >
      {success ? (
        <div className="space-y-4 text-center">
          <div className="size-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xl font-bold flex items-center justify-center mx-auto">
            ✓
          </div>
          <h2 className="text-sm font-bold text-fg">Password updated</h2>
          <p className="text-xs text-muted leading-relaxed">
            Your password was successfully updated. All previous sessions have been signed out.
            Redirecting to login…
          </p>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full h-11 rounded-full bg-primary text-primary-fg text-xs font-semibold hover:opacity-90 transition"
            >
              Sign in now
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-xs text-danger font-medium space-y-1"
            >
              <p>{error}</p>
              {error.includes("invalid") && (
                <p>
                  <Link to="/forgot-password" className="underline font-bold">
                    Request a new reset link
                  </Link>
                </p>
              )}
            </div>
          )}

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="New password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full h-11 px-4 pr-11 rounded-xl border border-line bg-surface text-fg text-sm placeholder:text-muted focus:outline-none focus:border-fg transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-fg transition text-xs font-semibold cursor-pointer select-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <div>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full h-11 px-4 rounded-xl border border-line bg-surface text-fg text-sm placeholder:text-muted focus:outline-none focus:border-fg transition"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-full bg-primary text-primary-fg font-bold text-sm tracking-wide hover:opacity-90 active:scale-[0.99] transition disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {submitting ? "Updating password…" : "Reset password"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
