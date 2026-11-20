# Blind Timer Relay (盲计时接力)

A Vortexa party mini game. The whole group shares one phone. Nobody can see the time: players take turns timing by feel and try to land the total on the target.

## How to play

1. The host sets a target time (default 30 seconds) and a tolerance (default ±3 seconds).
2. The current player presses **Start**, counts in their head, presses **Stop**, then passes the phone to the next player.
3. The timer keeps adding up from the previous player and pauses during the hand-over. No time is shown at any point.
4. At the reveal, the group wins if the total is within the tolerance of the target.
   Example with target 30 s and tolerance ±3 s: 27.8 s wins, 34.3 s loses.

## Features

- Custom target time, tolerance, number of players and names
- Two end modes: auto-reveal after the last player, or loop through players and reveal any time
- Count-up reveal animation, per-turn breakdown, win/lose sounds, confetti
- Chinese / English toggle
- Progress survives a page reload or accidental close (no time is lost)
- Anti-mistap: double-tap guard, delayed buttons on the hand-over screen
- Screen stays on during a game (browsers with Wake Lock support)

## Tech

Static web page: `index.html` + `style.css` + `app.js`. No framework, no build step, no dependencies.

Timing uses `performance.now()`, measured from the Start and Stop timestamps, with 0.01 s precision.
The win check uses integer centiseconds, so there are no floating-point errors.

## Run locally

Open `index.html` in a browser.

## Deploy (GitHub Pages)

1. Push the code to the `main` branch on GitHub.
2. In the repo, go to **Settings → Pages**. Set Source to **Deploy from a branch**, branch `main`, folder `/ (root)`, then save.
3. After about 1 minute, the site is live at `https://<username>.github.io/<repo-name>/`.

Every push to `main` then updates the site automatically.
