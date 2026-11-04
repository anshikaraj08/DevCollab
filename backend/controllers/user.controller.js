// A controller contains the main logic for handling requests.
// In DevCollab, this file handles user registration, login, token refreshing, logout, and viewing a profile.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";
import { setRefreshCookie, clearRefreshCookie } from "../utils/cookies.js";

const publicUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
});

// This helper sends the authentication response after registration or login.
const sendAuth = (res, user, status = 200) => {
  setRefreshCookie(res, user.generateRefreshToken());
  res.status(status).json({
    user: publicUser(user),
    accessToken: user.generateAccessToken(),
  });
};

// This function creates a new user account.
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (await User.findOne({ email })) 
    throw new ApiError(409, "Email already registered");

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ 
    name,
    email,
    password: hashed,
  });

  logger.info({ userId: user._id }, "User registered");
  sendAuth(res, user, 201);
});

// This function authenticates an existing user.
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.isValidPassword(password))) {
    logger.warn({ email }, "Failed login attempt");
    throw new ApiError(401, "Invalid email or password");
  }
  sendAuth(res, user);
});

// Called by the frontend on page load and when an access token expires
export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) throw new ApiError(401, "No refresh token");
  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  const user = await User.findById(decoded.id);
  if (!user) throw new ApiError(401, "User not found");
  res.json({ user: publicUser(user), accessToken: user.generateAccessToken() });
});

// This function logs the user out by clearing the refresh-token cookie.
export const logout = (req, res) => {
  clearRefreshCookie(res);
  res.json({ message: "Logged out" });
};

// This function retrieves the authenticated user's profile.
export const profile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");
  res.json({ user: publicUser(user) });
});
