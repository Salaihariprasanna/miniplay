/**
 * Simple Shooting Client Module (HTML5 Canvas Real-Time)
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

    // Dark sci-fi arena
    ctx.fillStyle = '#080d1a';
    ctx.fillRect(0, 0, W, H);

    // Arena border
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, W - 8, H - 8);

    // Powerups
    if (this.gameState.powerups) {
      this.gameState.powerups.forEach(pu => {
        ctx.beginPath();
        ctx.arc(pu.x, pu.y, pu.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 12;
      });
      ctx.shadowBlur = 0;
    }

    // Bullets (lasers)
    if (this.gameState.bullets) {
      this.gameState.bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
      });
      ctx.shadowBlur = 0;
    }

    // Players
    this.gameState.players.forEach(p => {
      if (p.isDead) return;

      // Body
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Gun barrel
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.aimAngle) * 24, p.y + Math.sin(p.aimAngle) * 24);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 4;
      ctx.stroke();

      // HP Bar
      const barW = 32;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(p.x - barW / 2, p.y - 26, barW, 5);
      ctx.fillStyle = p.hp > 50 ? '#10b981' : '#f43f5e';
      ctx.fillRect(p.x - barW / 2, p.y - 26, (p.hp / 100) * barW, 5);

      // Name & kills
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      const name = this.roomInfo.players[p.id]?.name || `P${p.id + 1}`;
      ctx.fillText(`${name} (${p.kills})`, p.x, p.y - 32);
    });
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    events.forEach(evt => {
      if (evt.type === 'player_hit') {
        this.app.playSfx('hit');
      } else if (evt.type === 'powerup_collected') {
        this.app.playSfx('match');
      } else if (evt.type === 'player_eliminated') {
        this.app.playSfx('win');
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
