import { useState, useEffect, useCallback } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Avatar from "../ui/Avatar";
import ConfirmDialog from "../ui/ConfirmDialog";
import { useToast } from "../ui/Toast";
import api from "../../config/axios";
import getErrorMessage from "../../config/getErrorMessage";

export default function ShareDialog({ open, onClose, roomId, isOwner, currentUserId, onLeaveWorkspace }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(isOwner ? "invite" : "people");

  // Invite creation state
  const [role, setRole] = useState("editor");
  const [expiresInHours, setExpiresInHours] = useState(168); // 7 days
  const [maxUses, setMaxUses] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newInviteLink, setNewInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  // Active invites
  const [invites, setInvites] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  // Members list
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Confirm dialogs
  const [removeTarget, setRemoveTarget] = useState(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch active invites
  const fetchInvites = useCallback(async () => {
    if (!isOwner || !roomId) return;
    setLoadingInvites(true);
    try {
      const { data } = await api.get(`/rooms/${roomId}/invites`);
      setInvites(data.invites || []);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load invites"));
    } finally {
      setLoadingInvites(false);
    }
  }, [roomId, isOwner, toast]);

  // Fetch room members
  const fetchMembers = useCallback(async () => {
    if (!roomId) return;
    setLoadingMembers(true);
    try {
      const { data } = await api.get(`/rooms/${roomId}/members`);
      setMembers(data.members || []);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load members"));
    } finally {
      setLoadingMembers(false);
    }
  }, [roomId, toast]);

  useEffect(() => {
    if (open) {
      if (isOwner) fetchInvites();
      fetchMembers();
      setNewInviteLink("");
      setCopied(false);
    }
  }, [open, isOwner, fetchInvites, fetchMembers]);

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await api.post(`/rooms/${roomId}/invites`, {
        role,
        expiresInHours,
        maxUses,
      });
      setNewInviteLink(data.link);
      setCopied(false);
      toast.success("Invite link generated!");
      fetchInvites();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create invite"));
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = () => {
    if (!newInviteLink) return;
    navigator.clipboard.writeText(newInviteLink);
    setCopied(true);
    toast.success("Invite link copied to clipboard!");
    setTimeout(() => setCopied(false), 3000);
  };

  const handleRevokeInvite = async (inviteId) => {
    try {
      await api.delete(`/rooms/${roomId}/invites/${inviteId}`);
      toast.success("Invite revoked");
      fetchInvites();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to revoke invite"));
    }
  };

  const handleUpdateRole = async (targetUserId, newRole) => {
    try {
      await api.patch(`/rooms/${roomId}/members/${targetUserId}`, { role: newRole });
      toast.success(`Role updated to ${newRole}`);
      fetchMembers();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update role"));
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!removeTarget) return;
    setActionLoading(true);
    try {
      await api.delete(`/rooms/${roomId}/members/${removeTarget.user._id}`);
      toast.success(`Removed ${removeTarget.user.name}`);
      setRemoveTarget(null);
      fetchMembers();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to remove member"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmLeave = async () => {
    setActionLoading(true);
    try {
      await api.delete(`/rooms/${roomId}/members/${currentUserId}`);
      toast.success("You left the workspace");
      setShowLeaveConfirm(false);
      onClose();
      if (onLeaveWorkspace) onLeaveWorkspace();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to leave workspace"));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={isOwner ? "Share & Workspace Access" : "Workspace Members"}>
        <div className="space-y-4">
          {/* Navigation Tabs (Only for owner) */}
          {isOwner && (
            <div className="flex border-b border-line gap-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("invite")}
                className={`pb-2.5 transition border-b-2 cursor-pointer ${
                  activeTab === "invite"
                    ? "border-primary text-fg font-bold"
                    : "border-transparent text-muted hover:text-fg"
                }`}
              >
                🔗 Invite Links
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("people")}
                className={`pb-2.5 transition border-b-2 cursor-pointer ${
                  activeTab === "people"
                    ? "border-primary text-fg font-bold"
                    : "border-transparent text-muted hover:text-fg"
                }`}
              >
                👥 People ({members.length})
              </button>
            </div>
          )}

          {/* TAB 1: INVITE LINKS */}
          {isOwner && activeTab === "invite" && (
            <div className="space-y-4 text-xs">
              {/* Creation Form */}
              <form onSubmit={handleCreateInvite} className="p-3.5 rounded-xl border border-line bg-surface-2/60 space-y-3">
                <div className="font-semibold text-fg">Create an Invite Link</div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Role */}
                  <div>
                    <label className="block text-[11px] text-muted mb-1">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg border border-line bg-surface text-fg text-xs focus:outline-none focus:border-primary"
                    >
                      <option value="editor">Editor (Can type)</option>
                      <option value="viewer">Viewer (Read-only)</option>
                    </select>
                  </div>

                  {/* Expiration */}
                  <div>
                    <label className="block text-[11px] text-muted mb-1">Expires In</label>
                    <select
                      value={expiresInHours}
                      onChange={(e) => setExpiresInHours(Number(e.target.value))}
                      className="w-full h-8 px-2 rounded-lg border border-line bg-surface text-fg text-xs focus:outline-none focus:border-primary"
                    >
                      <option value={24}>1 Day</option>
                      <option value={168}>7 Days (Default)</option>
                      <option value={720}>30 Days</option>
                    </select>
                  </div>

                  {/* Max Uses */}
                  <div>
                    <label className="block text-[11px] text-muted mb-1">Max Uses</label>
                    <select
                      value={maxUses === null ? "" : maxUses}
                      onChange={(e) => setMaxUses(e.target.value === "" ? null : Number(e.target.value))}
                      className="w-full h-8 px-2 rounded-lg border border-line bg-surface text-fg text-xs focus:outline-none focus:border-primary"
                    >
                      <option value="">Unlimited</option>
                      <option value="1">1 Person</option>
                      <option value="5">5 People</option>
                      <option value="25">25 People (Room max)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button type="submit" size="sm" loading={creating}>
                    Generate Invite Link
                  </Button>
                </div>
              </form>

              {/* Newly Generated Link Display */}
              {newInviteLink && (
                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                      Secret Invite Link Generated
                    </span>
                    <span className="text-[10px] text-muted">Shown once</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={newInviteLink}
                      className="flex-1 h-8 px-2.5 rounded-lg border border-emerald-500/20 bg-surface font-mono text-[11px] text-fg select-all"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCopyLink}
                      className={copied ? "bg-emerald-600 text-white" : ""}
                    >
                      {copied ? "Copied! ✓" : "Copy"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Active Links List */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                  Active Links ({invites.length})
                </span>

                {loadingInvites ? (
                  <p className="text-muted text-xs py-2">Loading invites...</p>
                ) : invites.length === 0 ? (
                  <p className="text-muted text-xs py-1">No active invite links.</p>
                ) : (
                  <div className="divide-y divide-line rounded-xl border border-line overflow-hidden max-h-48 overflow-y-auto">
                    {invites.map((inv) => (
                      <div key={inv._id} className="flex items-center justify-between p-2.5 bg-surface text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              inv.role === "editor"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                            }`}>
                              {inv.role}
                            </span>
                            <span className="text-[11px] text-muted">
                              Uses: {inv.uses} / {inv.maxUses || "∞"}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted">
                            Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevokeInvite(inv._id)}
                          className="text-xs text-red-500 hover:text-red-600 font-semibold cursor-pointer"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PEOPLE & ROLES */}
          {(activeTab === "people" || !isOwner) && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-fg">Room Members</span>
                <span className="text-[11px] text-muted">Max 25</span>
              </div>

              {loadingMembers ? (
                <p className="text-muted py-4 text-center">Loading members...</p>
              ) : (
                <div className="divide-y divide-line rounded-xl border border-line overflow-hidden max-h-64 overflow-y-auto">
                  {members.map((m) => (
                    <div key={m.user._id} className="flex items-center justify-between p-3 bg-surface">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={m.user.name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold text-fg truncate text-xs">
                            {m.user.name} {String(m.user._id) === String(currentUserId) && "(You)"}
                          </p>
                          <p className="text-[10px] text-muted truncate">{m.user.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {m.isOwner ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px] border border-amber-500/20">
                            Owner
                          </span>
                        ) : isOwner ? (
                          <>
                            <select
                              value={m.role}
                              onChange={(e) => handleUpdateRole(m.user._id, e.target.value)}
                              className="h-7 px-2 rounded-md border border-line bg-surface text-fg text-xs focus:outline-none"
                            >
                              <option value="editor">Editor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => setRemoveTarget(m)}
                              className="text-xs text-red-500 hover:text-red-600 p-1 cursor-pointer"
                              title="Remove member"
                            >
                              &times;
                            </button>
                          </>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            m.role === "editor"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                          }`}>
                            {m.role === "editor" ? "Editor" : "Viewer"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Non-owner: Leave workspace button */}
              {!isOwner && (
                <div className="pt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => setShowLeaveConfirm(true)}
                  >
                    Leave Workspace
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Remove Member Confirmation */}
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleConfirmRemoveMember}
        title="Remove Member?"
        message={`Are you sure you want to remove ${removeTarget?.user.name} from this workspace? They will lose access immediately.`}
        confirmText="Remove"
        loading={actionLoading}
        variant="danger"
      />

      {/* Leave Workspace Confirmation */}
      <ConfirmDialog
        open={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={handleConfirmLeave}
        title="Leave Workspace?"
        message="Are you sure you want to leave this workspace? You will need an invite link to rejoin."
        confirmText="Leave Workspace"
        loading={actionLoading}
        variant="danger"
      />
    </>
  );
}

