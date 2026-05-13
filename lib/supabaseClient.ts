import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = "https://icxztrlqjgzldmhlcifj.supabase.co";
  const supabaseKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHp0cmxxamd6bGRtaGxjaWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Njc4MzEsImV4cCI6MjA5NDA0MzgzMX0.23mXBQDllBe4CQT_iVPBAPfcUnKLMnjZdhm8zW-r4J8";

  supabaseClient = createClient(supabaseUrl, supabaseKey);
  return supabaseClient;
};
