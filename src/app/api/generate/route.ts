import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const VARIATION_STYLES = [
  "Clean and minimal — lots of whitespace, simple typography, subtle colors",
  "Bold and modern — strong colors, large typography, high contrast",
  "Soft and rounded — rounded corners, pastel colors, friendly feel",
  "Sharp and professional — crisp edges, corporate palette, structured layout",
  "Creative and expressive — unique layout, gradients, interesting visual hierarchy",
];

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY not set");
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const { prompt, count = 4, revision, existingHtml } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    // If this is a revision, only generate 1 updated version
    if (revision && existingHtml) {
      const result = await generateSingle(prompt, revision, existingHtml);
      return NextResponse.json({ iterations: [result] });
    }

    // Generate multiple variations in parallel
    const variations = VARIATION_STYLES.slice(0, count);
    const results = await Promise.all(
      variations.map((style, i) => generateVariation(prompt, style, i))
    );

    return NextResponse.json({ iterations: results });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Generation error:", errMsg, err);
    return NextResponse.json(
      { error: `Generation failed: ${errMsg}` },
      { status: 500 }
    );
  }
}

async function generateVariation(
  prompt: string,
  style: string,
  index: number
): Promise<{ html: string; label: string }> {
  const message = await client.messages.create({
    model: "claude-opus-4-0626",
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
  originalPrompt: string,
  revision: string,
  existingHtml: string
): Promise<{ html: string; label: string }> {
  const message = await client.messages.create({
    model: "claude-opus-4-0626",
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
  // Strip markdown code fences if present
  let cleaned = html.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:html)?\n?/, "").replace(/\n?```$/, "");
  }
  return cleaned.trim();
}
