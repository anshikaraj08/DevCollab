# DevCollab Permission Matrix and Role-Based Access Control (RBAC)

DevCollab enforces role-based access control (RBAC) across three membership roles for workspaces:
- **Owner (`owner`)**: Workspace creator or transferred owner. Has complete authority over workspace settings, membership, invites, code execution, snapshots, and deletion.
- **Editor (`editor`)**: Collaborator with write access to code, comments, snapshots, AI reviews, and shared tests.
- **Viewer (`viewer`)**: Read-only collaborator. Can inspect code, see live cursors, run code and test cases, post comments, and compare snapshots in the non-destructive diff editor, but cannot modify code, save snapshots, edit tests, or alter membership.

---

## 1. Permission Matrix

| Action | Meaning | Owner | Editor | Viewer |
|---|---|:---:|:---:|:---:|
| `room.read` | View workspace metadata, source code, and active presence | **Yes** | **Yes** | **Yes** |
| `doc.edit` | Type in editor, send Yjs doc edits, save code | **Yes** | **Yes** | No |
| `comment.write` | Post new comments or reply to comment threads | **Yes** | **Yes** | **Yes** |
| `comment.edit` | Edit own comments and replies | **Own only** | **Own only** | **Own only** |
| `comment.mention` | Mention workspace collaborators in comments and replies | **Yes** | **Yes** | **Yes** |
| `comment.delete` | Delete comment (own for editor/viewer; any for owner) | **Yes** | **Yes** | **Yes** |
| `run` | Execute code against Wandbox with live stdin/stdout | **Yes** | **Yes** | **Yes** |
| `snapshot.read` | List snapshots and inspect snapshot code | **Yes** | **Yes** | **Yes** |
| `snapshot.create` | Save named version snapshots of the workspace | **Yes** | **Yes** | No |
| `snapshot.restore` | Restore past snapshot into live collaborative document | **Yes** | **Yes** | No |
| `snapshot.delete` | Delete snapshot (own for editor; any for owner) | **Yes** | **Yes** | No |
| `tests.read` | View shared workspace test cases | **Yes** | **Yes** | **Yes** |
| `tests.write` | Add, edit, or delete shared test cases | **Yes** | **Yes** | No |
| `members.read` | View list of workspace collaborators and their roles | **Yes** | **Yes** | **Yes** |
| `members.manage` | Change collaborator roles or remove members | **Yes** | No | No |
| `invites.manage` | Generate, list, and revoke invite links | **Yes** | No | No |
| `room.delete` | Permanently delete the workspace and all history | **Yes** | No | No |
| `ai.review` | Request an AI code review (consumes provider quota) | **Yes** | **Yes** | No |
| `ai.read` | View AI code review history and findings | **Yes** | **Yes** | **Yes** |

---

## 2. Real-Time Socket Enforcement

In addition to HTTP middleware (`roomAccess`), the Socket.IO and Yjs collaboration layer independently validates roles:
1. **Viewers rejected on document updates:** Sockets with role `viewer` sending `yjs:update` events are ignored and receive `{ error: "READ_ONLY" }`.
2. **Dynamic role transitions:** When an owner modifies a user's role or removes them via `PATCH /rooms/:roomId/members/:userId` or `DELETE /rooms/:roomId/members/:userId`, `io.syncRoomMembership(roomId)` pushes `room:role` or `room:removed` to live sockets immediately without requiring a browser reload.
3. **Collaborative Undo Isolation:** `Y.UndoManager` scopes undo/redo exclusively to the local editor's origin. Viewers do not have undo stacks. When a snapshot restore occurs (`room:restored`), undo history is cleared across all participants to prevent re-inserting pre-restore contents.
4. **Concurrent Connection Limits:** Each authenticated user is limited to 10 concurrent real-time sockets across rooms. Excess connections are rejected with `TOO_MANY`.

---

## 3. Distributed Scale-Out & Notification RBAC (Phase 4)

1. **Redis Pub/Sub Consistency:** In multi-instance deployments (`@socket.io/redis-adapter`), room broadcasts (`yjs:update`, `awareness:update`, `comment:*`, `room:restored`) travel through Redis channels. Each backend instance enforces the role matrix locally on connected sockets before emitting or accepting mutations.
2. **Private User Channels:** In-app notifications are routed strictly through private socket channels (`user:<userId>`). Other users in the same workspace room cannot subscribe to or intercept notifications intended for peers.
3. **Mention Authorization:** The backend verifies that mentioned user handles correspond to active workspace members before generating notifications or dispatching email alerts.
4. **Account Safety Guards:** Users cannot unlink their last remaining authentication method (e.g. unlinking password when no OAuth account is linked), preventing orphaned user accounts.
