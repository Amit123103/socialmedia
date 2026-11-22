import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createAuthorizationUrl, finishOAuth, oauthRedirectUri, socialPlatforms } from "../src/social-oauth.js";

test("OAuth platform list reports setup state without exposing credentials", () => {
  const keys = ["SOCIAL_X_CLIENT_ID", "SOCIAL_X_CLIENT_SECRET", "SOCIAL_TIKTOK_CLIENT_KEY", "SOCIAL_TIKTOK_CLIENT_SECRET"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  delete process.env.SOCIAL_X_CLIENT_ID;
  delete process.env.SOCIAL_X_CLIENT_SECRET;
  delete process.env.SOCIAL_TIKTOK_CLIENT_KEY;
  delete process.env.SOCIAL_TIKTOK_CLIENT_SECRET;
  try {
    const platforms = socialPlatforms();
    assert.equal(platforms.find(platform => platform.id === "x").configured, false);
    assert.equal(platforms.find(platform => platform.id === "telegram").configured, false);
    assert.match(platforms.find(platform => platform.id === "tiktok").note, /SOCIAL_TIKTOK_CLIENT_KEY/);
    assert.ok(platforms.every(platform => !("clientSecret" in platform)));
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("X authorization URL includes state, registered callback, and S256 PKCE", () => {
  const keys = ["SOCIAL_X_CLIENT_ID", "SOCIAL_X_CLIENT_SECRET"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.SOCIAL_X_CLIENT_ID = "test-client";
  process.env.SOCIAL_X_CLIENT_SECRET = "test-secret";
  try {
    const verifier = "a".repeat(64);
    const callback = "https://api.example.test/api/social/callback/x";
    const url = new URL(createAuthorizationUrl("x", "one-time-state", verifier, callback));
    assert.equal(url.origin, "https://twitter.com");
    assert.equal(url.searchParams.get("state"), "one-time-state");
    assert.equal(url.searchParams.get("redirect_uri"), callback);
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("code_challenge"), createHash("sha256").update(verifier).digest("base64url"));
    assert.equal(url.href.includes("test-secret"), false);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("OAuth redirects use the configured public API base URL", () => {
  const previous = process.env.API_BASE_URL;
  process.env.API_BASE_URL = "https://api.example.test/";
  try {
    assert.equal(oauthRedirectUri("youtube"), "https://api.example.test/api/social/callback/youtube");
  } finally {
    if (previous === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = previous;
  }
});

test("Instagram OAuth exchanges a code and returns the authenticated profile", async () => {
  const keys = ["SOCIAL_INSTAGRAM_CLIENT_ID", "SOCIAL_INSTAGRAM_CLIENT_SECRET"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  process.env.SOCIAL_INSTAGRAM_CLIENT_ID = "test-client";
  process.env.SOCIAL_INSTAGRAM_CLIENT_SECRET = "test-secret";
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url === "https://api.instagram.com/oauth/access_token") {
      assert.equal(options.method, "POST");
      assert.match(String(options.body), /code=authorization-code/);
      return new Response(JSON.stringify({ access_token: "account-token", user_id: "ig-42", expires_in: 3600 }), { status: 200 });
    }
    assert.match(url, /^https:\/\/graph\.instagram\.com\/me\?/);
    assert.equal(options.headers.Authorization, "Bearer account-token");
    return new Response(JSON.stringify({ user_id: "ig-42", username: "studio", profile_picture_url: "https://img.example.test/profile.jpg" }), { status: 200 });
  };
  try {
    const result = await finishOAuth("instagram", "authorization-code", "https://api.example.test/callback", "verifier");
    assert.equal(result.id, "ig-42");
    assert.equal(result.displayName, "studio");
    assert.equal(result.avatarUrl, "https://img.example.test/profile.jpg");
    assert.equal(result.accessToken, "account-token");
    assert.equal(result.scope, "instagram_business_basic instagram_business_content_publish");
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("Telegram cannot be connected using the OAuth adapter", () => {
  assert.throws(() => createAuthorizationUrl("telegram", "state", "verifier", "https://example.test/callback"), {
    message: "This platform does not support OAuth account linking"
  });
});
