import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";

export const maxDuration = 300;

const DEFAULT_MODEL = "claude-sonnet-4-5";

// --- Clients ---

function getAnthropicClient(apiKey?: string): Anthropic {
  if (apiKey) return new Anthropic({ apiKey });
  return new Anthropic();
}

function getGeminiClient(apiKey?: string): GoogleGenAI | null {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

// --- Types ---

interface PipelineRequest {
  prompt: string;
  style: string;
  index: number;
  model?: string;
  apiKey?: string;
  geminiKey?: string;
  unsplashKey?: string;
  openaiKey?: string;
  systemPrompt?: string;
  critique?: string;
  enableImages?: boolean;
  enableQA?: boolean;
  availableSources?: string[]; // e.g. ["unsplash", "dalle", "gemini"]
  revision?: string;
  existingHtml?: string;
}

type ImageSource = "unsplash" | "dalle" | "gemini";

interface Placeholder {
  id: string;
  description: string;
  width: number;
  height: number;
  source: ImageSource;
  query?: string; // Unsplash search query
}

// --- Streaming response helpers ---

function encodeStage(stage: string, progress: number, data?: Record<string, unknown>) {
  return `data: ${JSON.stringify({ type: "stage", stage, progress, ...data })}\n\n`;
}

function encodeResult(html: string, label: string, width?: number, height?: number) {
  return `data: ${JSON.stringify({ type: "result", html, label, width, height })}\n\n`;
}

function encodePreview(html: string, width?: number, height?: number) {
  return `data: ${JSON.stringify({ type: "preview", html, width, height })}\n\n`;
}

function encodeError(message: string) {
  return `data: ${JSON.stringify({ type: "error", message })}\n\n`;
}

function encodeCritique(critique: string) {
  return `data: ${JSON.stringify({ type: "critique", critique })}\n\n`;
}

// --- Pipeline stages ---

/** Stage 1: Generate layout HTML with image placeholders */
async function generateLayout(
  client: Anthropic,
  model: string,
  prompt: string,
  style: string,
  systemPrompt?: string,
  critique?: string,
  availableSources?: string[],
): Promise<{ html: string; width?: number; height?: number }> {
  const critiqueBlock = critique
    ? `\n\nIMPROVEMENT FEEDBACK from previous variation (apply these learnings):\n${critique}\n`
    : "";
  const customBlock = systemPrompt
    ? `\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${systemPrompt}\n`
    : "";

  const message = await client.messages.create({
    model,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are a world-class visual designer. Generate a stunning, self-contained HTML/CSS design.${customBlock}${critiqueBlock}

Design request: "${prompt}"
Style direction: ${style}

⚠️ MANDATORY IMAGE PLACEHOLDERS — YOU MUST INCLUDE THESE:
Every design MUST contain at least 1-3 image placeholder divs. This is NON-NEGOTIABLE.
Do NOT use colored boxes, CSS gradients, or background-image as substitutes for real imagery.
Do NOT use <img> tags with URLs. Use ONLY placeholder divs in this EXACT format:

<div data-placeholder="DESCRIPTION" data-ph-w="WIDTH" data-ph-h="HEIGHT" data-img-source="SOURCE" data-img-query="SEARCH_TERMS" style="width:WIDTHpx;height:HEIGHTpx;background:#e5e7eb;display:flex;align-items:center;justify-content:center;border-radius:8px;overflow:hidden;">
  <span style="color:#9ca3af;font-size:12px;text-align:center;padding:8px;">DESCRIPTION</span>
</div>

REQUIRED ATTRIBUTES on every placeholder:
- data-placeholder = detailed image description/prompt
- data-ph-w / data-ph-h = pixel dimensions that fit the layout
- data-img-source = which image API to use: "unsplash", "dalle", or "gemini"
- data-img-query = search terms (especially important for Unsplash)

${availableSources && availableSources.length > 0
  ? `AVAILABLE IMAGE SOURCES (choose the best one for each placeholder):
${availableSources.includes("unsplash") ? '- "unsplash" — BEST for real photographs: landscapes, people, food, architecture, objects, nature, office spaces. Use when the design needs photographic imagery.\n' : ""}${availableSources.includes("dalle") ? '- "dalle" — BEST for custom illustrations, abstract art, specific scenes that don\'t exist as stock photos, conceptual imagery, stylized graphics.\n' : ""}${availableSources.includes("gemini") ? '- "gemini" — BEST for design assets, UI elements, icons, patterns, textures, decorative graphics.\n' : ""}
Choose the source that best matches what each placeholder needs. If the user specifies a source in their prompt (e.g., "photo from Unsplash"), use that source.`
  : 'Set data-img-source="gemini" for all placeholders (only source available).'}

Rules:
- Include 1-6 placeholders per design — hero images, product photos, team photos, backgrounds, etc.
- Use CSS gradients ONLY for decorative/abstract accents, NOT as replacements for photographs
- All data attributes are REQUIRED — they trigger the image generation pipeline

SIZE — output a size comment on the FIRST line:
<!--size:WIDTHxHEIGHT-->

DESIGN QUALITY RULES:
- Rich color palettes, gradients, accent colors
- Strong typography hierarchy (48-72px headlines, 14-16px body)
- Visual texture: layered shadows, glassmorphism, patterns
- System font stack: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif

ABSOLUTELY NO MOTION:
- No CSS animations, transitions, @keyframes, hover effects

OUTPUT:
- First line: <!--size:WIDTHxHEIGHT-->
- Then HTML only — no explanation, no markdown, no code fences
- ALL CSS in a <style> tag at the top
- Self-contained, no external dependencies
- Generate exactly ONE design`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  return parseHtmlWithSize(raw);
}

/** Stage 1 (revision mode): Edit existing HTML with a targeted change */
async function generateRevision(
  client: Anthropic,
  model: string,
  originalPrompt: string,
  revision: string,
  existingHtml: string,
  systemPrompt?: string,
): Promise<{ html: string; width?: number; height?: number }> {
  const customBlock = systemPrompt
    ? `\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${systemPrompt}\n`
    : "";

  const message = await client.messages.create({
    model,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are a world-class visual designer. You are EDITING an existing design — not creating a new one.${customBlock}

Here is the EXISTING HTML design:

${existingHtml}

The original request was: "${originalPrompt}"

The user wants this specific change: "${revision}"

CRITICAL RULES:
- Return exactly ONE design — the existing design with ONLY the requested change applied
- Do NOT generate multiple variations, alternatives, or options
- Do NOT stack multiple versions vertically or horizontally
- PRESERVE the existing layout, structure, and content
- ONLY modify what was specifically requested — change nothing else

IMAGE PLACEHOLDERS — where the design needs a NEW photo/visual (only if the revision requires new imagery):
- Use: <div data-placeholder="DESCRIPTION" data-ph-w="WIDTH" data-ph-h="HEIGHT" style="width:WIDTHpx;height:HEIGHT px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;border-radius:8px;overflow:hidden;">
    <span style="color:#9ca3af;font-size:12px;text-align:center;padding:8px;">DESCRIPTION</span>
  </div>
- Keep any existing <img> tags as-is unless the revision specifically asks to change them

ABSOLUTELY NO MOTION — no CSS animations, transitions, @keyframes, hover effects.

SIZE — output a size comment on the FIRST line:
<!--size:WIDTHxHEIGHT-->

OUTPUT: HTML only — no explanation, no markdown, no code fences. ALL CSS in a <style> tag.`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  return parseHtmlWithSize(raw);
}

/** Parse placeholder elements from HTML */
function parsePlaceholders(html: string, availableSources: string[]): Placeholder[] {
  const placeholders: Placeholder[] = [];
  // Match placeholder divs — source and query are optional in the regex
  const regex = /data-placeholder="([^"]+)"\s+data-ph-w="(\d+)"\s+data-ph-h="(\d+)"(?:\s+data-img-source="([^"]*)")?(?:\s+data-img-query="([^"]*)")?/g;
  let match;
  let idx = 0;
  const defaultSource: ImageSource = availableSources.includes("unsplash") ? "unsplash" : availableSources.includes("dalle") ? "dalle" : "gemini";
  while ((match = regex.exec(html)) !== null) {
    let source = (match[4] || defaultSource) as ImageSource;
    // Fallback if specified source isn't available
    if (!availableSources.includes(source)) {
      source = defaultSource;
    }
    placeholders.push({
      id: `ph-${idx++}`,
      description: match[1],
      width: parseInt(match[2], 10),
      height: parseInt(match[3], 10),
      source,
      query: match[5] || undefined,
    });
  }
  return placeholders;
}

/** Generate a single image via Unsplash search API */
async function generateUnsplashImage(ph: Placeholder, unsplashKey: string): Promise<string | null> {
  const query = ph.query || ph.description;
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=${ph.width > ph.height * 1.3 ? "landscape" : ph.height > ph.width * 1.3 ? "portrait" : "squarish"}`;
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${unsplashKey}` },
  });
  if (!res.ok) {
    console.error(`[pipeline] Unsplash API error: ${res.status} ${res.statusText}`);
    return null;
  }
  const data = await res.json();
  const photo = data.results?.[0];
  if (!photo) {
    console.warn(`[pipeline] Unsplash: no results for "${query}"`);
    return null;
  }
  // Use the raw URL with size params for exact dimensions
  return `${photo.urls.raw}&w=${ph.width}&h=${ph.height}&fit=crop&auto=format`;
}

