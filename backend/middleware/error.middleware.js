
import logger from "../utils/logger.js";
// Runs when no route matches
export const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};
 
// Runs when anything throws an error (it must have all 4 arguments)
export const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || "Server error";
 
  if (err.name === "CastError") {
    status = 400;
    message = "Invalid id";
  } else if (err.code === 11000) {
    status = 409;
    message = "Already exists";
  } else if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors)[0].message;
  } else if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    status = 401;
    message = "Invalid or expired token";
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Invalid JSON body";
  }
 
  if (status === 500) {
    logger.error({ err, method: req.method, url: req.originalUrl }, "Unhandled error");
  }
 
  res.status(status).json({
    message:
      status === 500 && process.env.NODE_ENV === "production"
        ? "Something went wrong" // never leak internals in production
        : message,
  });
};
