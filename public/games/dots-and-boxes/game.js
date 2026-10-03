/**
 * Dots and Boxes Client Module
 */
window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['dots-and-boxes'] = {
  init(container, socket, roomInfo, myPlayerIndex, app) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.myPlayerIndex = myPlayerIndex;
    this.app = app;

    this.playerColors = ['#38bdf8', '#f43f5e', '#10b981', '#fbbf24'];
    this.render();
  },

  render() {
    const size = 3; // 3x3 boxes
    let boardHtml = '<div class="dnb-board" id="dnb-board">';

    for (let r = 0; r <= size; r++) {
      // Row with dots and horizontal lines
      boardHtml += '<div class="dnb-row">';
      for (let c = 0; c <= size; c++) {
        boardHtml += '<div class="dnb-dot"></div>';
        if (c < size) {
          boardHtml += `<div class="dnb-line-h" data-dir="H" data-r="${r}" data-c="${c}"></div>`;
        }
      }
      boardHtml += '</div>';

      // Row with vertical lines and box interiors
      if (r < size) {
        boardHtml += '<div class="dnb-row">';
        for (let c = 0; c <= size; c++) {
          boardHtml += `<div class="dnb-line-v" data-dir="V" data-r="${r}" data-c="${c}"></div>`;
          if (c < size) {
            boardHtml += `<div class="dnb-box" id="dnb-box-${r}-${c}"></div>`;
          }
        }
        boardHtml += '</div>';
      }
    }
    boardHtml += '</div>';

    this.container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:1.25rem;">
        <div id="dnb-scores-rack" style="display:flex; gap:1rem;"></div>
        ${boardHtml}
      </div>
    `;

    const board = this.container.querySelector('#dnb-board');
    board.addEventListener('click', (e) => {
      const line = e.target.closest('.dnb-line-h, .dnb-line-v');
      if (!line || line.classList.contains('active')) return;

      const dir = line.dataset.dir;
      const r = parseInt(line.dataset.r, 10);
      const c = parseInt(line.dataset.c, 10);
      this.handleLineClick(dir, r, c);
    });

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }
  },

  handleLineClick(dir, r, c) {
    if (this.gameState && this.gameState.currentTurn !== this.myPlayerIndex) {
      this.app.toast('Wait for your turn!');
      return;
    }
    this.app.playSfx('click');
    this.socket.emit('player_action', { type: 'draw_line', dir, r, c });
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    // Scores rack
    const rack = this.container.querySelector('#dnb-scores-rack');
    if (rack) {
      rack.innerHTML = this.roomInfo.players.map((p, idx) => `
        <div class="score-badge" style="background:rgba(15,23,42,0.6); padding:0.4rem 0.8rem; border-radius:10px; border:1px solid ${state.currentTurn === idx ? 'var(--primary)' : 'var(--border)'}">
          <span class="score-name" style="${state.currentTurn === idx ? 'color:#38bdf8; font-weight:700;' : ''}">${p.name} ${state.currentTurn === idx ? '✏️' : ''}</span>
          <span class="score-val" style="font-size:1.25rem; color:${this.playerColors[idx]}">${state.scores[idx] || 0} boxes</span>
        </div>
      `).join('');
    }

    // Horizontal lines
    state.hLines.forEach((row, r) => {
      row.forEach((owner, c) => {
        if (owner !== null) {
          const el = this.container.querySelector(`.dnb-line-h[data-r="${r}"][data-c="${c}"]`);
          if (el) {
            el.classList.add('active');
            el.style.background = this.playerColors[owner];
          }
        }
      });
    });

    // Vertical lines
    state.vLines.forEach((row, r) => {
      row.forEach((owner, c) => {
        if (owner !== null) {
          const el = this.container.querySelector(`.dnb-line-v[data-r="${r}"][data-c="${c}"]`);
          if (el) {
            el.classList.add('active');
            el.style.background = this.playerColors[owner];
          }
        }
      });
    });

    // Boxes
    state.boxes.forEach((row, r) => {
      row.forEach((owner, c) => {
        if (owner !== null) {
          const box = this.container.querySelector(`#dnb-box-${r}-${c}`);
          if (box && !box.textContent) {
            box.textContent = this.roomInfo.players[owner]?.name?.[0]?.toUpperCase() || `P${owner + 1}`;
            box.style.background = `${this.playerColors[owner]}33`;
            box.style.color = this.playerColors[owner];
            box.style.border = `2px solid ${this.playerColors[owner]}`;
          }
        }
      });
    });

    events.forEach(evt => {
      if (evt.type === 'line_drawn') {
        this.app.playSfx('move');
      } else if (evt.type === 'boxes_captured') {
        this.app.playSfx('match');
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
