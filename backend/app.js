import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import logger from "./utils/logger.js";
import userRoutes from "./routes/user.routes.js";
import roomRoutes from "./routes/room.routes.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";

const app = express();

// credentials: true lets the browser send the refresh-token cookie
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(pinoHttp({ logger })); // logs every request (replaces morgan)
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => res.json({ message: "DevCollab API running" }));
app.use("/users", userRoutes); //Whenever a request starts with /users, send it to userRoutes to handle it.
app.use("/rooms", roomRoutes); //Whenever a request starts with /rooms, send it to roomRoutes to handle it.


app.use(notFound);
app.use(errorHandler);
 
export default app;
