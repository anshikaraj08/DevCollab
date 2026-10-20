// This is the middleware that actually applies the Zod validation rules to incoming requests.
// Your validator files define the rules; this file checks the request data against them.
import ApiError from "../utils/ApiError.js";
 
// Usage: router.post("/register", validate(registerSchema), register)
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw new ApiError(400, result.error.issues[0].message);
  }
  req.body = result.data; // cleaned data (trimmed, lowercased, defaults applied)
  next();
};
