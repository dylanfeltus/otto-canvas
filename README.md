# Canvas by Otto

An open-source AI design tool by [Otto](https://otto.design). Describe what you want, get multiple design variations on an infinite canvas, then click to refine.

**Vibe coding, but for design.**

## Features

- 🎨 **Infinite Canvas** — Pan, zoom, and scroll like Figma
- ✨ **AI Design Generation** — Describe a design, get 3-5 polished HTML/CSS variations
- 💬 **Click-to-Comment** — Figma-style comment pins for targeted micro-revisions
- 🧊 **Liquid Glass UI** — Frosted glass toolbar and controls
- 📦 **Export** — Export to Figma, Tailwind CSS, or React components
- ⌨️ **Keyboard Shortcuts** — V (select), C (comment), Space+drag (pan), Ctrl+scroll (zoom)

## Use Cases

- UI components (buttons, cards, navs, modals, forms)
- Single page/screen designs (landing pages, app screens)
- Marketing assets (social cards, banners, email headers)

## Getting Started

```bash
# Clone the repo
git clone https://github.com/dylanfeltus/otto-canvas.git
cd otto-canvas

# Install dependencies
npm install

# Set your Anthropic API key
cp .env.local.example .env.local
# Edit .env.local and add your key

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key for Claude |

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Canvas:** CSS transforms + @use-gesture/react
- **AI:** Claude (Anthropic API)
- **Design Rendering:** Shadow DOM isolation

## Demo Prompts

Try these to get started:

- "A pricing card with 3 tiers: Starter, Pro, and Enterprise"
- "A dark mode login form with social sign-in buttons"
- "A hero section for a SaaS landing page"
- "A notification toast component with success, error, and warning variants"
- "A settings page sidebar navigation"

## License

MIT — see [LICENSE](LICENSE) for details.

## Built With

- [Claude](https://anthropic.com) by Anthropic
- [Next.js](https://nextjs.org)
- [Tailwind CSS](https://tailwindcss.com)
