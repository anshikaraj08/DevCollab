import { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { setAccessToken } from "../config/axios";
import getErrorMessage from "../config/getErrorMessage";
import { UserContext } from "../context/user.context";
import AuthLayout from "../components/AuthLayout";

export default function Register() {
  const [name, setName] = useState("");
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
      const { data } = await api.post("/users/register", { name, email, password });
      setAccessToken(data.accessToken);
      setUser(data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err, "Registration failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <form onSubmit={submit} className="flex flex-col">
        <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-2">
          Create account
        </h1>
        <p className="text-xs text-neutral-500 dark:text-[#8a8a8e] leading-relaxed mb-6">
          Start collaborating and reviewing code with your team in minutes.
        </p>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl px-4 py-2.5 mb-4">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 mb-4">
          <div>
            <input
              className="w-full px-5 py-3 rounded-full text-xs bg-white dark:bg-[#282828] border border-neutral-300 dark:border-[#3c3c3c] text-neutral-900 dark:text-[#eff2f6] placeholder-neutral-400 dark:placeholder-[#666666] focus:outline-none focus:ring-2 focus:ring-neutral-400/30 focus:border-neutral-500 transition-all shadow-xs"
              placeholder="Full name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <input
              className="w-full px-5 py-3 rounded-full text-xs bg-white dark:bg-[#282828] border border-neutral-300 dark:border-[#3c3c3c] text-neutral-900 dark:text-[#eff2f6] placeholder-neutral-400 dark:placeholder-[#666666] focus:outline-none focus:ring-2 focus:ring-neutral-400/30 focus:border-neutral-500 transition-all shadow-xs"
              type="email"
              placeholder="Email address"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="relative">
            <input
              className="w-full px-5 py-3 pr-11 rounded-full text-xs bg-white dark:bg-[#282828] border border-neutral-300 dark:border-[#3c3c3c] text-neutral-900 dark:text-[#eff2f6] placeholder-neutral-400 dark:placeholder-[#666666] focus:outline-none focus:ring-2 focus:ring-neutral-400/30 focus:border-neutral-500 transition-all shadow-xs"
              type={showPassword ? "text" : "password"}
              placeholder="Password (minimum 6 characters)"
              autoComplete="new-password"
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

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 rounded-full font-semibold text-xs bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-all duration-150 shadow-sm active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed mb-5"
        >
          {submitting ? "Creating account…" : "Get Started Free"}
        </button>

        <p className="text-center text-xs text-neutral-500 dark:text-[#8a8a8e]">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-neutral-900 dark:text-white hover:underline transition">
            Log in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
