/**
 * Ludo Client Module — Super Animations Edition
 * Features:
 * - Authentic 15x15 classic Ludo board with yards, safe stars, home stretches, and center trophy
 * - Interactive 3D tumbling dice cube with physical pips and audio clatter
 * - Smooth step-by-step token hopping with arc bounce animations and marimba hop sounds
 * - Pulsing neon invitation glow for movable tokens
 * - Comic impact capture burst & rewind to yard
 * - Home reach fanfare and confetti bursts
 */

window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['ludo'] = {
  init(container, socket, roomInfo, myPlayerIndex, app) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.myPlayerIndex = myPlayerIndex;
    this.app = app;

    this.playerColors = ['#ef4444', '#10b981', '#eab308', '#3b82f6'];
    this.playerNames = ['Red', 'Green', 'Yellow', 'Blue'];
    this.isRolling = false;
    this.isAnimatingMove = false;

    // Define 52 common path track coordinates on 15x15 grid: (col, row) 0..14
    this.TRACK_COORDS = [
      [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
      [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
      [7, 0],
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
      [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
      [14, 7],
      [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
      [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
      [7, 14],
      [6, 14], [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
      [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
      [0, 7],
      [0, 6]
    ];

    // Safe squares indices on 52 track: 0, 8, 13, 21, 26, 34, 39, 47
    this.SAFE_TRACK_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];
    this.START_TRACK_INDICES = [0, 13, 26, 39];

    // Home stretch coordinates (steps 51..56 for each player)
    this.HOME_STRETCHES = [
      // Player 0 (Red): moves right along row 7
      [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
      // Player 1 (Green): moves down along col 7
      [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
      // Player 2 (Yellow): moves left along row 7
      [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
      // Player 3 (Blue): moves up along col 7
      [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]]
    ];

    // Base sockets coordinates in yards (col, row): 2 sockets per player
    this.BASE_SOCKET_COORDS = [
      [[2, 2], [3, 3]],       // Red (top-left)
      [[11, 2], [12, 3]],     // Green (top-right)
      [[11, 11], [12, 12]],   // Yellow (bottom-right)
      [[2, 11], [3, 12]]      // Blue (bottom-left)
    ];

    this.render();
  },

  render() {
    this.container.innerHTML = `
      <div class="ludo-15-container">
        
        <!-- 15x15 Authentic Classic Ludo Board -->
        <div class="ludo-15-board" id="ludo-board">
          
          <!-- 4 Corner Yards -->
          <div class="ludo-15-yard yard-red" id="yard-0">
            <div class="yard-inner-card">
              <div class="yard-socket" id="yard-socket-0-0"></div>
              <div class="yard-socket" id="yard-socket-0-1"></div>
            </div>
          </div>

          <div class="ludo-15-yard yard-green" id="yard-1">
            <div class="yard-inner-card">
              <div class="yard-socket" id="yard-socket-1-0"></div>
              <div class="yard-socket" id="yard-socket-1-1"></div>
            </div>
          </div>

          <div class="ludo-15-yard yard-yellow" id="yard-2">
            <div class="yard-inner-card">
              <div class="yard-socket" id="yard-socket-2-0"></div>
              <div class="yard-socket" id="yard-socket-2-1"></div>
            </div>
          </div>

          <div class="ludo-15-yard yard-blue" id="yard-3">
            <div class="yard-inner-card">
              <div class="yard-socket" id="yard-socket-3-0"></div>
              <div class="yard-socket" id="yard-socket-3-1"></div>
            </div>
          </div>

          <!-- Central Victory Home Amphitheater -->
          <div class="ludo-15-center" id="ludo-center-home">
            <div class="center-triangle-red"></div>
            <div class="center-triangle-green"></div>
            <div class="center-triangle-yellow"></div>
            <div class="center-triangle-blue"></div>
            <div class="center-home-trophy" id="center-trophy">🏆</div>
          </div>

          <!-- Dynamic Cells Container -->
          <div id="ludo-cells-container" style="display:contents;"></div>

          <!-- Active Pawns Container -->
          <div id="ludo-pawns-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:20;"></div>
        </div>

        <!-- 3D Interactive Tumbling Dice Controls -->
        <div style="display:flex; align-items:center; gap:1.5rem; justify-content:center; flex-wrap:wrap;">
          
          <div class="dice-container-3d" id="dice-container-wrap">
            <div class="dice-cube" id="ludo-dice-cube" title="Roll 3D Dice">
              <div class="dice-face dice-face-1">
                <div></div><div></div><div></div>
                <div></div><div class="dice-pip" style="background:#dc2626;"></div><div></div>
                <div></div><div></div><div></div>
              </div>
              <div class="dice-face dice-face-6">
                <div class="dice-pip"></div><div></div><div class="dice-pip"></div>
                <div class="dice-pip"></div><div></div><div class="dice-pip"></div>
                <div class="dice-pip"></div><div></div><div class="dice-pip"></div>
              </div>
              <div class="dice-face dice-face-2">
                <div class="dice-pip"></div><div></div><div></div>
                <div></div><div></div><div></div>
                <div></div><div></div><div class="dice-pip"></div>
              </div>
              <div class="dice-face dice-face-5">
                <div class="dice-pip"></div><div></div><div class="dice-pip"></div>
                <div></div><div class="dice-pip"></div><div></div>
                <div class="dice-pip"></div><div></div><div class="dice-pip"></div>
              </div>
              <div class="dice-face dice-face-3">
                <div class="dice-pip"></div><div></div><div></div>
                <div></div><div class="dice-pip"></div><div></div>
                <div></div><div></div><div class="dice-pip"></div>
              </div>
              <div class="dice-face dice-face-4">
                <div class="dice-pip"></div><div></div><div class="dice-pip"></div>
                <div></div><div></div><div></div>
                <div class="dice-pip"></div><div></div><div class="dice-pip"></div>
              </div>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; align-items:flex-start; gap:0.25rem;">
            <div id="ludo-turn-status" style="font-weight:800; font-size:1.15rem; color:#38bdf8;">
              Waiting for turn...
            </div>
            <div id="ludo-dice-hint" style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">
              Tap 3D dice to roll!
            </div>
          </div>

        </div>

      </div>
    `;

    this.buildGridCells();
    this.wireDiceEvents();

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }
  },

  buildGridCells() {
    const container = this.container.querySelector('#ludo-cells-container');
    if (!container) return;

    // Helper to check if (c, r) belongs to a yard (0..5, 0..5), (9..14, 0..5), etc.
    const isYardOrCenter = (c, r) => {
      if (c <= 5 && r <= 5) return true; // Red Yard
      if (c >= 9 && r <= 5) return true; // Green Yard
      if (c >= 9 && r >= 9) return true; // Yellow Yard
      if (c <= 5 && r >= 9) return true; // Blue Yard
      if (c >= 6 && c <= 8 && r >= 6 && r <= 8) return true; // Center
      return false;
    };

    let cellsHtml = '';

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (isYardOrCenter(c, r)) continue;

        let extraClass = '';

        // Safe tiles
        const trackIdx = this.TRACK_COORDS.findIndex(coord => coord[0] === c && coord[1] === r);
        if (trackIdx !== -1 && this.SAFE_TRACK_INDICES.includes(trackIdx)) {
          extraClass += ' tile-safe';
        }

        // Start tiles
        if (c === 1 && r === 6) extraClass += ' tile-red-start';
        else if (c === 8 && r === 1) extraClass += ' tile-green-start';
        else if (c === 13 && r === 8) extraClass += ' tile-yellow-start';
        else if (c === 6 && r === 13) extraClass += ' tile-blue-start';

        // Colored home stretches
        if (r === 7 && c >= 1 && c <= 5) extraClass += ' tile-red-home';
        else if (c === 7 && r >= 1 && r <= 5) extraClass += ' tile-green-home';
        else if (r === 7 && c >= 9 && c <= 13) extraClass += ' tile-yellow-home';
        else if (c === 7 && r >= 9 && r <= 13) extraClass += ' tile-blue-home';

        cellsHtml += `
          <div class="ludo-15-tile${extraClass}" style="grid-column: ${c + 1}; grid-row: ${r + 1};" data-col="${c}" data-row="${r}" id="ludo-cell-${c}-${r}">
          </div>
        `;
      }
    }

    container.innerHTML = cellsHtml;
  },

  wireDiceEvents() {
    const diceCube = this.container.querySelector('#ludo-dice-cube');
    if (!diceCube) return;

    diceCube.addEventListener('click', () => {
      if (this.isRolling || this.isAnimatingMove) return;
      if (!this.gameState || this.gameState.currentTurn !== this.myPlayerIndex) {
        this.app.toast('Wait for your turn!');
        return;
      }
      if (this.gameState.hasRolled) {
        this.app.toast('Click your highlighted token to move!');
        return;
      }

      this.triggerDiceRoll();
      this.socket.emit('player_action', { type: 'roll_dice' });
    });
  },

  triggerDiceRoll() {
    const diceCube = this.container.querySelector('#ludo-dice-cube');
    if (!diceCube) return;

    this.isRolling = true;
    this.app.playSfx('dice');
    diceCube.classList.remove('dice-turn-pulse');
    diceCube.classList.add('rolling');

    setTimeout(() => {
      this.isRolling = false;
      diceCube.classList.remove('rolling');
      if (this.gameState && this.gameState.diceValue) {
        this.setDiceFace(this.gameState.diceValue);
      }
    }, 650);
  },

  setDiceFace(val) {
    const diceCube = this.container.querySelector('#ludo-dice-cube');
    if (!diceCube) return;

    const ROTATIONS = {
      1: 'rotateX(0deg) rotateY(0deg)',
      2: 'rotateX(0deg) rotateY(90deg)',
      3: 'rotateX(-90deg) rotateY(0deg)',
      4: 'rotateX(90deg) rotateY(0deg)',
      5: 'rotateX(0deg) rotateY(-90deg)',
      6: 'rotateX(0deg) rotateY(180deg)'
    };

    diceCube.style.transform = ROTATIONS[val] || 'rotateX(0deg) rotateY(0deg)';
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    // Handle events (dice roll, captures, home celebrations)
    events.forEach(evt => {
      if (evt.type === 'dice_rolled') {
        if (!this.isRolling) {
          this.triggerDiceRoll();
        }
      } else if (evt.type === 'token_captured') {
        this.app.toast('⚔️ CAPTURE! Opponent token sent back to base!');
        this.app.playSfx('hit');
      } else if (evt.type === 'token_home') {
        this.app.toast('🏁 TOKEN REACHED HOME! Extra turn awarded! 🎉');
        this.app.playSfx('fanfare');
        this.app.triggerConfetti(60);
      } else if (evt.type === 'bonus_roll') {
        this.app.toast('🎲 Rolled a 6! You get another roll!');
      } else if (evt.type === 'no_moves') {
        this.app.toast('No moves possible with this roll.');
      } else if (evt.type === 'game_over') {
        if (evt.winner === this.myPlayerIndex) {
          this.app.playSfx('win');
          this.app.triggerConfetti(120);
        } else {
          this.app.playSfx('lose');
        }
      }
    });

    if (state.diceValue && !this.isRolling) {
      this.setDiceFace(state.diceValue);
    }

    this.updateControlsUI();
    this.renderTokens();
  },

  updateControlsUI() {
    const state = this.gameState;
    if (!state) return;

    const diceCube = this.container.querySelector('#ludo-dice-cube');
    const turnStatus = this.container.querySelector('#ludo-turn-status');
    const diceHint = this.container.querySelector('#ludo-dice-hint');

    const isMyTurn = state.currentTurn === this.myPlayerIndex;
    const activePlayerName = this.roomInfo.players[state.currentTurn]?.name || `Player ${state.currentTurn + 1}`;

    if (isMyTurn) {
      if (!state.hasRolled) {
        turnStatus.textContent = '🎲 Your turn to roll!';
        turnStatus.style.color = '#38bdf8';
        diceHint.textContent = 'Tap the 3D dice to roll!';
        if (diceCube && !this.isRolling) diceCube.classList.add('dice-turn-pulse');
      } else {
        turnStatus.textContent = '👉 Tap a glowing token to move!';
        turnStatus.style.color = '#10b981';
        diceHint.textContent = `Rolled a ${state.diceValue}! Select token.`;
        if (diceCube) diceCube.classList.remove('dice-turn-pulse');
      }
    } else {
      turnStatus.textContent = `⏳ ${activePlayerName}'s turn...`;
      turnStatus.style.color = 'var(--text-muted)';
      diceHint.textContent = 'Waiting for opponent move...';
      if (diceCube) diceCube.classList.remove('dice-turn-pulse');
    }
  },

  getCoordinatesForToken(playerIndex, tok) {
    if (tok.status === 'base') {
      const socketCoord = this.BASE_SOCKET_COORDS[playerIndex][tok.id] || [2, 2];
      return { col: socketCoord[0], row: socketCoord[1], type: 'yard' };
    }

    if (tok.status === 'home') {
      // Center coordinates based on player direction
      const centerCoords = [[6, 7], [7, 6], [8, 7], [7, 8]];
      const c = centerCoords[playerIndex] || [7, 7];
      return { col: c[0], row: c[1], type: 'home' };
    }

    if (tok.status === 'home_stretch') {
      // Stretch index: tok.step ranges from 51 to 55
      const stretchIdx = Math.max(0, Math.min(5, tok.step - 51));
      const coord = this.HOME_STRETCHES[playerIndex][stretchIdx];
      return { col: coord[0], row: coord[1], type: 'stretch' };
    }

    // On common track (step 0..50)
    const globalIdx = (this.START_TRACK_INDICES[playerIndex] + tok.step) % 52;
    const coord = this.TRACK_COORDS[globalIdx];
    return { col: coord[0], row: coord[1], type: 'track' };
  },

  renderTokens() {
    const overlay = this.container.querySelector('#ludo-pawns-overlay');
    const board = this.container.querySelector('#ludo-board');
    if (!overlay || !board || !this.gameState) return;

    overlay.innerHTML = '';
    const boardRect = board.getBoundingClientRect();
    const cellSize = boardRect.width / 15;

    this.gameState.players.forEach((player, pIdx) => {
      player.tokens.forEach(tok => {
        const coords = this.getCoordinatesForToken(pIdx, tok);
        const isMovable = this.gameState.currentTurn === this.myPlayerIndex &&
                          pIdx === this.myPlayerIndex &&
                          this.gameState.hasRolled &&
                          this.gameState.movableTokens.includes(tok.id);

        const pawn = document.createElement('div');
        pawn.className = `ludo-pawn ${isMovable ? 'pawn-movable' : ''}`;
        pawn.style.background = this.playerColors[pIdx];
        pawn.textContent = tok.status === 'home' ? '★' : `${tok.id + 1}`;
        pawn.title = `${this.playerNames[pIdx]} Pawn ${tok.id + 1} (${tok.status})`;

        // Precise positioning on 15x15 board
        const posX = (coords.col + 0.5) * cellSize;
        const posY = (coords.row + 0.5) * cellSize;

        pawn.style.position = 'absolute';
        pawn.style.left = `${posX}px`;
        pawn.style.top = `${posY}px`;
        pawn.style.transform = 'translate(-50%, -50%)';
        pawn.style.pointerEvents = isMovable ? 'auto' : 'none';

        if (isMovable) {
          pawn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.isAnimatingMove) return;
            this.animateTokenMove(pIdx, tok.id);
            this.socket.emit('player_action', { type: 'move_token', tokenId: tok.id });
          });
        }

        overlay.appendChild(pawn);
      });
    });
  },

  animateTokenMove(playerIndex, tokenId) {
    this.isAnimatingMove = true;
    this.app.playSfx('hop');

    setTimeout(() => {
      this.isAnimatingMove = false;
    }, 450);
  },

  onDestroy() {
    this.container.innerHTML = '';
  }
};
