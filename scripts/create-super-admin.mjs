import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadDotEnv() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    console.warn(`.env file not found at ${envPath}, relying on existing process.env`);
    return;
  }

  const contents = fs.readFileSync(envPath, "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

async function main() {
  loadDotEnv();

  const email = "codecorelabs@gmail.com";
  const password = "Password@123";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    console.error("NEXT_PUBLIC_SUPABASE_URL is not set in .env");
    process.exit(1);
  }
  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not set in .env");
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log(`Ensuring user ${email} exists with the given password...`);

  // Try to create the user (idempotent: if exists, we'll handle below)
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    // If the user already exists, this may error with "User already registered"
    if (!createError.message.toLowerCase().includes("already registered")) {
      console.error("Error creating user:", createError.message);
      process.exit(1);
    }
    console.log("User already exists, continuing.");
  } else if (created?.user) {
    console.log("User created:", created.user.id);
  }

  // Fetch the user to get their id
  const { data: list, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError.message);
    process.exit(1);
  }

  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`Could not find user with email ${email} after creation.`);
    process.exit(1);
  }

  // Always set password so login works (fixes "invalid credentials" if user existed with different password)
  const { error: pwdError } = await supabase.auth.admin.updateUserById(user.id, {
    password,
  });
  if (pwdError) {
    console.error("Error setting password:", pwdError.message);
    process.exit(1);
  }
  console.log("Password set to the expected value.");

  console.log(`Promoting user ${email} (id=${user.id}) to super_admin in profiles...`);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role: "super_admin", is_active: true })
    .eq("id", user.id);

  if (updateError) {
    console.error("Error updating profiles role:", updateError.message);
    process.exit(1);
  }

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", user.id);

  if (profileError) {
    console.error("Error verifying profile:", profileError.message);
    process.exit(1);
  }

  console.log("Updated profile:", profiles);
  console.log(`Done. You can now log in with:\n  Email: ${email}\n  Password: ${password}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

