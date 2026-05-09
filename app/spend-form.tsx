"use client";

import { useEffect, useMemo, useState } from "react";

type PrimaryUseCase = "coding" | "writing" | "data" | "research" | "mixed";
type ToolName =
  | "Cursor"
  | "GitHub Copilot"
  | "Claude"
  | "ChatGPT"
  | "Anthropic API"
  | "OpenAI API"
  | "Gemini"
  | "Windsurf";

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
  "GitHub Copilot": ["Free", "Pro", "Business", "Enterprise"],
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


export default function SpendFormPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [form, setForm] = useState<SpendForm>(DEFAULT_FORM);

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
  const totalSpend = useMemo(() => {
    return form.tools.reduce((acc, tool) => {
      const parsed = Number.parseFloat(tool.monthlySpend);
      return Number.isFinite(parsed) ? acc + parsed : acc;
    }, 0);
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

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Team Size
              </span>
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
              <span className="text-sm font-medium text-slate-700">
                Primary Use Case
              </span>
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
              <h2 className="text-lg font-semibold text-slate-900">
                AI Tools
              </h2>
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
                    <p className="text-sm font-semibold text-slate-700">
                      Tool #{index + 1}
                    </p>
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
                      <span className="text-sm font-medium text-slate-700">
                        Tool Name
                      </span>
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
                      <span className="text-sm font-medium text-slate-700">
                        Plan Type
                      </span>
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
                      <span className="text-sm font-medium text-slate-700">
                        Number of Seats
                      </span>
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
                      <span className="text-sm font-medium text-slate-700">
                        Current Monthly Spend
                      </span>
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

          <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-sky-100 bg-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700">
              {isMounted
                ? "All changes are auto-saved in local storage."
                : "Loading saved state."}
            </p>
            <p className="text-base font-semibold text-slate-900">
              Total Monthly Spend: ${totalSpend.toFixed(2)}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
