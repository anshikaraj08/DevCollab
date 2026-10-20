import mongoose from "mongoose";//Mongoose is a library that helps Node.js applications work with MongoDB.
import logger from "../utils/logger.js";
//  You are defining a function named connectDB. Its responsibility is to establish a database connection.
// Defining a function doesn't automatically execute it. Another file must call it.
// B. async
// The connection takes time because the application must communicate with a database server over a network.
// An async function always returns a Promise. If it completes normally, the Promise resolves; if an error escapes the function, the Promise rejects.
// C. export default
// This makes the function available to other JavaScript modules.
// process.env is an object containing environment variables available to the running Node.js process.
// export default async function connectDB() {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI);
//     console.log("MongoDB connected");
//   } catch (err) {
//     console.error("MongoDB error:", err.message);
//     process.exit(1);
//   }
// }

export default async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info("MongoDB connected");
  } catch (err) {
    logger.error({ err }, "MongoDB connection failed");
    process.exit(1);
  }
}

