/**
 * Stickman Fight Client Module (HTML5 Canvas 2D Fighter)
 */
window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['stickman-fight'] = {
  init(container, socket, roomInfo, myPlayerIndex, app) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.myPlayerIndex = myPlayerIndex;
    this.app = app;

    this.inputs = { moveDir: 0, block: false };
    this.animationFrame = null;

    this.render();
  },

  render() {
    this.container.innerHTML = `
      <div class="canvas-wrapper">
        <canvas id="stickman-canvas" width="800" height="450" class="game-canvas"></canvas>

        <div class="mobile-controls-row">
          <div style="display:flex; gap:6px;">
            <button class="dpad-btn" id="sm-left" style="width:50px; height:50px;">◀</button>
            <button class="dpad-btn" id="sm-right" style="width:50px; height:50px;">▶</button>
            <button class="dpad-btn" id="sm-jump" style="width:50px; height:50px;">▲</button>
          </div>
          <div class="virtual-actions">
            <button class="action-btn-circle" id="sm-punch" style="background:#3b82f6;">PUNCH</button>
            <button class="action-btn-circle" id="sm-kick" style="background:#f43f5e;">KICK</button>
            <button class="action-btn-circle" id="sm-block" style="background:#64748b;">SHIELD</button>
          </div>
        </div>

        <div style="font-size:0.85rem; color:var(--text-muted); text-align:center;">
          Desktop: <strong>A / D</strong> = Move • <strong>W / Space</strong> = Jump • <strong>J</strong> = Punch • <strong>K</strong> = Kick • <strong>S</strong> = Block
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#stickman-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Keyboard
    this.onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft') { this.inputs.moveDir = -1; this.sendInput(); }
      if (k === 'd' || k === 'arrowright') { this.inputs.moveDir = 1; this.sendInput(); }
      if (k === 'w' || k === ' ' || k === 'arrowup') { this.socket.emit('player_action', { type: 'jump' }); }
      if (k === 's' || k === 'arrowdown') { this.inputs.block = true; this.sendInput(); }
      if (k === 'j') { this.socket.emit('player_action', { type: 'punch' }); }
      if (k === 'k') { this.socket.emit('player_action', { type: 'kick' }); }
    };

    this.onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (['a', 'd', 'arrowleft', 'arrowright'].includes(k)) { this.inputs.moveDir = 0; this.sendInput(); }
      if (k === 's' || k === 'arrowdown') { this.inputs.block = false; this.sendInput(); }
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Touch binds
    const bindBtn = (id, action) => {
      const b = this.container.querySelector(id);
      if (!b) return;
      b.addEventListener('touchstart', (e) => { e.preventDefault(); action(true); });
      b.addEventListener('touchend', (e) => { e.preventDefault(); action(false); });
    };

    bindBtn('#sm-left', (down) => { this.inputs.moveDir = down ? -1 : 0; this.sendInput(); });
    bindBtn('#sm-right', (down) => { this.inputs.moveDir = down ? 1 : 0; this.sendInput(); });
    bindBtn('#sm-block', (down) => { this.inputs.block = down; this.sendInput(); });

    const jBtn = this.container.querySelector('#sm-jump');
    if (jBtn) jBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.socket.emit('player_action', { type: 'jump' }); });

    const pBtn = this.container.querySelector('#sm-punch');
    if (pBtn) pBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.socket.emit('player_action', { type: 'punch' }); });

    const kBtn = this.container.querySelector('#sm-kick');
    if (kBtn) kBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.socket.emit('player_action', { type: 'kick' }); });

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }

    this.startLoop();
  },

  sendInput() {
    this.socket.emit('player_action', { type: 'input', ...this.inputs });
  },

  startLoop() {
    const loop = () => {
      this.draw();
      this.animationFrame = requestAnimationFrame(loop);
    };
    this.animationFrame = requestAnimationFrame(loop);
  },

  drawStickman(ctx, f, color) {
    const headRadius = 14;
    const bodyHeight = 44;
    const legLength = 36;
    const armLength = 28;

    const x = f.x;
    const y = f.y;
    const facing = f.facing;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Head
    const headY = y - bodyHeight - legLength - headRadius;
    ctx.beginPath();
    ctx.arc(x, headY, headRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.stroke();

    // Body
    const hipY = y - legLength;
    ctx.beginPath();
    ctx.moveTo(x, headY + headRadius);
    ctx.lineTo(x, hipY);
    ctx.stroke();

    // Legs
    if (f.action === 'kick') {
      // Kicking pose
      ctx.beginPath();
      ctx.moveTo(x, hipY);
      ctx.lineTo(x - facing * 10, y); // Support leg
      ctx.moveTo(x, hipY);
      ctx.lineTo(x + facing * legLength * 1.3, hipY - 6); // Extended kick leg
      ctx.stroke();
    } else {
      // Normal / jump / walk legs
      ctx.beginPath();
      ctx.moveTo(x, hipY);
      ctx.lineTo(x - 12, y);
      ctx.moveTo(x, hipY);
      ctx.lineTo(x + 12, y);
      ctx.stroke();
    }

    // Arms
    const shoulderY = headY + headRadius + 10;
    if (f.action === 'punch') {
      // Punching pose
      ctx.beginPath();
      ctx.moveTo(x, shoulderY);
      ctx.lineTo(x + facing * armLength * 1.4, shoulderY - 4);
      ctx.stroke();
    } else if (f.action === 'block') {
      // Blocking shield pose
      ctx.beginPath();
      ctx.moveTo(x, shoulderY);
      ctx.lineTo(x + facing * 12, shoulderY - 14);
      ctx.lineTo(x + facing * 12, shoulderY + 14);
      ctx.stroke();

      // Blue shield glow
      ctx.beginPath();
      ctx.arc(x + facing * 16, shoulderY, 24, -Math.PI / 2, Math.PI / 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      // Normal arms
      ctx.beginPath();
      ctx.moveTo(x, shoulderY);
      ctx.lineTo(x - facing * 8, shoulderY + 20);
      ctx.moveTo(x, shoulderY);
      ctx.lineTo(x + facing * 8, shoulderY + 20);
      ctx.stroke();
    }

    ctx.restore();
  },

  draw() {
    if (!this.ctx || !this.gameState) return;
    const ctx = this.ctx;
    const W = 800;
    const H = 450;
    const FLOOR_Y = 360;

    // Stage Background (Dojo / Cyberpunk Dojo)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Moonlight circle
    ctx.beginPath();
    ctx.arc(400, 140, 90, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();

    // Floor
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(W, FLOOR_Y);
    ctx.stroke();

    // Top Health Bars
    const f0 = this.gameState.fighters[0];
    const f1 = this.gameState.fighters[1];

    const p0Name = this.roomInfo.players[0]?.name || 'Player 1';
    const p1Name = this.roomInfo.players[1]?.name || 'Player 2';

    // P0 HP
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(40, 30, 280, 22);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(40, 30, (f0.hp / 100) * 280, 22);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.fillText(`${p0Name} (${f0.roundsWon} wins)`, 40, 22);

    // P1 HP
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(W - 320, 30, 280, 22);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(W - 320 + (1 - f1.hp / 100) * 280, 30, (f1.hp / 100) * 280, 22);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`(${f1.roundsWon} wins) ${p1Name}`, W - 40, 22);
    ctx.textAlign = 'left';

    // Round indicator in center
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`ROUND ${this.gameState.round}`, W / 2, 46);
    ctx.textAlign = 'left';

    // Fighters
    this.drawStickman(ctx, f0, '#38bdf8');
    this.drawStickman(ctx, f1, '#f43f5e');
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    events.forEach(evt => {
      if (evt.type === 'punched' || evt.type === 'kicked') {
        if (evt.hitResult && evt.hitResult.hit) {
          this.app.playSfx('hit');
        } else {
          this.app.playSfx('move');
        }
      } else if (evt.type === 'jumped') {
        this.app.playSfx('click');
      } else if (evt.type === 'round_won') {
        this.app.toast(`🥊 Round won by ${this.roomInfo.players[evt.winner]?.name || `Player ${evt.winner + 1}`}!`);
        this.app.playSfx('match');
      } else if (evt.type === 'game_over') {
        if (evt.winner === this.myPlayerIndex) this.app.playSfx('win');
        else this.app.playSfx('lose');
      }
    });
  },

  onDestroy() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.container.innerHTML = '';
  }
};
