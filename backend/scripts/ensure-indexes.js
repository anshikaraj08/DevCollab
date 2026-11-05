#!/usr/bin/env node

/**
 * Ensures and synchronizes all MongoDB model indexes with database.
 * Run this script after deploying schema migrations, new compound indexes, or TTL indexes.
 *
 * Usage:
 *   node backend/scripts/ensure-indexes.js
 */

import "../config/env.js";
import mongoose from "mongoose";
import connectDB from "../db/db.js";
import logger from "../utils/logger.js";
import User from "../models/user.model.js";
import Room from "../models/room.model.js";
import Comment from "../models/comment.model.js";
import Invite from "../models/invite.model.js";
import Snapshot from "../models/snapshot.model.js";

const models = [
  { name: "User", model: User },
  { name: "Room", model: Room },
  { name: "Comment", model: Comment },
  { name: "Invite", model: Invite },
  { name: "Snapshot", model: Snapshot },
];

async function ensureIndexes() {
  logger.info("Connecting to MongoDB to sync model indexes...");
  await connectDB();

  for (const { name, model } of models) {
    try {
      logger.info(`Syncing indexes for collection: ${name}...`);
      const result = await model.syncIndexes();
      logger.info({ collection: name, synced: result }, `Successfully synced indexes for ${name}`);
    } catch (err) {
      logger.error({ collection: name, err: err.message }, `Error syncing indexes for ${name}`);
    }
  }

  await mongoose.connection.close(false);
  logger.info("MongoDB connection closed. Index sync complete.");
  process.exit(0);
}

ensureIndexes().catch((err) => {
  logger.error({ err }, "Fatal error during ensureIndexes");
  process.exit(1);
});
