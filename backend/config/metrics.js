import client from "prom-client";

export const register = new client.Registry();

// Collect Node.js process & memory default metrics
client.collectDefaultMetrics({ register, prefix: "devcollab_" });

// Custom operational metrics
export const activeSocketsGauge = new client.Gauge({
  name: "devcollab_active_sockets",
  help: "Total number of active Socket.IO connections",
  registers: [register],
});

export const loadedRoomsGauge = new client.Gauge({
  name: "devcollab_rooms_loaded",
  help: "Total number of loaded rooms in memory",
  registers: [register],
});

export const saveDurationHistogram = new client.Histogram({
  name: "devcollab_save_duration_seconds",
  help: "Duration of document persistence saves in seconds",
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const runExecutionsCounter = new client.Counter({
  name: "devcollab_run_executions_total",
  help: "Total code execution requests",
  labelNames: ["language", "status"],
  registers: [register],
});

export const aiReviewCounter = new client.Counter({
  name: "devcollab_ai_reviews_total",
  help: "Total AI code reviews requested",
  labelNames: ["provider", "status"],
  registers: [register],
});

export default {
  register,
  activeSocketsGauge,
  loadedRoomsGauge,
  saveDurationHistogram,
  runExecutionsCounter,
  aiReviewCounter,
};

