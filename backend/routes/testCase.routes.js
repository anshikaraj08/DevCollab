import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.js";
import { roomAccess } from "../middleware/roomAccess.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { updateTestsSchema } from "../validators/tests.validator.js";
import {
  getTestCases,
  updateTestCases,
} from "../controllers/testCase.controller.js";

const router = Router({ mergeParams: true });
router.use(authUser);

router.get("/", roomAccess("tests.read"), getTestCases);
router.put("/", roomAccess("tests.write"), validate(updateTestsSchema), updateTestCases);

export default router;
