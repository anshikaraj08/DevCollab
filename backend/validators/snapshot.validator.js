import { z } from "zod";
import { MAX_SNAPSHOT_NAME_CHARS } from "../config/limits.js";

export const createSnapshotSchema = z.object({
  name: z
    .string()
    .trim()
    .max(MAX_SNAPSHOT_NAME_CHARS, `Name cannot exceed ${MAX_SNAPSHOT_NAME_CHARS} characters`)
    .optional(),
});

