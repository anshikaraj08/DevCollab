// A controller contains the main logic for handling requests.
//  In DevCollab, this file handles user registration, login, token refreshing, logout, and viewing a profile.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";

const isProd = process.env.NODE_ENV === "production";

// For production with Vercel + Render (different domains), sameSite "none" + secure is required
const cookieOptions = {
    httpOnly: true, //JavaScript running in the browser cannot directly read this cookie.
    secure: isProd, //In production, the browser sends the cookie only over HTTPS.
    sameSite: isProd ? "none" : "lax", //Uses "none" in production to allow cross-site cookie requests, and "lax" locally.
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
// In DevCollab: The refresh token is stored in a cookie so the frontend can request a new access token when necessary.
// For cross-origin cookies, the frontend must also send credentials, and the backend must configure CORS and cookie settings correctly.
const publicUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
});
// Creates a safe, limited version of a user object.
// - u is the user retrieved from MongoDB.
// - Only _id, name, and email are returned.

// This helper sends the authentication response after registration or login.
const sendAuth = (res, user, status = 200) => {
    res.cookie("refreshToken", user.generateRefreshToken(), cookieOptions);
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
// bcrypt.hash(password, 10) hashes the password using a work factor of 10. The original password is not stored.
    const hashed = await bcrypt.hash(password, 10);
    // User.create(...) saves the new user in MongoDB.
    const user = await User.create({ 
        name,
        email,
        password: hashed
    });
// logger.info(...) records that registration succeeded.
    logger.info({ userId: user._id }, "User registered");

    // This helper sends the authentication response after registration or login.
    sendAuth(res, user, 201);

});

// This function authenticates an existing user.
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    // User.findOne({ email }): Searches MongoDB for the user.
    // .select("+password"): Explicitly includes the password field if the model normally excludes it.
    const user = await User.findOne({ email }).select("+password");
    // user.isValidPassword(password): Checks the submitted password against the stored hash.
    // !user: Handles an email that does not exist.
    // If either check fails, the controller logs the failed attempt and returns 401 Unauthorized.
    if (!user || !(await user.isValidPassword(password))) {
        logger.warn({ email }, "Failed login attempt");
        throw new ApiError(401, "Invalid email or password");
    }
    sendAuth(res, user);
});

// Called by the frontend on page load and when an access token expires
// This function creates a new access token using a valid refresh token.
export const refresh = asyncHandler(async (req, res) => {
    const token = req.cookies.refreshToken;
    if (!token) throw new ApiError(401, "No refresh token");
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET); // throws if invalid or expired
    const user = await User.findById(decoded.id);
    if (!user) throw new ApiError(401, "User not found");
    res.json({ user: publicUser(user), accessToken: user.generateAccessToken() });
});
// This function logs the user out by clearing the refresh-token cookie.
export const logout = (req, res) => {
    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
    });
    res.json({ message: "Logged out" });
};
// This function retrieves the authenticated user's profile.
// req.user.id: The user ID stored by authUser after JWT verification.
export const profile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError(404, "User not found");
    res.json({ user: publicUser(user) });
});
