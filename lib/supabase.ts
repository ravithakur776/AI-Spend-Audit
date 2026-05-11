import { getSupabaseClient } from "@/lib/supabaseClient";

export type StoredAuditData = {
  auditInput: unknown;
  auditResult: unknown;
  aiSummary: string;
  createdAt: string;
};

export type SaveAuditLeadInput = {
  email: string;
  company?: string;
  role?: string;
  teamSize: number;
  auditData: StoredAuditData;
};

export const saveAuditLead = async (input: SaveAuditLeadInput): Promise<string> => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("audits")
    .insert({
      email: input.email,
      company: input.company || null,
      role: input.role || null,
      team_size: input.teamSize,
      audit_data: input.auditData,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to save audit lead");
  }

  return data.id;
};
