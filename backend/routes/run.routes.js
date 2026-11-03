import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.js";
import { runCode } from "../controllers/run.controller.js";

const router = Router();
router.use(authUser);

router.post("/", runCode);

export default router;

