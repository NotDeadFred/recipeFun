import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "../supabase/config";

export class UnauthorizedError extends Error {
  constructor() {
    super("Please sign in first.");
    this.name = "UnauthorizedError";
  }
}

/**
 * When Supabase is configured, API routes that cost money (Claude) or reach
 * out to the web require a signed-in user. In local demo mode there are no
 * accounts, so requests are allowed.
 */
export async function requireUser(request: Request): Promise<{ userId: string | null }> {
  const config = getSupabaseConfig();
  if (!config) return { userId: null };
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new UnauthorizedError();
  const supabase = createClient(config.url, config.anonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new UnauthorizedError();
  return { userId: data.user.id };
}
