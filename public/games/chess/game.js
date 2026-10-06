/**
 * Chess Client Module — Smooth Glide & King Check Edition
 */
window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['chess'] = {
  init(container, socket, roomInfo, myPlayerIndex, app) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.myPlayerIndex = myPlayerIndex;
    this.app = app;

    this.selectedSquare = null;
    this.validMoves = [];
    this.lastMove = null;

    this.PIECE_SYMBOLS = {
      'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙', // White
      'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'  // Black
    };

    this.render();
  },

  render() {
    let gridHtml = '<div class="chess-board-wrapper"><div class="chess-grid" id="chess-grid">';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isDark = (r + c) % 2 === 1;
        gridHtml += `<div class="board-cell ${isDark ? 'dark' : 'light'}" data-r="${r}" data-c="${c}"></div>`;
      }
    }
    gridHtml += '</div></div>';

    this.container.innerHTML = gridHtml;

    const grid = this.container.querySelector('#chess-grid');
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

    // Check if clicking a destination from selectedSquare
    if (this.selectedSquare) {
      const isTarget = this.validMoves.some(m => m.r === r && m.c === c);
      if (isTarget) {
        this.app.playSfx('move');
        this.lastMove = { fromR: this.selectedSquare.r, fromC: this.selectedSquare.c, toR: r, toC: c };
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

    // Select piece
    if (piece) {
      const isMyPiece = this.myPlayerIndex === 0 ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
      if (isMyPiece) {
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
    }

    this.selectedSquare = null;
    this.validMoves = [];
    this.updateHighlights();
  },

  updateHighlights() {
    const cells = this.container.querySelectorAll('.board-cell');
    cells.forEach(cell => {
      cell.classList.remove('selected', 'valid-dest');
      cell.style.outline = '';
      const r = parseInt(cell.dataset.r, 10);
      const c = parseInt(cell.dataset.c, 10);

      if (this.selectedSquare && this.selectedSquare.r === r && this.selectedSquare.c === c) {
        cell.classList.add('selected');
      }
      if (this.validMoves.some(m => m.r === r && m.c === c)) {
        cell.classList.add('valid-dest');
      }
      if (this.lastMove) {
        if ((this.lastMove.fromR === r && this.lastMove.fromC === c) || (this.lastMove.toR === r && this.lastMove.toC === c)) {
          cell.style.outline = '2px solid rgba(245, 158, 11, 0.7)';
        }
      }
    });
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = this.container.querySelector(`.board-cell[data-r="${r}"][data-c="${c}"]`);
        if (!cell) continue;

        const piece = state.board[r][c];
        cell.textContent = piece ? (this.PIECE_SYMBOLS[piece] || piece) : '';
      }
    }

    this.updateHighlights();

    events.forEach(evt => {
      if (evt.type === 'piece_moved') {
        this.app.playSfx('move');
        this.lastMove = { fromR: evt.fromR, fromC: evt.fromC, toR: evt.toR, toC: evt.toC };
        this.updateHighlights();
      } else if (evt.type === 'piece_captured') {
        this.app.playSfx('hit');
      } else if (evt.type === 'check') {
        this.app.toast('⚠️ CHECK!');
      } else if (evt.type === 'game_over') {
        if (evt.winner === this.myPlayerIndex) {
          this.app.playSfx('win');
          this.app.triggerConfetti(120);
        } else {
          this.app.playSfx('lose');
        }
      }
    });
  },

  onDestroy() {
    this.container.innerHTML = '';
  }
};
