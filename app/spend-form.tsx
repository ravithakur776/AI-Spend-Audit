"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateAudit,
  type AuditInput,
  type AuditResult,
  type PrimaryUseCase,
  type ToolName,
} from "@/lib/auditEngine";
import { saveAuditLead } from "@/lib/supabase";

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
  const [aiSummary, setAiSummary] = useState("");
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [leadForm, setLeadForm] = useState<LeadForm>(DEFAULT_LEAD_FORM);
  const [isLeadCaptured, setIsLeadCaptured] = useState(false);
  const [isLeadSubmitting, setIsLeadSubmitting] = useState(false);
  const [leadError, setLeadError] = useState("");

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

  useEffect(() => {
    if (view !== "results" || !auditResult || !isLeadCaptured) {
      return;
    }

    let cancelled = false;
    const rafId = window.requestAnimationFrame(() => {
      void (async () => {
        try {
          const response = await fetch("/api/generate-summary", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              auditResult,
              teamSize: parseSeats(form.teamSize),
              primaryUseCase: form.primaryUseCase || "mixed",
            }),
          });

          const data = (await response.json()) as { summary?: string };
          if (!cancelled) {
            setAiSummary(data.summary || FALLBACK_SUMMARY);
          }
        } catch {
          if (!cancelled) {
            setAiSummary(FALLBACK_SUMMARY);
          }
        } finally {
          if (!cancelled) {
            setIsSummaryLoading(false);
          }
        }
      })();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [auditResult, form.primaryUseCase, form.teamSize, isLeadCaptured, view]);

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
    setAiSummary("");
    setIsSummaryLoading(false);
    setLeadForm(DEFAULT_LEAD_FORM);
    setIsLeadCaptured(false);
    setIsLeadSubmitting(false);
    setLeadError("");
  };

  const handleLeadCaptureSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!auditResult) {
      return;
    }

    if (leadForm.honeypot.trim().length > 0) {
      setLeadError("");
      setIsLeadCaptured(true);
      setIsSummaryLoading(true);
      return;
    }

    if (!isValidEmail(leadForm.email)) {
      setLeadError("Please enter a valid work email address.");
      return;
    }

    setIsLeadSubmitting(true);
    setLeadError("");

    try {
      const auditInput = toAuditInput(form);

      await saveAuditLead({
        email: leadForm.email.trim(),
        company: leadForm.company.trim(),
        role: leadForm.role.trim(),
        teamSize: parseSeats(form.teamSize),
        auditData: {
          auditInput,
          auditResult,
          createdAt: new Date().toISOString(),
        },
      });

      void fetch("/api/send-transactional-email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: leadForm.email.trim(),
          savings: auditResult.totalMonthlySavings,
        }),
      });

      setIsLeadCaptured(true);
      setIsSummaryLoading(true);
    } catch {
      setLeadError(
        "We could not save your report right now. Please try again in a moment.",
      );
    } finally {
      setIsLeadSubmitting(false);
    }
  };

  const isHighSavings = (auditResult?.totalMonthlySavings ?? 0) > 500;
  const isLowSavings = (auditResult?.totalMonthlySavings ?? 0) < 100;

  if (view === "results" && auditResult) {
    return (
      <div className="min-h-screen bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <section className="overflow-hidden rounded-3xl border border-sky-400/30 bg-linear-to-br from-sky-500/20 via-indigo-500/15 to-cyan-500/10 p-8 shadow-2xl shadow-black/40 sm:p-10">
            <p className="text-xs font-semibold tracking-[0.24em] text-sky-200 uppercase">
              Audit Results
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              You have a clear savings opportunity.
            </h1>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                <p className="text-xs tracking-wide text-slate-300 uppercase">
                  Total Monthly Savings
                </p>
                <p className="mt-3 text-4xl font-black text-white sm:text-6xl">
                  {currency.format(auditResult.totalMonthlySavings)}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-5 backdrop-blur">
                <p className="text-xs tracking-wide text-emerald-100 uppercase">
                  Total Annual Savings
                </p>
                <p className="mt-3 text-4xl font-black text-emerald-100 sm:text-6xl">
                  {currency.format(auditResult.totalAnnualSavings)}
                </p>
              </div>
            </div>
          </section>

          {isHighSavings && (
            <section className="rounded-2xl border border-amber-300/40 bg-linear-to-r from-amber-300/15 to-orange-300/15 p-5 sm:p-6">
              <p className="text-lg font-semibold text-amber-100 sm:text-xl">
                Stop wasting {currency.format(auditResult.totalAnnualSavings)}/yr. Credex can help you capture these savings instantly.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Book Credex Consultation
              </button>
            </section>
          )}

          {isLowSavings && (
            <section className="rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-5 sm:p-6">
              <p className="text-lg font-semibold text-emerald-100">
                You are spending well! Your stack is nearly optimal.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={notificationEmail}
                  onChange={(event) => setNotificationEmail(event.target.value)}
                  placeholder="Notify me when new optimizations apply"
                  className="w-full rounded-xl border border-emerald-200/40 bg-slate-950/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-emerald-100/60 focus:border-emerald-200 focus:ring-4 focus:ring-emerald-200/20"
                />
                <button
                  type="button"
                  className="rounded-xl border border-emerald-200/70 px-4 py-2.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-100/10"
                >
                  Notify Me
                </button>
              </div>
            </section>
          )}

          {!isLeadCaptured && (
            <section className="rounded-3xl border border-white/20 bg-white/5 p-6 sm:p-8">
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
                  <span className="text-sm text-slate-300">Work Email</span>
                  <input
                    type="email"
                    required
                    value={leadForm.email}
                    onChange={(event) =>
                      setLeadForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    placeholder="you@company.com"
                    className="w-full rounded-xl border border-slate-500/50 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-300/20"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Company (Optional)</span>
                  <input
                    type="text"
                    value={leadForm.company}
                    onChange={(event) =>
                      setLeadForm((prev) => ({ ...prev, company: event.target.value }))
                    }
                    placeholder="Credex"
                    className="w-full rounded-xl border border-slate-500/50 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-300/20"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Role (Optional)</span>
                  <input
                    type="text"
                    value={leadForm.role}
                    onChange={(event) =>
                      setLeadForm((prev) => ({ ...prev, role: event.target.value }))
                    }
                    placeholder="Engineering Manager"
                    className="w-full rounded-xl border border-slate-500/50 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-300/20"
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

                {leadError && (
                  <p className="md:col-span-2 text-sm text-rose-300">{leadError}</p>
                )}

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={isLeadSubmitting}
                    className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isLeadSubmitting ? "Saving report..." : "Unlock Full Report"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {isLeadCaptured && (
            <>
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
                <p className="text-xs font-semibold tracking-[0.2em] text-sky-200 uppercase">
                  AI Auditor Summary
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-200 sm:text-base">
                  {isSummaryLoading
                    ? "Generating personalized audit summary..."
                    : aiSummary || FALLBACK_SUMMARY}
                </p>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-2xl font-semibold text-white">Tool-by-Tool Breakdown</h2>
                  <button
                    type="button"
                    onClick={() => setView("form")}
                    className="rounded-xl border border-slate-400/50 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                  >
                    Edit Inputs
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {auditResult.breakdown.map((item, index) => (
                    <article
                      key={`${item.recommendedAction}-${index}`}
                      className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-medium text-slate-300">Current Spend &rarr; Recommended Action</p>
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
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-sky-50 via-white to-indigo-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-3xl border border-white/80 bg-white/80 p-6 shadow-lg shadow-slate-300/40 backdrop-blur sm:p-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-sky-600 uppercase">
            AI Spend Audit
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Spend Input Form
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Capture your current AI tooling and monthly spend baseline. Your
            progress is auto-saved locally so refreshing the page won&apos;t
            lose changes.
          </p>
        </section>

        <form
          onSubmit={handleSubmitAudit}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Team Size</span>
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
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-200"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Primary Use Case</span>
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
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-200"
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
              <h2 className="text-lg font-semibold text-slate-900">AI Tools</h2>
              <button
                type="button"
                onClick={addTool}
                className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200 sm:w-auto"
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
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">Tool #{index + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeTool(tool.id)}
                      disabled={form.tools.length === 1}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">Tool Name</span>
                      <select
                        value={tool.toolName}
                        onChange={(event) =>
                          updateTool(tool.id, "toolName", event.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-200"
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
                      <span className="text-sm font-medium text-slate-700">Plan Type</span>
                      <select
                        value={tool.planType}
                        disabled={!tool.toolName}
                        onChange={(event) =>
                          updateTool(tool.id, "planType", event.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-sky-500 focus:ring-4 focus:ring-sky-200"
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
                      <span className="text-sm font-medium text-slate-700">Number of Seats</span>
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={tool.seats}
                        onChange={(event) =>
                          updateTool(tool.id, "seats", event.target.value)
                        }
                        placeholder="e.g. 6"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-200"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">Current Monthly Spend</span>
                      <div className="relative">
                        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-500">
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
                          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-3 pl-7 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-200"
                        />
                      </div>
                    </label>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700">
              {isMounted
                ? "All changes are auto-saved in local storage."
                : "Loading saved state..."}
            </p>
            <p className="text-base font-semibold text-slate-900">
              Current Monthly Spend: {currencyPrecise.format(currentTotalSpend)}
            </p>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300"
            >
              Run Spend Audit
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