/** Generate a single image via OpenAI DALL-E */
async function generateDalleImage(ph: Placeholder, openaiKey: string): Promise<string | null> {
  // DALL-E 3 supports 1024x1024, 1024x1792, 1792x1024
  const size = ph.width > ph.height * 1.3 ? "1792x1024" : ph.height > ph.width * 1.3 ? "1024x1792" : "1024x1024";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: `${ph.description}. Clean, professional design asset suitable for web/marketing. No text unless specifically requested.`,
      n: 1,
      size,
      response_format: "b64_json",
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error(`[pipeline] DALL-E API error: ${res.status}`, err.slice(0, 200));
    return null;
  }
  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) return null;
  return `data:image/png;base64,${b64}`;
}

/** Generate a single image via Gemini */
async function generateGeminiImage(ph: Placeholder, geminiKey: string): Promise<string | null> {
  const gemini = getGeminiClient(geminiKey);
  if (!gemini) return null;
  const response = await gemini.models.generateContent({
    model: "gemini-2.0-flash-preview-image-generation",
    contents: `Generate a high quality design asset image: ${ph.description}. Clean, professional, suitable for web/marketing design. No text unless specifically requested. Output only the image.`,
    config: { responseModalities: ["image", "text"] },
  });
  const parts = response.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        const b64 = part.inlineData.data;
        const mime = part.inlineData.mimeType;
        if (b64) return `data:${mime};base64,${b64}`;
      }
    }
  }
  return null;
}

