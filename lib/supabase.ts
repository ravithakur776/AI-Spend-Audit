import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export type StoredAuditData = {
  auditInput: unknown;
  auditResult: unknown;
  createdAt: string;
};

export const getSupabaseClient = (): SupabaseClient => {
  if (client) {
    return client;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  client = createClient(url, anonKey);
  return client;
};

export type SaveAuditLeadInput = {
  email: string;
  company?: string;
  role?: string;
  teamSize: number;
  auditData: StoredAuditData;
};

export const saveAuditLead = async (input: SaveAuditLeadInput): Promise<void> => {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from("audits").insert({
    email: input.email,
    company: input.company || null,
    role: input.role || null,
    team_size: input.teamSize,
    audit_data: input.auditData,
  });

  if (error) {
    throw new Error(error.message);
  }
};
