import fs from "node:fs";
import jwt from "jsonwebtoken";

// ---- Required env vars ----
// Apple
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;               // e.g. C698639W97
const APPLE_KEY_ID = process.env.APPLE_KEY_ID;                 // e.g. P469P55MXM
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;           // e.g. com.boatmatey.app.service
const APPLE_P8 = process.env.APPLE_P8;                         // full .p8 contents OR base64
const APPLE_P8_BASE64 = process.env.APPLE_P8_BASE64;           // optional alternative

// Supabase Mgmt API
const SUPABASE_PAT = process.env.SUPABASE_PAT;                 // personal access token
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF; // e.g. lqponcaidadcgvlovymuu

// Optional: choose how long before expiry (max 180 days for Apple)
const DAYS_VALID = Number(process.env.APPLE_JWT_DAYS_VALID ?? "180");

// ---- Basic validation ----
function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
}
requireEnv("APPLE_TEAM_ID", APPLE_TEAM_ID);
requireEnv("APPLE_KEY_ID", APPLE_KEY_ID);
requireEnv("APPLE_CLIENT_ID", APPLE_CLIENT_ID);
requireEnv("SUPABASE_PAT", SUPABASE_PAT);
requireEnv("SUPABASE_PROJECT_REF", SUPABASE_PROJECT_REF);

const privateKey =
  APPLE_P8 ??
  (APPLE_P8_BASE64 ? Buffer.from(APPLE_P8_BASE64, "base64").toString("utf8") : null);

requireEnv("APPLE_P8 or APPLE_P8_BASE64", privateKey);

// ---- Generate Apple client secret JWT ----
const now = Math.floor(Date.now() / 1000);
const exp = now + DAYS_VALID * 24 * 60 * 60;

const appleClientSecret = jwt.sign(
  {
    iss: APPLE_TEAM_ID,
    iat: now,
    exp,
    aud: "https://appleid.apple.com",
    sub: APPLE_CLIENT_ID,
  },
  privateKey,
  {
    algorithm: "ES256",
    keyid: APPLE_KEY_ID,
  }
);

console.log("Generated Apple client secret JWT (first 40 chars):", appleClientSecret.slice(0, 40), "…");

// ---- Update Supabase ----
// NOTE: This matches the endpoint/body you pasted. If Supabase returns 4xx,
// the field name may differ; see the curl section below.
const url = `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth`;

const res = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${SUPABASE_PAT}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    external_apple_secret: appleClientSecret,
  }),
});

const text = await res.text();

if (!res.ok) {
  console.error("Supabase API update failed:", res.status, res.statusText);
  console.error(text);
  process.exit(1);
}

console.log("Supabase Apple secret updated OK.");
console.log(text);
