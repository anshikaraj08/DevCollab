import jwt from "jsonwebtoken";
// jsonwebtoken: Library used to verify JWT tokens.
import ApiError from "../utils/ApiError.js";
// ApiError: Your custom error class used to throw errors with HTTP status codes.
 
export const authUser = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  // This extracts the JWT token from the request's Authorization header.
  if (!token) throw new ApiError(401, "Unauthorized");
  req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, email }. Throws if invalid or expired
  // Important: If the token is invalid or expired, jwt.verify() throws an error, which your error-handling system can proces
  next();
  // Tells Express to continue to the next middleware or controller because authentication succeeded.
};
// What is it?
// Authentication middleware checks whether a user has a valid JWT (JSON Web Token) before allowing them to access a protected route in DevCollab.