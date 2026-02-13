# Canvas by Otto

An open-source AI design tool by [Otto](https://otto.design). Describe what you want, get multiple design variations on an infinite canvas, then click to refine.

**Vibe coding, but for design.**

## Features

- 🎨 **Infinite Canvas** — Pan, zoom, and scroll like Figma
- ✨ **AI Design Generation** — Describe a design, get 4 polished HTML/CSS variations with smart sizing
- 📐 **Adaptive Frames** — Frame dimensions match the design type (wide for navbars, tall for pages, compact for cards)
- 💬 **Click-to-Comment** — Figma-style comment pins for targeted micro-revisions
- 🔑 **Bring Your Own Key** — Enter your Anthropic API key in Settings, or use the built-in demo key
- 🧠 **Model Selection** — Choose between Claude Opus 4.6, Sonnet 4.5, Opus 4, or Sonnet 4
- 📚 **Prompt Library** — Pre-built prompts for UI components, full pages, and marketing assets
- 📦 **Export** — Export to Figma, Tailwind CSS, or React components
- ⌨️ **Keyboard Shortcuts** — V (select), C (comment), Space+drag (pan), Ctrl+scroll (zoom)
- 💾 **Persistent Sessions** — Your API key and model preference saved to localStorage

## Use Cases

- UI components (buttons, cards, navs, modals, forms)
- Single page/screen designs (landing pages, dashboards, app screens)
- Marketing assets (social cards, banners, email headers)

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

No API key? The app includes a demo key limited to Sonnet 4.5.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | No | Fallback API key for the demo mode. Users can enter their own key in the UI. |

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS v4
- **Canvas:** CSS transforms + @use-gesture/react
- **AI:** Claude (Anthropic API) — multiple model support
- **Design Rendering:** iframe isolation with auto-measurement

## Demo Prompts

Try these to get started:

- "A pricing card with 3 tiers: Starter, Pro, and Enterprise"
- "A dark mode login form with social sign-in buttons"
- "A responsive navigation bar with logo, links, search, and user avatar"
- "A hero section for a SaaS landing page"
- "An analytics dashboard with metric cards, chart, and activity table"
- "A notification toast component with success, error, and warning variants"

## License

MIT — see [LICENSE](LICENSE) for details.

## Built With

- [Claude](https://anthropic.com) by Anthropic
- [Next.js](https://nextjs.org)
- [Tailwind CSS](https://tailwindcss.com)
