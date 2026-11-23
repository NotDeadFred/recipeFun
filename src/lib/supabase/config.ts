export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/** Supabase is optional: without these variables the app runs in local demo mode. */
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
