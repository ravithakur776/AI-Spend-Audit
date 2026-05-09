export type PrimaryUseCase = "coding" | "writing" | "data" | "research" | "mixed";

export type ToolName =
  | "Cursor"
  | "GitHub Copilot"
  | "Claude"
  | "ChatGPT"
  | "Anthropic API"
  | "OpenAI API"
  | "Gemini"
  | "Windsurf";

export interface AuditToolInput {
  toolName: ToolName;
  currentPlan: string;
  seats: number;
  currentMonthlySpend: number;
}

export interface AuditInput {
  teamSize: number;
  primaryUseCase: PrimaryUseCase;
  tools: AuditToolInput[];
}

export interface AuditBreakdownItem {
  currentSpend: number;
  recommendedAction: string;
  savingsMonthly: number;
  reason: string;
}

export interface AuditResult {
  breakdown: AuditBreakdownItem[];
  totalMonthlySavings: number;
  totalAnnualSavings: number;
}

const PRICING = {
  claudePro: 20,
  claudeTeam: 30,
  copilotIndividual: 10,
  copilotBusiness: 19,
  copilotEnterprise: 39,
  cursorPro: 20,
  cursorBusiness: 40,
  chatGptPlus: 20,
} as const;

const normalizePlan = (plan: string): string => plan.trim().toLowerCase();

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const clampNonNegative = (value: number): number => (value > 0 ? value : 0);

const isCopilotCodingPlan = (plan: string): boolean => {
  const normalized = normalizePlan(plan);
  return (
    normalized === "individual" ||
    normalized === "pro" ||
    normalized === "business" ||
    normalized === "enterprise"
  );
};

const isExpensiveCodingTool = (tool: AuditToolInput): boolean => {
  const plan = normalizePlan(tool.currentPlan);

  if (tool.toolName === "Cursor") {
    return plan === "pro" || plan === "business" || plan === "enterprise";
  }

  if (tool.toolName === "GitHub Copilot") {
    return isCopilotCodingPlan(plan);
  }

  return false;
};

