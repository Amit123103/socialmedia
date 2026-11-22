import { createHash } from "node:crypto";

const definitions = {
  facebook: {
    name: "Facebook",
    credentials: "FACEBOOK",
    auth: "https://www.facebook.com/v22.0/dialog/oauth",
    token: "https://graph.facebook.com/v22.0/oauth/access_token",
    profile: "https://graph.facebook.com/v22.0/me?fields=id,name,picture",
    scopes: ["public_profile", "pages_show_list", "pages_read_engagement", "pages_manage_posts"],
    tokenMethod: "GET"
  },
  instagram: {
    name: "Instagram",
    credentials: "INSTAGRAM",
    auth: "https://www.instagram.com/oauth/authorize",
    token: "https://api.instagram.com/oauth/access_token",
    profile: "https://graph.instagram.com/me?fields=user_id,username,name,profile_picture_url",
    scopes: ["instagram_business_basic", "instagram_business_content_publish"],
    tokenMethod: "POST"
  },
  threads: {
    name: "Threads",
    credentials: "THREADS",
    auth: "https://threads.net/oauth/authorize",
    token: "https://graph.threads.net/oauth/access_token",
    profile: "https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url,name",
    scopes: ["threads_basic", "threads_content_publish"],
    tokenMethod: "POST"
  },
  x: {
    name: "X",
    credentials: "X",
    auth: "https://twitter.com/i/oauth2/authorize",
    token: "https://api.x.com/2/oauth2/token",
    profile: "https://api.x.com/2/users/me?user.fields=profile_image_url,name,username",
    scopes: ["users.read", "tweet.read", "tweet.write", "offline.access"],
    tokenMethod: "POST",
    pkce: true
  },
  linkedin: {
    name: "LinkedIn",
    credentials: "LINKEDIN",
    auth: "https://www.linkedin.com/oauth/v2/authorization",
    token: "https://www.linkedin.com/oauth/v2/accessToken",
    profile: "https://api.linkedin.com/v2/userinfo",
    scopes: ["openid", "profile", "w_member_social"],
    tokenMethod: "POST"
  },
  youtube: {
    name: "YouTube",
    credentials: "YOUTUBE",
    auth: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    profile: "https://www.googleapis.com/oauth2/v3/userinfo",
    scopes: ["openid", "profile", "https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/youtube.upload"],
    tokenMethod: "POST",
    extraAuth: { access_type: "offline", prompt: "consent" }
  },
  tiktok: {
    name: "TikTok",
    credentials: "TIKTOK",
    clientIdKey: "SOCIAL_TIKTOK_CLIENT_KEY",
    auth: "https://www.tiktok.com/v2/auth/authorize/",
    token: "https://open.tiktokapis.com/v2/oauth/token/",
    profile: "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username",
    scopes: ["user.info.basic", "video.publish"],
    tokenMethod: "POST",
    pkce: true
  },
  pinterest: {
    name: "Pinterest",
    credentials: "PINTEREST",
    auth: "https://www.pinterest.com/oauth/",
    token: "https://api.pinterest.com/v5/oauth/token",
    profile: "https://api.pinterest.com/v5/user_account",
    scopes: ["user_accounts:read", "pins:read", "pins:write"],
    tokenMethod: "POST"
  },
  reddit: {
    name: "Reddit",
    credentials: "REDDIT",
    auth: "https://www.reddit.com/api/v1/authorize",
    token: "https://www.reddit.com/api/v1/access_token",
    profile: "https://oauth.reddit.com/api/v1/me",
    scopes: ["identity", "read", "submit"],
    tokenMethod: "POST",
    extraAuth: { duration: "permanent" }
  }
};

function credentials(platform) {
  const provider = definitions[platform];
  if (!provider) return null;
  const id = process.env[provider.clientIdKey || `SOCIAL_${provider.credentials}_CLIENT_ID`];
  const secret = process.env[`SOCIAL_${provider.credentials}_CLIENT_SECRET`];
  return id && secret ? { id, secret } : null;
}

export function socialPlatforms() {
  return [
    ...Object.entries(definitions).map(([id, provider]) => {
      const clientIdKey = provider.clientIdKey || `SOCIAL_${provider.credentials}_CLIENT_ID`;
      const clientSecretKey = `SOCIAL_${provider.credentials}_CLIENT_SECRET`;
      const configured = Boolean(credentials(id));
      return {
        id,
        name: provider.name,
        configured,
        note: configured ? null : `Set ${clientIdKey} and ${clientSecretKey} in the server environment, then restart the backend.`
      };
    }),
    { id: "telegram", name: "Telegram", configured: false, note: "Telegram requires its own bot or Login Widget setup; it does not support this OAuth flow." }
  ];
}

export function oauthRedirectUri(platform) {
  const base = (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/+$/, "");
  return `${base}/api/social/callback/${encodeURIComponent(platform)}`;
}

