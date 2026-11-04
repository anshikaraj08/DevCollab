import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import env from "./config/env.js";
import logger from "./utils/logger.js";
import userRoutes from "./routes/user.routes.js";
import roomRoutes from "./routes/room.routes.js";
import memberRoutes from "./routes/member.routes.js";
import roomInviteRoutes from "./routes/roomInvite.routes.js";
import inviteRoutes from "./routes/invite.routes.js";
import runRoutes from "./routes/run.routes.js";
import commentRoutes from "./routes/comment.routes.js";
import snapshotRoutes from "./routes/snapshot.routes.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// credentials: true lets the browser send the refresh-token cookie
app.use(cors({ origin: env?.CLIENT_URL || process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(
  pinoHttp({
    logger,
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => res.json({ message: "DevCollab API running" }));
app.use("/users", userRoutes);
app.use("/rooms/:roomId/members", memberRoutes);
app.use("/rooms/:roomId/invites", roomInviteRoutes);
app.use("/rooms/:roomId/snapshots", snapshotRoutes);
app.use("/rooms", roomRoutes);
app.use("/invites", inviteRoutes);
app.use("/run", runRoutes);
app.use("/comments", commentRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
