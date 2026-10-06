/**
 * Stickman Fight Client Module (HTML5 Canvas 2D Fighter) - Enhanced with Super Comic FX
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
    this.particles = [];
    this.comicHits = [];
    this.screenShake = 0;

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
            <button class="action-btn-circle" id="sm-punch" style="background:#3b82f6;">PUNCH 🥊</button>
            <button class="action-btn-circle" id="sm-kick" style="background:#f43f5e;">KICK 🥋</button>
            <button class="action-btn-circle" id="sm-block" style="background:#64748b;">SHIELD 🛡️</button>
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
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Head
    const headY = y - bodyHeight - legLength - headRadius;
    ctx.beginPath();
    ctx.arc(x, headY, headRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.stroke();

    // Eyes / Focus band
    ctx.fillStyle = color;
    ctx.fillRect(x + facing * 4, headY - 2, 4, 4);

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
      ctx.lineTo(x - facing * 12, y); // Support leg
      ctx.moveTo(x, hipY);
      ctx.lineTo(x + facing * legLength * 1.35, hipY - 8); // Extended kick leg
      ctx.stroke();

      // Kick whoosh arc
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + facing * 20, hipY, 32, -0.6 * facing, 0.4 * facing, facing < 0);
      ctx.stroke();
      ctx.restore();
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
      ctx.lineTo(x + facing * armLength * 1.45, shoulderY - 4);
      ctx.stroke();

      // Punch fist glow
      ctx.beginPath();
      ctx.arc(x + facing * armLength * 1.45, shoulderY - 4, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Punch speed whoosh lines
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + facing * 10, shoulderY - 10);
      ctx.lineTo(x + facing * (armLength * 1.45 + 10), shoulderY - 10);
      ctx.moveTo(x + facing * 10, shoulderY + 2);
      ctx.lineTo(x + facing * (armLength * 1.45 + 8), shoulderY + 2);
      ctx.stroke();
      ctx.restore();
    } else if (f.action === 'block') {
      // Blocking shield pose
      ctx.beginPath();
      ctx.moveTo(x, shoulderY);
      ctx.lineTo(x + facing * 14, shoulderY - 14);
      ctx.lineTo(x + facing * 14, shoulderY + 14);
      ctx.stroke();

      // Sci-fi energy shield dome
      ctx.beginPath();
      ctx.arc(x + facing * 18, shoulderY, 26, -Math.PI / 2, Math.PI / 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      // Idle / ready arms
      ctx.beginPath();
      ctx.moveTo(x, shoulderY);
      ctx.lineTo(x - facing * 8, shoulderY + 18);
      ctx.moveTo(x, shoulderY);
      ctx.lineTo(x + facing * 10, shoulderY + 14);
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

    ctx.save();

    // Screen Shake
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
      this.screenShake = Math.max(0, this.screenShake * 0.85 - 0.2);
    }

    // Stage Background (Sunset Dojo)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.6, '#1e1b4b');
    bgGrad.addColorStop(1, '#311042');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Glowing Blood Moon
    ctx.beginPath();
    ctx.arc(400, 150, 95, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.12)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(400, 150, 75, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(254, 205, 211, 0.08)';
    ctx.fill();

    // Dojo Tatami Floor
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(W, FLOOR_Y);
    ctx.stroke();

    // Top Health Bars
    const f0 = this.gameState.fighters[0];
    const f1 = this.gameState.fighters[1];

    const p0 = this.roomInfo.players[0];
    const p1 = this.roomInfo.players[1];
    const p0Name = p0?.name || 'Player 1';
    const p1Name = p1?.name || 'Player 2';
    const p0Avatar = p0?.avatar || '🥋';
    const p1Avatar = p1?.avatar || '🥊';

    // P0 HP
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(40, 30, 280, 22);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(40, 30, Math.max(0, (f0.hp / 100) * 280), 22);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 30, 280, 22);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.fillText(`${p0Avatar} ${p0Name} (${f0.roundsWon} wins)`, 40, 22);

    // P1 HP
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(W - 320, 30, 280, 22);
    ctx.fillStyle = '#f43f5e';
    const p1BarW = Math.max(0, (f1.hp / 100) * 280);
    ctx.fillRect(W - 40 - p1BarW, 30, p1BarW, 22);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(W - 320, 30, 280, 22);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`(${f1.roundsWon} wins) ${p1Name} ${p1Avatar}`, W - 40, 22);
    ctx.textAlign = 'left';

    // Center Round Indicator
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`ROUND ${this.gameState.round}`, W / 2, 46);
    ctx.textAlign = 'left';

    // Fighters
    this.drawStickman(ctx, f0, '#38bdf8');
    this.drawStickman(ctx, f1, '#f43f5e');

    // Dust & Hit Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Comic Hit Starbursts & Popups
    for (let i = this.comicHits.length - 1; i >= 0; i--) {
      const c = this.comicHits[i];
      c.life--;
      c.scale = Math.min(1.3, c.scale + 0.08);

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.scale, c.scale);

      // Starburst polygon background
      ctx.fillStyle = c.color;
      ctx.beginPath();
      const points = 8;
      const rInner = 14;
      const rOuter = 26;
      for (let pt = 0; pt < points * 2; pt++) {
        const angle = (pt * Math.PI) / points;
        const rad = pt % 2 === 0 ? rOuter : rInner;
        const px = Math.cos(angle) * rad;
        const py = Math.sin(angle) * rad;
        if (pt === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Comic text
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 13px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.text, 0, 0);

      ctx.restore();

      if (c.life <= 0) this.comicHits.splice(i, 1);
    }

    ctx.restore();
  },

  spawnHitSparks(x, y, color = '#f59e0b', count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color: Math.random() < 0.4 ? '#ffffff' : color,
        life: 14 + Math.random() * 10
      });
    }
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    events.forEach(evt => {
      if (evt.type === 'punched' || evt.type === 'kicked') {
        const attacker = state.fighters[evt.playerId];
        const victim = state.fighters[1 - evt.playerId];
        const hitX = (attacker.x + victim.x) / 2;
        const hitY = victim.y - 45;

        if (evt.hitResult && evt.hitResult.hit) {
          if (evt.hitResult.blocked) {
            this.comicHits.push({ x: hitX, y: hitY, text: 'BLOCKED!', color: '#0284c7', life: 14, scale: 0.8 });
            this.spawnHitSparks(hitX, hitY, '#38bdf8', 8);
            this.app.playSfx('click');
          } else {
            const label = evt.type === 'punch' ? 'POW!' : 'BAM!';
            this.comicHits.push({ x: hitX, y: hitY, text: label, color: '#ef4444', life: 16, scale: 0.8 });
            this.spawnHitSparks(hitX, hitY, '#f59e0b', 16);
            this.screenShake = evt.type === 'kick' ? 9 : 6;
            this.app.playSfx('hit');
          }
        } else {
          this.app.playSfx('move');
        }
      } else if (evt.type === 'jumped') {
        const f = state.fighters[evt.playerId];
        if (f) {
          for (let i = 0; i < 6; i++) {
            this.particles.push({
              x: f.x + (Math.random() - 0.5) * 20,
              y: f.y,
              vx: (Math.random() - 0.5) * 2,
              vy: -Math.random() * 1.5,
              size: 2 + Math.random() * 3,
              color: 'rgba(148, 163, 184, 0.5)',
              life: 15
            });
          }
        }
        this.app.playSfx('click');
      } else if (evt.type === 'round_won') {
        const winner = this.roomInfo.players[evt.winner];
        const wName = winner?.name || `Player ${evt.winner + 1}`;
        const wAvatar = winner?.avatar || '🏆';
        this.app.toast(`🥊 Round won by ${wAvatar} ${wName}!`);
        this.comicHits.push({ x: 400, y: 200, text: 'K.O.!', color: '#f59e0b', life: 25, scale: 1 });
        this.screenShake = 12;
        this.app.playSfx('match');
      } else if (evt.type === 'game_over') {
        if (evt.winner === this.myPlayerIndex) {
          this.app.playSfx('win');
          this.app.triggerConfetti?.(100);
        } else {
          this.app.playSfx('lose');
        }
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
