import { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { setAccessToken } from "../config/axios";
import getErrorMessage from "../config/getErrorMessage";
import { UserContext } from "../context/user.context";
import AuthLayout from "../components/AuthLayout";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { setUser } = useContext(UserContext);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/users/login", { email, password });
      setAccessToken(data.accessToken);
      setUser(data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err, "Login failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <form onSubmit={submit} className="flex flex-col">
        <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-2">
          Welcome back!
        </h1>
        <p className="text-xs text-neutral-500 dark:text-[#8a8a8e] leading-relaxed mb-6">
          Simplify your workflow and boost your productivity with DevCollab. Get started for free.
        </p>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl px-4 py-2.5 mb-4">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3.5 mb-2">
          {/* Email / Username field with rounded pill */}
          <div>
            <input
              className="w-full px-5 py-3 rounded-full text-xs bg-white dark:bg-[#282828] border border-neutral-300 dark:border-[#3c3c3c] text-neutral-900 dark:text-[#eff2f6] placeholder-neutral-400 dark:placeholder-[#666666] focus:outline-none focus:ring-2 focus:ring-neutral-400/30 focus:border-neutral-500 transition-all shadow-xs"
              type="email"
              placeholder="Username or email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password field with eye toggle */}
          <div className="relative">
            <input
              className="w-full px-5 py-3 pr-11 rounded-full text-xs bg-white dark:bg-[#282828] border border-neutral-300 dark:border-[#3c3c3c] text-neutral-900 dark:text-[#eff2f6] placeholder-neutral-400 dark:placeholder-[#666666] focus:outline-none focus:ring-2 focus:ring-neutral-400/30 focus:border-neutral-500 transition-all shadow-xs"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-zinc-200 transition"
              aria-label="Toggle password visibility"
            >
              {showPassword ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Forgot password */}
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={() => alert("Password reset link will be sent to your registered email.")}
            className="text-[11px] font-medium text-neutral-400 hover:text-neutral-700 dark:hover:text-zinc-300 transition"
          >
            Forgot Password?
          </button>
        </div>

        {/* Solid Black / Dark Mode Pure White Pill Button (LeetCode style) */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 rounded-full font-semibold text-xs bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-all duration-150 shadow-sm active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed mb-5"
        >
          {submitting ? "Signing in…" : "Login"}
        </button>

        {/* Or continue with divider */}
        <div className="relative flex items-center justify-center mb-5">
          <div className="w-full border-t border-neutral-200 dark:border-[#333333]" />
          <span className="bg-white dark:bg-[#1e1e1e] px-3 text-[11px] text-neutral-400 dark:text-[#888888] absolute">
            or continue with
          </span>
        </div>

        {/* 3 Circular Social Buttons */}
        <div className="flex items-center justify-center gap-3.5 mb-6">
          {/* Google */}
          <button
            type="button"
            className="w-10 h-10 rounded-full bg-black text-white dark:bg-[#282828] dark:text-white dark:border dark:border-[#383838] flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-xs"
            aria-label="Login with Google"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.24 10.285V13.4h6.887C18.2 16.14 15.645 18 12.24 18c-3.315 0-6-2.685-6-6s2.685-6 6-6c1.47 0 2.82.525 3.87 1.41l2.4-2.4C16.965 3.525 14.73 2.7 12.24 2.7c-5.13 0-9.3 4.17-9.3 9.3s4.17 9.3 9.3 9.3c5.37 0 8.94-3.78 8.94-9.105 0-.615-.06-1.065-.135-1.515h-8.805z" />
            </svg>
          </button>

          {/* Apple */}
          <button
            type="button"
            className="w-10 h-10 rounded-full bg-black text-white dark:bg-[#282828] dark:text-white dark:border dark:border-[#383838] flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-xs"
            aria-label="Login with Apple"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.84c.67-.82 1.13-1.96.99-3.11-1 .04-2.18.66-2.88 1.48-.61.71-1.15 1.87-.99 2.99 1.11.08 2.22-.55 2.88-1.36z" />
            </svg>
          </button>

          {/* GitHub */}
          <button
            type="button"
            className="w-10 h-10 rounded-full bg-black text-white dark:bg-[#282828] dark:text-white dark:border dark:border-[#383838] flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-xs"
            aria-label="Login with GitHub"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </button>
        </div>

        {/* Register link */}
        <p className="text-center text-xs text-neutral-500 dark:text-[#8a8a8e]">
          Not a member?{" "}
          <Link to="/register" className="font-bold text-neutral-900 dark:text-white hover:underline transition">
            Register now
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