export function createAuthorizationUrl(platform, state, verifier, redirectUri) {
  const provider = definitions[platform];
  const auth = credentials(platform);
  if (!provider) throw Object.assign(new Error("This platform does not support OAuth account linking"), { status: 501 });
  if (!auth) {
    const clientIdKey = provider.clientIdKey || `SOCIAL_${provider.credentials}_CLIENT_ID`;
    const clientSecretKey = `SOCIAL_${provider.credentials}_CLIENT_SECRET`;
    throw Object.assign(new Error(`${provider.name} OAuth is not configured. Set ${clientIdKey} and ${clientSecretKey}, then restart the backend.`), { status: 503 });
  }

  const url = new URL(provider.auth);
  url.searchParams.set("client_id", auth.id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scopes.join(" "));
  url.searchParams.set("state", state);
  for (const [key, value] of Object.entries(provider.extraAuth || {})) url.searchParams.set(key, value);
  if (provider.pkce) {
    url.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

async function readJson(response, action) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error || data.error_description) {
    const message = data.error_description || data.error?.message || data.error || `${action} failed (${response.status})`;
    throw new Error(`${action} failed: ${String(message).slice(0, 240)}`);
  }
  return data;
}

async function postForm(url, fields, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(Object.entries(fields).filter(([, value]) => value != null)),
    signal: AbortSignal.timeout(15000)
  });
  return readJson(response, "Provider token exchange");
}

function basicAuth(credentialsValue) {
  return `Basic ${Buffer.from(`${credentialsValue.id}:${credentialsValue.secret}`).toString("base64")}`;
}

async function exchange(platform, code, redirectUri, verifier) {
  const provider = definitions[platform];
  const auth = credentials(platform);
  const common = { code, redirect_uri: redirectUri };
  if (platform === "facebook") {
    const url = new URL(provider.token);
    for (const [key, value] of Object.entries({ client_id: auth.id, client_secret: auth.secret, ...common })) url.searchParams.set(key, value);
    return readJson(await fetch(url, { signal: AbortSignal.timeout(15000) }), "Provider token exchange");
  }
  if (platform === "x") {
    return postForm(provider.token, { ...common, grant_type: "authorization_code", code_verifier: verifier }, { Authorization: basicAuth(auth) });
  }
  if (platform === "pinterest" || platform === "reddit") {
    return postForm(provider.token, { ...common, grant_type: "authorization_code" }, { Authorization: basicAuth(auth) });
  }
  const fields = platform === "tiktok"
    ? { client_key: auth.id, client_secret: auth.secret, code, grant_type: "authorization_code", redirect_uri: redirectUri, code_verifier: verifier }
    : { ...common, client_id: auth.id, client_secret: auth.secret, grant_type: "authorization_code" };
  return postForm(provider.token, fields);
}

async function loadProfile(platform, token) {
  const provider = definitions[platform];
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "User-Agent": "SocialFlow/1.0"
  };
  if (platform === "facebook") {
    const url = new URL(provider.profile);
    url.searchParams.set("access_token", token);
    return readJson(await fetch(url, { headers, signal: AbortSignal.timeout(15000) }), `${provider.name} profile lookup`);
  }
  if (platform === "reddit") headers["User-Agent"] = "web:socialflow:1.0 (account connection)";
  const data = await readJson(await fetch(provider.profile, { headers, signal: AbortSignal.timeout(15000) }), `${provider.name} profile lookup`);
  return platform === "tiktok" ? data.data?.user || {} : platform === "x" ? data.data || {} : data;
}

function normalizeProfile(platform, profile) {
  const id = profile.id || profile.user_id || profile.open_id || profile.sub;
  const displayName = profile.username || profile.display_name || profile.name || profile.full_name || profile.login;
  const avatarUrl = profile.profile_picture_url || profile.threads_profile_picture_url || profile.profile_image_url || profile.picture?.data?.url || profile.picture || profile.avatar_url || profile.icon_img;
  if (!id || !displayName) throw new Error(`Could not read the ${definitions[platform].name} profile. Check the app's requested permissions.`);
  return { id: String(id), displayName: String(displayName), avatarUrl: typeof avatarUrl === "string" ? avatarUrl : null };
}

export async function finishOAuth(platform, code, redirectUri, verifier) {
  if (!definitions[platform] || !credentials(platform)) {
    throw Object.assign(new Error("OAuth provider is not configured"), { status: 503 });
  }
  const tokenData = await exchange(platform, code, redirectUri, verifier);
  const access = tokenData.access_token;
  if (!access) throw new Error(`${definitions[platform].name} did not return an access token.`);
  const profile = normalizeProfile(platform, await loadProfile(platform, access));
  const expiresAt = Number.isFinite(Number(tokenData.expires_in))
    ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
    : null;
  const scope = Array.isArray(tokenData.scope) ? tokenData.scope.join(" ") : tokenData.scope || definitions[platform].scopes.join(" ");
  return {
    ...profile,
    accessToken: access,
    refreshToken: tokenData.refresh_token || null,
    expiresAt,
    scope
  };
}
