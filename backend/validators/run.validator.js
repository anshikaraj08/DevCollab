import { z } from "zod";
import { MAX_CODE_CHARS, MAX_STDIN_CHARS } from "../config/limits.js";

export const runCodeSchema = z.object({
  language: z.enum(["cpp", "python", "javascript", "java"], {
    errorMap: () => ({ message: "Language must be one of: cpp, python, javascript, java" }),
  }),
  code: z
    .string({ required_error: "Code is required" })
    .max(MAX_CODE_CHARS, `Code cannot exceed ${MAX_CODE_CHARS} characters`),
  stdin: z
    .string()
    .max(MAX_STDIN_CHARS, `Standard input cannot exceed ${MAX_STDIN_CHARS} characters`)
    .optional()
    .default(""),
});

