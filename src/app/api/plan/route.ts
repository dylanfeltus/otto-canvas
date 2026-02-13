import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

function getClient(apiKey?: string): Anthropic {
  if (apiKey) return new Anthropic({ apiKey });
  return new Anthropic();
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, apiKey, model } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    const client = getClient(apiKey);

    const message = await client.messages.create({
      model: model || "claude-sonnet-4-5-20250514",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are a creative director planning design variations. Given this design request, decide how many distinct concepts to create (between 2 and 6) and describe each one in a short phrase.

Design request: "${prompt}"

Consider:
- Simple components (buttons, inputs) → 2-3 concepts
- Cards, modals, forms → 3-4 concepts  
- Marketing assets (social cards, banners) → 4-5 concepts
- Full pages (landing, dashboard) → 2-3 concepts (they're complex)

Respond in EXACTLY this JSON format, nothing else:
{"count":N,"concepts":["concept 1 description","concept 2 description",...]}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    
    try {
      // Extract JSON from response (handle markdown wrapping)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]);
        const count = Math.min(Math.max(Number(plan.count) || 4, 2), 6);
        const concepts = (plan.concepts || []).slice(0, count);
        return NextResponse.json({ count, concepts });
      }
    } catch {}

    // Fallback
    return NextResponse.json({ count: 4, concepts: [] });
  } catch (err) {
    console.error("Plan error:", err);
    // Fallback on any error — don't block generation
    return NextResponse.json({ count: 4, concepts: [] });
  }
}
