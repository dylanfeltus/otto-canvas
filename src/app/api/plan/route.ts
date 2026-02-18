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
          content: `You are a creative director planning VISUAL STYLE variations for a design. Given this design request, decide how many distinct visual directions to create (between 2 and 6) and describe each one.

Design request: "${prompt}"

CRITICAL: Each concept must be a VISUAL STYLE DIRECTION (colors, typography, layout style, mood) — NOT a different product, brand, or content idea. Every concept must be a different visual interpretation of the SAME design request above.

WRONG (changing the content/product):
- "SaaS productivity dashboard" when the request was about glasses
- "E-commerce fashion store" when the request was about a restaurant

RIGHT (different visual takes on the same content):
- "Dark premium feel — black backgrounds, gold accents, editorial typography"
- "Bright and playful — vibrant yellows, rounded shapes, friendly layout"
- "Minimal and clean — lots of whitespace, monochrome palette, Swiss typography"

Consider:
- Simple components (buttons, inputs) → 2-3 concepts
- Cards, modals, forms → 3-4 concepts  
- Marketing assets (social cards, banners) → 4-5 concepts
- Full pages (landing, dashboard) → 2-3 concepts (they're complex)

Respond in EXACTLY this JSON format, nothing else:
{"count":N,"concepts":["visual style direction 1","visual style direction 2",...]}`,
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
