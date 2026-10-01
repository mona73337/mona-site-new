# Mona737 Portfolio

Personal portfolio site for **Mona737** — On-Chain Builder (Product & Community), Creator, Scientist.

## Stack

Pure HTML · CSS · Vanilla JavaScript — no frameworks, no build step.

## Features

- 🌌 **WebGL warp displacement** — cursor-reactive space background with GLSL fragment shader (canvas 2D fallback)
- 🌑 **Black outer space theme** with green accent system
- 📱 **Fully responsive** — mobile-first design
- ♿ **Accessible** — semantic HTML, ARIA labels, keyboard nav, skip links, reduced-motion support
- ⚡ **Fast** — no JS frameworks, minimal dependencies, lazy-loaded assets
- 🔒 **Security headers** via `vercel.json`
- 📬 **Contact form** with client-side validation (Formspree-ready)

## Sections

1. Hero — PFP, intro, CTAs, social links
2. About — bio, stats
3. Skills — Dev, Web3, Community, Science
4. Projects — card grid with badges
5. Experience — timeline
6. Writing — article cards
7. Contact — social links + validated form

## Local Development

```bash
npx serve . -p 3000
```

Then open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy (from project root)
vercel
```

## Deploy to GitHub Pages

```bash
# 1. Init git repo (if not done)
git init
git add .
git commit -m "feat: initial portfolio"

# 2. Push to GitHub
git remote add origin https://github.com/Mona737/mona737-portfolio.git
git branch -M main
git push -u origin main

# 3. Enable GitHub Pages in repo Settings → Pages → Branch: main, Root: /
```

## Contact Form Setup

Replace `YOUR_FORM_ID` in `main.js` with your [Formspree](https://formspree.io) form ID:

```js
// main.js, inside initContactForm()
const res = await fetch('https://formspree.io/f/YOUR_FORM_ID', { ... });
```

## License

MIT © Mona737
