// This file defines the validation rules for user registration and login using the Zod library.

// Validation means checking whether the data supplied by the user follows the required rules.
import { z } from "zod";
// Imports Zod, a library used to define and validate data structures.
 
export const registerSchema = z.object({
  name: z
  .string()
  .trim()
  .min(1,"Name is required")
  .min(3, "Name must be at least 3 characters long")
  .max(50, "Name cannot exceed 50 characters"),

 email: z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .max(254, "Email must not exceed 254 characters")
  .email("Please enter a valid email address"),
  password: z
  .string()
  .min(6, "Password must be at least 6 characters long")
  .max(128, "Password cannot exceed 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least one special character"
  ),
});
 
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email required"),
  password: z.string().min(1, "Password is required"),
});

// Unlike registration, the login schema doesn't require six password characters. It checks that the password isn't empty; the controller then checks whether it matches the stored password.

// Regex	Meaning	Example
// /[A-Z]/	Uppercase letter	A, Z
// /[a-z]/	Lowercase letter	a, z
// /[0-9]/	Digit	0, 9
// /[^A-Za-z0-9]/	Character other than a letter or digit	@, #, !
// The ^ inside [^A-Za-z0-9] means anything except the listed characters.