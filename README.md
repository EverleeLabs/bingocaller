# Bingo caller

A web app for running bingo events. Hosts plan the night's games (each with its own way to win), add timed intermissions, put everything in order, and then let the app call numbers automatically while a second window shows the board on a TV.

## Features

- **Events and running order**: games and intermissions, reordered by dragging or with the arrows.
- **Ways to win**: pick one or more of 16 built-in patterns (any line, four corners, postage stamp, letter X, coverall, …) an "Any 2 in two columns" pattern (you pick the two columns; a card needs any 2 in the first and any 2 in the second), and/or draw your own. A card wins by completing any one of the picked patterns, and the TV shows each of them.
- **Smart calling**: columns that can't help anyone win the current game are never called. Four corners only calls B and O; a diagonal skips N because its only N square is the free space.
- **Auto-call timer**: set the seconds between calls for the whole event or per game, and change the speed live. Pause, resume, undo the last call, and a **Bingo!** button pauses calling while a card is checked.
- **Number limit (optional, per game)**: switch on "Limit how many numbers are called" and set a number. Calling stops when it's reached ("That's 50 numbers."), and the caller can add 5, 10 or any amount to keep going, or choose **Keep going until a bingo** to drop the limit for the rest of that game (before or after the limit is reached). Milestone announcements stop once the limit is dropped. The TV shows "23 of 50 numbers called".
- **Milestone announcements (with a number limit)**: list call numbers in "Announce at" (or use Every 10 / Each of the last 5). After those calls the caller adds "That's 40 numbers called. 10 to go." Change the wording with **Milestone wording**, using `{called}`, `{left}` and `{total}` for the numbers.
- **Call next now**: draws the next number immediately (shortcut: N). While paused it steps one number at a time, which is handy for testing. The speed slider goes down to 1 second.
- **O 69 special prize (optional, switched on during a game)**: set the announcement in the event's setup (**O 69 prize announcement**), then turn on "Special prize on O 69" on the caller screen during any game where O is called. The wording can also be changed there and is saved with the event. If O 69 is called, calling pauses, the announcement is read out after the call, and the TV shows a "Special prize!" banner with the message until the caller taps Resume calling. The switch only appears in games where O numbers are called, resets for each game, and disappears once O 69 has been called and the game has moved on.
- **Ending the event**: **End event** on the caller (any time), or **End the event** after the last game. The voice reads the event's **Closing message** (set in setup) and the TV shows "Thanks for playing" with that message.
- **Spoken calls**: each number is read aloud ("G, 52. five, two. … G, 52.") with an optional chime, plus announcements for game starts, bingos and the end of intermissions. Voice, speed, volume and each option live under **Voice settings**, and **Say it again** repeats the last call. Auto-calling waits for the voice to finish so calls never overlap.
- **Colours, logo and font (optional, per event)**: every event uses the standard look until you change it under **Colours, logo and font** in the event's setup. You can set the background colour or a background picture (with a fade slider so the board stays readable), the colour of all text, the pattern squares, each column's ball colour and the text on it (also used for called numbers on the board), the ball centre and number, the caller's main buttons and Bingo button (text on them is picked automatically for contrast), a logo (cropped after you choose it, with **Trim empty edges**; placed before, after, above or instead of the event name, or in any corner; sized from 4% to 30% of the screen height), and the font for the board and balls. With a background colour or picture set, **Suggested colours** offers three complete palettes that go with it. A live preview shows the TV and the caller buttons, and a readability check flags any hard-to-read colour pair with a one-click fix (text 4.5:1, big numbers 3:1). The look applies to every screen of the event: games, intermissions and the end screen, on the TV and on the caller screen (balls, called numbers, chips, pattern squares and buttons; the caller's board and "how to win" card use the TV's background and text colours). **Colour sets** has ready-made looks, and **Save set** keeps your own (with its picture and logo) to reuse in any event. Pictures are shrunk to TV size before they're saved.
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
   - **iPad with an M-series chip** (iPad Air 5th gen or later, iPad Pro M1 or later): turn on Stage Manager, connect with a USB-C to HDMI adapter, open a second Safari window on the TV screen at `…/#/display`, and run the game from the iPad window. iPhones and older iPads can only mirror.
   - For calls through the TV speakers, set the Mac's sound output to the TV (Control Center → Sound).
3. Keep calling from the laptop screen. The TV follows along instantly.

The display window must be open in the same browser as the caller. Showing the board on a *separate* device that has its own browser (for example a tablet) needs a small realtime backend; `src/lib/sync.js` is the only file that would change.

## Deploy

It's a static site, so `npm run build` outputs `dist/`, which works on any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, or any web server). Routes use `#/…`, so no rewrite rules are needed.

Events are saved in each host's own browser (localStorage). Nobody's events are shared or synced between devices yet; adding accounts means replacing `src/lib/store.js` with API calls.

### Backups and moving events

On the events page, **Export all** downloads every event as a `.json` file, and each event's **Export** downloads just that one. **Import** reads a file back in: it lists the events in the file, marks each as **New** or **Replaces the saved copy** (same event already in this browser), and only changes anything once you confirm. Files are checked and cleaned on import, so a damaged or unrelated file is rejected with a message rather than breaking the app.

## Code map

| File | What it does |
| --- | --- |
| `src/lib/patterns.js` | Win patterns, which columns are in play, the call pool |
| `src/lib/store.js` | Saving events |
| `src/lib/theme.js` | Event colours, logo and font: defaults, built-in sets, cleaning, CSS variables, contrast checks |
| `src/lib/palettes.js` | Saved colour sets, reusable in any event |
| `src/lib/colour.js` | Colour maths: mixing, contrast, readable text |
| `src/lib/suggest.js` | Colour suggestions from a background colour or picture |
| `src/lib/backup.js` | Export and import files |
| `src/lib/voice.js` | Spoken calls (browser text-to-speech) and the chime |
| `src/lib/sync.js` | Caller → TV messaging, background-safe timer |
| `src/pages/EventEditor.jsx` | Setting up games, patterns, intermissions, order |
| `src/pages/Caller.jsx` | Running the event and auto-calling |
| `src/pages/Display.jsx` | The TV board |
