import { isClaudeConfigured } from "@/lib/server/claude";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { connection } from "next/server";

/** Tells the client which optional features the server has configured. */
export async function GET() {
  await connection();
  return Response.json({ claude: isClaudeConfigured(), supabase: Boolean(getSupabaseConfig()) });
}