export function calculateAudit(input: AuditInput): AuditResult {
  const breakdown: AuditBreakdownItem[] = [];
  const consumedTools = new Set<number>();

  const addBreakdownItem = (
    currentSpend: number,
    recommendedAction: string,
    savingsMonthly: number,
    reason: string,
  ) => {
    const sanitizedCurrentSpend = roundCurrency(Math.max(currentSpend, 0));
    const sanitizedSavings = roundCurrency(clampNonNegative(savingsMonthly));

    if (sanitizedSavings <= 0) {
      return;
    }

    breakdown.push({
      currentSpend: sanitizedCurrentSpend,
      recommendedAction,
      savingsMonthly: sanitizedSavings,
      reason,
    });
  };

  // Rule 1: Over-provisioned Claude Team.
  input.tools.forEach((tool, index) => {
    const plan = normalizePlan(tool.currentPlan);
    if (tool.toolName !== "Claude" || plan !== "team" || consumedTools.has(index)) {
      return;
    }

    if (tool.seats < 5) {
      const optimizedSpend = tool.seats * PRICING.claudePro;
      const savings = tool.currentMonthlySpend - optimizedSpend;

      addBreakdownItem(
        tool.currentMonthlySpend,
        `Downgrade Claude Team to Claude Pro for ${tool.seats} seat(s).`,
        savings,
        "Claude Team has a 5-seat minimum, so Claude Pro is cheaper for smaller active usage.",
      );

      if (savings > 0) {
        consumedTools.add(index);
      }
    }
  });

  // Rule 2: Single-seat business plans should move to individual/pro plans.
  input.tools.forEach((tool, index) => {
    if (consumedTools.has(index) || tool.seats !== 1) {
      return;
    }

    const plan = normalizePlan(tool.currentPlan);

    if (tool.toolName === "GitHub Copilot" && plan === "business") {
      const savings = tool.currentMonthlySpend - PRICING.copilotIndividual;

      addBreakdownItem(
        tool.currentMonthlySpend,
        "Switch GitHub Copilot Business to Copilot Individual.",
        savings,
        "Single-seat teams typically do not benefit from business-tier Copilot features.",
      );

      if (savings > 0) {
        consumedTools.add(index);
      }
    }

    if (tool.toolName === "Cursor" && plan === "business") {
      const savings = tool.currentMonthlySpend - PRICING.cursorPro;

      addBreakdownItem(
        tool.currentMonthlySpend,
        "Switch Cursor Business to Cursor Pro.",
        savings,
        "Cursor Business pricing is usually unnecessary for a single-seat setup.",
      );

      if (savings > 0) {
        consumedTools.add(index);
      }
    }
  });

  // Rule 3: Writing/research teams paying for coding-heavy tools.
  if (input.primaryUseCase === "writing" || input.primaryUseCase === "research") {
    const recommendedTool =
      input.primaryUseCase === "writing" ? "Claude Pro" : "ChatGPT Plus";

    input.tools.forEach((tool, index) => {
      if (consumedTools.has(index) || !isExpensiveCodingTool(tool)) {
        return;
      }

      const optimizedSpend = tool.seats * PRICING.chatGptPlus;
      const savings = tool.currentMonthlySpend - optimizedSpend;

      addBreakdownItem(
        tool.currentMonthlySpend,
        `Replace ${tool.toolName} ${tool.currentPlan} with ${recommendedTool}.`,
        savings,
        "Your primary workload is not coding-heavy, so a general assistant plan is typically more cost-effective.",
      );

      if (savings > 0) {
        consumedTools.add(index);
      }
    });
  }

  // Rule 4: Consolidate overlapping single-user ChatGPT Plus and Claude Pro subscriptions.
  if (input.teamSize === 1) {
    const chatGptIndex = input.tools.findIndex(
      (tool) =>
        tool.toolName === "ChatGPT" &&
        normalizePlan(tool.currentPlan) === "plus" &&
        tool.seats === 1 &&
        !consumedTools.has(input.tools.indexOf(tool)),
    );

    const claudeProIndex = input.tools.findIndex(
      (tool) =>
        tool.toolName === "Claude" &&
        normalizePlan(tool.currentPlan) === "pro" &&
        tool.seats === 1 &&
        !consumedTools.has(input.tools.indexOf(tool)),
    );

    if (chatGptIndex !== -1 && claudeProIndex !== -1) {
      const keepClaude =
        input.primaryUseCase === "writing" || input.primaryUseCase === "research";
      const dropIndex = keepClaude ? chatGptIndex : claudeProIndex;
      const droppedTool = input.tools[dropIndex];
      const savings = droppedTool.currentMonthlySpend;

      addBreakdownItem(
        droppedTool.currentMonthlySpend,
        keepClaude
          ? "Drop ChatGPT Plus and keep Claude Pro."
          : "Drop Claude Pro and keep ChatGPT Plus.",
        savings,
        "Both subscriptions overlap heavily for a single user, so keeping one reduces duplicate spend.",
      );

      if (savings > 0) {
        consumedTools.add(dropIndex);
      }
    }
  }

  const totalMonthlySavings = roundCurrency(
    breakdown.reduce((sum, item) => sum + item.savingsMonthly, 0),
  );
  const totalAnnualSavings = roundCurrency(totalMonthlySavings * 12);

  if (breakdown.length === 0) {
    return {
      breakdown: [
        {
          currentSpend: roundCurrency(
            input.tools.reduce((sum, tool) => sum + Math.max(tool.currentMonthlySpend, 0), 0),
          ),
          recommendedAction: "You are perfectly optimized. Keep your current stack.",
          savingsMonthly: 0,
          reason: "Your plans already match the lowest practical cost for your current usage.",
        },
      ],
      totalMonthlySavings: 0,
      totalAnnualSavings: 0,
    };
  }

  return {
    breakdown,
    totalMonthlySavings,
    totalAnnualSavings,
  };
}
