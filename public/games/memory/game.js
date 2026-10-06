/**
 * Memory Cards Client Module — 3D Flip & Sparkle Edition
 */
window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['memory'] = {
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
      <div style="display:flex; flex-direction:column; align-items:center; gap:1.25rem;">
        <div id="memory-scores-rack" style="display:flex; gap:1rem; flex-wrap:wrap; justify-content:center;"></div>
        <div class="memory-grid" id="memory-grid"></div>
      </div>
    `;

    const grid = this.container.querySelector('#memory-grid');
    grid.addEventListener('click', (e) => {
      const cardEl = e.target.closest('.memory-card');
      if (!cardEl) return;
      const index = parseInt(cardEl.dataset.index, 10);
      this.handleCardClick(index);
    });

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }
  },

  handleCardClick(cardIndex) {
    if (this.gameState && this.gameState.currentTurn !== this.myPlayerIndex && this.gameState.playerCount > 1) {
      this.app.toast('Wait for your turn!');
      return;
    }
    if (this.gameState && this.gameState.isEvaluating) return;

    this.app.playSfx('flip');
    this.socket.emit('player_action', { type: 'flip', cardIndex }, (res) => {
      if (res && !res.valid && res.error) {
        this.app.toast(res.error);
      }
    });
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    // Render scores
    const rack = this.container.querySelector('#memory-scores-rack');
    if (rack) {
      rack.innerHTML = this.roomInfo.players.map((p, idx) => `
        <div class="score-badge" style="background:rgba(15,23,42,0.7); padding:0.4rem 0.9rem; border-radius:12px; border:2px solid ${state.currentTurn === idx ? 'var(--primary)' : 'var(--border)'}">
          <span class="score-name" style="${state.currentTurn === idx ? 'color:#38bdf8; font-weight:700;' : ''}">${p.avatar || '👤'} ${p.name} ${state.currentTurn === idx ? '🎲' : ''}</span>
          <span class="score-val" style="font-size:1.3rem;">${state.scores[idx] || 0} pts</span>
        </div>
      `).join('');
    }

    // Render grid
    const grid = this.container.querySelector('#memory-grid');
    if (grid && grid.children.length === 0) {
      grid.innerHTML = state.cards.map((card, idx) => `
        <div class="memory-card" data-index="${idx}">
          <div class="memory-face memory-back">❓</div>
          <div class="memory-face memory-front"></div>
        </div>
      `).join('');
    }

    // Update card states
    state.cards.forEach((card, idx) => {
      const cardEl = grid.children[idx];
      if (!cardEl) return;

      const front = cardEl.querySelector('.memory-front');
      const isFlipped = card.symbol !== null;

      if (isFlipped) {
        front.textContent = card.symbol;
        cardEl.classList.add('flipped');
      } else {
        cardEl.classList.remove('flipped');
      }

      if (card.matched) {
        cardEl.classList.add('matched');
      }
    });

    events.forEach(evt => {
      if (evt.type === 'pair_matched') {
        this.app.playSfx('match');
        this.app.triggerConfetti(40);
        this.app.toast('✨ Pair Matched!');
      } else if (evt.type === 'mismatch') {
        setTimeout(() => {
          this.socket.emit('player_action', { type: 'resolve_mismatch' });
        }, 1100);
      } else if (evt.type === 'game_over') {
        if (evt.winner === this.myPlayerIndex) {
          this.app.playSfx('win');
          this.app.triggerConfetti(100);
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
