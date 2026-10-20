import { Router } from "express";
import { register, login, refresh, logout, profile } from "../controllers/user.controller.js";
import { authUser } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { registerSchema, loginSchema } from "../validators/user.validator.js";
//  Creates a router to hold the user routes.
const router = Router();
// A route file defines the URLs your frontend can call and connects each URL to the appropriate middleware and controller.

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/profile", authUser, profile);
 
export default router;

// The router itself does not reveal the final URL prefix. For example, if your main Express app mounts it with app.use("/api/users", router), the registration URL becomes POST /api/users/register.