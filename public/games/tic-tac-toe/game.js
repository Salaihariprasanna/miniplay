/**
 * Tic Tac Toe Client Module — Animated Edition
 */
window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['tic-tac-toe'] = {
  init(container, socket, roomInfo, myPlayerIndex, app) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.myPlayerIndex = myPlayerIndex;
    this.app = app;

    this.render();
  },

  render() {
    this.container.innerHTML = `
      <div class="ttt-container">
        <div class="ttt-board" id="ttt-board">
          ${Array(9).fill(0).map((_, i) => `<div class="ttt-cell" data-index="${i}"></div>`).join('')}
        </div>
      </div>
    `;

    const board = this.container.querySelector('#ttt-board');
    board.addEventListener('click', (e) => {
      const cell = e.target.closest('.ttt-cell');
      if (!cell) return;
      const index = parseInt(cell.dataset.index, 10);
      this.handleClick(index);
    });

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }
  },

  handleClick(cellIndex) {
    if (this.gameState && this.gameState.currentTurn !== this.myPlayerIndex) {
      this.app.toast('Wait for your turn!');
      return;
    }
    if (this.gameState && this.gameState.winner !== null) return;
    if (this.gameState && this.gameState.board[cellIndex] !== null) return;

    this.app.playSfx('click');
    this.socket.emit('player_action', { type: 'move', cellIndex }, (res) => {
      if (res && !res.valid && res.error) {
        this.app.toast(res.error);
      }
    });
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;
    const cells = this.container.querySelectorAll('.ttt-cell');

    // Update cells with SVG animations
    state.board.forEach((val, idx) => {
      const cell = cells[idx];
      if (!cell) return;

      if (!val) {
        cell.innerHTML = '';
        cell.className = 'ttt-cell';
      } else if (!cell.querySelector('svg')) {
        cell.className = `ttt-cell ${val.toLowerCase()}`;
        if (val === 'X') {
          cell.innerHTML = `
            <svg viewBox="0 0 50 50" style="width:70%; height:70%; filter:drop-shadow(0 0 8px rgba(56,189,248,0.7));">
              <line x1="10" y1="10" x2="40" y2="40" stroke="#38bdf8" stroke-width="6" stroke-linecap="round" stroke-dasharray="45" stroke-dashoffset="45" style="animation:drawStroke 0.2s forwards ease-out;" />
              <line x1="40" y1="10" x2="10" y2="40" stroke="#38bdf8" stroke-width="6" stroke-linecap="round" stroke-dasharray="45" stroke-dashoffset="45" style="animation:drawStroke 0.2s 0.1s forwards ease-out;" />
            </svg>
          `;
        } else if (val === 'O') {
          cell.innerHTML = `
            <svg viewBox="0 0 50 50" style="width:70%; height:70%; filter:drop-shadow(0 0 8px rgba(244,63,94,0.7));">
              <circle cx="25" cy="25" r="16" stroke="#f43f5e" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="105" stroke-dashoffset="105" style="animation:drawStroke 0.3s forwards ease-out;" />
            </svg>
          `;
        }
      }

      if (state.winningLine && state.winningLine.includes(idx)) {
        cell.classList.add('win');
      }
    });

    // Check events for SFX
    events.forEach(evt => {
      if (evt.type === 'cell_marked') {
        this.app.playSfx('move');
      } else if (evt.type === 'game_over') {
        if (evt.result === 'win') {
          if (evt.winner === this.myPlayerIndex) {
            this.app.playSfx('win');
            this.app.triggerConfetti(90);
          } else {
            this.app.playSfx('lose');
          }
        } else {
          this.app.playSfx('click');
        }
      }
    });
  },

  onDestroy() {
    this.container.innerHTML = '';
  }
};
