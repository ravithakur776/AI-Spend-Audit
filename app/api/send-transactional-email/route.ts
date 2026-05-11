import { NextResponse } from "next/server";

import { sendTransactionalEmail } from "@/lib/sendTransactionalEmail";

type TransactionalEmailRequest = {
  email?: string;
  savings?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TransactionalEmailRequest;

    if (!body.email || typeof body.savings !== "number") {
      return NextResponse.json(
        { ok: false, error: "Missing required payload fields" },
        { status: 400 },
      );
    }

    await sendTransactionalEmail(body.email, body.savings);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to send transactional email" },
      { status: 500 },
    );
  }
}
