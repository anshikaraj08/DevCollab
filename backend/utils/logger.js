import pino from "pino";
 
const isProd = process.env.NODE_ENV === "production";
 
const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  // Never write secrets into logs
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    'res.headers["set-cookie"]',
    "password",
    "*.password",
  ],
  // Pretty colored output in development, plain JSON in production
  transport: isProd
    ? undefined
    : { target: "pino-pretty", options: { colorize: true } },
});
 
export default logger;
