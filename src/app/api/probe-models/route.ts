import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const MODELS = [
  "claude-opus-4-6-20250219",
  "claude-sonnet-4-5-20241022",
  "claude-opus-4-0520",
  "claude-sonnet-4-0514",
];

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();
    if (!apiKey) {
      return NextResponse.json({ error: "apiKey required" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    const results = await Promise.allSettled(
      MODELS.map(async (model) => {
        try {
          await client.messages.create({
            model,
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          });
          return { model, available: true };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "";
          // 404 / not_found_error = model not available on this key
          // 401 = bad key entirely
          if (msg.includes("not_found") || msg.includes("404") || msg.includes("Could not resolve")) {
            return { model, available: false };
          }
          // Rate limit or other transient error — assume available
          if (msg.includes("rate") || msg.includes("overloaded")) {
            return { model, available: true };
          }
          // Permission / billing errors — model not available
          return { model, available: false };
        }
      })
    );

    const available: Record<string, boolean> = {};
    for (const r of results) {
      if (r.status === "fulfilled") {
        available[r.value.model] = r.value.available;
      }
    }

    return NextResponse.json({ available });
  } catch (err) {
    console.error("Probe error:", err);
    return NextResponse.json({ error: "Probe failed" }, { status: 500 });
  }
}
