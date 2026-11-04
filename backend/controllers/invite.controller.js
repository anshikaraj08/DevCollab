import crypto from "crypto";
import Invite from "../models/invite.model.js";
import Room from "../models/room.model.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { MAX_ROOM_MEMBERS, DEFAULT_INVITE_HOURS, MAX_INVITE_HOURS, MIN_INVITE_HOURS, MAX_INVITE_USES } from "../config/limits.js";
import { roomKey } from "../sockets/roomKey.js";
import { getRole } from "../utils/roles.js";
import env from "../config/env.js";

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

/** POST /rooms/:roomId/invites */
export const createInvite = asyncHandler(async (req, res) => {
  const { role = "editor", expiresInHours = DEFAULT_INVITE_HOURS, maxUses = null } = req.body;
  const roomId = req.room._id;

  if (role !== "editor" && role !== "viewer") {
    throw new ApiError(400, "Role must be 'editor' or 'viewer'");
  }

  const hours = Math.max(MIN_INVITE_HOURS, Math.min(MAX_INVITE_HOURS, Number(expiresInHours) || DEFAULT_INVITE_HOURS));
  const usesLimit = maxUses ? Math.max(1, Math.min(MAX_INVITE_USES, Number(maxUses))) : null;

  // Generate 32-byte cryptographically secure random token
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  const invite = await Invite.create({
    room: roomId,
    tokenHash,
    role,
    createdBy: req.user.id,
    expiresAt,
    maxUses: usesLimit,
    uses: 0,
  });

  const clientUrl = env?.CLIENT_URL || process.env.CLIENT_URL || "http://localhost:5173";
  const link = `${clientUrl}/invite/${token}`;

  res.status(201).json({
    invite: {
      _id: invite._id,
      role: invite.role,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
      uses: invite.uses,
    },
    link,
  });
});

/** GET /rooms/:roomId/invites */
export const getActiveInvites = asyncHandler(async (req, res) => {
  const roomId = req.room._id;

  const invites = await Invite.find({
    room: roomId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  // Filter out used-up invites
  const active = invites
    .filter((inv) => inv.maxUses === null || inv.uses < inv.maxUses)
    .map((inv) => ({
      _id: inv._id,
      role: inv.role,
      expiresAt: inv.expiresAt,
      maxUses: inv.maxUses,
      uses: inv.uses,
      createdAt: inv.createdAt,
    }));

  res.json({ invites: active });
});

/** DELETE /rooms/:roomId/invites/:inviteId */
export const revokeInvite = asyncHandler(async (req, res) => {
  const { inviteId } = req.params;
  const invite = await Invite.findOneAndUpdate(
    { _id: inviteId, room: req.room._id, revokedAt: null },
    { revokedAt: new Date() },
    { new: true }
  );

  if (!invite) throw new ApiError(404, "Invite not found or already revoked");
  res.json({ ok: true, message: "Invite revoked" });
});

/** GET /invites/:token */
export const previewInvite = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const tokenHash = hashToken(token);

  const invite = await Invite.findOne({
    tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .populate("room", "title createdBy users")
    .populate("createdBy", "name");

  if (!invite || !invite.room) {
    throw new ApiError(404, "Invalid or expired invite link");
  }

  if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
    throw new ApiError(404, "Invalid or expired invite link");
  }

  const alreadyMember = (invite.room.users || []).some(
    (u) => String(u._id || u) === String(req.user.id)
  );

  res.json({
    roomTitle: invite.room.title,
    roomId: invite.room._id,
    role: invite.role,
    invitedBy: invite.createdBy?.name || "A team member",
    alreadyMember,
  });
});

/** POST /invites/:token/accept */
export const acceptInvite = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const tokenHash = hashToken(token);
  const userId = req.user.id;

  // Check if preview finds the invite and user is already member
  const preview = await Invite.findOne({
    tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).populate("room");

  if (!preview || !preview.room) {
    throw new ApiError(404, "Invalid or expired invite link");
  }

  const alreadyMember = (preview.room.users || []).some(
    (u) => String(u._id || u) === String(userId)
  );

  if (alreadyMember) {
    const userRole = getRole(preview.room, userId) || "editor";
    const roomObj = preview.room.toObject ? preview.room.toObject() : { ...preview.room };
    roomObj.role = userRole;
    return res.json({ room: roomObj, role: userRole, alreadyMember: true });
  }

  // Atomically increment uses if within limits
  const invite = await Invite.findOneAndUpdate(
    {
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
      $or: [{ maxUses: null }, { $expr: { $lt: ["$uses", "$maxUses"] } }],
    },
    { $inc: { uses: 1 } },
    { new: true }
  ).populate("room");

  if (!invite || !invite.room) {
    throw new ApiError(404, "Invalid or expired invite link");
  }

  const room = await Room.findById(invite.room._id);
  if (!room) throw new ApiError(404, "Room not found");

  if (room.users.length >= MAX_ROOM_MEMBERS) {
    throw new ApiError(409, `Workspace has reached the maximum capacity of ${MAX_ROOM_MEMBERS} members`);
  }

  if (!room.users.some((u) => String(u) === String(userId))) {
    room.users.push(userId);
    if (!room.roles) room.roles = new Map();
    if (invite.role === "viewer") {
      room.roles.set(String(userId), "viewer");
    } else {
      room.roles.delete(String(userId));
    }
    await room.save();
  }

  const io = req.app.get("io");
  if (io) {
    await io.syncRoomMembership(String(room._id));
    io.to(roomKey(room._id)).emit("room:members", { roomId: room._id });
  }

  const roomObj = room.toObject ? room.toObject() : { ...room };
  roomObj.role = invite.role;
  res.json({ room: roomObj, role: invite.role });
});

