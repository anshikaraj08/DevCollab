import { useContext, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api, { setAccessToken } from "../config/axios";
import getErrorMessage from "../config/getErrorMessage";
import { UserContext } from "../context/user.context";
import AuthLayout from "../components/layout/AuthLayout";
import OAuthButtons from "../components/auth/OAuthButtons";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { setUser } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();

  const getSafeNext = () => {
    const params = new URLSearchParams(location.search);
    const next = params.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      return next;
    }
    return "/dashboard";
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/users/register", { name, email, password });
      setAccessToken(data.accessToken);
      setUser(data.user);
      navigate(getSafeNext(), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Registration failed"));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create account"
      subtitle="Join DevCollab and supercharge your code reviews with real-time rooms."
      footer={
        <>
          Already a member?{" "}
          <Link to={`/login${location.search}`} className="font-bold text-fg hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <OAuthButtons next={getSafeNext()} />

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
            type="text"
            autoComplete="name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full h-11 px-4 rounded-xl border border-line bg-surface text-fg text-sm placeholder:text-muted focus:outline-none focus:border-fg transition"
          />
        </div>

        <div>
          <input
            type="email"
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full h-11 px-4 rounded-xl border border-line bg-surface text-fg text-sm placeholder:text-muted focus:outline-none focus:border-fg transition"
          />
        </div>

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Password (min 6 characters)"
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

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-11 rounded-full bg-primary text-primary-fg font-bold text-sm tracking-wide hover:opacity-90 active:scale-[0.99] transition disabled:opacity-50 cursor-pointer shadow-sm"
        >
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
