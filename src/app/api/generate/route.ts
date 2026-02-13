import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Fallback chain — if requested model fails, try next one down
const MODEL_FALLBACK_CHAIN = [
  "claude-opus-4-6",
  "claude-sonnet-4-5",
  "claude-opus-4",
  "claude-sonnet-4",
];

const DEFAULT_MODEL = "claude-sonnet-4-5";

function getClient(apiKey?: string): Anthropic {
  if (apiKey) return new Anthropic({ apiKey });
  return new Anthropic();
}

/** Try a model call, falling back to cheaper models on "not found" errors */
async function callWithFallback(
  client: Anthropic,
  preferredModel: string,
  messages: Anthropic.MessageCreateParams["messages"],
  maxTokens: number
): Promise<{ result: Anthropic.Message; usedModel: string }> {
  // Build fallback list: preferred model first, then remaining chain models
  const idx = MODEL_FALLBACK_CHAIN.indexOf(preferredModel);
  const fallbacks =
    idx >= 0
      ? MODEL_FALLBACK_CHAIN.slice(idx)
      : [preferredModel, ...MODEL_FALLBACK_CHAIN];

  let lastError: unknown;
  for (const model of fallbacks) {
    try {
      const result = await client.messages.create({ model, max_tokens: maxTokens, messages });
      return { result, usedModel: model };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Only fallback on model-not-found / not-available errors
      if (msg.includes("not_found") || msg.includes("404") || msg.includes("model")) {
        console.warn(`Model ${model} unavailable, trying fallback...`);
        lastError = err;
        continue;
      }
      // Any other error (auth, rate limit, etc.) — throw immediately
      throw err;
    }
  }
  throw lastError;
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
    if (message.includes("not_found") || message.includes("404")) {
      return NextResponse.json({ error: "Model not available with this API key. Try a different model in Settings." }, { status: 400 });
    }
    if (message.includes("auth") || message.includes("401") || message.includes("API key")) {
      return NextResponse.json({ error: "Invalid API key. Check your key in Settings." }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function generateVariation(
  client: Anthropic,
  model: string,
  prompt: string,
  style: string,
  index: number
): Promise<{ html: string; label: string; width?: number; height?: number }> {
  const { result: message } = await callWithFallback(client, model, [
    {
      role: "user",
      content: `You are a UI/web designer. Generate a single, self-contained HTML design for the following request.

Design request: "${prompt}"
Style direction: ${style}

IMPORTANT: First output a JSON size hint on its own line, then the HTML. Format:
<!--size:WIDTHxHEIGHT-->

Choose dimensions that match the design type:
- Navigation bar: ~1200x60-80
- Hero section: ~1200x500-700
- Card component: ~350x400
- Modal/dialog: ~500x350
- Full page: ~1200x800
- Sidebar: ~280x600
- Footer: ~1200x200-300
- Form: ~450x500
- Pricing cards: ~1100x500
- Dashboard: ~1200x700

RULES:
- Start with <!--size:WIDTHxHEIGHT--> on the first line (e.g. <!--size:1200x70-->)
- Then the HTML code — no explanation, no markdown, no code fences
- Include ALL CSS inline in a <style> tag
- The design must be self-contained — no external dependencies
- Use modern CSS (flexbox, grid, gradients, shadows)
- Make it look like a real, polished design — not a wireframe
- Use appropriate placeholder text and content
- Set the root element width to match the size hint width
- Use web-safe fonts or system font stack
- Include appropriate padding and spacing
- Make colors, typography, and spacing feel intentional and designed`,
    },
  ], 4096);

  const html =
    message.content[0].type === "text" ? message.content[0].text : "";

  const { html: cleaned, width, height } = parseHtmlWithSize(html);

  return {
    html: cleaned,
    label: `Variation ${index + 1}`,
    width,
    height,
  };
}

async function generateSingle(
  client: Anthropic,
  model: string,
  originalPrompt: string,
  revision: string,
  existingHtml: string
): Promise<{ html: string; label: string; width?: number; height?: number }> {
  const { result: message } = await callWithFallback(client, model, [
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
  ], 4096);

  const html =
    message.content[0].type === "text" ? message.content[0].text : "";

  return {
    html: parseHtmlWithSize(html).html,
    label: "Revised",
  };
}

function parseHtmlWithSize(raw: string): { html: string; width?: number; height?: number } {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:html)?\n?/, "").replace(/\n?```$/, "");
  }
  cleaned = cleaned.trim();

  // Extract size hint: <!--size:WIDTHxHEIGHT-->
  const sizeMatch = cleaned.match(/<!--size:(\d+)x(\d+)-->/);
  let width: number | undefined;
  let height: number | undefined;

  if (sizeMatch) {
    width = parseInt(sizeMatch[1], 10);
    height = parseInt(sizeMatch[2], 10);
    cleaned = cleaned.replace(/<!--size:\d+x\d+-->\n?/, "").trim();
  }

  return { html: cleaned, width, height };
}
