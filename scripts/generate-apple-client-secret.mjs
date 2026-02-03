/**
 * Generate Apple Sign in client secret (JWT)
 *
 * Output:
 *  - Prints a valid Apple client secret JWT
 *  - Copy/paste it into:
 *    Supabase Dashboard → Authentication → Providers → Apple → Secret key
 *
 * Apple hard-limits expiry to 6 months. This cannot be automated in Supabase.
 */

import jwt from "jsonwebtoken";
import fs from "fs";

// -------------------- ENV VARS --------------------
const {
  APPLE_TEAM_ID,
  APPLE_KEY_ID,
  APPLE_CLIENT_ID,
  APPLE_P8_BASE64,
  APPLE_P8_PATH,
} = process.env;

function required(name, value) {
  if (!value) {
    console.error(`❌ Missing environment variable: ${name}`);
    process.exit(1);
  }
}

required("APPLE_TEAM_ID", APPLE_TEAM_ID);
required("APPLE_KEY_ID", APPLE_KEY_ID);
required("APPLE_CLIENT_ID", APPLE_CLIENT_ID);

// -------------------- LOAD PRIVATE KEY --------------------
let privateKey;

if (APPLE_P8_BASE64) {
  privateKey = Buffer.from(APPLE_P8_BASE64, "base64").toString("utf8");
} else if (APPLE_P8_PATH) {
  privateKey = fs.readFileSync(APPLE_P8_PATH, "utf8");
} else {
  console.error("❌ Provide APPLE_P8_BASE64 or APPLE_P8_PATH");
  process.exit(1);
}

// -------------------- BUILD JWT --------------------
const now = Math.floor(Date.now() / 1000);
const expiresIn = 60 * 60 * 24 * 180; // 6 months (Apple max)

const token = jwt.sign(
  {
    iss: APPLE_TEAM_ID,
    iat: now,
    exp: now + expiresIn,
    aud: "https://appleid.apple.com",
    sub: APPLE_CLIENT_ID,
  },
  privateKey,
  {
    algorithm: "ES256",
    keyid: APPLE_KEY_ID,
  }
);

// -------------------- OUTPUT --------------------
console.log("");
console.log("====================================================");
console.log("✅ APPLE CLIENT SECRET (JWT)");
console.log("====================================================");
console.log(token);
console.log("====================================================");
console.log("");
console.log("Paste this value into:");
console.log("Supabase → Authentication → Providers → Apple → Secret key");
console.log("");
console.log("Expiry:", new Date((now + expiresIn) * 1000).toISOString());
console.log("====================================================");
