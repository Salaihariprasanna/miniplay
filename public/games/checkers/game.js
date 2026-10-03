/**
 * Checkers Client Module
 */
window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['checkers'] = {
  init(container, socket, roomInfo, myPlayerIndex, app) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.myPlayerIndex = myPlayerIndex;
    this.app = app;

    this.selectedSquare = null;
    this.validMoves = [];

    this.render();
  },

  render() {
    let gridHtml = '<div class="checkers-board-wrapper"><div class="checkers-grid" id="checkers-grid">';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isDark = (r + c) % 2 === 1;
        gridHtml += `<div class="board-cell ${isDark ? 'dark' : 'light'}" data-r="${r}" data-c="${c}"></div>`;
      }
    }
    gridHtml += '</div></div>';

    this.container.innerHTML = gridHtml;

    const grid = this.container.querySelector('#checkers-grid');
    grid.addEventListener('click', (e) => {
      const cell = e.target.closest('.board-cell');
      if (!cell) return;
      const r = parseInt(cell.dataset.r, 10);
      const c = parseInt(cell.dataset.c, 10);
      this.handleSquareClick(r, c);
    });

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }
  },

  handleSquareClick(r, c) {
    if (this.gameState && this.gameState.currentTurn !== this.myPlayerIndex) {
      this.app.toast('Wait for your turn!');
      return;
    }

    const piece = this.gameState.board[r][c];

    if (this.selectedSquare) {
      const move = this.validMoves.find(m => m.r === r && m.c === c);
      if (move) {
        this.app.playSfx('move');
        this.socket.emit('player_action', {
          type: 'move',
          fromR: this.selectedSquare.r,
          fromC: this.selectedSquare.c,
          toR: r,
          toC: c
        }, (res) => {
          if (res && !res.valid && res.error) {
            this.app.toast(res.error);
          }
        });
        this.selectedSquare = null;
        this.validMoves = [];
        this.updateHighlights();
        return;
      }
    }

    if (piece && piece.player === this.myPlayerIndex) {
      this.selectedSquare = { r, c };
      this.socket.emit('player_action', { type: 'get_valid_moves', fromR: r, fromC: c }, (res) => {
        if (res && res.valid) {
          this.validMoves = res.moves || [];
          this.updateHighlights();
        }
      });
      this.app.playSfx('click');
      return;
    }

    this.selectedSquare = null;
    this.validMoves = [];
    this.updateHighlights();
  },

  updateHighlights() {
    const cells = this.container.querySelectorAll('.board-cell');
    cells.forEach(cell => {
      cell.classList.remove('selected', 'valid-dest');
      const r = parseInt(cell.dataset.r, 10);
      const c = parseInt(cell.dataset.c, 10);

      if (this.selectedSquare && this.selectedSquare.r === r && this.selectedSquare.c === c) {
        cell.classList.add('selected');
      }
      if (this.validMoves.some(m => m.r === r && m.c === c)) {
        cell.classList.add('valid-dest');
      }
    });
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = this.container.querySelector(`.board-cell[data-r="${r}"][data-c="${c}"]`);
        if (!cell) continue;

        cell.innerHTML = '';
        const piece = state.board[r][c];
        if (piece) {
          const disc = document.createElement('div');
          disc.className = `checker-disc ${piece.player === 0 ? 'red' : 'black'}`;
          if (piece.isKing) {
            disc.textContent = '👑';
          }
          cell.appendChild(disc);
        }
      }
    }

    this.updateHighlights();

    events.forEach(evt => {
      if (evt.type === 'piece_moved') {
        this.app.playSfx('move');
      } else if (evt.type === 'piece_captured') {
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
