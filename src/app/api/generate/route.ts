import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const DEFAULT_MODEL = "claude-opus-4-20250514";

function getClient(apiKey?: string): Anthropic {
  if (apiKey) return new Anthropic({ apiKey });
  return new Anthropic();
}

const VARIATION_STYLES = [
  "Clean and minimal — lots of whitespace, simple typography, subtle colors",
  "Bold and modern — strong colors, large typography, high contrast",
  "Soft and rounded — rounded corners, pastel colors, friendly feel",
  "Sharp and professional — crisp edges, corporate palette, structured layout",
  "Creative and expressive — unique layout, gradients, interesting visual hierarchy",
];

export async function POST(req: NextRequest) {
  try {
    const { prompt, count = 4, revision, existingHtml, apiKey, model } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    const client = getClient(apiKey);
    const useModel = model || DEFAULT_MODEL;

    if (revision && existingHtml) {
      const result = await generateSingle(client, useModel, prompt, revision, existingHtml);
      return NextResponse.json({ iterations: [result] });
    }

    const variations = VARIATION_STYLES.slice(0, count);
    const results = await Promise.all(
      variations.map((style, i) => generateVariation(client, useModel, prompt, style, i))
    );

    return NextResponse.json({ iterations: results });
  } catch (err: unknown) {
    console.error("Generation error:", err);
    const message = err instanceof Error ? err.message : "Failed to generate designs";
    const status = message.includes("auth") || message.includes("API key") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function generateVariation(
  client: Anthropic,
  model: string,
  prompt: string,
  style: string,
  index: number
): Promise<{ html: string; label: string }> {
  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a UI/web designer. Generate a single, self-contained HTML design for the following request.

Design request: "${prompt}"
Style direction: ${style}

IMPORTANT RULES:
- Return ONLY the HTML code, no explanation, no markdown, no code fences
- Include ALL CSS inline in a <style> tag at the top
- The design must be self-contained — no external dependencies
- Use modern CSS (flexbox, grid, gradients, shadows)
- Make it look like a real, polished design — not a wireframe
- Use appropriate placeholder text and content
- Maximum width: 400px for components, 800px for full pages
- Set an explicit width on the root element
- Use web-safe fonts or system font stack
- Include appropriate padding and spacing
- Make colors, typography, and spacing feel intentional and designed`,
      },
    ],
  });

  const html =
    message.content[0].type === "text" ? message.content[0].text : "";

  return {
    html: cleanHtml(html),
    label: `Variation ${index + 1}`,
  };
}

async function generateSingle(
  client: Anthropic,
  model: string,
  originalPrompt: string,
  revision: string,
  existingHtml: string
): Promise<{ html: string; label: string }> {
  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a UI/web designer. Here is an existing HTML design:

${existingHtml}

The original request was: "${originalPrompt}"

The user wants this specific revision: "${revision}"

IMPORTANT RULES:
- Return ONLY the updated HTML code, no explanation, no markdown, no code fences
- Keep the same overall structure and style
- Apply ONLY the requested revision
- Include ALL CSS inline in a <style> tag at the top
- The design must be self-contained — no external dependencies
- Maintain the same width and layout approach`,
      },
    ],
  });

  const html =
    message.content[0].type === "text" ? message.content[0].text : "";

  return {
    html: cleanHtml(html),
    label: "Revised",
  };
}

function cleanHtml(html: string): string {
  let cleaned = html.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:html)?\n?/, "").replace(/\n?```$/, "");
  }
  return cleaned.trim();
}
