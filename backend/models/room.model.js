import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    language: { type: String, default: "javascript" },
    code: { type: String, default: "" },
    // Phase 2: the saved Yjs document. Hidden from normal queries because it is large.
    yState: { type: Buffer, select: false },
    // Phase 4 Stage 5: update log compaction checkpoint
    compactedUntil: { type: mongoose.Schema.Types.ObjectId, ref: "YUpdate", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // Phase 3: roles mapping userId -> "editor" | "viewer" (owner is always createdBy)
    roles: {
      type: Map,
      of: { type: String, enum: ["editor", "viewer"] },
      default: {},
    },
    // Phase 3 Stage 4: shared test cases
    testCases: [
      {
        name: { type: String, default: "Test Case", trim: true },
        input: { type: String, default: "" },
        expected: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Room", roomSchema);
