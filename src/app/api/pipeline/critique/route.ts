import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const DEFAULT_MODEL = "claude-opus-4-6";

function getClient(apiKey?: string): Anthropic {
  if (apiKey) return new Anthropic({ apiKey });
  return new Anthropic();
}

function stripBase64Images(html: string): string {
  return html.replace(/src="(data:image\/[^"]+)"/g, (_match, _dataUri) => {
    return `src="[IMAGE]"`;
  });
}

export async function POST(req: NextRequest) {
  try {
    const { html, prompt, model, apiKey } = await req.json();
    const useModel = model || DEFAULT_MODEL;
    const client = getClient(apiKey);

    const stripped = stripBase64Images(html);

    const message = await client.messages.create({
      model: useModel,
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `You are a design critic. Analyze this HTML/CSS design and provide specific, actionable feedback for improving the NEXT variation.

Original request: "${prompt}"

HTML:
${stripped}

Provide 3-5 bullet points of specific improvements. Focus on:
- What works well (keep this in the next variation)
- What could be better (typography, spacing, color, layout)
- A different creative direction to try

Be specific and concise. This feedback will be injected into the next generation prompt.`,
      }],
    });

    const critique = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ critique });
  } catch (err) {
    console.error("Critique error:", err);
    return NextResponse.json({ critique: "" });
  }
}
