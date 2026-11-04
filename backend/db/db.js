import mongoose from "mongoose";
import logger from "../utils/logger.js";
import env from "../config/env.js";

export default async function connectDB(uri) {
  const mongoUri = uri || env?.MONGO_URI || process.env.MONGO_URI || process.env.MONGODB_URI;
  try {
    await mongoose.connect(mongoUri);
    logger.info("MongoDB connected");
  } catch (err) {
    logger.error({ err }, "MongoDB connection failed");
    process.exit(1);
  }
}
