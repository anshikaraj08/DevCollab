import { env } from "../config/env.js";

/**
 * Builds cookie options according to environment configuration.
 *
 * Rules:
 * - Localhost / development: sameSite="lax", secure=false, path="/".
 * - Production with COOKIE_DOMAIN: domain=COOKIE_DOMAIN, sameSite="lax", secure=true, path="/".
 * - Production with cross-site free subdomains (or COOKIE_SAMESITE="none"): sameSite="none", secure=true, path="/".
 * - Production fallback: sameSite="none", secure=true (required for cross-site free Vercel + Render subdomains).
 */
export function getCookieOptions(overrides = {}, config = {}) {
  const currentEnv = config.NODE_ENV || process.env.NODE_ENV || env?.NODE_ENV;
  const isProd = currentEnv === "production";
  const cookieDomain =
    config.COOKIE_DOMAIN !== undefined
      ? config.COOKIE_DOMAIN
      : process.env.COOKIE_DOMAIN || env?.COOKIE_DOMAIN;
  const cookieSameSite =
    config.COOKIE_SAMESITE !== undefined
      ? config.COOKIE_SAMESITE
      : process.env.COOKIE_SAMESITE || env?.COOKIE_SAMESITE;

  let sameSite = "lax";
  let secure = false;

  if (isProd) {
    secure = true;
    if (cookieSameSite) {
      sameSite = cookieSameSite;
    } else if (cookieDomain) {
      sameSite = "lax";
    } else {
      // Cross-site default for free Render + Vercel subdomains
      sameSite = "none";
    }
  }

  const options = {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    ...overrides,
  };

  if (cookieDomain && isProd) {
    options.domain = cookieDomain;
  }

  return options;
}

export const getRefreshCookieOptions = () =>
  getCookieOptions({ maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7 days in ms

export const getClearCookieOptions = () => getCookieOptions();

export const setRefreshCookie = (res, token) => {
  res.cookie("refreshToken", token, getRefreshCookieOptions());
};

export const clearRefreshCookie = (res) => {
  res.clearCookie("refreshToken", getClearCookieOptions());
};
