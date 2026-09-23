import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

export async function db() {
  const jar = await cookies();
  const { url, key } = supabaseConfig();
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: !["localhost", "127.0.0.1"].includes(new URL(url).hostname),
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (updates) => {
        // Server Components cannot set cookies. Proxy refreshes them before rendering.
        try {
          updates.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Read-only render. */
        }
      },
    },
  });
}
