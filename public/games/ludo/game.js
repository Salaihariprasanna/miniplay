/**
 * Ludo Client Module
 */
window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['ludo'] = {
  init(container, socket, roomInfo, myPlayerIndex, app) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.myPlayerIndex = myPlayerIndex;
    this.app = app;

    this.playerColors = ['#ef4444', '#10b981', '#f59e0b', '#3b82f6'];
    this.render();
  },

  render() {
    this.container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:1.25rem;">
        <div id="ludo-players-banner" style="display:flex; gap:1rem; flex-wrap:wrap; justify-content:center;"></div>
        
        <!-- Responsive Ludo Board Arena -->
        <div id="ludo-arena" class="ludo-arena">
          <!-- 4 Home Bases -->
          <div id="ludo-base-0" class="ludo-base ludo-base-red"></div>
          <div id="ludo-base-1" class="ludo-base ludo-base-green"></div>
          <div id="ludo-base-2" class="ludo-base ludo-base-yellow"></div>
          <div id="ludo-base-3" class="ludo-base ludo-base-blue"></div>
          
          <!-- Central Victory Triangle -->
          <div class="ludo-home-center">
            🏆
            <span>HOME</span>
          </div>

          <!-- Active Track Display -->
          <div id="ludo-active-track" style="position:absolute; width:100%; height:100%; pointer-events:none;"></div>
        </div>

        <!-- Controls -->
        <div style="display:flex; align-items:center; gap:1.25rem;">
          <button id="btn-ludo-dice" class="dice-btn" title="Roll Dice">🎲</button>
          <div id="ludo-turn-status" style="font-weight:700; font-size:1.1rem;">Waiting for turn...</div>
        </div>
      </div>
    `;

    const diceBtn = this.container.querySelector('#btn-ludo-dice');
    diceBtn.addEventListener('click', () => {
      if (this.gameState && this.gameState.currentTurn !== this.myPlayerIndex) {
        this.app.toast('Wait for your turn!');
        return;
      }
      this.app.playSfx('dice');
      this.socket.emit('player_action', { type: 'roll_dice' });
    });

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    // Players banner
    const banner = this.container.querySelector('#ludo-players-banner');
    if (banner) {
      banner.innerHTML = this.roomInfo.players.map((p, idx) => `
        <div class="score-badge" style="background:rgba(15,23,42,0.6); padding:0.4rem 0.8rem; border-radius:10px; border:1px solid ${state.currentTurn === idx ? this.playerColors[idx] : 'var(--border)'}">
          <span class="score-name" style="${state.currentTurn === idx ? 'font-weight:700;' : ''}; color:${this.playerColors[idx]}">${p.name} ${state.currentTurn === idx ? '🎲' : ''}</span>
          <span class="score-val" style="font-size:1rem;">${state.players[idx]?.tokensHome || 0}/2 Home</span>
        </div>
      `).join('');
    }

    // Clear bases
    for (let p = 0; p < 4; p++) {
      const baseEl = this.container.querySelector(`#ludo-base-${p}`);
      if (baseEl) baseEl.innerHTML = '';
    }

    // Render player tokens
    state.players.forEach((player, pIdx) => {
      const baseEl = this.container.querySelector(`#ludo-base-${pIdx}`);
      if (!baseEl) return;

      player.tokens.forEach(tok => {
        const isMovable = state.currentTurn === this.myPlayerIndex && state.movableTokens.includes(tok.id) && pIdx === this.myPlayerIndex;
        const tokEl = document.createElement('div');
        tokEl.style.width = '32px';
        tokEl.style.height = '32px';
        tokEl.style.borderRadius = '50%';
        tokEl.style.background = this.playerColors[pIdx];
        tokEl.style.border = isMovable ? '3px solid #fff' : '2px solid rgba(255,255,255,0.4)';
        tokEl.style.boxShadow = isMovable ? '0 0 14px #fff' : '0 2px 6px rgba(0,0,0,0.5)';
        tokEl.style.cursor = isMovable ? 'pointer' : 'default';
        tokEl.style.display = 'flex';
        tokEl.style.alignItems = 'center';
        tokEl.style.justifyContent = 'center';
        tokEl.style.fontSize = '0.8rem';
        tokEl.style.fontWeight = '800';
        tokEl.style.color = '#fff';
        tokEl.textContent = tok.status === 'home' ? '✓' : (tok.step > 0 ? tok.step : '');

        if (isMovable) {
          tokEl.addEventListener('click', () => {
            this.app.playSfx('click');
            this.socket.emit('player_action', { type: 'move_token', tokenId: tok.id });
          });
        }

        if (tok.status === 'base') {
          baseEl.appendChild(tokEl);
        } else if (tok.status === 'home') {
          tokEl.style.background = '#10b981';
          baseEl.appendChild(tokEl);
        } else {
          // On track
          baseEl.appendChild(tokEl);
        }
      });
    });

    // Update dice
    const diceBtn = this.container.querySelector('#btn-ludo-dice');
    const statusEl = this.container.querySelector('#ludo-turn-status');
    const DICE_ICONS = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

    if (state.diceValue) {
      diceBtn.textContent = DICE_ICONS[state.diceValue - 1] || state.diceValue;
    } else {
      diceBtn.textContent = '🎲';
    }

    const isMyTurn = state.currentTurn === this.myPlayerIndex;
    diceBtn.disabled = !isMyTurn || state.hasRolled || state.winner !== null;

    if (isMyTurn) {
      statusEl.textContent = state.hasRolled ? '👉 Click your highlighted token to move!' : '🎲 Your turn to roll!';
      statusEl.style.color = '#38bdf8';
    } else {
      const activeName = this.roomInfo.players[state.currentTurn]?.name || `Player ${state.currentTurn + 1}`;
      statusEl.textContent = `Waiting for ${activeName}...`;
      statusEl.style.color = 'var(--text-muted)';
    }

    events.forEach(evt => {
      if (evt.type === 'token_advanced' || evt.type === 'token_spawned') {
        this.app.playSfx('move');
      } else if (evt.type === 'token_captured') {
        this.app.toast('⚔️ Token captured and sent back to base!');
        this.app.playSfx('hit');
      } else if (evt.type === 'token_home') {
        this.app.toast('🏁 Token reached Home!');
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
