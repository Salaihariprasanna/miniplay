/**
 * Simple Shooting Client Module (HTML5 Canvas Real-Time) - Enhanced with Super Sci-Fi FX
 */
window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['simple-shooter'] = {
  init(container, socket, roomInfo, myPlayerIndex, app) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.myPlayerIndex = myPlayerIndex;
    this.app = app;

    this.inputs = { vx: 0, vy: 0, aimAngle: 0 };
    this.animationFrame = null;
    this.particles = [];
    this.floatingTexts = [];
    this.muzzleFlashes = [];
    this.shockwaves = [];
    this.screenShake = 0;
    this.laserBeams = [];

    this.render();
  },

  render() {
    this.container.innerHTML = `
      <div class="canvas-wrapper">
        <canvas id="shooter-canvas" width="800" height="500" class="game-canvas"></canvas>
        
        <div class="mobile-controls-row">
          <div class="virtual-dpad">
            <div></div>
            <button class="dpad-btn" id="sh-up">▲</button>
            <div></div>
            <button class="dpad-btn" id="sh-left">◀</button>
            <button class="dpad-btn" id="sh-down">▼</button>
            <button class="dpad-btn" id="sh-right">▶</button>
          </div>
          <div class="virtual-actions">
            <button class="action-btn-circle" id="sh-fire">LASER ⚡</button>
          </div>
        </div>

        <div style="font-size:0.85rem; color:var(--text-muted); text-align:center;">
          Desktop: <strong>WASD</strong> to Move • <strong>Mouse</strong> to Aim & Click to Fire • Grab glowing green health orbs!
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#shooter-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Movement
    this.keys = {};
    const updateVelocity = () => {
      let vx = 0; let vy = 0;
      if (this.keys['w'] || this.keys['ArrowUp']) vy -= 1;
      if (this.keys['s'] || this.keys['ArrowDown']) vy += 1;
      if (this.keys['a'] || this.keys['ArrowLeft']) vx -= 1;
      if (this.keys['d'] || this.keys['ArrowRight']) vx += 1;
      const mag = Math.hypot(vx, vy);
      this.inputs.vx = mag > 0 ? vx / mag : 0;
      this.inputs.vy = mag > 0 ? vy / mag : 0;
      this.sendInputs();
    };

    this.onKeyDown = (e) => { this.keys[e.key.toLowerCase()] = true; updateVelocity(); };
    this.onKeyUp = (e) => { this.keys[e.key.toLowerCase()] = false; updateVelocity(); };

    this.onMouseMove = (e) => {
      if (!this.gameState) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      const me = this.gameState.players[this.myPlayerIndex];
      if (me) {
        this.inputs.aimAngle = Math.atan2(my - me.y, mx - me.x);
        this.sendInputs();
      }
    };

    this.onMouseDown = (e) => {
      if (e.button === 0) this.shoot();
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);

    // Touch support
    const bindBtn = (id, dx, dy) => {
      const b = this.container.querySelector(id);
      if (!b) return;
      b.addEventListener('touchstart', (e) => { e.preventDefault(); this.inputs.vx = dx; this.inputs.vy = dy; this.sendInputs(); });
      b.addEventListener('touchend', (e) => { e.preventDefault(); this.inputs.vx = 0; this.inputs.vy = 0; this.sendInputs(); });
    };
    bindBtn('#sh-up', 0, -1);
    bindBtn('#sh-down', 0, 1);
    bindBtn('#sh-left', -1, 0);
    bindBtn('#sh-right', 1, 0);

    const fBtn = this.container.querySelector('#sh-fire');
    if (fBtn) {
      fBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.shoot(); });
    }

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }

    this.startLoop();
  },

  sendInputs() {
    this.socket.emit('player_action', { type: 'input', inputs: this.inputs });
  },

  shoot() {
    const me = this.gameState?.players[this.myPlayerIndex];
    if (me && !me.isDead) {
      const angle = this.inputs.aimAngle;
      const tipX = me.x + Math.cos(angle) * 26;
      const tipY = me.y + Math.sin(angle) * 26;
      this.muzzleFlashes.push({ x: tipX, y: tipY, angle, life: 6 });
    }
    this.app.playSfx('shoot');
    this.socket.emit('player_action', { type: 'shoot', aimAngle: this.inputs.aimAngle });
  },

  startLoop() {
    const loop = () => {
      this.draw();
      this.animationFrame = requestAnimationFrame(loop);
    };
    this.animationFrame = requestAnimationFrame(loop);
  },

  draw() {
    if (!this.ctx || !this.gameState) return;
    const ctx = this.ctx;
    const W = 800;
    const H = 500;
    const now = Date.now();

    ctx.save();

    // Screen Shake
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
      this.screenShake = Math.max(0, this.screenShake * 0.85 - 0.2);
    }

    // Dark cyberpunk arena
    ctx.fillStyle = '#060a17';
    ctx.fillRect(0, 0, W, H);

    // Glowing cyber floor grid
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Arena neon borders
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.strokeRect(4, 4, W - 8, H - 8);
    ctx.shadowBlur = 0;

    // Powerups (Radiant health orbs)
    if (this.gameState.powerups) {
      this.gameState.powerups.forEach(pu => {
        const pulse = Math.sin(now * 0.006) * 3;
        const r = pu.radius + pulse;

        // Outer glow
        ctx.beginPath();
        ctx.arc(pu.x, pu.y, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.fill();

        // Main core
        ctx.beginPath();
        ctx.arc(pu.x, pu.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Center medical cross
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(pu.x - 2, pu.y - 6, 4, 12);
        ctx.fillRect(pu.x - 6, pu.y - 2, 12, 4);
      });
    }

    // Bullets (High velocity laser bolts)
    if (this.gameState.bullets) {
      this.gameState.bullets.forEach(b => {
        const angle = Math.atan2(b.vy, b.vx);
        
        // Laser tail beam
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - Math.cos(angle) * 16, b.y - Math.sin(angle) * 16);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Core tip
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.restore();
      });
    }

    // Players
    this.gameState.players.forEach(p => {
      if (p.isDead) return;

      ctx.save();
      ctx.translate(p.x, p.y);

      // Body Shield / Aura
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fill();

      // Cyber Body
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Gun barrel
      const aim = p.aimAngle || 0;
      ctx.beginPath();
      ctx.moveTo(Math.cos(aim) * 8, Math.sin(aim) * 8);
      ctx.lineTo(Math.cos(aim) * 26, Math.sin(aim) * 26);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Gun muzzle tip
      ctx.beginPath();
      ctx.arc(Math.cos(aim) * 26, Math.sin(aim) * 26, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();

      ctx.restore();

      // HP Bar
      const barW = 38;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(p.x - barW / 2 - 1, p.y - 28, barW + 2, 7);
      
      const hpColor = p.hp > 50 ? '#10b981' : (p.hp > 25 ? '#f59e0b' : '#ef4444');
      ctx.fillStyle = hpColor;
      ctx.fillRect(p.x - barW / 2, p.y - 27, Math.max(0, (p.hp / 100) * barW), 5);

      // Name & avatar badge
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      const pObj = this.roomInfo.players[p.id];
      const name = pObj?.name || `P${p.id + 1}`;
      const avatar = pObj?.avatar || '⚡';
      ctx.fillText(`${avatar} ${name} [${p.kills}]`, p.x, p.y - 34);
    });

    // Muzzle Flashes
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      const mf = this.muzzleFlashes[i];
      ctx.save();
      ctx.translate(mf.x, mf.y);
      ctx.rotate(mf.angle);
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(16, 0);
      ctx.lineTo(0, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      mf.life--;
      if (mf.life <= 0) this.muzzleFlashes.splice(i, 1);
    }

    // Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += 4;
      sw.alpha -= 0.05;
      if (sw.alpha <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${sw.alpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Particles (Laser sparks)
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

    // Floating text notifications
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 1;
      ft.alpha -= 0.025;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = 'bold 15px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  },

  spawnSparks(x, y, color = '#38bdf8', count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color: Math.random() < 0.4 ? '#ffffff' : color,
        life: 18 + Math.random() * 12
      });
    }
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    events.forEach(evt => {
      if (evt.type === 'player_hit') {
        const victim = state.players[evt.playerId];
        if (victim) {
          this.spawnSparks(victim.x, victim.y, '#f43f5e', 12);
          this.floatingTexts.push({ x: victim.x, y: victim.y - 15, text: '-15', color: '#f43f5e', alpha: 1 });
        }
        this.screenShake = 6;
        this.app.playSfx('hit');
      } else if (evt.type === 'powerup_collected') {
        const p = state.players[evt.playerId];
        if (p) {
          this.spawnSparks(p.x, p.y, '#10b981', 16);
          this.floatingTexts.push({ x: p.x, y: p.y - 15, text: '+25 HP ❤️', color: '#10b981', alpha: 1.2 });
        }
        this.app.playSfx('match');
      } else if (evt.type === 'player_eliminated') {
        const victim = state.players[evt.victimId];
        if (victim) {
          this.shockwaves.push({ x: victim.x, y: victim.y, radius: 10, alpha: 1 });
          this.spawnSparks(victim.x, victim.y, '#38bdf8', 24);
          this.floatingTexts.push({ x: victim.x, y: victim.y - 20, text: 'K.O.! ⚡', color: '#fbbf24', alpha: 1.2 });
        }
        this.screenShake = 12;
        this.app.playSfx('win');
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
