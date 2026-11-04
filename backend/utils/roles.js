/**
 * Single source of truth for DevCollab role permissions on the backend.
 * Mirror this in frontend/src/lib/permissions.js (keep in sync).
 */

export const ROLES = ["owner", "editor", "viewer"];

export const ACTIONS = [
  "room.read",
  "doc.edit",
  "comment.write",
  "comment.delete",
  "run",
  "snapshot.read",
  "snapshot.create",
  "snapshot.restore",
  "snapshot.delete",
  "tests.read",
  "tests.write",
  "members.read",
  "members.manage",
  "invites.manage",
  "room.delete",
];

export const PERMISSION_MATRIX = {
  owner: [
    "room.read",
    "doc.edit",
    "comment.write",
    "comment.delete",
    "run",
    "snapshot.read",
    "snapshot.create",
    "snapshot.restore",
    "snapshot.delete",
    "tests.read",
    "tests.write",
    "members.read",
    "members.manage",
    "invites.manage",
    "room.delete",
  ],
  editor: [
    "room.read",
    "doc.edit",
    "comment.write",
    "comment.delete",
    "run",
    "snapshot.read",
    "snapshot.create",
    "snapshot.restore",
    "snapshot.delete",
    "tests.read",
    "tests.write",
    "members.read",
  ],
  viewer: [
    "room.read",
    "comment.write",
    "comment.delete",
    "run",
    "snapshot.read",
    "tests.read",
    "members.read",
  ],
};

const MATRIX_SETS = {
  owner: new Set(PERMISSION_MATRIX.owner),
  editor: new Set(PERMISSION_MATRIX.editor),
  viewer: new Set(PERMISSION_MATRIX.viewer),
};

/**
 * Determine a user's role in a given room.
 * @param {Object} room - Room document or object
 * @param {string} userId - ID of the user
 * @returns {"owner" | "editor" | "viewer" | null}
 */
export function getRole(room, userId) {
  if (!room || !userId) return null;
  const uId = String(userId);

  const ownerId = String(room.createdBy?._id || room.createdBy);
  if (ownerId === uId) return "owner";

  const isMember = (room.users || []).some((u) => String(u?._id || u) === uId);
  if (!isMember) return null;

  let assignedRole = null;
  if (room.roles) {
    if (typeof room.roles.get === "function") {
      assignedRole = room.roles.get(uId);
    } else {
      assignedRole = room.roles[uId];
    }
  }

  return assignedRole === "viewer" ? "viewer" : "editor";
}

/**
 * Check if a role is allowed to perform an action.
 * @param {string} role
 * @param {string} action
 * @returns {boolean}
 */
export function can(role, action) {
  if (!role || !MATRIX_SETS[role]) return false;
  return MATRIX_SETS[role].has(action);
}

