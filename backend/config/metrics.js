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

// Stage 5 Scale-Out Metrics
export const logLengthGauge = new client.Gauge({
  name: "devcollab_log_length",
  help: "Length of update log per room",
  labelNames: ["roomId"],
  registers: [register],
});

export const compactionDurationHistogram = new client.Histogram({
  name: "devcollab_compaction_duration_seconds",
  help: "Duration of document compaction in seconds",
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const resyncUpdatesCounter = new client.Counter({
  name: "devcollab_resync_updates_total",
  help: "Total missing updates applied from 30s resync poll",
  labelNames: ["roomId"],
  registers: [register],
});

export const instancesPerRoomGauge = new client.Gauge({
  name: "devcollab_instances_per_room",
  help: "Number of instances currently serving a room",
  labelNames: ["roomId"],
  registers: [register],
});

export default {
  register,
  activeSocketsGauge,
  loadedRoomsGauge,
  saveDurationHistogram,
  runExecutionsCounter,
  aiReviewCounter,
  logLengthGauge,
  compactionDurationHistogram,
  resyncUpdatesCounter,
  instancesPerRoomGauge,
};

