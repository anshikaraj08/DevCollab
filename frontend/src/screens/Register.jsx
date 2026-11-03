import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { setAccessToken } from "../config/axios";
import getErrorMessage from "../config/getErrorMessage";
import { UserContext } from "../context/user.context";
import AuthLayout from "../components/layout/AuthLayout";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { setUser } = useContext(UserContext);
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/users/register", { name, email, password });
      setAccessToken(data.accessToken);
      setUser(data.user);
      navigate("/dashboard");
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
          <Link to="/login" className="font-bold text-fg hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-xs text-danger font-medium"
          >
            {error}
          </p>
        )}

        {/* Full Name */}
        <div>
          <input
            type="text"
            autoComplete="name"
            placeholder="Full Name, e.g. Anshika Raj"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full h-11 rounded-full border border-line-strong bg-surface px-5 text-sm text-fg placeholder:text-faint outline-none focus:border-fg transition"
          />
        </div>

        {/* Email */}
        <div>
          <input
            type="email"
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full h-11 rounded-full border border-line-strong bg-surface px-5 text-sm text-fg placeholder:text-faint outline-none focus:border-fg transition"
          />
        </div>

        {/* Password */}
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Password (minimum 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full h-11 rounded-full border border-line-strong bg-surface px-5 pr-11 text-sm text-fg placeholder:text-faint outline-none focus:border-fg transition"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-fg text-xs p-1 cursor-pointer transition"
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "🙈" : "👁"}
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-11 rounded-full font-bold text-sm bg-primary text-primary-fg hover:opacity-90 active:scale-[0.99] transition disabled:opacity-50 cursor-pointer shadow-xs mt-2"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
