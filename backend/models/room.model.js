import mongoose from "mongoose";
 
const roomSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    language: { type: String, default: "javascript" },
    code: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);
 
export default mongoose.model("Room", roomSchema);
