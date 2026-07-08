import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/config/env";
import type { Database } from "./types";

let client: SupabaseClient<Database> | null = null;

function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

export function isSupabaseConfigured(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

export async function getSupabaseClient(): Promise<SupabaseClient<Database>> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  if (!client) {
    const { createClient } = await import("@supabase/supabase-js");
    client = createClient<Database>(normalizeSupabaseUrl(config.supabaseUrl!), config.supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return client;
}
