import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.js";
import { roomAccess } from "../middleware/roomAccess.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { createRoomSchema, saveCodeSchema } from "../validators/room.validator.js";
import {
  createRoom,
  getAllRooms,
  getRoom,
  saveCode,
  deleteRoom,
} from "../controllers/room.controller.js";

const router = Router();
router.use(authUser);

router.post("/create", validate(createRoomSchema), createRoom);
router.get("/all", getAllRooms);
router.get("/:roomId", roomAccess("room.read"), getRoom);
router.put("/:roomId/code", roomAccess("doc.edit"), validate(saveCodeSchema), saveCode);
router.delete("/:roomId", roomAccess("room.delete"), deleteRoom);

export default router;
