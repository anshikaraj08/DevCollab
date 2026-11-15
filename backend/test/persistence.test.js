import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as Y from "yjs";
import { setupTestDb } from "./helpers/setupApp.js";
import Room from "../models/room.model.js";
import User from "../models/user.model.js";
import YUpdate from "../models/yUpdate.model.js";
import { MongoPersistence } from "../sockets/persistence.js";
import { DocStore } from "../sockets/docStore.js";

const silent = { info() {}, warn() {}, error() {} };

describe("Update log persistence safety", () => {
  let db;
  let owner;

  before(async () => {
    db = await setupTestDb();
  });

  after(async () => {
    await db.teardown();
  });

  beforeEach(async () => {
    await db.clear();
    owner = await User.create({ name: "Owner", email: "owner_persist@example.com" });
  });

  /** A room whose yState holds `base`, plus a doc that can produce further updates. */
  async function makeRoom(base) {
    const doc = new Y.Doc();
    doc.getText("code").insert(0, base);
    const room = await Room.create({
      title: "Persistence Room",
      code: base,
      yState: Buffer.from(Y.encodeStateAsUpdate(doc)),
      createdBy: owner._id,
      users: [owner._id],
    });
    return { room, doc };
  }

  function nextUpdate(doc, fn) {
    let captured;
    const handler = (u) => {
      captured = u;
    };
    doc.on("update", handler);
    fn(doc.getText("code"));
    doc.off("update", handler);
    return Buffer.from(captured);
  }

  it("keeps an update whose _id sorts before the compaction checkpoint", async () => {
    const { room, doc } = await makeRoom("start");
    const persistence = new MongoPersistence({ logger: silent });

    await YUpdate.create({ room: room._id, update: nextUpdate(doc, (t) => t.insert(5, " A")) });
    const res = await persistence.compact(room._id);
    assert.equal(res.compacted, true);

    // Another instance wrote this edit with an ObjectId from an earlier second
    const lowId = mongoose.Types.ObjectId.createFromTime(Math.floor(Date.now() / 1000) - 60);
    assert.ok(String(lowId) < String(res.compactedUntil));
    await YUpdate.create({ _id: lowId, room: room._id, update: nextUpdate(doc, (t) => t.insert(7, " B")) });

    const loaded = await persistence.load(room._id);
    assert.equal(loaded.code, "start A B", "load must apply the out-of-order update");

    await persistence.compact(room._id);
    const after = await Room.findById(room._id).select("code");
    assert.equal(after.code, "start A B", "compaction must fold it in, not delete it unapplied");
    assert.equal(await YUpdate.countDocuments({ room: room._id }), 0);
  });

  it("requeues buffered edits when the database write fails", async () => {
    const { room, doc } = await makeRoom("x");
    let failNext = true;
    const flakyModel = {
      create: async (data) => {
        if (failNext) {
          failNext = false;
          throw new Error("transient network error");
        }
        return YUpdate.create(data);
      },
    };
    const persistence = new MongoPersistence({ logger: silent, yUpdateModel: flakyModel, batchIntervalMs: 10_000 });

    persistence.append(room._id, nextUpdate(doc, (t) => t.insert(1, "y")));
    await assert.rejects(() => persistence.flush(room._id), /transient/);

    // The edit is still buffered and lands on the next flush
    await persistence.flush(room._id);
    const stored = await YUpdate.find({ room: room._id });
    assert.equal(stored.length, 1);

    const loaded = await new MongoPersistence({ logger: silent }).load(room._id);
    assert.equal(loaded.code, "xy");
  });

  it("two instances compacting at once never overwrite each other's state", async () => {
    const { room, doc } = await makeRoom("");
    const expected = [];
    for (let i = 0; i < 20; i++) {
      const line = `line ${i}\n`;
      expected.push(line);
      await YUpdate.create({
        room: room._id,
        update: nextUpdate(doc, (t) => t.insert(t.length, line)),
      });
    }

    // Instance A reads the room and log, then stalls right before writing.
    let releaseA;
    const gate = new Promise((r) => (releaseA = r));
    let reachedWrite;
    const atWrite = new Promise((r) => (reachedWrite = r));
    const gated = (fn) => async (...args) => {
      reachedWrite();
      await gate;
      return fn(...args);
    };
    const slowRoomModel = {
      findById: (...args) => Room.findById(...args),
      findOneAndUpdate: gated((...args) => Room.findOneAndUpdate(...args)),
      findByIdAndUpdate: gated((...args) => Room.findByIdAndUpdate(...args)),
    };

    const a = new MongoPersistence({ logger: silent, roomModel: slowRoomModel });
    const b = new MongoPersistence({ logger: silent });

    const pendingA = a.compact(room._id);
    await atWrite;

    // Meanwhile a new edit arrives and instance B compacts it in.
    const late = "late edit\n";
    expected.push(late);
    await YUpdate.create({ room: room._id, update: nextUpdate(doc, (t) => t.insert(t.length, late)) });
    const resB = await b.compact(room._id);
    assert.equal(resB.compacted, true);

    releaseA();
    await pendingA;

    const loaded = await new MongoPersistence({ logger: silent }).load(room._id);
    assert.equal(loaded.code, expected.join(""), "A's stale state must not overwrite B's newer state");
  });

  it("evicting a room drops its document and pending edits without writing", async () => {
    const { room, doc } = await makeRoom("keep");
    const persistence = new MongoPersistence({ logger: silent, batchIntervalMs: 10_000 });
    const store = new DocStore({ persistence, logger: silent, resyncIntervalMs: 0 });

    const entry = await store.acquire(room._id);
    Y.applyUpdate(entry.doc, nextUpdate(doc, (t) => t.insert(4, "!")), "client");
    store.evict(room._id);

    assert.equal(store.peek(room._id), undefined);
    await persistence.flushAll();
    assert.equal(await YUpdate.countDocuments({ room: room._id }), 0);
  });
});
