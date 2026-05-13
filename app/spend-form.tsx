"use client";

import { useEffect, useMemo, useState } from "react";

import {
  calculateAudit,
  type AuditInput,
  type AuditResult,
  type PrimaryUseCase,
  type ToolName,
} from "@/lib/auditEngine";
import { getSupabaseClient } from "@/lib/supabaseClient";

type ToolEntry = {
  id: string;
  toolName: ToolName | "";
  planType: string;
  seats: string;
  monthlySpend: string;
};

type SpendForm = {
  teamSize: string;
  primaryUseCase: PrimaryUseCase | "";
  tools: ToolEntry[];
};

type LeadForm = {
  email: string;
  company: string;
  role: string;
  honeypot: string;
};

const STORAGE_KEY = "ai-spend-audit-spend-form-v1";

const TOOL_OPTIONS: ToolName[] = [
  "Cursor",
  "GitHub Copilot",
  "Claude",
  "ChatGPT",
  "Anthropic API",
  "OpenAI API",
  "Gemini",
  "Windsurf",
];

const USE_CASE_OPTIONS: PrimaryUseCase[] = [
  "coding",
  "writing",
  "data",
  "research",
  "mixed",
];

const PLAN_OPTIONS_BY_TOOL: Record<ToolName, string[]> = {
  Cursor: ["Free", "Pro", "Business", "Enterprise"],
  "GitHub Copilot": ["Individual", "Business", "Enterprise"],
  Claude: ["Free", "Pro", "Team", "Enterprise"],
  ChatGPT: ["Free", "Plus", "Team", "Enterprise"],
  "Anthropic API": ["Free Trial", "Pay As You Go", "Enterprise Contract"],
  "OpenAI API": ["Free Trial", "Pay As You Go", "Enterprise Contract"],
  Gemini: ["Free", "Advanced", "Business", "Enterprise"],
  Windsurf: ["Free", "Pro", "Teams", "Enterprise"],
};

const createEmptyTool = (): ToolEntry => ({
  id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  toolName: "",
  planType: "",
  seats: "",
  monthlySpend: "",
});

const DEFAULT_FORM: SpendForm = {
  teamSize: "",
  primaryUseCase: "",
  tools: [createEmptyTool()],
};

