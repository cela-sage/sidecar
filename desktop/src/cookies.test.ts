import assert from "node:assert/strict";
import { createCipheriv, createHash, pbkdf2Sync } from "node:crypto";
import { test } from "node:test";
import { decryptCookie, isExpired, setDetails, widenedTwins } from "./cookies.ts";

type Row = Parameters<typeof setDetails>[0];

function row(over: Partial<Row>): Row {
  return { encrypted_value: new Uint8Array(), expires_utc: 0n, host_key: ".example.com", is_httponly: 0n, is_secure: 1n, name: "x", path: "/", samesite: 1n, ...over };
}

// Encrypts exactly as macOS Chrome does, so the test proves decryptCookie inverts the real format with no Keychain or real cookie.
function encrypt(value: string, key: Buffer, host?: string): Buffer {
  const iv = Buffer.alloc(16, 0x20);
  const prefix = host ? createHash("sha256").update(host).digest() : Buffer.alloc(0);
  const cipher = createCipheriv("aes-128-cbc", key, iv);
  const body = Buffer.concat([cipher.update(Buffer.concat([prefix, Buffer.from(value, "utf8")])), cipher.final()]);
  return Buffer.concat([Buffer.from("v10"), body]);
}

const key = pbkdf2Sync("test-password", "saltysalt", 1003, 16, "sha1");

test("strips the SHA256(host) prefix on a v24 cookie", () => {
  const host = ".example.com";
  assert.equal(decryptCookie(encrypt("session=abc", key, host), key, host)?.value, "session=abc");
});

test("reads a pre-v24 cookie that has no prefix", () => {
  assert.equal(decryptCookie(encrypt("plain", key), key, ".example.com")?.value, "plain");
});

test("keeps an empty value apart from a failed decrypt", () => {
  const host = ".x.com";
  assert.equal(decryptCookie(encrypt("", key, host), key, host)?.value, "");
});

test("skips a blob that is not v10", () => {
  assert.equal(decryptCookie(Buffer.from("v20something"), key, ".x.com"), undefined);
});

test("a __Host- cookie imports host-only, so cookies.set accepts it", () => {
  const o = setDetails(row({ name: "__Host-ant_trusted_device", host_key: "claude.ai", path: "/" }), "tok");
  assert.equal(o.domain, undefined);
  assert.equal(o.path, "/");
  assert.equal(o.secure, true);
  assert.equal(o.url, "https://claude.ai/");
});

test("a domain cookie keeps its domain", () => {
  assert.equal(setDetails(row({ name: "sessionKey", host_key: ".claude.ai" }), "tok").domain, ".claude.ai");
});

test("a host-only cookie imports without a domain, so it is not widened to subdomains", () => {
  const o = setDetails(row({ name: "LSID", host_key: "accounts.google.com" }), "tok");
  assert.equal(o.domain, undefined);
  assert.equal(o.url, "https://accounts.google.com/");
});

test("a host-only cookie gets its widened twin expired by an HttpOnly write, which Chromium lets replace an HttpOnly twin", () => {
  assert.deepEqual(
    widenedTwins([row({ name: "LSID", host_key: "accounts.google.com" })]).map((t) => [t.domain, t.name, t.expirationDate, t.httpOnly]),
    [["accounts.google.com", "LSID", 1, true]],
  );
});

test("no twin is expired for a domain cookie, a __Host- cookie, or one Chrome itself also holds dotted", () => {
  const rows = [
    row({ name: "SID", host_key: ".google.com" }),
    row({ name: "__Host-GAPS", host_key: "accounts.google.com" }),
    row({ name: "OTZ", host_key: "accounts.google.com" }),
    row({ name: "OTZ", host_key: ".accounts.google.com" }),
  ];
  assert.deepEqual(widenedTwins(rows), []);
});

const chromeTime = (unixSeconds: number): bigint => BigInt(Math.round((unixSeconds + 11_644_473_600) * 1_000_000));

test("an expired row is expired, a session or future one is not", () => {
  const now = Date.now() / 1000;
  assert.equal(isExpired(row({ expires_utc: chromeTime(now - 60) })), true);
  assert.equal(isExpired(row({ expires_utc: chromeTime(now + 3600) })), false);
  assert.equal(isExpired(row({ expires_utc: 0n })), false);
});
