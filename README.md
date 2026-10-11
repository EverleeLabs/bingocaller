# Bingo caller

A web app for running bingo events. Hosts plan the night's games (each with its own way to win), add timed intermissions, put everything in order, and then let the app call numbers automatically while a second window shows the board on a TV.

## Features

- **Events and running order**: games and intermissions, reordered by dragging or with the arrows.
- **Ways to win**: pick one or more of 16 built-in patterns (any line, four corners, postage stamp, letter X, coverall, …) an "Any 2 in two columns" pattern (you pick the two columns; a card needs any 2 in the first and any 2 in the second), and/or draw your own. A card wins by completing any one of the picked patterns, and the TV shows each of them.
- **Smart calling**: columns that can't help anyone win the current game are never called. Four corners only calls B and O; a diagonal skips N because its only N square is the free space.
- **Auto-call timer**: set the seconds between calls for the whole event or per game, and change the speed live. Pause, resume, undo the last call, and a **Bingo!** button pauses calling while a card is checked.
- **Spoken calls**: each number is read aloud ("G, 52. five, two. … G, 52.") with an optional chime, plus announcements for game starts, bingos and the end of intermissions. Voice, speed, volume and each option live under **Voice settings**, and **Say it again** repeats the last call. Auto-calling waits for the voice to finish so calls never overlap.
- **TV display**: a separate full-screen board with the current ball, the last few calls, the pattern to win, and an intermission countdown.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # pattern and column-skipping tests
```

## Put the board on a TV

The caller screen has a **Show on a TV** button with these steps built in.

1. Open the event and click **Run event**, then **Open TV display**. A second window opens.
2. Send that window to the TV:
   - **AirPlay (Mac + Apple TV or AirPlay TV)**: Control Center → Screen Mirroring → choose the TV → **Use as separate display**. Drag the display window onto the TV and click **Full screen**.
   - **HDMI**: plug in, then drag the window over and click **Full screen**.
   - **Chromecast**: in the board window, Chrome ⋮ menu → Cast → Cast tab.
   - For calls through the TV speakers, set the Mac's sound output to the TV (Control Center → Sound).
3. Keep calling from the laptop screen. The TV follows along instantly.

The display window must be open in the same browser as the caller. Showing the board on a *separate* device that has its own browser (for example a tablet) needs a small realtime backend; `src/lib/sync.js` is the only file that would change.

## Deploy

It's a static site, so `npm run build` outputs `dist/`, which works on any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, or any web server). Routes use `#/…`, so no rewrite rules are needed.

Events are saved in each host's own browser (localStorage). Nobody's events are shared or synced between devices yet; adding accounts means replacing `src/lib/store.js` with API calls.

## Code map

| File | What it does |
| --- | --- |
| `src/lib/patterns.js` | Win patterns, which columns are in play, the call pool |
| `src/lib/store.js` | Saving events |
| `src/lib/voice.js` | Spoken calls (browser text-to-speech) and the chime |
| `src/lib/sync.js` | Caller → TV messaging, background-safe timer |
| `src/pages/EventEditor.jsx` | Setting up games, patterns, intermissions, order |
| `src/pages/Caller.jsx` | Running the event and auto-calling |
| `src/pages/Display.jsx` | The TV board |
