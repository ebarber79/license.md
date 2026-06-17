# Neon Dash 🏃‍♂️⚡

A fast, neon-styled **endless runner** built with plain HTML5 Canvas + JavaScript.
No frameworks, no build step, no install — just open it in any mobile or desktop browser.

## Play

- **Local:** open `index.html` in a browser, or serve the folder:
  ```bash
  python3 -m http.server 8000
  # then visit http://localhost:8000 on your phone or desktop
  ```
- **Mobile:** tap anywhere to jump. Tap again in mid-air for a **double jump**.
- **Desktop:** click, or press `Space` / `↑` / `W`.

## Goal

Run as far as you can. Dodge the red **spikes** and pink **bars**, and grab the
golden **gems** along the way. The longer you survive, the faster it gets.
Your best score is saved locally on your device.

## Features

- Smooth, frame-rate-independent physics with gravity + double jump
- Procedurally spawned obstacles and collectible gem arcs
- Progressive difficulty (speed ramps up, gaps tighten — but stay fair)
- Parallax starfield, scrolling neon grid, particle bursts, and screen shake
- Responsive full-screen canvas (HiDPI aware) tuned for portrait phones
- Persistent high score via `localStorage`

## Project structure

| File | Purpose |
|------|---------|
| `index.html` | Markup, HUD, and start / game-over overlays |
| `style.css`  | Neon theme, responsive layout, safe-area handling |
| `game.js`    | Game loop, physics, spawning, collision, rendering |

## Tuning

Most of the feel lives in the constants near the top of `game.js`
(`GRAVITY`, `JUMP_VELOCITY`, `START_SPEED`, `MAX_SPEED`, `SPEED_RAMP`).
Adjust those to change difficulty and game feel.
