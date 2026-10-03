/**
 * Connect Four Client Module
 */
window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['connect-four'] = {
  init(container, socket, roomInfo, myPlayerIndex, app) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.myPlayerIndex = myPlayerIndex;
    this.app = app;

    this.render();
  },

  render() {
    let boardHtml = '<div class="c4-container"><div class="c4-board" id="c4-board">';
    for (let c = 0; c < 7; c++) {
      boardHtml += `<div class="c4-col" data-col="${c}">`;
      for (let r = 0; r < 6; r++) {
        boardHtml += `<div class="c4-cell" data-row="${r}" data-col="${c}"></div>`;
      }
      boardHtml += `</div>`;
    }
    boardHtml += '</div></div>';

    this.container.innerHTML = boardHtml;

    const board = this.container.querySelector('#c4-board');
    board.addEventListener('click', (e) => {
      const colEl = e.target.closest('.c4-col');
      if (!colEl) return;
      const col = parseInt(colEl.dataset.col, 10);
      this.handleDrop(col);
    });

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }
  },

  handleDrop(col) {
    if (this.gameState && this.gameState.currentTurn !== this.myPlayerIndex) {
      this.app.toast('Wait for your turn!');
      return;
    }
    if (this.gameState && this.gameState.winner !== null) return;

    this.app.playSfx('click');
    this.socket.emit('player_action', { type: 'drop', col }, (res) => {
      if (res && !res.valid && res.error) {
        this.app.toast(res.error);
      }
    });
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        const cell = this.container.querySelector(`.c4-cell[data-row="${r}"][data-col="${c}"]`);
        if (!cell) continue;

        const val = state.board[r][c];
        cell.className = 'c4-cell' + (val !== null ? ` p${val}` : '');

        if (state.winningCells) {
          const isWin = state.winningCells.some(([wr, wc]) => wr === r && wc === c);
          if (isWin) cell.classList.add('win');
        }
      }
    }

    events.forEach(evt => {
      if (evt.type === 'token_dropped') {
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
