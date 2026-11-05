import { Router } from "express";
import { register } from "../config/metrics.js";

const router = Router();

router.get("/metrics", async (req, res) => {
  const token = process.env.METRICS_TOKEN;
  if (!token) {
    return res.status(404).json({ message: "Metrics endpoint not enabled" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${token}`) {
    return res.status(401).json({ message: "Unauthorized: Invalid metrics token" });
  }

  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

export default router;

