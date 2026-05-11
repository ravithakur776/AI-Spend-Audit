import "server-only";

import { Resend } from "resend";

export async function sendTransactionalEmail(
  email: string,
  savings: number,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: "AI Spend Audit <no-reply@updates.credex.ai>",
    to: email,
    subject: "Your AI Spend Audit report is ready",
    text: `Thanks for using AI Spend Audit. We identified potential savings of $${savings.toFixed(
      2,
    )} per month. Our team will share deeper recommendations soon.`,
  });
}
