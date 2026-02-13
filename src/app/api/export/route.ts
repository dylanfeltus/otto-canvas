import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const DEFAULT_MODEL = "claude-sonnet-4-0514";

function getClient(apiKey?: string): Anthropic {
  if (apiKey) return new Anthropic({ apiKey });
  return new Anthropic();
}

export async function POST(req: NextRequest) {
  try {
    const { html, format, apiKey, model } = await req.json();

    if (!html || !format) {
      return NextResponse.json({ error: "html and format required" }, { status: 400 });
    }

    const client = getClient(apiKey);
    const useModel = model || DEFAULT_MODEL;

    switch (format) {
      case "svg":
        return NextResponse.json({ result: htmlToSvg(html) });

      case "tailwind":
        return NextResponse.json({ result: await convertWithAI(client, useModel, html, TAILWIND_PROMPT) });

      case "react":
        return NextResponse.json({ result: await convertWithAI(client, useModel, html, REACT_PROMPT) });

      default:
        return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }
  } catch (err: unknown) {
    console.error("Export error:", err);
    const message = err instanceof Error ? err.message : "Export failed";
    const status = message.includes("auth") || message.includes("API key") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function htmlToSvg(html: string): string {
  const widthMatch = html.match(/width\s*:\s*(\d+)px/);
  const heightMatch = html.match(/height\s*:\s*(\d+)px/);
  const width = widthMatch ? parseInt(widthMatch[1]) : 800;
  const height = heightMatch ? parseInt(heightMatch[1]) : 600;

  const escaped = html.replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, "&amp;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
${escaped}
    </div>
  </foreignObject>
</svg>`;
}

const TAILWIND_PROMPT = `Convert this HTML/CSS design into HTML that uses Tailwind CSS utility classes instead of custom CSS.

RULES:
- Return ONLY the HTML code, no explanation, no markdown code fences
- Replace ALL custom CSS/inline styles with Tailwind utility classes
- Remove any <style> tags — everything should be Tailwind classes
- Use Tailwind v3 syntax
- Preserve the exact same visual appearance
- Keep the same HTML structure
- For custom colors, use arbitrary value syntax like bg-[#hex]
- For custom spacing, use arbitrary values like p-[20px] only when standard Tailwind values don't match`;

const REACT_PROMPT = `Convert this HTML/CSS design into a React functional component using Tailwind CSS.

RULES:
- Return ONLY the component code, no explanation, no markdown code fences
- Export a default functional component named "Design"
- Convert all HTML attributes to JSX (class→className, for→htmlFor, etc.)
- Replace ALL custom CSS with Tailwind utility classes
- Remove any <style> tags
- Use TypeScript syntax (React.FC)
- Use self-closing tags where appropriate
- Make it a clean, production-ready component
- Import React at the top`;

async function convertWithAI(client: Anthropic, model: string, html: string, systemPrompt: string): Promise<string> {
  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `${systemPrompt}\n\nHere is the HTML/CSS to convert:\n\n${html}`,
      },
    ],
  });

  let result = message.content[0].type === "text" ? message.content[0].text : "";

  result = result.trim();
  if (result.startsWith("```")) {
    result = result.replace(/^```(?:html|tsx|jsx|typescript)?\n?/, "").replace(/\n?```$/, "");
  }

  return result.trim();
}
