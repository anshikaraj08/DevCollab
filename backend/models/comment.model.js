import mongoose from "mongoose";

const replySchema = new mongoose.Schema(
  {
    author:   { id: String, name: String },
    text:     { type: String, required: true },
    editedAt: { type: Date, default: null },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

const commentSchema = new mongoose.Schema(
  {
    roomId:   { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    line:     { type: Number, required: true },           // 1-based line number
    author:   { id: String, name: String },
    text:     { type: String, required: true },
    resolved: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    replies:  [replySchema],
  },
  { timestamps: true }
);

export default mongoose.model("Comment", commentSchema);

