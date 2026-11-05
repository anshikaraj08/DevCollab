import { GitHub, generateState } from "arctic";

let gitHubClient = null;

export function getGitHubClient() {
  if (gitHubClient) return gitHubClient;
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectURI = `${(process.env.API_URL || "http://localhost:5000").replace(/\/+$/, "")}/auth/github/callback`;
  if (clientId && clientSecret) {
    gitHubClient = new GitHub(clientId, clientSecret, redirectURI);
  }
  return gitHubClient;
}

export const gitHubOAuthService = {
  createAuthorizationURL: async () => {
    const client = getGitHubClient();
    if (!client) throw new Error("GitHub OAuth not configured");
    const state = generateState();
    const url = client.createAuthorizationURL(state, ["user:email", "read:user"]);
    return { url: url.toString(), state, codeVerifier: null };
  },

  exchangeCode: async (code) => {
    const client = getGitHubClient();
    if (!client) throw new Error("GitHub OAuth not configured");
    return client.validateAuthorizationCode(code);
  },

  fetchProfile: async (tokens) => {
    const accessToken = typeof tokens === "string" ? tokens : tokens.accessToken();
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "DevCollab",
      },
    });
    if (!userRes.ok) {
      throw new Error(`Failed to fetch GitHub profile: ${userRes.statusText}`);
    }
    const userData = await userRes.json();

    // Fetch primary verified email from /user/emails
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "DevCollab",
      },
    });

    let verifiedEmail = null;
    if (emailsRes.ok) {
      const emails = await emailsRes.json();
      if (Array.isArray(emails)) {
        const primary = emails.find((e) => e.primary && e.verified);
        verifiedEmail = primary ? primary.email : emails.find((e) => e.verified)?.email;
      }
    }

    return {
      provider: "github",
      providerId: String(userData.id),
      email: verifiedEmail || userData.email || null,
      emailVerified: Boolean(verifiedEmail),
      name: userData.name || userData.login || "User",
      avatarUrl: userData.avatar_url,
    };
  },
};

