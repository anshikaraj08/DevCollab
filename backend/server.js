import "dotenv/config";
import http from "http";
import app from "./app.js";
import connectDB from "./db/db.js";
import logger from "./utils/logger.js";

 

 
const PORT = process.env.PORT || 5000;
const server = http.createServer(app); // http server, so Socket.IO can attach later
 
// connectDB().then(() => {
//   server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// });

connectDB().then(() => {
  server.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
});

