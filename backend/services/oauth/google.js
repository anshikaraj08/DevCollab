import { Google, generateState, generateCodeVerifier } from "arctic";

let googleClient = null;

export function getGoogleClient() {
  if (googleClient) return googleClient;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectURI = `${(process.env.API_URL || "http://localhost:5000").replace(/\/+$/, "")}/auth/google/callback`;
  if (clientId && clientSecret) {
    googleClient = new Google(clientId, clientSecret, redirectURI);
  }
  return googleClient;
}

export const googleOAuthService = {
  createAuthorizationURL: async () => {
    const client = getGoogleClient();
    if (!client) throw new Error("Google OAuth not configured");
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = client.createAuthorizationURL(state, codeVerifier, ["openid", "profile", "email"]);
    return { url: url.toString(), state, codeVerifier };
  },

  exchangeCode: async (code, codeVerifier) => {
    const client = getGoogleClient();
    if (!client) throw new Error("Google OAuth not configured");
    return client.validateAuthorizationCode(code, codeVerifier);
  },

  fetchProfile: async (tokens) => {
    const accessToken = typeof tokens === "string" ? tokens : tokens.accessToken();
    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch Google profile: ${response.statusText}`);
    }
    const data = await response.json();
    return {
      provider: "google",
      providerId: data.sub,
      email: data.email,
      emailVerified: Boolean(data.email_verified),
      name: data.name || data.email?.split("@")[0] || "User",
      avatarUrl: data.picture,
    };
  },
};

