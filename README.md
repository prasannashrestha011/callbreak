# Callbreak

A playful, responsive Call Break scorekeeper built with Astro and plain JavaScript.

## Run

Requires Node.js 22.22 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:4173. Use `npm test` for scoring and game-state checks, `npm run build` to generate the static site, and `npm run preview` to serve the production build.

## Play

Edit the four player names, set bids from 1–13, and lock them. After play, choose Record tricks and enter each player’s actual tricks won (0–13). Save round calculates scores against the locked bids and advances the round; canceling leaves the game unchanged. There is no total-tricks check. A made bid earns the bid plus 0.1 per extra trick; a missed bid loses the bid value. The highest total after five rounds wins, including joint winners. Edit last result corrects the actual tricks, including after the game ends.

Completed games appear in History with their full scorecards. New game starts a fresh game with the same players and saves an unfinished game as a draft in History, including its current bids and locked status. Continue restores a draft and saves the current unfinished game in its place. Play again starts fresh after a completed game. The active game, drafts, and history survive refreshes through localStorage.

Use the sun/moon button in the header to switch between light and black themes. The initial theme follows your device setting, and a manual choice is remembered in this browser.

Data stays in this browser on this device. Clearing site data removes games; there is no account, cloud sync, or multiplayer service. Storage failures show an alert, and unreadable saved data is preserved rather than overwritten.
