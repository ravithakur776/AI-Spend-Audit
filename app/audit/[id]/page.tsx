import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { AuditInput, AuditResult } from "@/lib/auditEngine";
import { getSupabaseClient } from "@/lib/supabase";

type AuditPageParams = {
  id: string;
};

type SupabaseAuditRow = {
  id: string;
  audit_data: unknown;
  created_at: string | null;
};

type PublicAuditRecord = {
  id: string;
  createdAt: string | null;
  auditInput: AuditInput;
  auditResult: AuditResult;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const currencyPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const isAuditInput = (value: unknown): value is AuditInput => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const input = value as Partial<AuditInput>;
  return (
    typeof input.teamSize === "number" &&
    typeof input.primaryUseCase === "string" &&
    Array.isArray(input.tools)
  );
};

const isAuditResult = (value: unknown): value is AuditResult => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Partial<AuditResult>;
  return (
    typeof result.totalMonthlySavings === "number" &&
    typeof result.totalAnnualSavings === "number" &&
    Array.isArray(result.breakdown)
  );
};

const toPublicAuditRecord = (row: SupabaseAuditRow): PublicAuditRecord | null => {
  if (!row.audit_data || typeof row.audit_data !== "object") {
    return null;
  }

  const payload = row.audit_data as {
    auditInput?: unknown;
    auditResult?: unknown;
  };

  if (!isAuditInput(payload.auditInput) || !isAuditResult(payload.auditResult)) {
    return null;
  }

  return {
    id: row.id,
    createdAt: row.created_at,
    auditInput: payload.auditInput,
    auditResult: payload.auditResult,
  };
};

const getPublicAuditById = async (id: string): Promise<PublicAuditRecord | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("audits")
    .select("id, audit_data, created_at")
    .eq("id", id)
    .maybeSingle<SupabaseAuditRow>();

  if (error || !data) {
    return null;
  }

  return toPublicAuditRecord(data);
};

const getBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
};

export async function generateMetadata({
  params,
}: {
  params: Promise<AuditPageParams>;
}): Promise<Metadata> {
  const { id } = await params;
  const audit = await getPublicAuditById(id);

  if (!audit) {
    return {
      title: "Shared AI Spend Audit",
      description: "Explore a public AI spend optimization report.",
    };
  }

  const annualSavings = audit.auditResult.totalAnnualSavings;
  const monthlySavings = audit.auditResult.totalMonthlySavings;
  const title = `I can save ${currency.format(annualSavings)}/yr on AI tools! Check my stack`;
  const description = `This stack identified ${currency.format(monthlySavings)} in monthly savings through pricing alignment and tool consolidation.`;
  const pageUrl = `${getBaseUrl()}/audit/${audit.id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: pageUrl,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function SharedAuditPage({
  params,
}: {
  params: Promise<AuditPageParams>;
}) {
  const { id } = await params;
  const audit = await getPublicAuditById(id);

  if (!audit) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-3xl border border-sky-300/30 bg-linear-to-br from-sky-500/15 via-indigo-500/10 to-cyan-500/10 p-8 shadow-2xl shadow-black/30 sm:p-10">
          <p className="text-xs font-semibold tracking-[0.22em] text-sky-200 uppercase">
            Public AI Spend Audit
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Shared Savings Report
          </h1>
          <p className="mt-3 text-sm text-slate-300 sm:text-base">
            This view intentionally omits personal and company identifiers.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs tracking-wide text-slate-300 uppercase">
                Total Monthly Savings
              </p>
              <p className="mt-3 text-4xl font-black text-white sm:text-6xl">
                {currency.format(audit.auditResult.totalMonthlySavings)}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-300/35 bg-emerald-500/10 p-5 backdrop-blur">
              <p className="text-xs tracking-wide text-emerald-100 uppercase">
                Total Annual Savings
              </p>
              <p className="mt-3 text-4xl font-black text-emerald-100 sm:text-6xl">
                {currency.format(audit.auditResult.totalAnnualSavings)}
              </p>
            </div>
          </div>

          {audit.createdAt && (
            <p className="mt-6 text-xs text-slate-400">
              Generated on {new Date(audit.createdAt).toLocaleDateString("en-US")}
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-white">Tool Stack Inputs</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {audit.auditInput.tools.map((tool, index) => (
              <article
                key={`${tool.toolName}-${tool.currentPlan}-${index}`}
                className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
              >
                <p className="text-sm text-slate-300">{tool.toolName}</p>
                <p className="mt-2 text-lg font-semibold text-white">{tool.currentPlan}</p>
                <p className="mt-2 text-sm text-slate-300">Seats: {tool.seats}</p>
                <p className="mt-2 text-sm text-slate-300">
                  Current Spend: {currencyPrecise.format(tool.currentMonthlySpend)} / month
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-white">Savings Breakdown</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {audit.auditResult.breakdown.map((item, index) => (
              <article
                key={`${item.recommendedAction}-${index}`}
                className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-300">Current &rarr; Recommendation</p>
                  <p className="text-lg font-bold text-emerald-300">
                    +{currencyPrecise.format(item.savingsMonthly)}
                  </p>
                </div>
                <p className="mt-3 text-base font-semibold text-white">
                  {currencyPrecise.format(item.currentSpend)} &rarr; {item.recommendedAction}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{item.reason}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
