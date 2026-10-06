/**
 * Tank Battle Client Module (HTML5 Canvas Real-Time) - Enhanced with Super FX
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
    this.treadMarks = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.muzzleFlashes = [];
    this.recoil = [0, 0, 0, 0];
    this.screenShake = 0;
    this.prevTankPos = {};

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
    const myTank = this.gameState?.tanks[this.myPlayerIndex];
    if (myTank && !myTank.isDead) {
      this.recoil[this.myPlayerIndex] = 7;
      const tAngle = this.mouseTurretAngle;
      const barrelTipX = myTank.x + Math.cos(tAngle) * 28;
      const barrelTipY = myTank.y + Math.sin(tAngle) * 28;
      this.muzzleFlashes.push({ x: barrelTipX, y: barrelTipY, angle: tAngle, life: 5 });
    }
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

    ctx.save();

    // Screen Shake
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
      this.screenShake = Math.max(0, this.screenShake * 0.86 - 0.2);
    }

    // Background tactical grid
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Outer border neon line
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    // Fade and draw tread marks
    for (let i = this.treadMarks.length - 1; i >= 0; i--) {
      const tm = this.treadMarks[i];
      tm.alpha -= 0.003;
      if (tm.alpha <= 0) {
        this.treadMarks.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.translate(tm.x, tm.y);
      ctx.rotate(tm.angle);
      ctx.fillStyle = `rgba(15, 23, 42, ${tm.alpha})`;
      ctx.fillRect(-12, -14, 6, 4);
      ctx.fillRect(-12, 10, 6, 4);
      ctx.restore();
    }

    // Obstacles (Metallic tactical bunkers)
    if (this.gameState.obstacles) {
      this.gameState.obstacles.forEach(obs => {
        // Base
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        
        // Bevel highlight
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

        // Tech corner rivets
        ctx.fillStyle = '#64748b';
        const rSize = 4;
        ctx.fillRect(obs.x + 3, obs.y + 3, rSize, rSize);
        ctx.fillRect(obs.x + obs.w - 7, obs.y + 3, rSize, rSize);
        ctx.fillRect(obs.x + 3, obs.y + obs.h - 7, rSize, rSize);
        ctx.fillRect(obs.x + obs.w - 7, obs.y + obs.h - 7, rSize, rSize);

        // Center hatch
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(obs.x + obs.w / 2 - 8, obs.y + obs.h / 2 - 8, 16, 16);
      });
    }

    // Bullets (High-energy glowing tracer rounds)
    if (this.gameState.bullets) {
      this.gameState.bullets.forEach(b => {
        // Tracer tail
        const tailAngle = Math.atan2(b.vy, b.vx);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - Math.cos(tailAngle) * 14, b.y - Math.sin(tailAngle) * 14);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Glowing core
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    // Tanks
    this.gameState.tanks.forEach((tank, idx) => {
      if (tank.isDead) return;

      // Tread mark creation when moved
      const prev = this.prevTankPos[tank.id];
      if (prev && (Math.hypot(tank.x - prev.x, tank.y - prev.y) > 8 || Math.abs(tank.angle - prev.angle) > 0.15)) {
        if (this.treadMarks.length < 80) {
          this.treadMarks.push({ x: tank.x, y: tank.y, angle: tank.angle, alpha: 0.4 });
        }
      }
      this.prevTankPos[tank.id] = { x: tank.x, y: tank.y, angle: tank.angle };

      // Engine smoke when low HP
      if (tank.hp <= 40 && Math.random() < 0.25) {
        this.particles.push({
          x: tank.x - Math.cos(tank.angle) * 16 + (Math.random() - 0.5) * 8,
          y: tank.y - Math.sin(tank.angle) * 16 + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -0.6 - Math.random() * 0.8,
          size: 3 + Math.random() * 3,
          color: 'rgba(100, 116, 139, 0.6)',
          life: 25
        });
      }

      ctx.save();
      ctx.translate(tank.x, tank.y);

      // Tank Body & Treads
      ctx.rotate(tank.angle);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(-22, -18, 44, 36);

      // Heavy Treads
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-22, -18, 44, 7);
      ctx.fillRect(-22, 11, 44, 7);

      // Tread segments
      ctx.fillStyle = '#334155';
      for (let tx = -20; tx <= 16; tx += 6) {
        ctx.fillRect(tx, -18, 2, 7);
        ctx.fillRect(tx, 11, 2, 7);
      }

      // Armored Chassis
      ctx.fillStyle = tank.color;
      ctx.fillRect(-17, -12, 34, 24);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-17, -12, 34, 24);

      ctx.restore();

      // Turret & Recoil Barrel
      ctx.save();
      ctx.translate(tank.x, tank.y);
      const turretRot = tank.turretAngle || tank.angle;
      ctx.rotate(turretRot);

      // Recoil kickback
      const rec = this.recoil[idx] || 0;
      if (rec > 0) this.recoil[idx] = Math.max(0, rec - 0.8);

      // Barrel
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(4 - rec, -3.5, 24, 7);
      // Muzzle brake
      ctx.fillStyle = '#64748b';
      ctx.fillRect(24 - rec, -5, 4, 10);

      // Armored Turret Dome
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = tank.color;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Turret top hatch ring
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = tank.color;
      ctx.fill();

      ctx.restore();

      // Health bar & kills
      const barW = 42;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(tank.x - barW / 2 - 1, tank.y - 32, barW + 2, 7);
      
      const hpColor = tank.hp > 50 ? '#10b981' : (tank.hp > 25 ? '#f59e0b' : '#ef4444');
      ctx.fillStyle = hpColor;
      ctx.fillRect(tank.x - barW / 2, tank.y - 31, Math.max(0, (tank.hp / 100) * barW), 5);

      // Label with avatar badge
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      const playerObj = this.roomInfo.players[tank.id];
      const pName = playerObj?.name || `P${tank.id + 1}`;
      const pAvatar = playerObj?.avatar || '🪖';
      ctx.fillText(`${pAvatar} ${pName} [${tank.kills}]`, tank.x, tank.y - 36);
    });

    // Muzzle Flashes
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      const mf = this.muzzleFlashes[i];
      ctx.save();
      ctx.translate(mf.x, mf.y);
      ctx.rotate(mf.angle);
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(14, 0);
      ctx.lineTo(0, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      mf.life--;
      if (mf.life <= 0) this.muzzleFlashes.splice(i, 1);
    }

    // Shockwave Rings
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += 3.5;
      sw.alpha -= 0.04;
      if (sw.alpha <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245, 158, 11, ${sw.alpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Particles (Sparks & Smoke)
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

    // Floating Damage Texts
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

  spawnExplosion(x, y, color = '#f59e0b', count = 22) {
    this.shockwaves.push({ x, y, radius: 8, alpha: 0.9 });
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 5.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 4,
        color: Math.random() < 0.5 ? color : '#fef08a',
        life: 25 + Math.random() * 18
      });
    }
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    events.forEach(evt => {
      if (evt.type === 'tank_hit') {
        const victim = state.tanks[evt.playerId];
        if (victim) {
          this.spawnExplosion(victim.x, victim.y, '#ef4444', 14);
          this.floatingTexts.push({ x: victim.x, y: victim.y - 15, text: '-25', color: '#ef4444', alpha: 1 });
        }
        this.screenShake = 6;
        this.app.playSfx('hit');
      } else if (evt.type === 'tank_destroyed') {
        const victim = state.tanks[evt.victimId];
        if (victim) {
          this.spawnExplosion(victim.x, victim.y, '#f59e0b', 35);
          this.floatingTexts.push({ x: victim.x, y: victim.y - 20, text: 'DESTROYED! 💥', color: '#fbbf24', alpha: 1.2 });
        }
        this.screenShake = 14;
        this.app.toast(`💥 Tank destroyed!`);
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
