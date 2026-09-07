// =====================================================================
// AURORA SEWA KEBAYA — Seed initial auth users (RUN LOCALLY / CI ONLY)
// Never deploy this file. Never expose the service_role key.
//
// Usage:
//   1) npm install @supabase/supabase-js dotenv   (in a scratch folder or the frontend)
//   2) Create .env.seed (see below) — DO NOT COMMIT
//   3) node scripts/seed_users.mjs
//
// .env.seed:
//   SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role...
//   OWNER_EMAIL=zakiyazkr8@gmail.com
//   OWNER_PASSWORD=aurora123
// =====================================================================
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// minimal .env.seed loader (no dependency required)
try {
  const env = readFileSync(new URL("../.env.seed", import.meta.url), "utf8");
  env.split("\n").forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
} catch { /* rely on shell env */ }

const URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const users = [
  { email: process.env.OWNER_EMAIL || "zakiyazkr8@gmail.com", password: process.env.OWNER_PASSWORD || "aurora123", name: "Owner Aurora", role: "OWNER" },
  { email: "admin@aurora.com", password: "aurora123", name: "Admin Aurora", role: "ADMIN" },
  { email: "kasir@aurora.com", password: "aurora123", name: "Kasir Aurora", role: "KASIR" },
  { email: "staff@aurora.com", password: "aurora123", name: "Staff Aurora", role: "STAFF" },
];

for (const u of users) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email, password: u.password, email_confirm: true,
    user_metadata: { name: u.name, role: u.role },
  });
  if (error) {
    if (String(error.message).includes("already")) { console.log(`• ${u.email} sudah ada, lewati`); continue; }
    console.error(`✗ ${u.email}:`, error.message); continue;
  }
  await admin.from("profiles").upsert({ id: data.user.id, email: u.email, name: u.name, role: u.role, status: "ACTIVE" }, { onConflict: "id" });
  console.log(`✓ Seeded ${u.email} (${u.role})`);
}

console.log("Selesai. Kredensial demo: password 'aurora123'.");
