/**
 * Tic Tac Toe Client Module
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

    // Update cells
    state.board.forEach((val, idx) => {
      const cell = cells[idx];
      if (!cell) return;
      cell.textContent = val || '';
      cell.className = 'ttt-cell' + (val ? ` ${val.toLowerCase()}` : '');

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
          if (evt.winner === this.myPlayerIndex) this.app.playSfx('win');
          else this.app.playSfx('lose');
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
