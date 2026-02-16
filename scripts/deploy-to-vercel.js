#!/usr/bin/env node
/**
 * Deployment script: validates .env and deploys the frontend to Vercel.
 *
 * Prerequisites:
 *   1. Install Vercel CLI: npm i -g vercel (or use npx)
 *   2. Log in: vercel login
 *   3. Set env vars in Vercel Dashboard (Project → Settings → Environment Variables)
 *      using the same names as in .env (see output of this script).
 *
 * Usage:
 *   node scripts/deploy-to-vercel.js
 *   npm run deploy
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");

// Vercel project ID (frontend)
const VERCEL_PROJECT_ID = "prj_XnSBhxa68DIbJ2gb3hyCZvWSxhrh";

const REQUIRED_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function parseEnv(content) {
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\"/g, '"');
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replace(/\\'/g, "'");
    env[key] = value;
  }
  return env;
}

function main() {
  console.log("Deployment script – Vercel (frontend)\n");

  if (!fs.existsSync(ENV_PATH)) {
    console.error("ERROR: .env file not found at", ENV_PATH);
    console.error("Create .env with the required variables (see .env.example).");
    process.exit(1);
  }

  const envContent = fs.readFileSync(ENV_PATH, "utf8");
  const env = parseEnv(envContent);

  const missing = REQUIRED_ENV_KEYS.filter((k) => !env[k] || env[k].length === 0);
  if (missing.length > 0) {
    console.error("ERROR: .env is missing or empty for:", missing.join(", "));
    process.exit(1);
  }

  console.log("Required env vars present in .env:");
  REQUIRED_ENV_KEYS.forEach((k) => console.log("  -", k));
  console.log("\nEnsure these are set in Vercel: Project → Settings → Environment Variables.");
  console.log("(Use the same names; values can be copied from .env.)\n");

  const run = () => {
    return new Promise((resolve, reject) => {
      const cmd = "npx vercel --prod --yes";
      const child = spawn(cmd, [], {
        cwd: ROOT,
        stdio: "inherit",
        shell: true,
        env: { ...process.env, VERCEL_PROJECT_ID },
      });
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error("Exit " + code))));
    });
  };

  (async () => {
    try {
      console.log("Deploying to Vercel (production)...\n");
      await run();
      console.log("\nDeployment finished.");
    } catch (e) {
      console.error("\nDeployment failed:", e.message);
      process.exit(1);
    }
  })();
}

main();
