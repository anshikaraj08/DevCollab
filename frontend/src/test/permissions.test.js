
import { can } from "../lib/permissions";

describe("Frontend Permission Matrix", () => {
  it("asserts the exact permission matrix from Section 3.1", () => {
    // room.read: yes, yes, yes
    expect(can("owner", "room.read")).toBe(true);
    expect(can("editor", "room.read")).toBe(true);
    expect(can("viewer", "room.read")).toBe(true);

    // doc.edit: yes, yes, no
    expect(can("owner", "doc.edit")).toBe(true);
    expect(can("editor", "doc.edit")).toBe(true);
    expect(can("viewer", "doc.edit")).toBe(false);

    // comment.write: yes, yes, yes
    expect(can("owner", "comment.write")).toBe(true);
    expect(can("editor", "comment.write")).toBe(true);
    expect(can("viewer", "comment.write")).toBe(true);

    // run: yes, yes, yes
    expect(can("owner", "run")).toBe(true);
    expect(can("editor", "run")).toBe(true);
    expect(can("viewer", "run")).toBe(true);

    // snapshot.create: yes, yes, no
    expect(can("owner", "snapshot.create")).toBe(true);
    expect(can("editor", "snapshot.create")).toBe(true);
    expect(can("viewer", "snapshot.create")).toBe(false);

    // members.manage & invites.manage: yes, no, no
    expect(can("owner", "members.manage")).toBe(true);
    expect(can("editor", "members.manage")).toBe(false);
    expect(can("viewer", "members.manage")).toBe(false);

    expect(can("owner", "invites.manage")).toBe(true);
    expect(can("editor", "invites.manage")).toBe(false);
    expect(can("viewer", "invites.manage")).toBe(false);

    // room.delete: yes, no, no
    expect(can("owner", "room.delete")).toBe(true);
    expect(can("editor", "room.delete")).toBe(false);
    expect(can("viewer", "room.delete")).toBe(false);

    // ai.review: yes, yes, no
    expect(can("owner", "ai.review")).toBe(true);
    expect(can("editor", "ai.review")).toBe(true);
    expect(can("viewer", "ai.review")).toBe(false);

    // ai.read: yes, yes, yes
    expect(can("owner", "ai.read")).toBe(true);
    expect(can("editor", "ai.read")).toBe(true);
    expect(can("viewer", "ai.read")).toBe(true);
  });
});
