import { z } from "zod";
import {
  MAX_TEST_CASES,
  MAX_TEST_NAME_CHARS,
  MAX_TEST_INPUT_CHARS,
} from "../config/limits.js";

const testCaseItemSchema = z.object({
  name: z
    .string()
    .trim()
    .max(MAX_TEST_NAME_CHARS, `Test case name cannot exceed ${MAX_TEST_NAME_CHARS} characters`)
    .default("Test Case"),
  input: z
    .string()
    .max(MAX_TEST_INPUT_CHARS, `Input cannot exceed ${MAX_TEST_INPUT_CHARS} characters`)
    .default(""),
  expected: z
    .string()
    .max(MAX_TEST_INPUT_CHARS, `Expected output cannot exceed ${MAX_TEST_INPUT_CHARS} characters`)
    .default(""),
});

export const updateTestsSchema = z.object({
  cases: z
    .array(testCaseItemSchema)
    .max(MAX_TEST_CASES, `Cannot exceed ${MAX_TEST_CASES} test cases`),
});

