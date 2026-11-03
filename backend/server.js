import "dotenv/config";
import http from "http";
import app from "./app.js";
import connectDB from "./db/db.js";
import logger from "./utils/logger.js";
import { initSockets } from "./sockets/index.js";
 
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
 
// Socket.IO shares the same HTTP server as Express
const { io, store } = initSockets(server);
app.set("io", io);                        // the comment routes use this to announce changes
 
connectDB().then(() => {
  server.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
});

const shutdown = async (signal) => {
  logger.info({ signal }, "Stopping: saving open rooms");
  try {
    await store.flushAll();
  } finally {
    io.close();
    process.exit(0);
  }
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
 
// nodemon restarts with SIGUSR2
process.once("SIGUSR2", async () => {
  await store.flushAll();
  process.kill(process.pid, "SIGUSR2");
});
