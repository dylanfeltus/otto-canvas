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
  geminiKey?: string; // User's Gemini API key for image generation
  systemPrompt?: string;
  critique?: string; // Feedback from previous frame
  enableImages?: boolean; // Whether to run image generation
  enableQA?: boolean; // Whether to run visual QA
}

interface Placeholder {
  id: string;
  description: string;
  width: number;
  height: number;
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

IMAGE PLACEHOLDERS — this is critical:
- Where the design needs a photo, illustration, or visual asset, use this EXACT format:
  <div data-placeholder="DESCRIPTION" data-ph-w="WIDTH" data-ph-h="HEIGHT" style="width:WIDTHpx;height:HEIGHTpx;background:#e5e7eb;display:flex;align-items:center;justify-content:center;border-radius:8px;overflow:hidden;">
    <span style="color:#9ca3af;font-size:12px;text-align:center;padding:8px;">DESCRIPTION</span>
  </div>
- DESCRIPTION should be a detailed prompt for image generation (e.g., "Modern minimalist office workspace with plants, soft natural lighting")
- Use real dimensions that fit the layout
- You can have 0-6 placeholders per design
- For decorative/abstract elements, still use CSS gradients — only use placeholders for things that need real imagery

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

/** Parse placeholder elements from HTML */
function parsePlaceholders(html: string): Placeholder[] {
  const placeholders: Placeholder[] = [];
  const regex = /data-placeholder="([^"]+)"\s+data-ph-w="(\d+)"\s+data-ph-h="(\d+)"/g;
  let match;
  let idx = 0;
  while ((match = regex.exec(html)) !== null) {
    placeholders.push({
      id: `ph-${idx++}`,
      description: match[1],
      width: parseInt(match[2], 10),
      height: parseInt(match[3], 10),
    });
  }
  return placeholders;
}

/** Stage 2: Generate images for placeholders via Gemini */
async function generateImages(
  placeholders: Placeholder[],
  geminiKey?: string,
): Promise<Map<number, string>> {
  const gemini = getGeminiClient(geminiKey);
  if (!gemini) {
    console.warn("No Gemini key — skipping image generation");
    return new Map();
  }
  const imageMap = new Map<number, string>();

  // Generate in parallel, max 3 concurrent (Gemini rate limits)
  const batchSize = 3;
  for (let i = 0; i < placeholders.length; i += batchSize) {
    const batch = placeholders.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (ph, batchIdx) => {
        const globalIdx = i + batchIdx;
        try {
          const response = await gemini.models.generateContent({
            model: "gemini-2.0-flash-preview-image-generation",
            contents: `Generate a high quality design asset image: ${ph.description}. Clean, professional, suitable for web/marketing design. No text unless specifically requested. Output only the image.`,
            config: {
              responseModalities: ["image", "text"],
            },
          });
          console.log(`Gemini response for ph ${globalIdx}:`, JSON.stringify(response.candidates?.[0]?.content?.parts?.map(p => ({ hasImage: !!p.inlineData, text: p.text?.slice(0, 50) }))));

          // Extract image from response parts
          const parts = response.candidates?.[0]?.content?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.inlineData?.mimeType?.startsWith("image/")) {
                const b64 = part.inlineData.data;
                const mime = part.inlineData.mimeType;
                if (b64) {
                  imageMap.set(globalIdx, `data:${mime};base64,${b64}`);
                  break;
                }
              }
            }
          }
        } catch (err) {
          console.warn(`Image generation failed for placeholder ${globalIdx}:`, err);
        }
        return globalIdx;
      })
    );
    results.forEach((r, idx) => {
      if (r.status === "rejected") {
        console.warn(`Image batch item ${idx} failed:`, r.reason);
      }
    });
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
  } = body;

  const useModel = model || DEFAULT_MODEL;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => controller.enqueue(new TextEncoder().encode(chunk));

      try {
        // Stage 1: Layout
        send(encodeStage("layout", 0.2));
        const layout = await generateLayout(
          getAnthropicClient(apiKey),
          useModel,
          prompt,
          style,
          systemPrompt,
          critique,
        );
        let html = layout.html;
        const width = layout.width;
        const height = layout.height;

        // Send layout preview so UI updates immediately
        send(encodePreview(html, width, height));

        // Parse placeholders
        const placeholders = parsePlaceholders(html);

        // Stage 2: Image generation (if enabled and placeholders exist)
        if (enableImages && placeholders.length > 0) {
          send(encodeStage("images", 0.45));
          try {
            const imageMap = await generateImages(placeholders, geminiKey);

            // Stage 3: Compositing
            if (imageMap.size > 0) {
              send(encodeStage("compositing", 0.65));
              html = compositeImages(html, placeholders, imageMap);
              // Send composited preview so UI shows images before QA
              send(encodePreview(html, width, height));
            }
          } catch (imgErr) {
            console.warn("Image pipeline failed, continuing with placeholders:", imgErr);
            // Continue with CSS placeholders — don't fail the whole pipeline
          }
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
        send(encodeResult(html, `Variation ${index + 1}`, width, height));

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
