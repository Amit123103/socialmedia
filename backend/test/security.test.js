import test from "node:test";
import assert from "node:assert/strict";
import { encrypt, decrypt, sha, randomToken, accessToken } from "../src/security.js";

test("AES-256-GCM encrypts and decrypts secrets", () => {
  process.env.TOKEN_ENCRYPTION_KEY="test-encryption-key";
  const secret="test-provider-access-token";
  assert.equal(decrypt(encrypt(secret)),secret);
});

test("encrypted values differ because IV is random", () => {
  const one=encrypt("same-secret");
  const two=encrypt("same-secret");
  assert.notEqual(one,two);
});

test("sha and random tokens are stable and unique", () => {
  assert.equal(sha("value"),sha("value"));
  assert.notEqual(randomToken(),randomToken());
});

test("access token identifies the user", () => {
  process.env.JWT_ACCESS_SECRET="test-access-secret";
  const jwt=accessToken({id:42,email:"test@example.com"});
  assert.equal(typeof jwt,"string");
  assert.equal(jwt.split(".").length,3);
});
