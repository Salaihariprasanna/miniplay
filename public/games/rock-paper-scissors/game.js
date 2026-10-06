/**
 * Rock Paper Scissors Client Module — Clash Animation Edition
 */
window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['rock-paper-scissors'] = {
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
      <div class="rps-container">
        <!-- Versus Duel Arena -->
        <div class="rps-arena-duel">
          <div class="rps-duel-side" id="rps-p0-side">
            <div class="rps-duel-hand" id="rps-hand-0">❓</div>
            <strong id="rps-p0-name">Player 1</strong>
            <span class="badge-players" id="rps-p0-score">Score: 0</span>
          </div>

          <div class="rps-vs-badge" id="rps-vs-status">VS</div>

          <div class="rps-duel-side" id="rps-p1-side">
            <div class="rps-duel-hand" id="rps-hand-1">❓</div>
            <strong id="rps-p1-name">Player 2</strong>
            <span class="badge-players" id="rps-p1-score">Score: 0</span>
          </div>
        </div>

        <!-- Choice Cards -->
        <div class="rps-cards-row">
          <button class="rps-card-btn" data-choice="rock">
            <span class="rps-card-icon">✊</span>
            <span class="rps-card-label">Rock</span>
          </button>
          <button class="rps-card-btn" data-choice="paper">
            <span class="rps-card-icon">✋</span>
            <span class="rps-card-label">Paper</span>
          </button>
          <button class="rps-card-btn" data-choice="scissors">
            <span class="rps-card-icon">✌️</span>
            <span class="rps-card-label">Scissors</span>
          </button>
        </div>

        <!-- Next Round Button -->
        <button id="btn-rps-next" class="btn-primary" style="display: none; padding: 0.75rem 2rem; font-size:1.1rem; font-weight:800;">
          Next Round ➡️
        </button>
      </div>
    `;

    // Handle clicks
    this.container.querySelectorAll('.rps-card-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const choice = btn.dataset.choice;
        this.handlePick(choice);
      });
    });

    const nextBtn = this.container.querySelector('#btn-rps-next');
    nextBtn.addEventListener('click', () => {
      this.socket.emit('player_action', { type: 'next_round' });
      this.app.playSfx('click');
    });

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }
  },

  handlePick(choice) {
    if (this.gameState && this.gameState.revealed) return;
    if (this.gameState && this.gameState.myChoice) return;

    this.app.playSfx('click');
    this.socket.emit('player_action', { type: 'choose', choice }, (res) => {
      if (res && !res.valid && res.error) {
        this.app.toast(res.error);
      }
    });
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    const ICONS = { rock: '✊', paper: '✋', scissors: '✌️' };
    const p0 = this.roomInfo.players[0];
    const p1 = this.roomInfo.players[1];
    const p0Name = p0?.name || 'Player 1';
    const p1Name = p1?.name || 'Player 2';

    const p0NameEl = this.container.querySelector('#rps-p0-name');
    const p1NameEl = this.container.querySelector('#rps-p1-name');
    const p0ScoreEl = this.container.querySelector('#rps-p0-score');
    const p1ScoreEl = this.container.querySelector('#rps-p1-score');

    if (p0NameEl) p0NameEl.textContent = `${p0?.avatar || '👤'} ${p0Name}`;
    if (p1NameEl) p1NameEl.textContent = `${p1?.avatar || '👤'} ${p1Name}`;
    if (p0ScoreEl) p0ScoreEl.textContent = `Score: ${state.scores[0]}`;
    if (p1ScoreEl) p1ScoreEl.textContent = `Score: ${state.scores[1]}`;

    const hand0 = this.container.querySelector('#rps-hand-0');
    const hand1 = this.container.querySelector('#rps-hand-1');
    const vsStatus = this.container.querySelector('#rps-vs-status');
    const nextBtn = this.container.querySelector('#btn-rps-next');

    // Highlight selected card
    const buttons = this.container.querySelectorAll('.rps-card-btn');
    buttons.forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.choice === state.myChoice);
      btn.disabled = !!state.myChoice || state.revealed;
    });

    if (state.revealed) {
      // Both revealed with clash animation
      hand0.textContent = ICONS[state.choices[0]];
      hand1.textContent = ICONS[state.choices[1]];
      hand0.style.transform = 'scale(1.3)';
      hand1.style.transform = 'scale(1.3)';
      setTimeout(() => {
        hand0.style.transform = '';
        hand1.style.transform = '';
      }, 300);

      nextBtn.style.display = 'inline-flex';

      if (state.roundWinner === 'draw') {
        vsStatus.textContent = '🤝 DRAW!';
        vsStatus.style.color = '#fbbf24';
      } else {
        const winnerName = this.roomInfo.players[state.roundWinner]?.name || `Player ${state.roundWinner + 1}`;
        vsStatus.textContent = `🎉 ${winnerName} Wins!`;
        vsStatus.style.color = state.roundWinner === this.myPlayerIndex ? '#34d399' : '#f43f5e';
      }
    } else {
      nextBtn.style.display = 'none';
      vsStatus.textContent = 'VS';
      vsStatus.style.color = '#f43f5e';

      // Secret indicator
      const hasPicked = state.hasPicked || [false, false];
      hand0.textContent = hasPicked[0] ? '🔒 Locked' : '⏳ Choosing...';
      hand1.textContent = hasPicked[1] ? '🔒 Locked' : '⏳ Choosing...';
    }

    events.forEach(evt => {
      if (evt.type === 'round_revealed') {
        if (evt.winner === this.myPlayerIndex) {
          this.app.playSfx('win');
          this.app.triggerConfetti(60);
        } else if (evt.winner === 'draw') {
          this.app.playSfx('move');
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
