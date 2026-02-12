# DesignBuddy Canvas

AI design tool with an infinite canvas. Type a prompt, get 3-5 HTML/CSS design iterations, click to comment and revise.

## Setup

```bash
npm install
```

Add your Anthropic API key to `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

```bash
npm run dev
```

## How It Works

1. Type a design prompt in the bottom bar
2. AI generates 4 HTML/CSS variations on the canvas
3. Pan/zoom to explore (scroll to pan, Ctrl+scroll to zoom)
4. Switch to Comment mode (C key or toolbar)
5. Click on a design to leave a revision comment
6. AI regenerates that specific variation with your feedback

## Keyboard Shortcuts

- **V** — Select mode
- **C** — Comment mode
- **Space + drag** — Pan
- **Ctrl/⌘ + scroll** — Zoom
- **Esc** — Cancel comment

## Stack

Next.js 15 · Tailwind · Claude Sonnet · Shadow DOM rendering
