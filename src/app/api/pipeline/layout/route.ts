import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const maxDuration = 120;

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

function getClient(apiKey?: string): Anthropic {
  if (apiKey) return new Anthropic({ apiKey });
  return new Anthropic();
}

function parseHtmlWithSize(raw: string): { html: string; width?: number; height?: number } {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:html)?\n?/, "").replace(/\n?```$/, "");
  }
  const fenceMatch = cleaned.match(/```(?:html)?\n?([\s\S]*?)\n?```/);
  if (fenceMatch) cleaned = fenceMatch[1];
  cleaned = cleaned.trim();

  const sizeMatch = cleaned.match(/<!--size:(\d+)x(\d+)-->/);
  let width: number | undefined;
  let height: number | undefined;
  if (sizeMatch) {
    width = parseInt(sizeMatch[1], 10);
    height = parseInt(sizeMatch[2], 10);
    cleaned = cleaned.replace(/<!--size:\d+x\d+-->\n?/, "").trim();
  }

  const htmlStart = cleaned.match(/^[\s\S]*?(<(?:!DOCTYPE|html|head|style|div|section|main|body|meta|link)[>\s])/i);
  if (htmlStart && htmlStart.index !== undefined && htmlStart.index > 0) {
    cleaned = cleaned.substring(htmlStart.index);
  }
  const lastTagMatch = cleaned.match(/([\s\S]*<\/(?:html|div|section|main|body)>)/i);
  if (lastTagMatch) cleaned = lastTagMatch[1];

  return { html: cleaned.trim(), width, height };
}

/** Strip base64 data URIs from HTML */
function stripBase64Images(html: string): { stripped: string; restore: (output: string) => string } {
  const images: string[] = [];
  const stripped = html.replace(/src="(data:image\/[^"]+)"/g, (_match, dataUri) => {
    const idx = images.length;
    images.push(dataUri);
    return `src="[IMAGE_PLACEHOLDER_${idx}]"`;
  });
  const restore = (output: string): string => {
    let result = output;
    for (let i = 0; i < images.length; i++) {
      result = result.replace(`[IMAGE_PLACEHOLDER_${i}]`, images[i]);
    }
    return result;
  };
  return { stripped, restore };
}

function buildRevisionPrompt(
  systemPrompt: string | undefined,
  existingHtml: string,
  prompt: string,
  revision: string
): string {
  const customBlock = systemPrompt ? `\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${systemPrompt}\n` : "";
  const { stripped, restore } = stripBase64Images(existingHtml);

  return JSON.stringify({ stripped, restoreNeeded: true }) + "\n---PROMPT---\n" +
    `You are a world-class visual designer. You are EDITING an existing design — not creating a new one.${customBlock}

Here is the EXISTING HTML design:

${stripped}

Note: [IMAGE_PLACEHOLDER_N] references are real images — keep all <img> tags and their src attributes exactly as-is.

The original request was: "${prompt}"

The user wants this specific change: "${revision}"

CRITICAL RULES:
- Return exactly ONE design — the existing design with ONLY the requested change applied
- Do NOT generate multiple variations, alternatives, or options
- Do NOT stack multiple versions vertically or horizontally
- PRESERVE the existing layout, structure, and content
- ONLY modify what was specifically requested — change nothing else

IMAGE PLACEHOLDERS — where the design needs a NEW photo/visual (only if the revision requires new imagery):
- Use: <div data-placeholder="DESCRIPTION" data-ph-w="WIDTH" data-ph-h="HEIGHT" style="width:WIDTHpx;height:HEIGHTpx;background:#e5e7eb;display:flex;align-items:center;justify-content:center;border-radius:8px;overflow:hidden;">
    <span style="color:#9ca3af;font-size:12px;text-align:center;padding:8px;">DESCRIPTION</span>
  </div>
- Keep any existing <img> tags as-is unless the revision specifically asks to change them

ABSOLUTELY NO MOTION — no CSS animations, transitions, @keyframes, hover effects.

SIZE — output a size comment on the FIRST line:
<!--size:WIDTHxHEIGHT-->

OUTPUT: HTML only — no explanation, no markdown, no code fences. ALL CSS in a <style> tag.`;
}

function buildNewPrompt(
  systemPrompt: string | undefined,
  critique: string | undefined,
  prompt: string,
  style: string,
  availableSources: string[]
): string {
  const critiqueBlock = critique ? `\n\nIMPROVEMENT FEEDBACK from previous variation (apply these learnings):\n${critique}\n` : "";
  const customBlock = systemPrompt ? `\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${systemPrompt}\n` : "";

  return `You are a world-class visual designer. Generate a stunning, self-contained HTML/CSS design.${customBlock}${critiqueBlock}

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
- data-img-query = SHORT search keywords for Unsplash (3-5 words max)

${availableSources && availableSources.length > 0
    ? `AVAILABLE IMAGE SOURCES (choose the best one for each placeholder):
${availableSources.includes("unsplash") ? '- "unsplash" — BEST for real photographs\n' : ""}${availableSources.includes("dalle") ? '- "dalle" — BEST for custom illustrations, abstract art\n' : ""}${availableSources.includes("gemini") ? '- "gemini" — BEST for design assets, UI elements\n' : ""}
Choose the source that best matches what each placeholder needs.`
    : 'Set data-img-source="gemini" for all placeholders (only source available).'}

Rules:
- Include 1-6 placeholders per design
- Use CSS gradients ONLY for decorative/abstract accents, NOT as replacements for photographs
- All data attributes are REQUIRED

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
- Generate exactly ONE design`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt, style, model, apiKey, systemPrompt, critique,
      availableSources = [], revision, existingHtml,
    } = body;

    const useModel = model || DEFAULT_MODEL;
    const client = getClient(apiKey);
    const isRevision = !!(revision && existingHtml);

    let userContent: string;
    let restoreFn: ((s: string) => string) | null = null;

    if (isRevision) {
      const { stripped, restore } = stripBase64Images(existingHtml);
      restoreFn = restore;
      const customBlock = systemPrompt ? `\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${systemPrompt}\n` : "";
      userContent = `You are a world-class visual designer. You are EDITING an existing design — not creating a new one.${customBlock}

Here is the EXISTING HTML design:

${stripped}

Note: [IMAGE_PLACEHOLDER_N] references are real images — keep all <img> tags and their src attributes exactly as-is.

The original request was: "${prompt}"

The user wants this specific change: "${revision}"

CRITICAL RULES:
- Return exactly ONE design — the existing design with ONLY the requested change applied
- Do NOT generate multiple variations, alternatives, or options
- Do NOT stack multiple versions vertically or horizontally
- PRESERVE the existing layout, structure, and content
- ONLY modify what was specifically requested — change nothing else

IMAGE PLACEHOLDERS — where the design needs a NEW photo/visual (only if the revision requires new imagery):
- Use: <div data-placeholder="DESCRIPTION" data-ph-w="WIDTH" data-ph-h="HEIGHT" style="width:WIDTHpx;height:HEIGHTpx;background:#e5e7eb;display:flex;align-items:center;justify-content:center;border-radius:8px;overflow:hidden;">
    <span style="color:#9ca3af;font-size:12px;text-align:center;padding:8px;">DESCRIPTION</span>
  </div>
- Keep any existing <img> tags as-is unless the revision specifically asks to change them

ABSOLUTELY NO MOTION — no CSS animations, transitions, @keyframes, hover effects.

SIZE — output a size comment on the FIRST line:
<!--size:WIDTHxHEIGHT-->

OUTPUT: HTML only — no explanation, no markdown, no code fences. ALL CSS in a <style> tag.`;
    } else {
      userContent = buildNewPrompt(systemPrompt, critique, prompt, style, availableSources);
    }

    // Use streaming to avoid Vercel timeout — stream keeps connection alive
    const stream = client.messages.stream({
      model: useModel,
      max_tokens: 16384,
      messages: [{ role: "user", content: userContent }],
    });

    // Collect the full response via streaming, then return JSON
    // We use a ReadableStream to keep the connection alive with periodic pings
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          let fullText = "";

          // Send a space immediately to establish the connection
          controller.enqueue(encoder.encode(" "));

          const pingInterval = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(" "));
            } catch {
              // stream already closed
            }
          }, 5000);

          const message = await stream.finalMessage();
          clearInterval(pingInterval);

          fullText = message.content[0].type === "text" ? message.content[0].text : "";

          let result = parseHtmlWithSize(fullText);
          if (restoreFn) {
            result = { ...result, html: restoreFn(result.html) };
          }

          // Send the actual JSON result
          controller.enqueue(encoder.encode(JSON.stringify(result)));
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Layout generation failed";
          console.error("Layout streaming error:", msg);
          controller.enqueue(encoder.encode(JSON.stringify({ error: msg })));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Layout generation failed";
    console.error("Layout error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
