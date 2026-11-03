import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { setAccessToken } from "../config/axios";
import getErrorMessage from "../config/getErrorMessage";
import { UserContext } from "../context/user.context";
import AuthLayout from "../components/layout/AuthLayout";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
 
export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      title="Create your account"
      subtitle="Start reviewing code with your team."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-fg hover:underline">Log in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</p>}
        <Field label="Full name" name="name" autoComplete="name" placeholder="Priya Sharma"
          value={name} onChange={(e) => setName(e.target.value)} required />
        <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label="Password" name="password" type="password" autoComplete="new-password"
          hint="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" size="lg" loading={submitting} className="w-full">Create account</Button>
      </form>
    </AuthLayout>
  );
}
