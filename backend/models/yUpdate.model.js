import mongoose from "mongoose";

const yUpdateSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    update: {
      type: Buffer,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false }
);

// Fast cursor scan for updates since compaction checkpoint
yUpdateSchema.index({ room: 1, _id: 1 });

export default mongoose.model("YUpdate", yUpdateSchema);

