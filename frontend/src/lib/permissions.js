/**
 * Single source of truth for DevCollab role permissions on the frontend.
 * Keep in sync with backend/utils/roles.js!
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
  "ai.review",
  "ai.read",
  "comment.edit",
  "comment.mention",
];

export const PERMISSION_MATRIX = {
  owner: [
    "room.read",
    "doc.edit",
    "comment.write",
    "comment.delete",
    "comment.edit",
    "comment.mention",
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
    "ai.review",
    "ai.read",
  ],
  editor: [
    "room.read",
    "doc.edit",
    "comment.write",
    "comment.delete",
    "comment.edit",
    "comment.mention",
    "run",
    "snapshot.read",
    "snapshot.create",
    "snapshot.restore",
    "snapshot.delete",
    "tests.read",
    "tests.write",
    "members.read",
    "ai.review",
    "ai.read",
  ],
  viewer: [
    "room.read",
    "comment.write",
    "comment.delete",
    "comment.edit",
    "comment.mention",
    "run",
    "snapshot.read",
    "tests.read",
    "members.read",
    "ai.read",
  ],
};

const MATRIX_SETS = {
  owner: new Set(PERMISSION_MATRIX.owner),
  editor: new Set(PERMISSION_MATRIX.editor),
  viewer: new Set(PERMISSION_MATRIX.viewer),
};

/**
 * Check if a role can perform a specific action on the frontend.
 * @param {string} role
 * @param {string} action
 * @returns {boolean}
 */
export function can(role, action) {
  if (!role || !MATRIX_SETS[role]) return false;
  return MATRIX_SETS[role].has(action);
}

