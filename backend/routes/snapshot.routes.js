import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.js";
import { roomAccess } from "../middleware/roomAccess.middleware.js";
import { createRateLimiter } from "../middleware/rateLimit.middleware.js";
import { RATE_LIMITS } from "../config/limits.js";
import { validate } from "../middleware/validate.middleware.js";
import { createSnapshotSchema } from "../validators/snapshot.validator.js";
import {
  listSnapshots,
  createSnapshot,
  getSnapshot,
  deleteSnapshot,
  restoreSnapshot,
} from "../controllers/snapshot.controller.js";

const snapshotRateLimiter = createRateLimiter({
  ...RATE_LIMITS.snapshots,
  keyType: "user",
});

const router = Router({ mergeParams: true });
router.use(authUser);

router.get("/", roomAccess("snapshot.read"), listSnapshots);
router.post(
  "/",
  snapshotRateLimiter,
  roomAccess("snapshot.create"),
  validate(createSnapshotSchema),
  createSnapshot
);
router.get("/:snapshotId", roomAccess("snapshot.read"), getSnapshot);
router.delete("/:snapshotId", roomAccess("snapshot.delete"), deleteSnapshot);
router.post(
  "/:snapshotId/restore",
  snapshotRateLimiter,
  roomAccess("snapshot.restore"),
  restoreSnapshot
);

export default router;
