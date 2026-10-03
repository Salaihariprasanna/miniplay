/**
 * Tank Battle Client Module (HTML5 Canvas Real-Time)
 */
window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['tank-battle'] = {
  init(container, socket, roomInfo, myPlayerIndex, app) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.myPlayerIndex = myPlayerIndex;
    this.app = app;

    this.keys = { forward: 0, rotate: 0 };
    this.mouseTurretAngle = 0;
    this.animationFrame = null;
    this.particles = [];

    this.render();
  },

  render() {
    this.container.innerHTML = `
      <div class="canvas-wrapper">
        <canvas id="tank-canvas" width="800" height="500" class="game-canvas"></canvas>
        
        <!-- Controls hint & mobile buttons -->
        <div class="mobile-controls-row">
          <div class="virtual-dpad">
            <div></div>
            <button class="dpad-btn" id="dpad-up">▲</button>
            <div></div>
            <button class="dpad-btn" id="dpad-left">◀</button>
            <button class="dpad-btn" id="dpad-down">▼</button>
            <button class="dpad-btn" id="dpad-right">▶</button>
          </div>
          <div class="virtual-actions">
            <button class="action-btn-circle" id="btn-touch-fire">FIRE 💥</button>
          </div>
        </div>
        
        <div style="font-size:0.85rem; color:var(--text-muted); text-align:center;">
          Desktop: <strong>WASD / Arrow Keys</strong> to Move & Turn • <strong>Mouse</strong> to Aim & Shoot | First to 5 frags wins!
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#tank-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Keyboard controls
    this.onKeyDown = (e) => {
      let changed = false;
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') { this.keys.forward = 1; changed = true; }
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') { this.keys.forward = -1; changed = true; }
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') { this.keys.rotate = -1; changed = true; }
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') { this.keys.rotate = 1; changed = true; }
      if (changed) {
        this.sendInputs();
      }
    };

    this.onKeyUp = (e) => {
      let changed = false;
      if (['w', 'W', 's', 'S', 'ArrowUp', 'ArrowDown'].includes(e.key)) { this.keys.forward = 0; changed = true; }
      if (['a', 'A', 'd', 'D', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { this.keys.rotate = 0; changed = true; }
      if (changed) {
        this.sendInputs();
      }
    };

    // Aim & shoot
    this.onMouseMove = (e) => {
      if (!this.gameState) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (this.canvas.height / rect.height);

      const myTank = this.gameState.tanks[this.myPlayerIndex];
      if (myTank) {
        this.mouseTurretAngle = Math.atan2(my - myTank.y, mx - myTank.x);
        this.sendInputs();
      }
    };

    this.onMouseDown = (e) => {
      if (e.button === 0) {
        this.shoot();
      }
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);

    // Touch controls
    const bindDpad = (id, fwd, rot) => {
      const btn = this.container.querySelector(id);
      if (!btn) return;
      const start = (e) => { e.preventDefault(); if (fwd !== undefined) this.keys.forward = fwd; if (rot !== undefined) this.keys.rotate = rot; this.sendInputs(); };
      const stop = (e) => { e.preventDefault(); if (fwd !== undefined) this.keys.forward = 0; if (rot !== undefined) this.keys.rotate = 0; this.sendInputs(); };
      btn.addEventListener('touchstart', start);
      btn.addEventListener('touchend', stop);
    };

    bindDpad('#dpad-up', 1, undefined);
    bindDpad('#dpad-down', -1, undefined);
    bindDpad('#dpad-left', undefined, -1);
    bindDpad('#dpad-right', undefined, 1);

    const touchFire = this.container.querySelector('#btn-touch-fire');
    if (touchFire) {
      touchFire.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.shoot();
      });
    }

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }

    this.startLoop();
  },

  sendInputs() {
    this.socket.emit('player_action', {
      type: 'input',
      inputs: {
        forward: this.keys.forward,
        rotate: this.keys.rotate,
        turretAngle: this.mouseTurretAngle
      }
    });
  },

  shoot() {
    this.app.playSfx('shoot');
    this.socket.emit('player_action', {
      type: 'shoot',
      turretAngle: this.mouseTurretAngle
    });
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

    // Background grid
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Obstacles
    if (this.gameState.obstacles) {
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      this.gameState.obstacles.forEach(obs => {
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      });
    }

    // Bullets
    if (this.gameState.bullets) {
      ctx.fillStyle = '#f59e0b';
      this.gameState.bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
      });
      ctx.shadowBlur = 0;
    }

    // Tanks
    this.gameState.tanks.forEach(tank => {
      if (tank.isDead) return;

      ctx.save();
      ctx.translate(tank.x, tank.y);

      // Tank Body
      ctx.rotate(tank.angle);
      ctx.fillStyle = tank.color;
      ctx.fillRect(-18, -14, 36, 28);

      // Treads
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-20, -18, 40, 6);
      ctx.fillRect(-20, 12, 40, 6);

      ctx.restore();

      // Turret
      ctx.save();
      ctx.translate(tank.x, tank.y);
      ctx.rotate(tank.turretAngle || tank.angle);

      // Barrel
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, -3, 24, 6);

      // Turret Dome
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = tank.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.restore();

      // Health bar & kills
      const barW = 36;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(tank.x - barW / 2, tank.y - 30, barW, 6);
      ctx.fillStyle = tank.hp > 50 ? '#10b981' : '#ef4444';
      ctx.fillRect(tank.x - barW / 2, tank.y - 30, (tank.hp / 100) * barW, 6);

      // Label
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      const pName = this.roomInfo.players[tank.id]?.name || `P${tank.id + 1}`;
      ctx.fillText(`${pName} (${tank.kills} kills)`, tank.x, tank.y - 35);
    });

    // Draw Particles
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
  },

  spawnExplosion(x, y, color = '#f59e0b') {
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color,
        life: 20 + Math.random() * 15
      });
    }
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    events.forEach(evt => {
      if (evt.type === 'tank_hit') {
        const victim = state.tanks[evt.playerId];
        if (victim) this.spawnExplosion(victim.x, victim.y, '#ef4444');
        this.app.playSfx('hit');
      } else if (evt.type === 'tank_destroyed') {
        const victim = state.tanks[evt.victimId];
        if (victim) this.spawnExplosion(victim.x, victim.y, '#f59e0b');
        this.app.toast(`💥 Player destroyed!`);
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
