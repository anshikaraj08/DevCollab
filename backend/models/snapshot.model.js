import mongoose from "mongoose";

const snapshotSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    name: {
      type: String,
      default: "",
      trim: true,
    },
    code: {
      type: String,
      default: "",
    },
    kind: {
      type: String,
      enum: ["manual", "pre-restore"],
      default: "manual",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

snapshotSchema.index({ room: 1, createdAt: -1 });

export default mongoose.model("Snapshot", snapshotSchema);
