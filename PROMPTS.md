# AI Prompts Used

**Date Verified:** 2026-05-10

## Personalized Summary Prompt
**Model:** Claude 3 Haiku (or OpenAI GPT-3.5/4o - update based on what Codex used)
**Task:** Generate a 100-word personalized audit summary.

**System Prompt:**
"You are a strict, financial auditor. Based on the provided AI tool spend data, write a brutal but professional 1-paragraph (~100 words) summary of their spend efficiency. Highlight the biggest waste."

**Why I wrote it this way:**
I wanted the tone to feel authoritative and actionable, fitting for a B2B SaaS tool. A "brutal but professional" tone creates urgency, which increases the likelihood of the user booking a consultation with Credex.

**What didn't work:**
Initially, giving the LLM no persona resulted in very generic, robotic summaries that just repeated the math. Adding "strict financial auditor" fixed the tone.