/** Stage 2: Generate images for placeholders — routes to appropriate API per placeholder */
async function generateImages(
  placeholders: Placeholder[],
  keys: { geminiKey?: string; unsplashKey?: string; openaiKey?: string },
): Promise<Map<number, string>> {
  const imageMap = new Map<number, string>();
  if (placeholders.length === 0) return imageMap;

  // Build fallback chain based on available keys
  const fallbackChain: ImageSource[] = [];
  if (keys.unsplashKey) fallbackChain.push("unsplash");
  if (keys.openaiKey) fallbackChain.push("dalle");
  if (keys.geminiKey) fallbackChain.push("gemini");

  if (fallbackChain.length === 0) {
    console.warn("[pipeline] No image API keys available — skipping image generation");
    return imageMap;
  }

  console.log(`[pipeline] Generating ${placeholders.length} images, available sources: ${fallbackChain.join(", ")}`);

  // Process in batches of 3 to respect rate limits
  const batchSize = 3;
  for (let i = 0; i < placeholders.length; i += batchSize) {
    const batch = placeholders.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async (ph, batchIdx) => {
        const globalIdx = i + batchIdx;
        // Build source order: preferred source first, then fallbacks
        const sources = [ph.source, ...fallbackChain.filter(s => s !== ph.source)];

        for (const source of sources) {
          try {
            let result: string | null = null;
            switch (source) {
              case "unsplash":
                if (keys.unsplashKey) result = await generateUnsplashImage(ph, keys.unsplashKey);
                break;
              case "dalle":
                if (keys.openaiKey) result = await generateDalleImage(ph, keys.openaiKey);
                break;
              case "gemini":
                if (keys.geminiKey) result = await generateGeminiImage(ph, keys.geminiKey);
                break;
            }
            if (result) {
              console.log(`[pipeline] Image ${globalIdx}: ${source} ✓`);
              imageMap.set(globalIdx, result);
              return;
            }
            console.warn(`[pipeline] Image ${globalIdx}: ${source} returned null, trying next`);
          } catch (err) {
            console.error(`[pipeline] Image ${globalIdx}: ${source} failed:`, err instanceof Error ? err.message : err);
          }
        }
        console.warn(`[pipeline] Image ${globalIdx}: all sources exhausted, keeping placeholder`);
      })
    );
  }

  return imageMap;
}

