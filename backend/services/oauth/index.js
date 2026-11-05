import { googleOAuthService } from "./google.js";
import { gitHubOAuthService } from "./github.js";

const providers = {
  google: googleOAuthService,
  github: gitHubOAuthService,
};

/**
 * Returns OAuth provider implementation for "google" | "github"
 */
export function getOAuthProvider(name) {
  return providers[name] || null;
}

/**
 * Override provider implementation (used for mocking in automated tests)
 */
export function setOAuthProvider(name, implementation) {
  providers[name] = implementation;
}

export { googleOAuthService, gitHubOAuthService };