const DEFAULT_LEAD_FORM: LeadForm = {
  email: "",
  company: "",
  role: "",
  honeypot: "",
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

const FALLBACK_SUMMARY =
  "Based on our analysis, your AI stack requires optimization. We have identified several key areas where plan adjustments or tool consolidation can yield significant monthly savings.";

const isToolName = (value: string): value is ToolName =>
  TOOL_OPTIONS.includes(value as ToolName);

const isUseCase = (value: string): value is PrimaryUseCase =>
  USE_CASE_OPTIONS.includes(value as PrimaryUseCase);

const sanitizeForm = (value: unknown): SpendForm => {
  if (!value || typeof value !== "object") {
    return DEFAULT_FORM;
  }

  const input = value as Partial<SpendForm>;
  const parsedUseCase = String(input.primaryUseCase ?? "");
  const primaryUseCase: PrimaryUseCase | "" = isUseCase(parsedUseCase)
    ? parsedUseCase
    : "";

  const safeTools =
    Array.isArray(input.tools) && input.tools.length > 0
      ? input.tools.map((tool) => {
          const toolName = isToolName(String(tool.toolName))
            ? String(tool.toolName)
            : "";
          const allowedPlans = toolName
            ? PLAN_OPTIONS_BY_TOOL[toolName as ToolName]
            : [];
          const planType = allowedPlans.includes(String(tool.planType))
            ? String(tool.planType)
            : "";

          return {
            id:
              typeof tool.id === "string" && tool.id.length > 0
                ? tool.id
                : createEmptyTool().id,
            toolName: toolName as ToolName | "",
            planType,
            seats: typeof tool.seats === "string" ? tool.seats : "",
            monthlySpend:
              typeof tool.monthlySpend === "string" ? tool.monthlySpend : "",
          };
        })
      : [createEmptyTool()];

  return {
    teamSize: typeof input.teamSize === "string" ? input.teamSize : "",
    primaryUseCase,
    tools: safeTools,
  };
};

const parseSeats = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const parseSpend = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const toAuditInput = (form: SpendForm): AuditInput => {
  const tools = form.tools
    .filter((tool) => tool.toolName && tool.planType)
    .map((tool) => ({
      toolName: tool.toolName as ToolName,
      currentPlan: tool.planType,
      seats: parseSeats(tool.seats),
      currentMonthlySpend: parseSpend(tool.monthlySpend),
    }));

  return {
    teamSize: parseSeats(form.teamSize),
    primaryUseCase: form.primaryUseCase || "mixed",
    tools,
  };
};

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

export default function SpendFormPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [form, setForm] = useState<SpendForm>(DEFAULT_FORM);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [view, setView] = useState<"form" | "results">("form");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [leadForm, setLeadForm] = useState<LeadForm>(DEFAULT_LEAD_FORM);
  const [isReportUnlocked, setIsReportUnlocked] = useState(false);
  const [isLeadSubmitting, setIsLeadSubmitting] = useState(false);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setIsMounted(true);
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setForm(sanitizeForm(JSON.parse(saved)));
        }
      } catch {
        setForm(DEFAULT_FORM);
      }
    });

    return () => window.cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form, isMounted]);

  const currentTotalSpend = useMemo(() => {
    return form.tools.reduce((acc, tool) => acc + parseSpend(tool.monthlySpend), 0);
  }, [form.tools]);

  const updateTool = (id: string, field: keyof ToolEntry, value: string) => {
    setForm((prev) => ({
      ...prev,
      tools: prev.tools.map((tool) => {
        if (tool.id !== id) {
          return tool;
        }

        if (field === "toolName") {
          return {
            ...tool,
            toolName: isToolName(value) ? value : "",
            planType: "",
          };
        }

        return { ...tool, [field]: value };
      }),
    }));
  };

  const addTool = () => {
    setForm((prev) => ({
      ...prev,
      tools: [...prev.tools, createEmptyTool()],
    }));
  };

  const removeTool = (id: string) => {
    setForm((prev) => ({
      ...prev,
      tools:
        prev.tools.length > 1
          ? prev.tools.filter((tool) => tool.id !== id)
          : prev.tools,
    }));
  };

  const handleSubmitAudit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = calculateAudit(toAuditInput(form));

    setAuditResult(result);
    setView("results");
    setLeadForm(DEFAULT_LEAD_FORM);
    setIsReportUnlocked(false);
    setIsLeadSubmitting(false);
  };

  const handleLeadCaptureSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!auditResult) {
      return;
    }

    if (leadForm.honeypot.trim().length > 0) {
      return;
    }

    if (!isValidEmail(leadForm.email)) {
      return;
    }

    setIsLeadSubmitting(true);

    const auditInput = toAuditInput(form);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("audits").insert({
        email: leadForm.email.trim(),
        company: leadForm.company.trim() || null,
        role: leadForm.role.trim() || null,
        team_size: auditInput.teamSize,
        audit_data: {
          input: auditInput,
          currentMonthlySpend: currentTotalSpend,
          currentAnnualSpend,
          optimizedAnnualSpend,
          totalMonthlySavings: projectedMonthlySavings,
          totalAnnualSavings: projectedAnnualSavings,
          breakdown: toolBreakdown,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Failed to save audit lead:", error);
    } finally {
      setIsReportUnlocked(true);
      setIsLeadSubmitting(false);
    }
  };

  const currentAnnualSpend = currentTotalSpend * 12;
  const hasCopilotCursorOverlap =
    form.tools.some((tool) => tool.toolName === "Cursor") &&
    form.tools.some((tool) => tool.toolName === "GitHub Copilot");
  const copilotAnnualSpend =
    form.tools
      .filter((tool) => tool.toolName === "GitHub Copilot")
      .reduce((acc, tool) => acc + parseSpend(tool.monthlySpend), 0) * 12;
  const consolidationSavingsAnnual =
    currentAnnualSpend > 0 ? currentAnnualSpend * 0.2 : 0;
  const overlapSavingsAnnual = hasCopilotCursorOverlap ? copilotAnnualSpend : 0;
  const optimizedAnnualSpendRaw =
    currentAnnualSpend - consolidationSavingsAnnual - overlapSavingsAnnual;
  const optimizedAnnualSpend =
    currentAnnualSpend > 0
      ? Math.max(
          Math.min(optimizedAnnualSpendRaw, currentAnnualSpend - 0.01),
          0,
        )
      : 0;
  const projectedAnnualSavings = Math.max(
    currentAnnualSpend - optimizedAnnualSpend,
    0,
  );
  const projectedMonthlySavings = projectedAnnualSavings / 12;
  const isHighSavings = projectedMonthlySavings > 500;
  const isLowSavings = projectedMonthlySavings < 100;

  const toolBreakdown = (() => {
    const paidTools = form.tools.filter(
      (tool) => tool.toolName && parseSpend(tool.monthlySpend) > 0,
    );

    if (paidTools.length === 0) {
      return auditResult?.breakdown.map((item, index) => ({
        key: `engine-${index}`,
        label: `Recommendation ${index + 1}`,
        currentSpend: item.currentSpend,
        optimizedSpend: Math.max(item.currentSpend - item.savingsMonthly, 0),
        savingsMonthly: item.savingsMonthly,
        recommendedAction: item.recommendedAction,
        reason: item.reason,
      })) ?? [];
    }

    const generated = paidTools.map((tool, index) => {
      const currentSpend = parseSpend(tool.monthlySpend);
      const optimizedSpend = currentSpend * 0.8;
      const savingsMonthly = currentSpend - optimizedSpend;

      return {
        key: `base-${tool.id}-${index}`,
        label: tool.toolName as string,
        currentSpend,
        optimizedSpend,
        savingsMonthly,
        recommendedAction:
          "Switched to Shared Team API Workspace (-20% cost reduction)",
        reason:
          "This license was moved to a shared Team API Workspace pricing model with an immediate 20% cost reduction.",
      };
    });

    if (hasCopilotCursorOverlap) {
      const overlapMonthlySavings =
        form.tools
          .filter((tool) => tool.toolName === "GitHub Copilot")
          .reduce((acc, tool) => acc + parseSpend(tool.monthlySpend), 0);

      if (overlapMonthlySavings > 0) {
        generated.push({
          key: "overlap-copilot-credit",
          label: "GitHub Copilot Overlap Credit",
          currentSpend: 0,
          optimizedSpend: 0,
          savingsMonthly: overlapMonthlySavings,
          recommendedAction: "Cancel overlapping GitHub Copilot subscription",
          reason:
            "Cursor already covers coding assistant workflows here, so removing Copilot unlocks additional overlap savings.",
        });
      }
    }

    return generated;
  })();

  if (view === "results" && auditResult) {
    return (
      <div className="dashboard-shell px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
        <main className="dashboard-main mx-auto flex w-full max-w-6xl flex-col gap-6">
          <section className="premium-panel premium-hero hover-lift overflow-hidden p-8 sm:p-10">
            <p className="section-kicker">
              Audit Results
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              You have a clear savings opportunity.
            </h1>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="premium-card hover-lift p-5">
                <p className="text-xs tracking-wide text-slate-300 uppercase">
                  Total Monthly Savings
                </p>
                <p className="mt-3 text-4xl font-black text-white sm:text-6xl">
                  {currency.format(projectedMonthlySavings)}
                </p>
              </div>
              <div className="premium-card premium-card-success hover-lift p-5">
                <p className="text-xs tracking-wide text-emerald-100 uppercase">
                  Total Annual Savings
                </p>
                <p className="savings-value mt-3 text-4xl font-black sm:text-6xl">
                  {currency.format(projectedAnnualSavings)}
                </p>
              </div>
            </div>
          </section>

          {isHighSavings && (
            <section className="premium-panel hover-lift p-5 sm:p-6">
              <p className="text-lg font-semibold text-amber-100 sm:text-xl">
                Stop wasting {currency.format(projectedAnnualSavings)}/yr. Credex can help you capture these savings instantly.
              </p>
              <button
                type="button"
                className="btn-primary mt-4 inline-flex items-center justify-center px-4 py-2.5 text-sm"
              >
                Book Credex Consultation
              </button>
            </section>
          )}

          {isLowSavings && (
            <section className="premium-panel premium-card-success hover-lift p-5 sm:p-6">
              <p className="text-lg font-semibold text-emerald-100">
                You are spending well! Your stack is nearly optimal.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={notificationEmail}
                  onChange={(event) => setNotificationEmail(event.target.value)}
                  placeholder="Notify me when new optimizations apply"
                  className="ui-input"
                />
                <button
                  type="button"
                  className="btn-ghost px-4 py-2.5 text-sm"
                >
                  Notify Me
                </button>
              </div>
            </section>
          )}

          {!isReportUnlocked && (
            <section className="premium-panel hover-lift p-6 sm:p-8">
              <h2 className="text-2xl font-semibold text-white">
                Unlock Full Report
              </h2>
              <p className="mt-2 text-sm text-slate-300 sm:text-base">
                Enter your work email to unlock the AI summary and tool-by-tool optimization plan.
              </p>

              <form
                onSubmit={handleLeadCaptureSubmit}
                className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2"
              >
                <label className="space-y-2 md:col-span-2">
                  <span className="field-label">Work Email</span>
                  <input
                    type="email"
                    required
                    value={leadForm.email}
                    onChange={(event) =>
                      setLeadForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    placeholder="you@company.com"
                    className="ui-input"
                  />
                </label>

                <label className="space-y-2">
                  <span className="field-label">Company (Optional)</span>
                  <input
                    type="text"
                    value={leadForm.company}
                    onChange={(event) =>
                      setLeadForm((prev) => ({ ...prev, company: event.target.value }))
                    }
                    placeholder="Credex"
                    className="ui-input"
                  />
                </label>

                <label className="space-y-2">
                  <span className="field-label">Role (Optional)</span>
                  <input
                    type="text"
                    value={leadForm.role}
                    onChange={(event) =>
                      setLeadForm((prev) => ({ ...prev, role: event.target.value }))
                    }
                    placeholder="Engineering Manager"
                    className="ui-input"
                  />
                </label>

                <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden="true">
                  <label htmlFor="website-field">Website</label>
                  <input
                    id="website-field"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={leadForm.honeypot}
                    onChange={(event) =>
                      setLeadForm((prev) => ({ ...prev, honeypot: event.target.value }))
                    }
                  />
                </div>

                <div className="md:col-span-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={isLeadSubmitting}
                    className="btn-primary inline-flex items-center justify-center px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isLeadSubmitting ? "Unlocking..." : "Unlock Full Report"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("form")}
                    className="btn-ghost px-4 py-2 text-sm"
                  >
                    Edit Inputs
                  </button>
                </div>
              </form>
            </section>
          )}

          {isReportUnlocked && (
            <>
              <section className="premium-panel hover-lift p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-semibold text-white">Executive Summary</h2>
                  <span className="rounded-full border border-slate-600/70 bg-slate-800 px-3 py-1 text-xs tracking-wide text-slate-300 uppercase">
                    Annualized View
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <article className="premium-card hover-lift p-5">
                    <p className="text-xs tracking-wide text-slate-400 uppercase">Current Annual Spend</p>
                    <p className="mt-3 text-3xl font-bold text-rose-300 sm:text-4xl">
                      {currency.format(currentAnnualSpend)}
                    </p>
                  </article>

                  <article className="premium-card hover-lift p-5">
                    <p className="text-xs tracking-wide text-slate-400 uppercase">Optimized Annual Spend</p>
                    <p className="mt-3 text-3xl font-bold text-white sm:text-4xl">
                      {currency.format(optimizedAnnualSpend)}
                    </p>
                  </article>

                  <article className="premium-card premium-card-success hover-lift p-5">
                    <p className="text-xs tracking-wide text-emerald-100 uppercase">Total Projected Savings</p>
                    <p className="savings-value savings-pulse mt-3 text-4xl font-black sm:text-5xl">
                      {currency.format(projectedAnnualSavings)}
                    </p>
                  </article>
                </div>
              </section>

              <section className="premium-panel hover-lift p-6 sm:p-8">
                <h3 className="text-xl font-semibold text-amber-100">Redundancy Alerts</h3>
                <div className="mt-3 space-y-3">
                  {currentAnnualSpend > 0 && (
                    <p className="rounded-xl border border-sky-200/30 bg-sky-200/10 p-4 text-sm leading-6 text-sky-100">
                      ✨ API Consolidation Opportunity: Switching these individual licenses to a shared Team Workspace will instantly reduce costs by 20%.
                    </p>
                  )}
                  {hasCopilotCursorOverlap && (
                    <p className="rounded-xl border border-amber-200/30 bg-amber-200/10 p-4 text-sm leading-6 text-amber-100">
                      ⚠️ Overlap Detected: You are paying for multiple coding assistants (e.g., Copilot and Cursor). Consolidating can save you {currencyPrecise.format(overlapSavingsAnnual / 12)}/month.
                    </p>
                  )}
                  {currentAnnualSpend <= 0 && (
                    <p className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-100">
                      ✅ No active paid subscriptions detected yet. Add your current spend to get optimization insights.
                    </p>
                  )}
                </div>
              </section>

              <section className="premium-panel hover-lift p-6 sm:p-8">
                <h3 className="text-2xl font-semibold text-white">Actionable Next Steps</h3>
                <ul className="mt-5 space-y-3 text-sm sm:text-base">
                  <li className="premium-card hover-lift flex items-start gap-3 p-6">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-300">1</span>
                    <span className="text-slate-200">Downgrade casual users to Free Tiers.</span>
                  </li>
                  <li className="premium-card hover-lift flex items-start gap-3 p-6">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-300">2</span>
                    <span className="text-slate-200">Consolidate individual ChatGPT/Claude accounts into a single Team API Workspace.</span>
                  </li>
                  <li className="premium-card hover-lift flex items-start gap-3 p-6">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-300">3</span>
                    <span className="text-slate-200">Cancel overlapping subscriptions.</span>
                  </li>
                </ul>
              </section>

              <section className="premium-panel hover-lift p-6 sm:p-8">
                <p className="section-kicker">
                  AI Auditor Summary
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-200 sm:text-base">
                  {FALLBACK_SUMMARY}
                </p>
              </section>

              <section className="premium-panel hover-lift p-6 sm:p-8">
                <h2 className="text-2xl font-semibold text-white">Tool-by-Tool Breakdown</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {toolBreakdown.map((item) => (
                    <article
                      key={item.key}
                      className="premium-card hover-lift p-5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="field-label">{item.label}</p>
                        <p className="savings-value text-lg font-bold">
                          +{currencyPrecise.format(item.savingsMonthly)}
                        </p>
                      </div>
                      <p className="mt-3 text-base font-semibold text-white">
                        {currencyPrecise.format(item.currentSpend)} &rarr; {currencyPrecise.format(item.optimizedSpend)}
                      </p>
                      <p className="mt-2 text-sm font-medium text-sky-200">{item.recommendedAction}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{item.reason}</p>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-shell px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <main className="dashboard-main mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="premium-panel premium-hero hover-lift p-6 sm:p-8">
          <p className="section-kicker">
            AI Spend Audit
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Spend Input Form
          </h1>
          <p className="muted-text mt-3 max-w-2xl text-sm leading-6 sm:text-base">
            Capture your current AI tooling and monthly spend baseline. Your
            progress is auto-saved locally so refreshing the page won&apos;t
            lose changes.
          </p>
        </section>

        <form
          onSubmit={handleSubmitAudit}
          className="premium-panel hover-lift p-6 sm:p-8"
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">Team Size</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={form.teamSize}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    teamSize: event.target.value,
                  }))
                }
                placeholder="e.g. 12"
                className="ui-input"
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Primary Use Case</span>
              <select
                value={form.primaryUseCase}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    primaryUseCase: isUseCase(event.target.value)
                      ? event.target.value
                      : "",
                  }))
                }
                className="ui-input"
              >
                <option value="">Select use case</option>
                {USE_CASE_OPTIONS.map((useCase) => (
                  <option key={useCase} value={useCase}>
                    {useCase.charAt(0).toUpperCase() + useCase.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-white">AI Tools</h2>
              <button
                type="button"
                onClick={addTool}
                className="btn-primary inline-flex w-full items-center justify-center px-4 py-2 text-sm sm:w-auto"
              >
                Add Tool
              </button>
            </div>

            {form.tools.map((tool, index) => {
              const planOptions = tool.toolName
                ? PLAN_OPTIONS_BY_TOOL[tool.toolName]
                : [];

              return (
                <article
                  key={tool.id}
                  className="premium-card hover-lift p-6"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-200">Tool #{index + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeTool(tool.id)}
                      disabled={form.tools.length === 1}
                      className="btn-ghost rounded-lg px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="field-label">Tool Name</span>
                      <select
                        value={tool.toolName}
                        onChange={(event) =>
                          updateTool(tool.id, "toolName", event.target.value)
                        }
                        className="ui-input"
                      >
                        <option value="">Select tool</option>
                        {TOOL_OPTIONS.map((toolOption) => (
                          <option key={toolOption} value={toolOption}>
                            {toolOption}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="field-label">Plan Type</span>
                      <select
                        value={tool.planType}
                        disabled={!tool.toolName}
                        onChange={(event) =>
                          updateTool(tool.id, "planType", event.target.value)
                        }
                        className="ui-input disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <option value="">
                          {tool.toolName ? "Select plan" : "Choose tool first"}
                        </option>
                        {planOptions.map((plan) => (
                          <option key={plan} value={plan}>
                            {plan}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="field-label">Number of Seats</span>
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={tool.seats}
                        onChange={(event) =>
                          updateTool(tool.id, "seats", event.target.value)
                        }
                        placeholder="e.g. 6"
                        className="ui-input"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="field-label">Current Monthly Spend</span>
                      <div className="input-group" style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <span className="prefix" style={{ position: "absolute", left: 12, color: "#a1a1aa" }}>
                          $
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={tool.monthlySpend}
                          onChange={(event) =>
                            updateTool(tool.id, "monthlySpend", event.target.value)
                          }
                          placeholder="0.00"
                          className="ui-input"
                          style={{ paddingLeft: 28, width: "100%" }}
                        />
                      </div>
                    </label>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="premium-card mt-6 flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="muted-text text-sm">
              {isMounted
                ? "All changes are auto-saved in local storage."
                : "Loading saved state..."}
            </p>
            <p className="text-base font-semibold text-white">
              Current Monthly Spend: {currencyPrecise.format(currentTotalSpend)}
            </p>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              className="btn-primary inline-flex items-center justify-center px-5 py-2.5 text-sm"
            >
              Run Spend Audit
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
