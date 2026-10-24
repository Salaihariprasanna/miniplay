/**
 * Carrom Client Module — Real Canvas Character Animation Edition (Zero SVG)
 * Authentic 19 Carrom Men with Real Animated Player Hand Flick, 60 FPS Physics, and Queen Cover Rules
 */
window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['carrom'] = {
  init(container, socket, roomInfo, myPlayerIndex, app) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.myPlayerIndex = myPlayerIndex;
    this.app = app;

    this.BOARD_SIZE = 600;
    this.strikerX = 300;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.dragCurrent = { x: 0, y: 0 };
    this.flickAnim = null; // { progress, x, y, angle }
    this.particles = [];
    this.floatingTexts = [];

    // Local physics simulation for live 60fps movement
    this.localCoins = [];
    this.localStriker = { x: 300, y: 520, vx: 0, vy: 0, radius: 20, active: true };
    this.isSimulating = false;

    this.render();
  },

  render() {
    this.container.innerHTML = `
      <div class="carrom-wrapper" style="display:flex; flex-direction:column; align-items:center; gap:0.75rem; width:100%; max-width:620px; margin:0 auto;">
        
        <!-- Scoreboard & Queen Indicator -->
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:0.6rem 1rem; background:var(--bg-surface); border-radius:12px; border:1px solid var(--border-color); box-shadow:0 4px 16px rgba(0,0,0,0.3);">
          <div style="display:flex; gap:1.25rem; font-size:0.95rem;">
            <span>⚪ White: <strong id="carrom-sc-0" style="color:#ffffff;">0</strong> pts</span>
            <span>⚫ Black: <strong id="carrom-sc-1" style="color:#94a3b8;">0</strong> pts</span>
          </div>
          <div id="carrom-queen-status" style="font-size:0.85rem; font-weight:700; color:#ef4444;">
            👑 Queen: On Board
          </div>
        </div>

        <!-- HTML5 Canvas Board (Zero SVG) -->
        <div style="position:relative; width:100%; aspect-ratio:1/1; background:#3b2210; border-radius:16px; overflow:hidden; box-shadow:0 12px 36px rgba(0,0,0,0.5), 0 0 0 4px rgba(255,255,255,0.06);">
          <canvas id="carrom-canvas" width="600" height="600" style="width:100%; height:100%; display:block; cursor:crosshair;"></canvas>
        </div>

        <!-- Baseline Placement Slider -->
        <div style="display:flex; align-items:center; gap:1rem; width:100%; padding:0.5rem 1rem; background:var(--bg-surface); border-radius:10px; border:1px solid var(--border-color);">
          <span style="font-size:0.85rem; font-weight:700; white-space:nowrap; color:var(--text-muted);">Striker Position:</span>
          <input type="range" id="carrom-slider" min="110" max="490" value="300" style="width:100%; accent-color:#38bdf8; cursor:pointer;" />
        </div>

        <div style="font-size:0.82rem; color:var(--text-muted); text-align:center;">
          Use slider to position striker. <strong>Drag backward & release</strong> to flick! Cover Queen for +25 pts.
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#carrom-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.slider = this.container.querySelector('#carrom-slider');

    this.slider.addEventListener('input', (e) => {
      this.strikerX = parseFloat(e.target.value);
      this.localStriker.x = this.strikerX;
      this.localStriker.y = 520;
    });

    // Touch & Mouse Drag Listeners
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
      if (this.isSimulating) return;
      if (this.gameState && this.gameState.currentTurn !== this.myPlayerIndex) {
        this.app.toast('Wait for your turn!');
        return;
      }
      const pos = getPos(e);
      // Check if clicking near striker baseline
      if (Math.hypot(pos.x - this.strikerX, pos.y - 520) < 45) {
        this.isDragging = true;
        this.dragStart = pos;
        this.dragCurrent = pos;
      }
    };

    const onMove = (e) => {
      if (!this.isDragging) return;
      this.dragCurrent = getPos(e);
    };

    const onEnd = () => {
      if (!this.isDragging) return;
      this.isDragging = false;

      const dx = this.dragStart.x - this.dragCurrent.x;
      const dy = this.dragStart.y - this.dragCurrent.y;
      const power = Math.min(26, Math.hypot(dx, dy) * 0.2);

      if (power > 1.2) {
        const angle = Math.atan2(dy, dx);
        const vx = Math.cos(angle) * power;
        const vy = Math.sin(angle) * power;

        // Trigger real finger flick animation
        this.flickAnim = {
          progress: 0,
          x: this.strikerX,
          y: 520,
          angle
        };

        this.app.playSfx('hit');

        // Send strike action to server
        this.socket.emit('player_action', {
          type: 'strike',
          strikerX: this.strikerX,
          vx,
          vy
        });

        // Launch local 60fps simulation
        this.startLocalPhysics(vx, vy);
      }
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

    this.startLoop();
  },

  startLocalPhysics(vx, vy) {
    this.isSimulating = true;
    this.localStriker.x = this.strikerX;
    this.localStriker.y = 520;
    this.localStriker.vx = vx;
    this.localStriker.vy = vy;

    // Run continuous 60fps step until stopped
    let stepCount = 0;
    const simStep = () => {
      if (!this.isSimulating) return;

      const FRICTION = 0.982;
      const allObjects = [...this.localCoins.filter(c => !c.pocketed), this.localStriker];

      for (const obj of allObjects) {
        obj.x += obj.vx;
        obj.y += obj.vy;
        obj.vx *= FRICTION;
        obj.vy *= FRICTION;

        if (Math.hypot(obj.vx, obj.vy) < 0.08) {
          obj.vx = 0;
          obj.vy = 0;
        }

        // Wall bounce
        const minB = 30 + obj.radius;
        const maxB = 600 - 30 - obj.radius;
        if (obj.x < minB) { obj.x = minB; obj.vx = -obj.vx * 0.85; }
        if (obj.x > maxB) { obj.x = maxB; obj.vx = -obj.vx * 0.85; }
        if (obj.y < minB) { obj.y = minB; obj.vy = -obj.vy * 0.85; }
        if (obj.y > maxB) { obj.y = maxB; obj.vy = -obj.vy * 0.85; }

        // Pockets
        const pockets = [{ x: 35, y: 35 }, { x: 565, y: 35 }, { x: 35, y: 565 }, { x: 565, y: 565 }];
        for (const p of pockets) {
          if (Math.hypot(obj.x - p.x, obj.y - p.y) < 28) {
            if (obj === this.localStriker) {
              this.localStriker.vx = 0;
              this.localStriker.vy = 0;
            } else if (!obj.pocketed) {
              obj.pocketed = true;
              obj.vx = 0;
              obj.vy = 0;
              this.app.playSfx('match');
              this.spawnSparkles(p.x, p.y);
            }
          }
        }
      }

      // Elastic collisions
      for (let i = 0; i < allObjects.length; i++) {
        for (let j = i + 1; j < allObjects.length; j++) {
          const a = allObjects[i];
          const b = allObjects[j];
          if (a.pocketed || b.pocketed) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const minDist = a.radius + b.radius;

          if (dist > 0 && dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;

            const kx = a.vx - b.vx;
            const ky = a.vy - b.vy;
            const p = 2 * (nx * kx + ny * ky) / 2;
            a.vx -= p * nx * 0.92;
            a.vy -= p * ny * 0.92;
            b.vx += p * nx * 0.92;
            b.vy += p * ny * 0.92;
          }
        }
      }

      stepCount++;
      const moving = allObjects.some(o => Math.hypot(o.vx, o.vy) > 0.08);

      if (moving && stepCount < 300) {
        requestAnimationFrame(simStep);
      } else {
        this.isSimulating = false;
        this.localStriker.vx = 0;
        this.localStriker.vy = 0;
        this.localStriker.x = this.strikerX;
        this.localStriker.y = 520;
      }
    };

    requestAnimationFrame(simStep);
  },

  spawnSparkles(x, y) {
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#f59e0b' : '#fef08a',
        life: 20 + Math.random() * 12
      });
    }
  },

  startLoop() {
    const loop = () => {
      this.draw();
      this.animationFrame = requestAnimationFrame(loop);
    };
    this.animationFrame = requestAnimationFrame(loop);
  },

  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const W = 600;

    ctx.clearRect(0, 0, W, W);

    // 1. Birchwood Playing Surface
    const woodGrad = ctx.createRadialGradient(W / 2, W / 2, 50, W / 2, W / 2, 380);
    woodGrad.addColorStop(0, '#fde68a');
    woodGrad.addColorStop(0.7, '#fcd34d');
    woodGrad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = woodGrad;
    ctx.fillRect(0, 0, W, W);

    // 2. Heavy Rosewood Frame Cushions
    ctx.lineWidth = 26;
    ctx.strokeStyle = '#451a03';
    ctx.strokeRect(13, 13, W - 26, W - 26);

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#78350f';
    ctx.strokeRect(26, 26, W - 52, W - 52);

    // 3. Four Corner Pockets (Mesh depth)
    const pockets = [{ x: 35, y: 35 }, { x: W - 35, y: 35 }, { x: 35, y: W - 35 }, { x: W - 35, y: W - 35 }];
    pockets.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Net ring
      ctx.beginPath();
      ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // 4. Center Circles (Red Queen circle and concentric rings)
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, W / 2, 48, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, W / 2, 16, 0, Math.PI * 2); ctx.fillStyle = '#fecaca'; ctx.fill(); ctx.stroke();

    // 5. Baselines
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    // Bottom baseline
    ctx.beginPath(); ctx.moveTo(110, 520); ctx.lineTo(490, 520); ctx.stroke();
    // Baseline boundary circles
    [110, 490].forEach(bx => {
      ctx.beginPath(); ctx.arc(bx, 520, 16, 0, Math.PI * 2); ctx.fillStyle = '#fde68a'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx, 520, 9, 0, Math.PI * 2); ctx.fillStyle = '#dc2626'; ctx.fill();
    });

    // Top baseline
    ctx.beginPath(); ctx.moveTo(110, 80); ctx.lineTo(490, 80); ctx.stroke();
    [110, 490].forEach(bx => {
      ctx.beginPath(); ctx.arc(bx, 80, 16, 0, Math.PI * 2); ctx.fillStyle = '#fde68a'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx, 80, 9, 0, Math.PI * 2); ctx.fillStyle = '#dc2626'; ctx.fill();
    });

    // 6. Draw Carrom Coins
    const coinsToDraw = this.localCoins.length > 0 ? this.localCoins : (this.gameState?.coins || []);
    coinsToDraw.forEach(c => {
      if (c.pocketed) return;

      ctx.save();
      ctx.translate(c.x, c.y);

      // Shadow
      ctx.beginPath();
      ctx.arc(2, 2, c.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();

      // Coin Body
      ctx.beginPath();
      ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
      if (c.type === 'queen') {
        const qGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, c.radius);
        qGrad.addColorStop(0, '#f87171');
        qGrad.addColorStop(0.6, '#dc2626');
        qGrad.addColorStop(1, '#991b1b');
        ctx.fillStyle = qGrad;
      } else if (c.type === 'white') {
        const wGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, c.radius);
        wGrad.addColorStop(0, '#ffffff');
        wGrad.addColorStop(0.7, '#f1f5f9');
        wGrad.addColorStop(1, '#cbd5e1');
        ctx.fillStyle = wGrad;
      } else {
        const bGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, c.radius);
        bGrad.addColorStop(0, '#475569');
        bGrad.addColorStop(0.7, '#1e293b');
        bGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = bGrad;
      }
      ctx.fill();

      ctx.strokeStyle = c.type === 'queen' ? '#fef08a' : (c.type === 'white' ? '#94a3b8' : '#334155');
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner ring pattern
      ctx.beginPath();
      ctx.arc(0, 0, c.radius * 0.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    });

    // 7. Draw Striker
    const isMyTurn = this.gameState && this.gameState.currentTurn === this.myPlayerIndex;
    const stX = this.localStriker.x;
    const stY = this.localStriker.y;

    ctx.save();
    ctx.translate(stX, stY);

    // Striker shadow
    ctx.beginPath();
    ctx.arc(3, 3, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // Striker disc
    const stGrad = ctx.createRadialGradient(-4, -4, 3, 0, 0, 20);
    stGrad.addColorStop(0, '#ffffff');
    stGrad.addColorStop(0.4, isMyTurn ? '#38bdf8' : '#94a3b8');
    stGrad.addColorStop(1, isMyTurn ? '#0284c7' : '#475569');
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fillStyle = stGrad;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Striker star motif
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', 0, 0);

    ctx.restore();

    // 8. Aim Guide & Power Gauge
    if (this.isDragging) {
      const dx = this.dragStart.x - this.dragCurrent.x;
      const dy = this.dragStart.y - this.dragCurrent.y;
      const powerRatio = Math.min(1, Math.hypot(dx, dy) / 120);
      const aimColor = powerRatio < 0.4 ? '#10b981' : (powerRatio < 0.75 ? '#f59e0b' : '#ef4444');

      // Aim dashed line
      ctx.beginPath();
      ctx.moveTo(stX, stY);
      ctx.lineTo(stX + dx * 2, stY + dy * 2);
      ctx.strokeStyle = aimColor;
      ctx.lineWidth = 3.5;
      ctx.setLineDash([8, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Power gauge arc
      ctx.beginPath();
      ctx.arc(stX, stY, 28, -Math.PI / 2, -Math.PI / 2 + powerRatio * Math.PI * 2);
      ctx.strokeStyle = aimColor;
      ctx.lineWidth = 4.5;
      ctx.stroke();

      // Animated Player Hand pulling back
      this.drawAnimatedPlayerHand(ctx, stX - dx * 0.4, stY - dy * 0.4, Math.atan2(dy, dx), powerRatio);
    }

    // 9. Animated Finger Flick Strike
    if (this.flickAnim) {
      this.flickAnim.progress += 0.12;
      this.drawAnimatedFlick(ctx, this.flickAnim.x, this.flickAnim.y, this.flickAnim.angle, this.flickAnim.progress);
      if (this.flickAnim.progress >= 1) {
        this.flickAnim = null;
      }
    }

    // 10. Draw Sparkle Particles
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

    // 11. Draw Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 1.2;
      ft.alpha -= 0.02;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = '900 18px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  },

  drawAnimatedPlayerHand(ctx, hx, hy, angle, powerRatio) {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(angle);

    // Realistic player hand pulling back behind striker
    const skinColor = '#fed7aa';
    const darkSkin = '#fba359';

    // Wrist
    ctx.fillStyle = skinColor;
    ctx.fillRect(-55, -14, 40, 28);
    ctx.strokeStyle = darkSkin;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-55, -14, 40, 28);

    // Palm
    ctx.beginPath();
    ctx.ellipse(-20, 0, 22, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = skinColor;
    ctx.fill();
    ctx.stroke();

    // Bent flicking index finger under tension
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.quadraticCurveTo(-14 - powerRatio * 10, -10, 0, -6);
    ctx.lineWidth = 7;
    ctx.strokeStyle = darkSkin;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Thumb support
    ctx.beginPath();
    ctx.moveTo(-16, 10);
    ctx.lineTo(-4, 14);
    ctx.stroke();

    ctx.restore();
  },

  drawAnimatedFlick(ctx, x, y, angle, progress) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const skinColor = '#fed7aa';
    const darkSkin = '#fba359';

    // Finger snaps forward
    const flickExtend = (1 - progress) * 20;
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(flickExtend, 0);
    ctx.strokeStyle = darkSkin;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Snap impact air whoosh arc
    ctx.beginPath();
    ctx.arc(flickExtend + 5, 0, 14, -Math.PI / 3, Math.PI / 3);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    // Sync local coins
    if (!this.isSimulating) {
      this.localCoins = state.coins.map(c => ({ ...c }));
    }

    const sc0 = this.container.querySelector('#carrom-sc-0');
    const sc1 = this.container.querySelector('#carrom-sc-1');
    if (sc0) sc0.textContent = state.scores[0];
    if (sc1) sc1.textContent = state.scores[1];

    const queenStatus = this.container.querySelector('#carrom-queen-status');
    if (queenStatus) {
      if (state.pendingQueenCover) {
        const pName = this.roomInfo.players[state.pendingQueenCover.player]?.name || `Player ${state.pendingQueenCover.player + 1}`;
        queenStatus.textContent = `👑 Queen Needs Cover by ${pName}!`;
        queenStatus.style.color = '#f59e0b';
      } else {
        const queenLeft = state.coins.some(c => c.type === 'queen' && !c.pocketed);
        queenStatus.textContent = queenLeft ? '👑 Queen: On Board' : '👑 Queen: Pocketed';
        queenStatus.style.color = queenLeft ? '#ef4444' : '#10b981';
      }
    }

    events.forEach(evt => {
      if (evt.type === 'shot_executed') {
        if (evt.strikerFoul) {
          this.app.toast('⚠️ Striker Foul! Pocketed striker penalty.');
          this.floatingTexts.push({ x: 300, y: 300, text: 'FOUL! ⚠️', color: '#ef4444', alpha: 1.4 });
        }
        if (evt.queenCovered) {
          this.app.playSfx('fanfare');
          this.app.toast('👑 Queen successfully covered! +25 Points!');
          this.floatingTexts.push({ x: 300, y: 250, text: 'QUEEN COVERED! 👑', color: '#fbbf24', alpha: 1.5 });
        }
        if (evt.queenReturned) {
          this.app.toast('⚠️ Failed to cover Queen! Returned to center.');
        }
      } else if (evt.type === 'game_over') {
        if (evt.winner === this.myPlayerIndex) {
          this.app.playSfx('win');
          this.app.triggerConfetti?.(140);
        } else {
          this.app.playSfx('lose');
        }
      }
    });
  },

  onDestroy() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.container.innerHTML = '';
  }
};
