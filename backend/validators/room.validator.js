// This file defines validation rules for creating a DevCollab room and saving code in that room.
import { z } from "zod";
 
export const createRoomSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(100, "Title too long"),
  language: z.enum(["javascript", "python", "cpp", "java"]).default("javascript"),
});
 
export const saveCodeSchema = z.object({
  code: z.string().max(200000, "Code is too large"),
});