/** Stage 3: Composite — swap placeholders for generated images */
function compositeImages(html: string, placeholders: Placeholder[], imageMap: Map<number, string>): string {
  let result = html;
  // Replace each placeholder div with an img tag
  const regex = /<div\s+data-placeholder="[^"]*"\s+data-ph-w="\d+"\s+data-ph-h="\d+"[^>]*>[\s\S]*?<\/div>/g;
  let idx = 0;
  result = result.replace(regex, (match) => {
    const dataUrl = imageMap.get(idx);
    const ph = placeholders[idx];
    idx++;
    if (dataUrl && ph) {
      return `<img src="${dataUrl}" alt="${ph.description}" style="width:${ph.width}px;height:${ph.height}px;object-fit:cover;border-radius:8px;display:block;" />`;
    }
    return match; // Keep original placeholder if no image
  });
  return result;
}

/** Stage 4: Visual QA — Claude reviews the design and suggests fixes */
async function visualQA(
  client: Anthropic,
  model: string,
  html: string,
  originalPrompt: string,
  width?: number,
  height?: number,
): Promise<string> {
  // We can't screenshot in a serverless function, so we do text-based QA
  // Claude reviews the HTML structure for common issues
  const message = await client.messages.create({
    model,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are a design quality reviewer. Review this HTML/CSS design and fix any issues.

Original request: "${originalPrompt}"
Target size: ${width || "auto"}x${height || "auto"}

Current HTML:
${html}

REVIEW CHECKLIST:
1. Typography — proper hierarchy, readable sizes, good line-height
2. Spacing — consistent padding/margins, nothing cramped
3. Colors — harmonious palette, sufficient contrast
4. Layout — proper alignment, no overflow issues
5. Images — properly sized, good aspect ratios, rounded corners match design
6. Overall polish — does it look professional and intentional?

If the design is good, return it unchanged.
If there are issues, fix them and return the corrected version.

RULES:
- Return ONLY the HTML — no explanation, no markdown, no code fences
- Start with <!--size:WIDTHxHEIGHT--> on the first line
- Keep the same structure and images (don't remove <img> tags)
- No animations, transitions, or hover effects
- Self-contained, no external dependencies`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  return parseHtmlWithSize(raw).html;
}

/** Generate critique of a completed frame for improving the next one */
async function generateCritique(
  client: Anthropic,
  model: string,
  html: string,
  originalPrompt: string,
): Promise<string> {
  const message = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a design critic. Analyze this HTML/CSS design and provide specific, actionable feedback for improving the NEXT variation.

Original request: "${originalPrompt}"

HTML:
${html}

Provide 3-5 bullet points of specific improvements. Focus on:
- What works well (keep this in the next variation)
- What could be better (typography, spacing, color, layout)
- A different creative direction to try

Be specific and concise. This feedback will be injected into the next generation prompt.`,
      },
    ],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

// --- Main pipeline route (SSE streaming) ---

export async function POST(req: NextRequest) {
  const body: PipelineRequest = await req.json();
  const {
    prompt,
    style,
    index,
    model,
    apiKey,
    geminiKey,
    systemPrompt,
    critique,
    enableImages = true,
    enableQA = true,
    revision,
    existingHtml,
    unsplashKey,
    openaiKey,
  } = body;

  const useModel = model || DEFAULT_MODEL;
  const isRevision = !!(revision && existingHtml);

  // Determine available image sources
  const availableSources: string[] = [];
  if (unsplashKey) availableSources.push("unsplash");
  if (openaiKey) availableSources.push("dalle");
  if (geminiKey) availableSources.push("gemini");
  const hasAnyImageKey = availableSources.length > 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => controller.enqueue(new TextEncoder().encode(chunk));

      try {
        // Stage 1: Layout (or Revision)
        send(encodeStage("layout", 0.2));
        const layout = isRevision
          ? await generateRevision(
              getAnthropicClient(apiKey),
              useModel,
              prompt,
              revision!,
              existingHtml!,
              systemPrompt,
            )
          : await generateLayout(
              getAnthropicClient(apiKey),
              useModel,
              prompt,
              style,
              systemPrompt,
              critique,
              availableSources,
            );
        let html = layout.html;
        const width = layout.width;
        const height = layout.height;

        // Send layout preview so UI updates immediately
        send(encodePreview(html, width, height));

        // Parse placeholders
        const placeholders = parsePlaceholders(html, availableSources);
        console.log(`[pipeline] enableImages=${enableImages}, hasAnyImageKey=${hasAnyImageKey}, sources=[${availableSources}], placeholders=${placeholders.length}`);
        if (placeholders.length > 0) {
          console.log(`[pipeline] Placeholders:`, placeholders.map(p => `${p.source}:"${p.description}"`));
        }

        // Stage 2: Image generation (if enabled and placeholders exist)
        if (enableImages && hasAnyImageKey && placeholders.length > 0) {
          send(encodeStage("images", 0.45));
          try {
            console.log(`[pipeline] Starting image generation for ${placeholders.length} placeholders`);
            const imageMap = await generateImages(placeholders, { geminiKey, unsplashKey, openaiKey });

            console.log(`[pipeline] Generated ${imageMap.size} images out of ${placeholders.length} placeholders`);
            // Stage 3: Compositing
            if (imageMap.size > 0) {
              send(encodeStage("compositing", 0.65));
              html = compositeImages(html, placeholders, imageMap);
              // Send composited preview so UI shows images before QA
              send(encodePreview(html, width, height));
            }
          } catch (imgErr) {
            console.warn("Image pipeline failed, continuing with placeholders:", imgErr);
          }
        }

        if (!enableImages || !hasAnyImageKey) {
          console.log(`[pipeline] Image generation DISABLED (no image API keys on client)`);
          send(encodeStage("images", 0.45, { skipped: true, reason: "No image API keys — add Unsplash, DALL·E, or Gemini key in Settings" }));
        } else if (placeholders.length === 0) {
          console.log(`[pipeline] No placeholders found in layout HTML — skipping image generation`);
          console.log(`[pipeline] First 500 chars of layout HTML:`, html.slice(0, 500));
          send(encodeStage("images", 0.45, { skipped: true, reason: "No image placeholders found in layout" }));
        }

        // Stage 4: Visual QA (if enabled)
        if (enableQA) {
          send(encodeStage("review", 0.8));
          try {
            html = await visualQA(
              getAnthropicClient(apiKey),
              useModel,
              html,
              prompt,
              width,
              height,
            );
          } catch (qaErr) {
            console.warn("Visual QA failed, using unreviewed version:", qaErr);
          }
        }

        // Stage 5: Done — send result
        send(encodeStage("done", 1.0));
        send(encodeResult(html, isRevision ? "Revised" : `Variation ${index + 1}`, width, height));

        // Generate critique for next frame (if this isn't the last)
        try {
          const critiqueText = await generateCritique(
            getAnthropicClient(apiKey),
            useModel,
            html,
            prompt,
          );
          send(encodeCritique(critiqueText));
        } catch {
          // Critique is optional — don't fail if it errors
        }

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Pipeline failed";
        console.error("Pipeline error:", msg);
        send(encodeError(msg));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// --- Helpers ---

function parseHtmlWithSize(raw: string): { html: string; width?: number; height?: number } {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:html)?\n?/, "").replace(/\n?```$/, "");
  }
  cleaned = cleaned.trim();

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
