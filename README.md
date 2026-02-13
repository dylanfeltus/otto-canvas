# Canvas by Otto

**[→ Try it live at canvas.otto.design](https://canvas.otto.design)**

An open-source AI design tool by [Otto](https://otto.design). Describe what you want, get multiple design variations on an infinite canvas, then click to refine.

**Vibe designing.**

<img width="320" height="180" alt="rrcover 2" src="https://github.com/user-attachments/assets/813cd160-ae56-4ee7-b519-b9d1e0a8f133" />

## Features

- 🎨 **Infinite Canvas** — Pan, zoom, and scroll like Figma
- ✨ **AI Design Generation** — Describe a design, get multiple polished HTML/CSS variations with smart sizing
- 🔄 **Sequential Critique Loop** — Each concept improves on the last. Frame 1 generates, AI reviews it, then uses those learnings to make Frame 2 better. Like a real designer iterating.
- 🎭 **Multi-Model Pipeline** — Claude handles layout, Gemini generates images, then Claude does a visual QA pass. Three models, one polished result.
- 🎯 **Design Presets** — Built-in system prompts for UI/UX Design, Marketing Websites, and Brand/Ad Design. Switch modes instantly in Dev Settings.
- 📐 **Adaptive Frames** — Frame dimensions match the design type (wide for navbars, tall for pages, compact for cards)
- 💬 **Click-to-Comment** — Figma-style comment pins with AI response threads. Color-coded by status (waiting → working → done).
- 🔑 **Bring Your Own Key** — Enter your Anthropic and Gemini API keys in Settings
- 🧠 **Model Selection** — Claude Opus 4.6, Sonnet 4.5, Opus 4, or Sonnet 4
- 📚 **Prompt Library** — Pre-built prompts for UI components, full pages, and marketing assets
- 📦 **Export** — Export to Figma, Tailwind CSS, or React components
- ⌨️ **Keyboard Shortcuts** — V (select), C (comment), Space+drag (pan), Ctrl+scroll (zoom)
- 💾 **Persistent Sessions** — API keys, model preference, and settings saved to localStorage

## Use Cases

- UI components (buttons, cards, navs, modals, forms)
- Full page designs (landing pages, dashboards, app screens)
- Marketing assets (social ads, display banners, email headers)
- Brand materials (Instagram posts, Facebook ads, Twitter cards)

## Getting Started

```bash
# Clone the repo
git clone https://github.com/dylanfeltus/otto-canvas.git
cd otto-canvas

# Install dependencies
npm install

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter your Anthropic API key in Settings (gear icon on the toolbar).

For the multi-model pipeline (image generation + visual QA), also add your Gemini API key in Settings.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | No | Fallback API key for demo mode. Users can enter their own key in the UI. |
| `NEXT_PUBLIC_GA_ID` | No | Google Analytics measurement ID. Only loads if set. |

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS v4
- **Canvas:** CSS transforms + @use-gesture/react
- **AI:** Claude (Anthropic) for layout + QA, Gemini (Google) for image generation
- **Design Rendering:** iframe isolation with auto-measurement

## Demo Prompts

Try these to get started:

- "A pricing card with 3 tiers: Starter, Pro, and Enterprise"
- "A dark mode login form with social sign-in buttons"
- "A responsive navigation bar with logo, links, search, and user avatar"
- "A hero section for a SaaS landing page"
- "An analytics dashboard with metric cards, chart, and activity table"
- "A Facebook ad for a coffee brand — bold, minimal, dark background"
- "An Instagram story promoting a weekend brunch special — warm, inviting colors"

## How It Works

1. **You describe** — Type what you want in the prompt bar
2. **Claude designs** — Generates HTML/CSS layout with proper typography, spacing, and hierarchy
3. **Gemini creates** — Generates images for any visual elements (if Gemini key provided)
4. **Claude reviews** — Screenshots the result and auto-fixes issues
5. **Each frame learns** — The next concept uses critique from the previous one to improve

## License

MIT — see [LICENSE](LICENSE) for details.

## Built With

- [Claude](https://anthropic.com) by Anthropic
- [Gemini](https://ai.google.dev) by Google
- [Next.js](https://nextjs.org)
- [Tailwind CSS](https://tailwindcss.com)
