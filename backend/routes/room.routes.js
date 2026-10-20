import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { createRoomSchema, saveCodeSchema } from "../validators/room.validator.js";
import {
  createRoom, getAllRooms, joinRoom, saveCode, deleteRoom,
} from "../controllers/room.controller.js";
 
const router = Router();
router.use(authUser); // every room route needs login
 
router.post("/create", validate(createRoomSchema), createRoom);
router.get("/all", getAllRooms);
router.put("/join/:roomId", joinRoom);
router.put("/:roomId/code", validate(saveCodeSchema), saveCode);
router.delete("/:roomId", deleteRoom);
 
export default router;
