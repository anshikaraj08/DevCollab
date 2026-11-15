import { useEffect, useState, useContext } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../context/user.context";
import api from "../config/axios";
import getErrorMessage from "../config/getErrorMessage";
import Button from "../components/ui/Button";
import PageLoader from "../components/PageLoader";
import Logo from "../components/Logo";

export default function Invite() {
  const { token } = useParams();
  const { user, loading: userLoading } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (userLoading) return;

    if (!user) {
      // Redirect to login with safe next parameter
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`, { replace: true });
      return;
    }

    const fetchPreview = async () => {
      try {
        const { data } = await api.get(`/invites/${token}`);
        setInviteData(data);
      } catch (err) {
        setError(getErrorMessage(err, "This invite link is invalid or has expired."));
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [token, user, userLoading, navigate, location]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const { data } = await api.post(`/invites/${token}/accept`);
      navigate(`/room/${data.room._id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to accept invite"));
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    navigate("/dashboard");
  };

  if (userLoading || loading) {
    return <PageLoader />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas text-fg p-4 select-none">
      <div className="w-full max-w-md p-8 rounded-3xl border border-line bg-surface shadow-2xl space-y-6 text-center">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        {error ? (
          <div className="space-y-4">
            <div className="size-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xl font-bold flex items-center justify-center mx-auto">
              ✕
            </div>
            <div>
              <h1 className="text-lg font-bold">Invite Unavailable</h1>
              <p className="text-xs text-muted mt-1 leading-relaxed">{error}</p>
            </div>
            <Button to="/dashboard" variant="primary" size="sm" className="w-full">
              Back to Dashboard
            </Button>
          </div>
        ) : inviteData?.alreadyMember ? (
          <div className="space-y-4">
            <div className="size-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xl font-bold flex items-center justify-center mx-auto">
              ✓
            </div>
            <div>
              <h1 className="text-xl font-bold">Already a Member</h1>
              <p className="text-xs text-muted mt-1.5 leading-relaxed">
                You are already a member of <span className="font-bold text-fg">{inviteData.roomTitle}</span>.
              </p>
            </div>
            <Button to={`/room/${inviteData.roomId}`} variant="primary" size="md" className="w-full">
              Open Workspace &rarr;
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="size-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xl font-bold flex items-center justify-center mx-auto">
              ✉
            </div>

            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-surface-2 border border-line text-muted">
                {inviteData.role === "editor" ? "Editor Access" : "Viewer Access"}
              </span>
              <h1 className="text-2xl font-black tracking-tight mt-2 text-fg">
                Workspace Invite
              </h1>
              <p className="text-xs sm:text-sm text-muted mt-2 leading-relaxed">
                <span className="font-bold text-fg">{inviteData.invitedBy}</span> invited you to collaborate on{" "}
                <span className="font-bold text-fg">{inviteData.roomTitle}</span> as an{" "}
                <span className="font-bold text-emerald-600 dark:text-emerald-400 capitalize">{inviteData.role}</span>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleDecline}
                className="w-full"
              >
                Decline
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleAccept}
                loading={accepting}
                className="w-full"
              >
                Accept Invite &rarr;
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

