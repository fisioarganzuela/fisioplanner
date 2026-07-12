// Cliente Supabase que apunta al proyecto externo del usuario (vdrxstbayoyshukkkzub).
// Ignora .env (que Lovable Cloud regenera) para que preview y GitHub Pages usen la misma BBDD.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = "https://vdrxstbayoyshukkkzub.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkcnhzdGJheW95c2h1a2trenViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4Njk4NTIsImV4cCI6MjA5OTQ0NTg1Mn0.Ldj4Npea5qS1aVNubtrBEvjnTbqThOny5G4ZpMykdUc";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
