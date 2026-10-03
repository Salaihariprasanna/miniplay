/**
 * Carrom Client Module (HTML5 Canvas)
 */
window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['carrom'] = {
  init(container, socket, roomInfo, myPlayerIndex, app) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.myPlayerIndex = myPlayerIndex;
    this.app = app;

    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.dragCurrent = { x: 0, y: 0 };
    this.strikerX = 300;

    this.render();
  },

  render() {
    this.container.innerHTML = `
      <div class="canvas-wrapper">
        <canvas id="carrom-canvas" width="600" height="600" class="game-canvas"></canvas>
        <div style="display:flex; align-items:center; gap:1.5rem; justify-content:center; font-size:0.95rem; color:var(--text-muted);">
          <span>Player 1 (White): <strong id="carrom-sc-0" style="color:#fff;">0</strong> pts</span>
          <span>Player 2 (Black): <strong id="carrom-sc-1" style="color:#94a3b8;">0</strong> pts</span>
        </div>
        <div style="font-size:0.85rem; color:#64748b;">
          Drag from striker backwards to aim and set power, then release to shoot!
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#carrom-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Drag listeners
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (this.canvas.width / rect.width),
        y: (clientY - rect.top) * (this.canvas.height / rect.height)
      };
    };

    const onStart = (e) => {
      if (this.gameState && this.gameState.currentTurn !== this.myPlayerIndex) {
        this.app.toast('Wait for your turn!');
        return;
      }
      const pos = getPos(e);
      // Check if near striker baseline
      if (Math.hypot(pos.x - this.strikerX, pos.y - (600 - 80)) < 40) {
        this.isDragging = true;
        this.dragStart = pos;
        this.dragCurrent = pos;
      }
    };

    const onMove = (e) => {
      if (!this.isDragging) return;
      this.dragCurrent = getPos(e);
      this.draw();
    };

    const onEnd = () => {
      if (!this.isDragging) return;
      this.isDragging = false;

      const dx = this.dragStart.x - this.dragCurrent.x;
      const dy = this.dragStart.y - this.dragCurrent.y;
      const power = Math.min(24, Math.hypot(dx, dy) * 0.18);

      if (power > 1) {
        const angle = Math.atan2(dy, dx);
        const vx = Math.cos(angle) * power;
        const vy = Math.sin(angle) * power;

        this.app.playSfx('hit');
        this.socket.emit('player_action', {
          type: 'strike',
          strikerX: this.strikerX,
          vx,
          vy
        });
      }
      this.draw();
    };

    this.canvas.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    this.canvas.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }
  },

  draw() {
    if (!this.ctx || !this.gameState) return;
    const ctx = this.ctx;
    const W = 600;
    const H = 600;

    // Board background (wood theme)
    ctx.fillStyle = '#eed9a4';
    ctx.fillRect(0, 0, W, H);

    // Board borders
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#4a2e18';
    ctx.strokeRect(7, 7, W - 14, H - 14);

    // Center circle
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#c2410c';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 45, 0, Math.PI * 2);
    ctx.stroke();

    // Baseline for striker
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(90, H - 80);
    ctx.lineTo(W - 90, H - 80);
    ctx.stroke();

    // 4 Corner Pockets
    const pockets = [
      { x: 35, y: 35 }, { x: W - 35, y: 35 },
      { x: 35, y: H - 35 }, { x: W - 35, y: H - 35 }
    ];
    for (const p of pockets) {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 28, 0, Math.PI * 2);
      ctx.fill();
    }

    // Coins
    this.gameState.coins.forEach(c => {
      if (c.pocketed) return;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      if (c.type === 'queen') {
        ctx.fillStyle = '#ef4444';
      } else if (c.type === 'white') {
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.fillStyle = '#1e293b';
      }
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#78350f';
      ctx.stroke();
    });

    // Striker
    const isMyTurn = this.gameState.currentTurn === this.myPlayerIndex;
    ctx.beginPath();
    ctx.arc(this.strikerX, H - 80, 20, 0, Math.PI * 2);
    ctx.fillStyle = isMyTurn ? '#38bdf8' : '#94a3b8';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Aim Line
    if (this.isDragging) {
      const dx = this.dragStart.x - this.dragCurrent.x;
      const dy = this.dragStart.y - this.dragCurrent.y;
      ctx.beginPath();
      ctx.moveTo(this.strikerX, H - 80);
      ctx.lineTo(this.strikerX + dx * 1.5, (H - 80) + dy * 1.5);
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    const sc0 = this.container.querySelector('#carrom-sc-0');
    const sc1 = this.container.querySelector('#carrom-sc-1');
    if (sc0) sc0.textContent = state.scores[0];
    if (sc1) sc1.textContent = state.scores[1];

    this.draw();

    events.forEach(evt => {
      if (evt.type === 'shot_executed') {
        this.app.playSfx('hit');
        if (evt.pocketed && evt.pocketed.length > 0) {
          this.app.playSfx('match');
        }
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
