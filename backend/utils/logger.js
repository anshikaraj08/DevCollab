import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  base: {
    service: "devcollab-backend",
    version: process.env.APP_VERSION || "1.0.0",
  },
  // Never write secrets, credentials, tokens, or code contents into logs
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    'res.headers["set-cookie"]',
    "password",
    "*.password",
    "token",
    "*.token",
    "accessToken",
    "*.accessToken",
    "refreshToken",
    "*.refreshToken",
    "code",
    "*.code",
    "req.body.code",
    "req.body.password",
  ],
  // Pretty output in development, plain structured JSON in production
  transport: isProd
    ? undefined
    : { target: "pino-pretty", options: { colorize: true } },
});

export default logger;
