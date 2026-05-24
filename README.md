# FOCUS — Pomodoro Timer

A single-screen Pomodoro timer with daily session history. Built with vanilla HTML, CSS, and JavaScript — no build step, no dependencies.

## How to run

**Fastest way — just open the file:**
```bash
open index.html
```
That's it. Any modern browser works.

**With a local dev server (recommended, avoids any browser file-protocol quirks):**
```bash
# Using Python (comes pre-installed on macOS/Linux)
python3 -m http.server 3000
# Then open http://localhost:3000

# Or with Node.js npx
npx serve .
# Then open the printed URL
```

**Requirements:** None. No npm install, no bundler. Works in Chrome, Firefox, Safari, Edge (all modern versions).

---

## Features

- **Focus + break timer** — configurable durations (defaults: 25 min focus, 5 min break)
- **Start, pause, resume, reset** controls
- **Countdown ring** — SVG progress ring with tick marks ticking in real time
- **Audible chime** — three-tone chord when a cycle ends (Web Audio API, no file dependency)
- **Auto-transition** — focus → break → ready, automatically
- **Completion overlay** — momentary full-screen acknowledgment with dismiss-on-click
- **Daily history** — completed focus sessions stored in `localStorage`, auto-cleared on a new calendar day
- **Responsive** — works from 360px phone to 1440px desktop
- **Keyboard shortcuts** — `Space` to start/pause, `R` to reset

## Deployed app

(Link)[pomodoro-zeta-swart.vercel.app]
