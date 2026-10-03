# MiniPlay — Tiny Games. Big Fun. Play Together. 🎮

MiniPlay is a beautiful, lightweight, web-based multiplayer mini-game platform built with **Vanilla HTML, CSS, JavaScript, Node.js, Express.js, and Socket.IO**.

No installation. No accounts. No login. No database.  
**Open Website → Choose Game → Create Room → Share Code/Link → Play Instantly!**

---

## 🌟 Key Highlights

* **Instant Multiplayer**: Generate a 5-character room code (e.g., `X7K2P`) and shareable URL (`/join/X7K2P`).
* **Zero Database Required**: Active rooms and game state are managed entirely in server memory with automatic inactivity garbage collection.
* **Anti-Cheat Validation**: Server validates legal moves, turns, piece captures, and win conditions.
* **Session Reconnection**: Reconnecting players automatically resume their exact match and player index without losing game state.
* **Web Audio SFX Engine**: Procedural 8-bit & modern chimes (clicks, moves, wins, dice rolls, lasers, punches) synthesized via the Web Audio API with zero asset downloads.
* **Mobile & Desktop Responsive**: Full touch controls including on-screen D-pads and action buttons for action games on smartphones and tablets.

---

## 🕹️ Included Games (12 Mini-Games)

### Level 1 — Classic Casual & Board
1. **Tic Tac Toe** (2 Players) — Timeless 3x3 duel with win line highlighting.
2. **Connect Four** (2 Players) — 7-column gravity drop token game with 4-in-a-row detection.
3. **Rock Paper Scissors** (2 Players) — Simultaneous secret picks with dramatic versus reveal.
4. **Memory Cards** (1–4 Players) — 16-card 3D flip grid with pair recall and scores.
5. **Snake & Ladder** (2–4 Players) — 100-tile board with animated dice, ladders, and snakes.
6. **Dots and Boxes** (2–4 Players) — Strategic dot grid line connection with box captures.

### Level 2 — Strategy & Board
7. **Chess** (2 Players) — Full chessboard with piece movement rules, captures, and checkmate.
8. **Checkers** (2 Players) — Diagonal movement, jump captures, and King promotions.
9. **Carrom** (2 Players) — HTML5 Canvas tabletop with realistic disc collisions and pocketing.
10. **Ludo** (2–4 Players) — Fast-paced mini-ludo with colored bases, track path, safe zones, and home run.

### Level 3 — Arcade & Action
11. **Tank Battle** (2–4 Players) — Real-time top-down arena with obstacle walls, bouncing shells, and health.
12. **Simple Shooting** (2–4 Players) — Fast-paced laser arena with omnidirectional strafing and health orbs.
13. **Stickman Fight** (2 Players) — Side-view 2D martial arts duel with punches, kicks, jumps, and blocks.

---

## 🚀 Quick Start Guide

### 1. Requirements
* [Node.js](https://nodejs.org/) (v16 or higher)
* [npm](https://www.npmjs.com/)

### 2. Installation
Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd minigames_multiplayer
npm install
```

### 3. Start the Server
```bash
npm start
```

For live code auto-reload during development:
```bash
npm run dev
```

### 4. Play!
Open your web browser and navigate to:
```text
http://localhost:3000
```

To test multiplayer on the same machine:
* Open `http://localhost:3000` in **Window A**, click **Create Game**, and select **Tic Tac Toe**.
* Copy the 5-letter room code (or click **Copy Game Link**).
* Open an **Incognito Window** (or another browser) as **Window B**, enter the code, and join.
* Make moves in Window A and observe real-time synchronized gameplay in Window B!

---

## 🧪 Running the Automated Test Suite

MiniPlay comes with automated integration and game engine test suites:

```bash
npm test
```

This tests:
* Server API endpoints
* Socket.IO room creation and joining
* Multiplayer turns and anti-cheat validation
* Reconnection preservation
* All 12 game engine modules individually

---

## 📁 Project Structure

```text
minigames_multiplayer/
├── server/
│   ├── server.js              # Express + Socket.IO server entry point
│   ├── roomManager.js         # Room lifecycle, tokens, reconnection & ticks
│   └── games/
│       ├── registry.js        # Game metadata, categories & rule definitions
│       ├── ticTacToe.js       # Level 1: Tic Tac Toe
│       ├── connectFour.js     # Level 1: Connect Four
│       ├── rockPaperScissors.js # Level 1: Rock Paper Scissors
│       ├── memory.js          # Level 1: Memory Cards
│       ├── snakeLadder.js     # Level 1: Snake & Ladder
│       ├── dotsAndBoxes.js    # Level 1: Dots and Boxes
│       ├── chess.js           # Level 2: Chess
│       ├── checkers.js        # Level 2: Checkers
│       ├── carrom.js          # Level 2: Carrom
│       ├── ludo.js            # Level 2: Ludo
│       ├── tankBattle.js      # Level 3: Tank Battle
│       ├── simpleShooter.js   # Level 3: Simple Shooting
│       └── stickmanFight.js   # Level 3: Stickman Fight
│
├── public/
│   ├── index.html             # Single-page app (Home, Lobby, Game View, Modals)
│   ├── style.css              # Modern, responsive gaming UI stylesheet
│   ├── app.js                 # Frontend coordinator & Web Audio SFX engine
│   └── games/
│       ├── tic-tac-toe/game.js
│       ├── connect-four/game.js
│       ├── rock-paper-scissors/game.js
│       ├── memory/game.js
│       ├── snake-ladder/game.js
│       ├── dots-and-boxes/game.js
│       ├── chess/game.js
│       ├── checkers/game.js
│       ├── carrom/game.js
│       ├── ludo/game.js
│       ├── tank-battle/game.js
│       ├── simple-shooter/game.js
│       └── stickman-fight/game.js
│
├── test/
│   ├── test_platform.js       # Integration networking & anti-cheat tests
│   └── test_all_games.js      # Unit tests for all game engines
│
├── package.json
└── README.md
```

---

## 🧩 Adding a New Game (Plugin Architecture)

MiniPlay uses a modular plugin architecture that makes adding new games straightforward:

1. **Register metadata** in `server/games/registry.js`:
   ```javascript
   'my-game': {
     id: 'my-game',
     name: 'My Game',
     icon: '🎲',
     categories: ['all', '2-players', 'board'],
     minPlayers: 2,
     maxPlayers: 2,
     defaultPlayers: 2,
     clientScript: '/games/my-game/game.js',
     howToPlay: ['Rule 1', 'Rule 2']
   }
   ```
2. **Implement server logic** in `server/games/myGame.js`:
   * `initGameState(options)`
   * `handleAction(gameState, playerIndex, action)`
   * `getPublicState(gameState, playerIndex)`
3. **Implement client view** in `public/games/my-game/game.js`:
   * `window.MiniPlayGames['my-game'] = { init(container, socket, roomInfo, myIndex, app), onStateUpdate(state, events), onDestroy() }`

---

## 📜 License

MIT License. Free to use, adapt, and build upon.
