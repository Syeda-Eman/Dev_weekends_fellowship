# ANSWERS.md

## 1. How to run

No install required. Open `index.html` directly in a browser:

```bash
open index.html
```

Or serve locally to avoid any file-protocol quirks:

```bash
python3 -m http.server 3000
# → open http://localhost:3000
```

No npm, no build step, no dependencies. Requires a modern browser (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+).

---

## 2. Stack & design choices

**Stack:** Vanilla HTML/CSS/JS. No framework, no bundler. The app is small enough that React or Vue would add friction without benefit — there's one screen, no routing, no shared state across components. Plain JS is faster to iterate and easier for a reviewer to open and inspect.

**Visual decision 1 — The ring takes ~75% of the viewport width.**  
A Pomodoro timer's primary job is ambient awareness: you glance at it and immediately know how far into a session you are. Making the ring dominate the screen (up to 340px, or 86vw on narrow phones) means the remaining time reads as a *shape* before it reads as a number. The gap in the arc is intuitively "how much is left." I deliberately made the stroke narrow (10px) against a dark track so the progress line stays crisp rather than chunky.

**Visual decision 2 — Three distinct color states (yellow / cyan / amber) for focus / break / paused.**  
This affects the ring, the status dot, the button, the session label, and the ambient glow — everything shifts color together when phase changes. I chose these over a more conventional red/green because they have strong hue contrast without looking like a traffic light. The shift is immediate and full-screen: even on a second monitor in peripheral vision you can tell at a glance whether you're in a focus session or a break.

---

## 3. Responsive & accessibility

**Responsive behavior:**  
On a 360px phone, the ring scales to `86vw` (~310px), controls shrink slightly, and the history list has a capped max-height with scroll. Nothing wraps awkwardly because the layout is a single centered column throughout — there's no grid that needs to reflow, just a flex column that naturally stacks. On 1440px the app stays capped at 500px wide with generous padding; it reads as an intentionally focused tool rather than a stretched-out interface.

**Accessibility — what I handled:**  
The timer `<div>` has `role="timer"` and the phase label uses `aria-live="polite"` so screen readers announce state changes (FOCUSING, ON BREAK, PAUSED) without interrupting. All three buttons have explicit `aria-label` attributes that update dynamically (e.g. "Pause timer" when running, "Resume timer" when paused). The settings panel uses `aria-expanded` on its trigger and `aria-controls` pointing to the panel. Keyboard users can navigate entirely without a mouse — Space/R shortcuts plus full tab order. Focus states use a 2px solid accent outline (not just browser defaults), which meets WCAG 2.1 SC 2.4.7. Color contrast for body text on the dark background exceeds 7:1.

**Accessibility — knowingly skipped:**  
I didn't add a live region that announces the countdown every second. That would be correct (the `role="timer"` technically needs periodic announcements to be fully useful), but it would make the app unusable for screen reader users — hearing "24:58... 24:57... 24:56..." continuously is worse than silence. The right fix is a periodic announcement at each minute mark and on phase transition, but implementing a well-tuned throttle was out of scope here.

---

## 4. AI usage

I used Claude (claude-sonnet-4) as a coding assistant during development. Here's where:

1. **SVG ring math** — I asked it to compute the stroke-dasharray/dashoffset approach for an SVG circle progress ring given a radius of 148. It gave me the circumference formula and the correct CSS transition setup. I kept this largely as-is.

2. **Web Audio API chime** — I asked for a "three-note ascending chime using Web Audio API with no audio files." It gave me a single oscillator with a flat frequency. I changed it to three separate oscillators staggered by 150ms with sine waves at A5/C#6/E6 (an ascending major chord), because a chord is more satisfying and final-feeling than a single tone. I also added a separate descending chord (E5/C5/G4) for break-end to create a softer "get back to work" cue rather than the same triumphant sound.

3. **localStorage date-clearing logic** — I described the requirement ("reset history on a new calendar day") and it suggested comparing `new Date().toDateString()`. I changed this to a custom `YYYY-M-D` string because `toDateString()` returns locale-dependent output like "Sun May 24 2026" which differs across environments. A plain numeric string is safer.

4. **CSS scanline texture** — I asked for a subtle CRT scanline effect. It gave me a `repeating-linear-gradient` with a 2px/2px pitch. I changed the pitch to 3px/1px (3px transparent, 1px tinted) because at 2px it created a visible Moiré pattern on retina screens; 3px/1px is subtle enough to read as texture rather than pattern.

---

## 5. Honest gap

The settings input UX isn't fully hardened. The number inputs accept keyboard entry freely, and if you type something invalid (like `0` or `999`) the APPLY button silently does nothing — there's no inline error message explaining why. A user who types `0` into the focus field and hits Apply will see no feedback.

With another day I'd add a small inline validation message beneath each field ("Must be 1–99 min"), highlight the offending input with a red border on failed apply, and auto-select the invalid field. I'd also add a subtle "saved" confirmation animation on successful apply so users know their change took effect.
