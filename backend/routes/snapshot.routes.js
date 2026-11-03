import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.js";
import {
  listSnapshots,
  createSnapshot,
  getSnapshot,
  deleteSnapshot,
} from "../controllers/snapshot.controller.js";

const router = Router();
router.use(authUser);

router.get("/:roomId",              listSnapshots);
router.post("/:roomId",             createSnapshot);
router.get("/single/:snapshotId",   getSnapshot);
router.delete("/single/:snapshotId", deleteSnapshot);

export default router;
