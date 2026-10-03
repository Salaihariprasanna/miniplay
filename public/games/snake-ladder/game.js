/**
 * Snake & Ladder Client Module
 */
window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['snake-ladder'] = {
  init(container, socket, roomInfo, myPlayerIndex, app) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.myPlayerIndex = myPlayerIndex;
    this.app = app;

    this.playerColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
    this.render();
  },

  render() {
    // Generate 100 tiles in boustrophedon order (row 10: 100..91, row 9: 81..90, etc.)
    let tilesHtml = '';
    for (let r = 9; r >= 0; r--) {
      const isEvenRow = r % 2 === 1;
      for (let c = 0; c < 10; c++) {
        const num = isEvenRow ? (r * 10 + (10 - c)) : (r * 10 + (c + 1));
        tilesHtml += `<div class="snl-tile" data-tile="${num}" id="snl-tile-${num}">
          <span class="snl-tile-num">${num}</span>
          <div class="snl-token-rack"></div>
        </div>`;
      }
    }

    this.container.innerHTML = `
      <div class="snl-container">
        <div class="snl-board" id="snl-board">
          ${tilesHtml}
        </div>

        <div class="snl-controls">
          <button id="btn-snl-dice" class="dice-btn" title="Roll Dice">
            🎲
          </button>
          <div id="snl-turn-info" style="font-weight:700; font-size:1.1rem;">
            Roll the dice!
          </div>
        </div>
      </div>
    `;

    const diceBtn = this.container.querySelector('#btn-snl-dice');
    diceBtn.addEventListener('click', () => {
      if (this.gameState && this.gameState.currentTurn !== this.myPlayerIndex) {
        this.app.toast('Wait for your turn!');
        return;
      }
      this.app.playSfx('dice');
      diceBtn.disabled = true;
      this.socket.emit('player_action', { type: 'roll_dice' });
    });

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    // Decorate snakes and ladders
    if (state.ladders) {
      Object.keys(state.ladders).forEach(start => {
        const tile = this.container.querySelector(`#snl-tile-${start}`);
        if (tile && !tile.classList.contains('ladder-tile')) {
          tile.classList.add('ladder-tile');
          tile.title = `Ladder up to ${state.ladders[start]}`;
          tile.innerHTML += `<span style="font-size:0.75rem; position:absolute; right:2px; top:2px;">🪜${state.ladders[start]}</span>`;
        }
      });
    }

    if (state.snakes) {
      Object.keys(state.snakes).forEach(head => {
        const tile = this.container.querySelector(`#snl-tile-${head}`);
        if (tile && !tile.classList.contains('snake-tile')) {
          tile.classList.add('snake-tile');
          tile.title = `Snake down to ${state.snakes[head]}`;
          tile.innerHTML += `<span style="font-size:0.75rem; position:absolute; right:2px; top:2px;">🐍${state.snakes[head]}</span>`;
        }
      });
    }

    // Clear and redraw tokens
    this.container.querySelectorAll('.snl-token-rack').forEach(r => r.innerHTML = '');

    state.positions.forEach((pos, pIdx) => {
      const tile = this.container.querySelector(`#snl-tile-${pos}`);
      if (tile) {
        const rack = tile.querySelector('.snl-token-rack');
        if (rack) {
          const tok = document.createElement('div');
          tok.className = 'snl-token';
          tok.style.background = this.playerColors[pIdx % this.playerColors.length];
          tok.title = `${this.roomInfo.players[pIdx]?.name || `Player ${pIdx + 1}`}: Tile ${pos}`;
          rack.appendChild(tok);
        }
      }
    });

    // Update dice button
    const diceBtn = this.container.querySelector('#btn-snl-dice');
    const turnInfo = this.container.querySelector('#snl-turn-info');

    const DICE_ICONS = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    if (state.lastDice) {
      diceBtn.textContent = DICE_ICONS[state.lastDice - 1] || state.lastDice;
    }

    const isMyTurn = state.currentTurn === this.myPlayerIndex;
    diceBtn.disabled = !isMyTurn || state.winner !== null;

    const currPlayerName = this.roomInfo.players[state.currentTurn]?.name || `Player ${state.currentTurn + 1}`;
    turnInfo.textContent = isMyTurn ? '🎲 Your turn to roll!' : `Waiting for ${currPlayerName} to roll...`;

    events.forEach(evt => {
      if (evt.type === 'token_moved') {
        this.app.playSfx('move');
      } else if (evt.specialEvent?.type === 'ladder_climbed') {
        this.app.toast(`🪜 Climbed ladder to ${evt.specialEvent.to}!`);
        this.app.playSfx('win');
      } else if (evt.specialEvent?.type === 'snake_bitten') {
        this.app.toast(`🐍 Bitten by snake! Slid to ${evt.specialEvent.to}!`);
        this.app.playSfx('hit');
      } else if (evt.type === 'game_over') {
        if (evt.winner === this.myPlayerIndex) this.app.playSfx('win');
        else this.app.playSfx('lose');
      }
    });
  },

  onDestroy() {
    this.container.innerHTML = '';
  }
};
