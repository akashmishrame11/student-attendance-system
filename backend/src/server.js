import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import app from "./app.js";
import mongoose from "mongoose";

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err.message);
    console.error("Check MONGO_URI in backend/.env and that MongoDB is running.");
    process.exit(1);
  }
  const server = app.listen(env.port, () => {
    console.log(`API running on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));
}

start();
