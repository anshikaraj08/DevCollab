import { useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api, { setAccessToken } from "../config/axios";
import getErrorMessage from "../config/getErrorMessage";
import { UserContext } from "../context/user.context";
import { useToast } from "../components/ui/Toast";
import AppLayout from "../components/layout/AppLayout";
import Avatar from "../components/ui/Avatar";

export default function Settings() {
  const { user, setUser } = useContext(UserContext);
  const toast = useToast();
  const navigate = useNavigate();

  // Profile state
  const [name, setName] = useState(user?.name || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Email resend state
  const [resendingEmail, setResendingEmail] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Unlink loading
  const [unlinkingProvider, setUnlinkingProvider] = useState("");

  const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

  // Refresh user data on mount
  useEffect(() => {
    api
      .get("/users/me")
      .then((res) => {
        setUser(res.data.user);
        setName(res.data.user.name);
      })
      .catch(() => {});
  }, [setUser]);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    setSavingProfile(true);
    try {
      const { data } = await api.patch("/users/me", { name: name.trim() });
      setUser(data.user);
      toast.success("Profile name updated");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update profile"));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    try {
      const { data } = await api.post("/users/verify-email/request");
      toast.success(data.message || "Verification email sent!");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to send verification email"));
    } finally {
      setResendingEmail(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long");
      return;
    }

    setSavingPassword(true);
    try {
      const payload = { newPassword };
      if (user?.hasPassword) {
        payload.currentPassword = currentPassword;
      }
      const { data } = await api.patch("/users/me/password", payload);
      setUser(data.user);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully!");
    } catch (err) {
      setPasswordError(getErrorMessage(err, "Failed to update password"));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLinkProvider = (provider) => {
    window.location.href = `${apiUrl}/auth/${provider}?link=1&next=/settings`;
  };

  const handleUnlinkProvider = async (provider) => {
    setUnlinkingProvider(provider);
    try {
      const { data } = await api.delete(`/users/me/providers/${provider}`);
      setUser(data.user);
      toast.success(`${provider === "google" ? "Google" : "GitHub"} unlinked successfully`);
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to unlink ${provider}`));
    } finally {
      setUnlinkingProvider("");
    }
  };

  const handleLogoutAll = async () => {
    try {
      await api.post("/users/logout-all");
      setAccessToken(null);
      setUser(null);
      toast.info("Logged out from all devices");
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to log out of all devices"));
    }
  };

  const hasGoogle = user?.providers?.includes("google");
  const hasGitHub = user?.providers?.includes("github");

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8 select-none">
        <div>
          <h1 className="text-2xl font-black text-fg tracking-tight">Account Settings</h1>
          <p className="text-xs text-muted mt-1">
            Manage your personal profile, authentication methods, and security preferences.
          </p>
        </div>

        {/* ── Section 1: Personal Profile ── */}
        <section className="p-6 rounded-2xl border border-line bg-surface shadow-xs space-y-6">
          <h2 className="text-sm font-bold text-fg uppercase tracking-wider text-muted">
            Profile Information
          </h2>

          <div className="flex items-center gap-4">
            <Avatar name={user?.name || "User"} size="lg" />
            <div>
              <p className="text-sm font-bold text-fg">{user?.name}</p>
              <p className="text-xs text-muted">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleUpdateName} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-fg mb-1.5">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-10 px-3.5 rounded-xl border border-line bg-canvas text-fg text-sm placeholder:text-muted focus:outline-none focus:border-fg transition"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile || name.trim() === user?.name}
              className="inline-flex items-center justify-center px-5 py-2 rounded-full bg-primary text-primary-fg text-xs font-semibold hover:opacity-90 active:scale-95 transition disabled:opacity-40 cursor-pointer"
            >
              {savingProfile ? "Saving…" : "Save changes"}
            </button>
          </form>
        </section>

        {/* ── Section 2: Email Verification ── */}
        <section className="p-6 rounded-2xl border border-line bg-surface shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-fg uppercase tracking-wider text-muted">
                Email Address
              </h2>
              <p className="text-sm font-medium text-fg mt-1">{user?.email}</p>
            </div>
            <div>
              {user?.emailVerified ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Unverified
                </span>
              )}
            </div>
          </div>

          {!user?.emailVerified && (
            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
              <p>
                Your email is unverified. Verify your address to secure account recovery and enable
                cross-provider linking.
              </p>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendingEmail}
                className="px-4 py-1.5 rounded-full bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition cursor-pointer shrink-0 disabled:opacity-50"
              >
                {resendingEmail ? "Sending…" : "Resend email"}
              </button>
            </div>
          )}
        </section>

        {/* ── Section 3: Linked Accounts ── */}
        <section className="p-6 rounded-2xl border border-line bg-surface shadow-xs space-y-5">
          <div>
            <h2 className="text-sm font-bold text-fg uppercase tracking-wider text-muted">
              Connected Accounts
            </h2>
            <p className="text-xs text-muted mt-1">
              Link OAuth providers for one-click access. You must maintain at least one sign-in
              method.
            </p>
          </div>

          <div className="divide-y divide-line">
            {/* Google */}
            <div className="py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="size-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <div>
                  <p className="text-xs font-bold text-fg">Google</p>
                  <p className="text-[11px] text-muted">
                    {hasGoogle ? "Connected to your account" : "Not connected"}
                  </p>
                </div>
              </div>

              {hasGoogle ? (
                <button
                  type="button"
                  onClick={() => handleUnlinkProvider("google")}
                  disabled={unlinkingProvider === "google"}
                  className="px-3.5 py-1.5 rounded-full border border-danger/30 text-danger hover:bg-danger/10 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  {unlinkingProvider === "google" ? "Unlinking…" : "Disconnect"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleLinkProvider("google")}
                  className="px-3.5 py-1.5 rounded-full border border-line bg-surface hover:bg-surface-2 text-fg text-xs font-semibold transition cursor-pointer shadow-2xs"
                >
                  Connect
                </button>
              )}
            </div>

            {/* GitHub */}
            <div className="py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="size-5 shrink-0 fill-current text-fg" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <div>
                  <p className="text-xs font-bold text-fg">GitHub</p>
                  <p className="text-[11px] text-muted">
                    {hasGitHub ? "Connected to your account" : "Not connected"}
                  </p>
                </div>
              </div>

              {hasGitHub ? (
                <button
                  type="button"
                  onClick={() => handleUnlinkProvider("github")}
                  disabled={unlinkingProvider === "github"}
                  className="px-3.5 py-1.5 rounded-full border border-danger/30 text-danger hover:bg-danger/10 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  {unlinkingProvider === "github" ? "Unlinking…" : "Disconnect"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleLinkProvider("github")}
                  className="px-3.5 py-1.5 rounded-full border border-line bg-surface hover:bg-surface-2 text-fg text-xs font-semibold transition cursor-pointer shadow-2xs"
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── Section 4: Password ── */}
        <section className="p-6 rounded-2xl border border-line bg-surface shadow-xs space-y-5">
          <div>
            <h2 className="text-sm font-bold text-fg uppercase tracking-wider text-muted">
              {user?.hasPassword ? "Change Password" : "Set Account Password"}
            </h2>
            <p className="text-xs text-muted mt-1">
              {user?.hasPassword
                ? "Update your existing account password."
                : "You currently sign in via OAuth. Setting a password allows email + password login."}
            </p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
            {passwordError && (
              <p
                role="alert"
                className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-xs text-danger font-medium"
              >
                {passwordError}
              </p>
            )}

            {user?.hasPassword && (
              <div>
                <label className="block text-xs font-semibold text-fg mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-canvas text-fg text-sm placeholder:text-muted focus:outline-none focus:border-fg transition"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-fg mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
                className="w-full h-10 px-3.5 rounded-xl border border-line bg-canvas text-fg text-sm placeholder:text-muted focus:outline-none focus:border-fg transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-fg mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full h-10 px-3.5 rounded-xl border border-line bg-canvas text-fg text-sm placeholder:text-muted focus:outline-none focus:border-fg transition"
              />
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex items-center justify-center px-5 py-2 rounded-full bg-primary text-primary-fg text-xs font-semibold hover:opacity-90 active:scale-95 transition disabled:opacity-40 cursor-pointer"
            >
              {savingPassword
                ? "Saving…"
                : user?.hasPassword
                ? "Update password"
                : "Set password"}
            </button>
          </form>
        </section>

        {/* ── Section 5: Sessions & Security ── */}
        <section className="p-6 rounded-2xl border border-danger/20 bg-danger/5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-danger uppercase tracking-wider">
              Security & Sessions
            </h2>
            <p className="text-xs text-muted mt-1">
              Revoke active authentication refresh tokens on all computers, tablets, and mobile
              devices.
            </p>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={handleLogoutAll}
              className="px-5 py-2 rounded-full bg-danger text-white text-xs font-bold hover:bg-danger/90 active:scale-95 transition cursor-pointer shadow-xs"
            >
              Log out of all devices
            </button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
