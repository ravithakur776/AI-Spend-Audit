import { NextResponse } from "next/server";
import type { AuditResult } from "@/lib/auditEngine";

const SYSTEM_PROMPT =
  "You are a strict, financial auditor. Based on the provided AI tool spend data, write a brutal but professional 1-paragraph (~100 words) summary of their spend efficiency. Highlight the biggest waste.";

const FALLBACK_SUMMARY =
  "Based on our analysis, your AI stack requires optimization. We have identified several key areas where plan adjustments or tool consolidation can yield significant monthly savings.";

type SummaryRequestBody = {
  auditResult?: AuditResult;
  teamSize?: number;
  primaryUseCase?: string;
};

const createUserPrompt = (payload: SummaryRequestBody): string => {
  return [
    "Audit report payload:",
    JSON.stringify(payload, null, 2),
    "Return only one concise paragraph and no bullet points.",
  ].join("\n\n");
};

const callAnthropic = async (
  apiKey: string,
  prompt: string,
): Promise<string> => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 220,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const text =
    data.content
      ?.filter((block) => block.type === "text" && Boolean(block.text))
      .map((block) => block.text?.trim())
      .join(" ") ?? "";

  if (!text) {
    throw new Error("Anthropic returned an empty summary");
  }

  return text;
};

const callOpenAI = async (apiKey: string, prompt: string): Promise<string> => {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 220,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error("OpenAI returned an empty summary");
  }

  return text;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SummaryRequestBody;

    if (!payload.auditResult) {
      throw new Error("Missing auditResult payload");
    }

    const userPrompt = createUserPrompt(payload);
    let summary = "";

    if (process.env.ANTHROPIC_API_KEY) {
      summary = await callAnthropic(process.env.ANTHROPIC_API_KEY, userPrompt);
    } else if (process.env.OPENAI_API_KEY) {
      summary = await callOpenAI(process.env.OPENAI_API_KEY, userPrompt);
    } else {
      throw new Error("No AI provider key configured");
    }

    return NextResponse.json({ summary, usedFallback: false });
  } catch {
    return NextResponse.json({
      summary: FALLBACK_SUMMARY,
      usedFallback: true,
    });
  }
}
