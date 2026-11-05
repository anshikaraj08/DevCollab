import mongoose from "mongoose";

const leaseSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    holder: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Lease", leaseSchema);
