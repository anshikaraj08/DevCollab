import mongoose from "mongoose";

const snapshotSchema = new mongoose.Schema(
  {
    roomId:  { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    name:    { type: String, default: "" },          // optional label the user gives it
    code:    { type: String, default: "" },
    savedBy: { id: String, name: String },
  },
  { timestamps: true }
);

export default mongoose.model("Snapshot", snapshotSchema);

