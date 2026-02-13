import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

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
  "Refined and premium — think Stripe or Linear. Subtle gradients, generous whitespace, sophisticated color palette, polished micro-details",
  "Bold and expressive — vibrant colors, large confident typography, strong visual hierarchy, creative use of shapes and color blocks",
  "Warm and approachable — friendly rounded shapes, warm color palette, inviting feel, natural and human-centered",
  "Dark and dramatic — dark backgrounds, glowing accents, cinematic feel, high contrast, moody atmosphere",
];

export async function POST(req: NextRequest) {
  try {
    const { prompt, count = 4, revision, existingHtml, apiKey, model, variationIndex, concept, systemPrompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    const client = getClient(apiKey);
    const useModel = model || DEFAULT_MODEL;

    if (revision && existingHtml) {
      const style = variationIndex !== undefined ? VARIATION_STYLES[variationIndex] || VARIATION_STYLES[0] : undefined;
      const result = await generateSingle(client, useModel, prompt, revision, existingHtml, style, variationIndex, systemPrompt);
      return NextResponse.json({ iteration: result });
    }

    // Single variation mode (sequential generation from frontend)
    if (variationIndex !== undefined) {
      const style = concept || VARIATION_STYLES[variationIndex] || VARIATION_STYLES[0];
      const result = await generateVariation(client, useModel, prompt, style, variationIndex, systemPrompt);
      return NextResponse.json({ iteration: result });
    }

    // Legacy: generate all at once
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
  index: number,
  systemPrompt?: string
): Promise<{ html: string; label: string; width?: number; height?: number }> {
  const customInstructions = systemPrompt ? `\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${systemPrompt}\n` : "";

  const { result: message } = await callWithFallback(client, model, [
    {
      role: "user",
      content: `You are a world-class visual designer. Generate a stunning, self-contained HTML/CSS design.${customInstructions}

Design request: "${prompt}"
Style direction: ${style}

FIRST, determine the design category:
- MARKETING (social media cards, banners, ads, email headers, OG images) → Focus on visual impact, bold typography, abstract/decorative graphics via CSS. NO buttons, NO forms, NO interactive elements. Think poster design, not web UI.
- UI COMPONENT (navbars, forms, modals, cards, settings panels) → Focus on usability, clean layout, proper interactive patterns.
- FULL PAGE (landing pages, dashboards, pricing pages, blog layouts) → Full composition with sections, proper information hierarchy.

SIZE — output a size comment on the FIRST line:
<!--size:WIDTHxHEIGHT-->

Size guidelines:
- Social media card/banner: 1200x630
- Instagram post: 1080x1080
- Navigation bar: 1200x70
- Hero section: 1200x600
- Card component: 380x420
- Modal/dialog: 500x380
- Full page: 1200x800
- Dashboard: 1200x700
- Email header: 600x300

DESIGN QUALITY RULES:
- Create CSS-only decorative elements: gradients, radial-gradient circles, box-shadows for glows, border-radius shapes, pseudo-elements for abstract graphics
- Use rich color palettes — not just gray/blue. Think gradients, accent colors, complementary tones
- Typography matters: vary font sizes dramatically for hierarchy (48-72px headlines, 14-16px body)
- Add visual texture: subtle patterns, layered shadows, glassmorphism, noise via repeating-radial-gradient
- For marketing: fewer words, bigger type, more visual drama
- For UI: proper spacing, clear labels, realistic placeholder content

OUTPUT RULES:
- First line: <!--size:WIDTHxHEIGHT-->
- Then HTML only — no explanation, no markdown, no code fences
- ALL CSS in a <style> tag at the top
- Self-contained — no external dependencies, no images (use CSS shapes/gradients instead)
- Use system font stack: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- Root element width must match the size hint
- IMPORTANT: Keep CSS concise. Avoid overly verbose styles. The HTML body content matters more than elaborate CSS animations.`,
    },
  ], 8192);

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
  existingHtml: string,
  styleVariation?: string,
  variationIndex?: number,
  systemPrompt?: string
): Promise<{ html: string; label: string; width?: number; height?: number }> {
  const customInstructions = systemPrompt ? `\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${systemPrompt}\n` : "";
  const styleInstruction = styleVariation
    ? `\n\nStyle direction for THIS variation: ${styleVariation}\nMake this variation feel distinctly different from others while keeping the same concept and revision.`
    : "";

  const { result: message } = await callWithFallback(client, model, [
    {
      role: "user",
      content: `You are a world-class visual designer.${customInstructions}

Here is an existing HTML design:

${existingHtml}

The original request was: "${originalPrompt}"

The user wants to REMIX this design: "${revision}"${styleInstruction}

OUTPUT FORMAT:
- Start with <!--size:WIDTHxHEIGHT--> on the first line
- Then the HTML — no explanation, no markdown, no code fences
- Include ALL CSS inline in a <style> tag
- Self-contained, no external dependencies
- Create something that feels like a distinct variation, not a copy
- Use the same dimensions unless the remix specifically changes the format`,
    },
  ], 8192);

  const html =
    message.content[0].type === "text" ? message.content[0].text : "";

  const parsed = parseHtmlWithSize(html);
  return {
    html: parsed.html,
    label: variationIndex !== undefined ? `Remix ${variationIndex + 1}` : "Revised",
    width: parsed.width,
    height: parsed.height,
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
