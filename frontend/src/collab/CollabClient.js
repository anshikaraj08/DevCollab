import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { MonacoBinding } from "./monacoBinding.js";
import { colorIndexFor } from "./colors.js";
 
const toBytes = (x) => (x instanceof Uint8Array ? x : new Uint8Array(x));
 
/**
 * One instance = one user inside one room.
 * status: "connecting" | "synced" | "disconnected" | "forbidden" | "error"
 */
export class CollabClient {
  constructor({ socket, roomId, user }) {
    this.socket = socket;
    this.roomId = roomId;
    this.user = user;                                   // { id, name }
    this.doc = new Y.Doc();
    this.ytext = this.doc.getText("code");
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.awareness.setLocalStateField("user", {
      id: user.id, name: user.name, colorIndex: colorIndexFor(user.id),
    });
 
    this.status = "connecting";
    this.error = null;
    this.room = null;
    this.lastSavedAt = null;
    this.binding = null;
    this.subscribers = new Set();
    this.destroyed = false;
 
    this.handlers = {
      connect: () => this.join(),
      disconnect: () => this.setStatus("disconnected"),
      "yjs:update": (msg) => {
        if (msg.roomId === this.roomId) Y.applyUpdate(this.doc, toBytes(msg.update), "remote");
      },
      "awareness:update": (msg) => {
        if (msg.roomId === this.roomId) {
          awarenessProtocol.applyAwarenessUpdate(this.awareness, toBytes(msg.update), "remote");
        }
      },
      "awareness:remove": (msg) => {
        if (msg.roomId === this.roomId) {
          awarenessProtocol.removeAwarenessStates(this.awareness, [msg.clientId], "remote");
        }
      },
      "room:saved": (msg) => {
        if (msg.roomId === this.roomId) {
          this.lastSavedAt = msg.at;
          this.notify();
        }
      },
      "room:error": (msg) => {
        this.error = msg.error;
        this.notify();
      },
    };
    for (const [event, fn] of Object.entries(this.handlers)) socket.on(event, fn);
 
    // my edits -> server (only while synced; after a reconnect join() sends what was missed)
    this.onDocUpdate = (update, origin) => {
      if (origin === "remote" || this.status !== "synced") return;
      this.socket.emit("yjs:update", { roomId: this.roomId, update });
    };
    this.doc.on("update", this.onDocUpdate);
 
    // my cursor and name -> server
    this.onAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin !== "local" || this.status !== "synced" || this.destroyed) return;
      this.sendAwareness([...added, ...updated, ...removed]);
    };
    this.awareness.on("update", this.onAwarenessUpdate);
    this.onAwarenessChange = () => this.notify();
    this.awareness.on("change", this.onAwarenessChange);
 
    if (socket.connected) this.join();
  }
 
  join() {
    if (this.destroyed) return;
    this.setStatus("connecting");
    this.socket.timeout(10000).emit("room:join", { roomId: this.roomId }, (err, res) => {
      if (this.destroyed) return;
      if (err) return this.setStatus("error", "TIMEOUT");
      if (!res?.ok) return this.setStatus(res?.error === "FORBIDDEN" ? "forbidden" : "error", res?.error);
 
      const serverState = toBytes(res.state);
      Y.applyUpdate(this.doc, serverState, "remote");                 // get what the server has
      this.room = res.room;
      this.status = "synced";
      this.error = null;
 
      // send what the server does not have yet (edits typed while offline)
      const missing = Y.encodeStateAsUpdate(this.doc, Y.encodeStateVectorFromUpdate(serverState));
      if (missing.byteLength > 2) this.socket.emit("yjs:update", { roomId: this.roomId, update: missing });
 
      for (const update of res.awareness || []) {
        awarenessProtocol.applyAwarenessUpdate(this.awareness, toBytes(update), "remote");
      }
      this.sendAwareness([this.doc.clientID]);
      this.notify();
    });
  }
 
  sendAwareness(clientIds) {
    const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, clientIds);
    this.socket.emit("awareness:update", { roomId: this.roomId, clientId: this.doc.clientID, update });
  }
 
  attachEditor(editor, monaco) {
    this.detachEditor();
    this.binding = new MonacoBinding({ ytext: this.ytext, editor, monaco, awareness: this.awareness });
    return this.binding;
  }
 
  detachEditor() {
    this.binding?.destroy();
    this.binding = null;
  }
 
  /** People in the room, one entry per person (a person with two tabs counts once). */
  getPresence() {
    const people = new Map();
    this.awareness.getStates().forEach((state) => {
      if (state.user && !people.has(state.user.id)) {
        people.set(state.user.id, { ...state.user, self: state.user.id === this.user.id });
      }
    });
    return [...people.values()];
  }
 
  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }
 
  notify() {
    for (const fn of [...this.subscribers]) fn();
  }
 
  setStatus(status, error = null) {
    this.status = status;
    this.error = error;
    this.notify();
  }
 
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.detachEditor();
    if (this.socket.connected) this.socket.emit("room:leave", { roomId: this.roomId });
    for (const [event, fn] of Object.entries(this.handlers)) this.socket.off(event, fn);
    this.doc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    this.awareness.off("change", this.onAwarenessChange);
    this.awareness.destroy();
    this.doc.destroy();
    this.subscribers.clear();
  }
}

