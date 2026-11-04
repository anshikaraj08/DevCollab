import { env } from "../config/env.js";

const isProd = (env?.NODE_ENV || process.env.NODE_ENV) === "production";

export const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

export const getClearCookieOptions = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
});

export const setRefreshCookie = (res, token) => {
  res.cookie("refreshToken", token, getRefreshCookieOptions());
};

export const clearRefreshCookie = (res) => {
  res.clearCookie("refreshToken", getClearCookieOptions());
};

