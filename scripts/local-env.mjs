import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const config = JSON.parse(
  execFileSync(
    "npx",
    ["--no-install", "supabase", "status", "--output", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ),
);
if (!["127.0.0.1", "localhost"].includes(new URL(config.API_URL).hostname))
  throw new Error("Only a local Supabase instance is allowed.");
if (!config.ANON_KEY || !config.SERVICE_ROLE_KEY)
  throw new Error("Missing local API keys.");
const publicEnv = `NEXT_PUBLIC_SUPABASE_URL=${config.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${config.ANON_KEY}\n`;
writeFileSync(".env.local", publicEnv, { mode: 0o600 });
writeFileSync(
  ".env.test.local",
  publicEnv + `SUPABASE_SERVICE_ROLE_KEY=${config.SERVICE_ROLE_KEY}\n`,
  { mode: 0o600 },
);
console.log(
  "Local application/test environment configured. Keys were not printed.",
);
