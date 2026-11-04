import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ROLES, ACTIONS, PERMISSION_MATRIX, getRole, can } from "../utils/roles.js";

describe("Roles and Permissions", () => {
  const expectedMatrix = {
    "room.read":          { owner: true,  editor: true,  viewer: true },
    "doc.edit":           { owner: true,  editor: true,  viewer: false },
    "comment.write":      { owner: true,  editor: true,  viewer: true },
    "comment.delete":     { owner: true,  editor: true,  viewer: true },
    "run":                { owner: true,  editor: true,  viewer: true },
    "snapshot.read":      { owner: true,  editor: true,  viewer: true },
    "snapshot.create":    { owner: true,  editor: true,  viewer: false },
    "snapshot.restore":   { owner: true,  editor: true,  viewer: false },
    "snapshot.delete":    { owner: true,  editor: true,  viewer: false },
    "tests.read":         { owner: true,  editor: true,  viewer: true },
    "tests.write":        { owner: true,  editor: true,  viewer: false },
    "members.read":       { owner: true,  editor: true,  viewer: true },
    "members.manage":     { owner: true,  editor: false, viewer: false },
    "invites.manage":     { owner: true,  editor: false, viewer: false },
    "room.delete":        { owner: true,  editor: false, viewer: false },
  };

  test("asserts the entire permission matrix matches Section 3.1", () => {
    for (const [action, rolesExpected] of Object.entries(expectedMatrix)) {
      for (const role of ROLES) {
        const expected = rolesExpected[role];
        assert.equal(
          can(role, action),
          expected,
          `Action '${action}' for role '${role}' expected ${expected} but got ${can(role, action)}`
        );
      }
    }
  });

  test("getRole computes role accurately", () => {
    const ownerId = "64b7f1a1a1a1a1a1a1a1a101";
    const editorId = "64b7f1a1a1a1a1a1a1a1a102";
    const viewerId = "64b7f1a1a1a1a1a1a1a1a103";
    const outsiderId = "64b7f1a1a1a1a1a1a1a1a104";

    const room = {
      _id: "64b7f1a1a1a1a1a1a1a1a100",
      createdBy: ownerId,
      users: [ownerId, editorId, viewerId],
      roles: new Map([
        [viewerId, "viewer"],
      ]),
    };

    assert.equal(getRole(room, ownerId), "owner");
    // editor is a member without a custom role entry
    assert.equal(getRole(room, editorId), "editor");
    assert.equal(getRole(room, viewerId), "viewer");
    assert.equal(getRole(room, outsiderId), null);
    assert.equal(getRole(null, ownerId), null);
  });
});

