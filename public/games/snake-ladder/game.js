/**
 * Snake & Ladder Client Module — Real Canvas Character Animation Edition (Zero SVG)
 * Authentic 100-Tile Board with Canvas-Rendered Slithering Snakes & 3D Wooden Ladders
 * Real animated adventurer pawns with step hopping, ladder climbing, and snake sliding!
 */
window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['snake-ladder'] = {
  init(container, socket, roomInfo, myPlayerIndex, app) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.myPlayerIndex = myPlayerIndex;
    this.app = app;

    this.playerColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
    this.playerDarkColors = ['#991b1b', '#1e40af', '#065f46', '#92400e'];
    this.playerNames = ['Red Ninja', 'Blue Knight', 'Green Archer', 'Gold Prince'];

    this.isRolling = false;
    this.isAnimating = false;
    this.animQueue = [];
    this.activeAnim = null; // { type, pIdx, fromPos, toPos, progress, startTime, duration }
    this.particles = [];
    this.floatingTexts = [];
    this.diceRolling = false;

    this.LADDERS = {
      4: 14,
      8: 30,
      21: 42,
      28: 76,
      36: 57,
      50: 67,
      71: 92,
      80: 99
    };

    this.SNAKES = {
      98: 78,
      95: 56,
      92: 73,
      83: 19,
      73: 15,
      69: 33,
      64: 60,
      59: 17,
      52: 11,
      48: 26,
      44: 22
    };

    this.render();
  },

  // Map tile number (1..100) to Canvas (col, row) coordinates:
  // Tile 1 is bottom-left (c:0, r:9), Tile 10 is bottom-right (c:9, r:9)
  // Tile 11 is (c:9, r:8), Tile 20 is (c:0, r:8)
  getTileColRow(tileNum) {
    const t = Math.max(1, Math.min(100, tileNum)) - 1;
    const rFromBottom = Math.floor(t / 10);
    const row = 9 - rFromBottom;
    const rem = t % 10;
    const col = (rFromBottom % 2 === 0) ? rem : (9 - rem);
    return { col, row };
  },

  getTileCenter(tileNum, cellSize) {
    const { col, row } = this.getTileColRow(tileNum);
    return {
      x: (col + 0.5) * cellSize,
      y: (row + 0.5) * cellSize
    };
  },

  render() {
    this.container.innerHTML = `
      <div class="snl-wrapper" style="display:flex; flex-direction:column; align-items:center; gap:0.75rem; width:100%; max-width:660px; margin:0 auto;">
        
        <!-- Controls & 3D Dice Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:0.5rem 1rem; background:var(--bg-surface); border-radius:12px; border:1px solid var(--border-color); box-shadow:0 4px 16px rgba(0,0,0,0.3);">
          <div id="snl-turn-indicator" style="display:flex; align-items:center; gap:0.5rem; font-weight:700; font-size:1rem;">
            <span id="snl-turn-dot" style="width:14px; height:14px; border-radius:50%; background:#ef4444; display:inline-block; box-shadow:0 0 10px #ef4444;"></span>
            <span id="snl-turn-text">Red's Turn</span>
          </div>

          <div style="display:flex; align-items:center; gap:1rem;">
            <div id="snl-dice-box" role="button" tabindex="0" style="width:56px; height:56px; background:#ffffff; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.8rem; font-weight:900; color:#0f172a; box-shadow:0 6px 16px rgba(0,0,0,0.4), inset 0 -3px 0 #cbd5e1; cursor:pointer; user-select:none; transition:transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);">
              🎲
            </div>
            <button id="btn-snl-roll" class="btn-cta-primary" style="padding:0.5rem 1.25rem; font-size:0.95rem; font-weight:700; border-radius:8px;">
              ROLL DICE
            </button>
          </div>
        </div>

        <!-- HTML5 Canvas Board (Zero SVG) -->
        <div style="position:relative; width:100%; aspect-ratio:1/1; background:#0f172a; border-radius:16px; overflow:hidden; box-shadow:0 12px 36px rgba(0,0,0,0.5), 0 0 0 4px rgba(255,255,255,0.06);">
          <canvas id="snl-canvas" width="900" height="900" style="width:100%; height:100%; display:block; cursor:pointer;"></canvas>
        </div>

        <div style="font-size:0.82rem; color:var(--text-muted); text-align:center;">
          Climb <strong>Ladders 🪜</strong> to jump ahead. Avoid <strong>Snakes 🐍</strong>. Reach exactly tile 100 to win!
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#snl-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.diceBtn = this.container.querySelector('#btn-snl-roll');
    this.diceBox = this.container.querySelector('#snl-dice-box');

    const handleRoll = () => {
      if (this.isRolling || this.isAnimating) return;
      if (this.gameState && this.gameState.currentTurn !== this.myPlayerIndex) {
        this.app.toast('Wait for your turn!');
        return;
      }

      this.isRolling = true;
      this.animateDiceRoll();
      this.app.playSfx('dice');

      this.socket.emit('player_action', { type: 'roll_dice' }, (res) => {
        this.isRolling = false;
        if (res && !res.valid && res.error) {
          this.app.toast(res.error);
        }
      });
    };

    this.diceBtn.addEventListener('click', handleRoll);
    this.diceBox.addEventListener('click', handleRoll);

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }

    this.startLoop();
  },

  animateDiceRoll() {
    this.diceRolling = true;
    let rolls = 0;
    const interval = setInterval(() => {
      const val = Math.floor(Math.random() * 6) + 1;
      this.diceBox.textContent = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][val - 1];
      this.diceBox.style.transform = `rotate(${(Math.random() - 0.5) * 40}deg) scale(1.15)`;
      rolls++;
      if (rolls > 8) {
        clearInterval(interval);
        this.diceRolling = false;
        this.diceBox.style.transform = 'rotate(0deg) scale(1)';
        if (this.gameState && this.gameState.lastDice) {
          this.diceBox.textContent = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][this.gameState.lastDice - 1];
        }
      }
    }, 45);
  },

  startLoop() {
    const loop = () => {
      this.updateAnimations();
      this.draw();
      this.animationFrame = requestAnimationFrame(loop);
    };
    this.animationFrame = requestAnimationFrame(loop);
  },

  updateAnimations() {
    if (!this.activeAnim && this.animQueue.length > 0) {
      this.activeAnim = this.animQueue.shift();
      this.activeAnim.startTime = performance.now();
      this.isAnimating = true;
    }

    if (this.activeAnim) {
      const now = performance.now();
      const elapsed = now - this.activeAnim.startTime;
      this.activeAnim.progress = Math.min(1, elapsed / this.activeAnim.duration);

      if (this.activeAnim.progress >= 1) {
        if (this.activeAnim.onDone) this.activeAnim.onDone();
        this.activeAnim = null;
        if (this.animQueue.length === 0) {
          this.isAnimating = false;
        }
      }
    }
  },

  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const W = 900;
    const cellSize = W / 10;
    const now = Date.now();

    ctx.clearRect(0, 0, W, W);

    // 1. Draw 10x10 Jewel Tiles
    const tileGradients = [
      ['#1e293b', '#0f172a'], // slate dark
      ['#1e1b4b', '#0f172a'], // indigo dark
      ['#14532d', '#052e16'], // emerald dark
      ['#701a75', '#4a044e']  // fuchsia dark
    ];

    for (let t = 1; t <= 100; t++) {
      const { col, row } = this.getTileColRow(t);
      const x = col * cellSize;
      const y = row * cellSize;

      if (t === 100) {
        // Golden Victory Tile 100
        const goldGrad = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
        goldGrad.addColorStop(0, '#fef08a');
        goldGrad.addColorStop(0.5, '#f59e0b');
        goldGrad.addColorStop(1, '#b45309');
        ctx.fillStyle = goldGrad;
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      } else {
        const pal = tileGradients[(col + row) % 4];
        ctx.fillStyle = pal[0];
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      }

      // Tile bevel border
      ctx.strokeStyle = t === 100 ? '#fde047' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = t === 100 ? 3 : 1.5;
      ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

      // Tile Number Label
      ctx.fillStyle = t === 100 ? '#78350f' : 'rgba(255, 255, 255, 0.45)';
      ctx.font = 'bold 15px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(t === 100 ? '🏆 100' : `${t}`, x + 6, y + 18);
    }

    // 2. Draw 3D Wooden Ladders (Zero SVG!)
    Object.entries(this.LADDERS).forEach(([fromStr, toVal]) => {
      const from = parseInt(fromStr, 10);
      const to = toVal;
      const p1 = this.getTileCenter(from, cellSize);
      const p2 = this.getTileCenter(to, cellSize);
      this.drawCanvasLadder(ctx, p1.x, p1.y, p2.x, p2.y);
    });

    // 3. Draw Realistic Curved Snakes (Zero SVG!)
    Object.entries(this.SNAKES).forEach(([headStr, tailVal], sIdx) => {
      const head = parseInt(headStr, 10);
      const tail = tailVal;
      const pHead = this.getTileCenter(head, cellSize);
      const pTail = this.getTileCenter(tail, cellSize);
      this.drawCanvasSnake(ctx, pHead.x, pHead.y, pTail.x, pTail.y, sIdx, now);
    });

    // 4. Draw Animated Player Characters
    if (this.gameState && this.gameState.positions) {
      this.gameState.positions.forEach((pos, pIdx) => {
        let drawX, drawY, isMidAir = false;

        // Check if this player is currently in an animation
        if (this.activeAnim && this.activeAnim.pIdx === pIdx) {
          const anim = this.activeAnim;
          const pStart = this.getTileCenter(anim.fromPos, cellSize);
          const pEnd = this.getTileCenter(anim.toPos, cellSize);
          const t = anim.progress;

          if (anim.type === 'hop') {
            // Parabolic jump arc
            drawX = pStart.x + (pEnd.x - pStart.x) * t;
            const jumpHeight = cellSize * 0.75;
            drawY = pStart.y + (pEnd.y - pStart.y) * t - Math.sin(t * Math.PI) * jumpHeight;
            isMidAir = true;
          } else if (anim.type === 'slide') {
            // Slithering slide down snake
            drawX = pStart.x + (pEnd.x - pStart.x) * t + Math.sin(t * Math.PI * 4) * 12;
            drawY = pStart.y + (pEnd.y - pStart.y) * t;
          } else if (anim.type === 'climb') {
            // Climbing up ladder rungs
            drawX = pStart.x + (pEnd.x - pStart.x) * t;
            drawY = pStart.y + (pEnd.y - pStart.y) * t;
          }
        } else {
          // Resting on tile
          const center = this.getTileCenter(pos, cellSize);
          // Offset players slightly if multiple on same tile
          const offset = (pIdx - 1.5) * 14;
          drawX = center.x + offset;
          drawY = center.y + offset;
        }

        const isCurrentTurn = this.gameState.currentTurn === pIdx;
        this.drawAdventurerCharacter(ctx, drawX, drawY, pIdx, isCurrentTurn, isMidAir, cellSize * 0.38);
      });
    }

    // 5. Draw Particles
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

    // 6. Draw Floating Texts
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

  drawCanvasLadder(ctx, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const ladderWidth = 26;

    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(angle);

    // Cast soft shadow underneath
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(8, -ladderWidth / 2 + 6, dist, ladderWidth);

    // Wooden rails
    const railGrad = ctx.createLinearGradient(0, -ladderWidth / 2, 0, ladderWidth / 2);
    railGrad.addColorStop(0, '#f59e0b');
    railGrad.addColorStop(0.5, '#b45309');
    railGrad.addColorStop(1, '#78350f');

    ctx.fillStyle = railGrad;
    // Left rail
    ctx.fillRect(0, -ladderWidth / 2, dist, 6);
    // Right rail
    ctx.fillRect(0, ladderWidth / 2 - 6, dist, 6);

    // Rungs spaced every 22px
    ctx.fillStyle = '#fde68a';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.5;
    const numRungs = Math.floor(dist / 22);
    for (let i = 1; i <= numRungs; i++) {
      const rx = i * 22;
      ctx.fillRect(rx, -ladderWidth / 2 + 4, 4, ladderWidth - 8);
      ctx.strokeRect(rx, -ladderWidth / 2 + 4, 4, ladderWidth - 8);
    }

    ctx.restore();
  },

  drawCanvasSnake(ctx, hx, hy, tx, ty, sIdx, now) {
    const dx = tx - hx;
    const dy = ty - hy;
    const dist = Math.hypot(dx, dy);

    // Snake colors alternating emerald and ruby
    const isRed = sIdx % 2 === 1;
    const colorMain = isRed ? '#ef4444' : '#10b981';
    const colorDark = isRed ? '#991b1b' : '#047857';

    // Curving spline points
    const mx1 = hx + dx * 0.33 + Math.sin(now * 0.003 + sIdx) * 24;
    const my1 = hy + dy * 0.33 + Math.cos(now * 0.003 + sIdx) * 24;
    const mx2 = hx + dx * 0.66 - Math.sin(now * 0.003 + sIdx) * 24;
    const my2 = hy + dy * 0.66 - Math.cos(now * 0.003 + sIdx) * 24;

    ctx.save();

    // Shadow
    ctx.beginPath();
    ctx.moveTo(hx + 5, hy + 5);
    ctx.bezierCurveTo(mx1 + 5, my1 + 5, mx2 + 5, my2 + 5, tx + 5, ty + 5);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.bezierCurveTo(mx1, my1, mx2, my2, tx, ty);
    ctx.strokeStyle = colorMain;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Scale stripes
    ctx.strokeStyle = colorDark;
    ctx.lineWidth = 12;
    ctx.setLineDash([4, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Diamond Snake Head at (hx, hy)
    const headAngle = Math.atan2(my1 - hy, mx1 - hx) + Math.PI;
    ctx.translate(hx, hy);
    ctx.rotate(headAngle);

    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-4, -10);
    ctx.lineTo(-12, 0);
    ctx.lineTo(-4, 10);
    ctx.closePath();
    ctx.fillStyle = colorDark;
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#facc15';
    ctx.beginPath(); ctx.arc(-2, -5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-2, 5, 2.5, 0, Math.PI * 2); ctx.fill();

    // Flickering forked tongue
    const tongueFlick = Math.sin(now * 0.015 + sIdx * 2);
    if (tongueFlick > 0) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(22, 0);
      ctx.lineTo(26, -3);
      ctx.moveTo(22, 0);
      ctx.lineTo(26, 3);
      ctx.stroke();
    }

    ctx.restore();
  },

  drawAdventurerCharacter(ctx, x, y, playerIdx, isTurn, isMidAir, radius) {
    const mainColor = this.playerColors[playerIdx];
    const darkColor = this.playerDarkColors[playerIdx];
    const now = Date.now();

    ctx.save();
    ctx.translate(x, y);

    // Ground Shadow
    const shadowScale = isMidAir ? 0.5 : 1;
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.9, radius * 0.7 * shadowScale, radius * 0.3 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Active Turn Pulsing Crown Ring
    if (isTurn) {
      const pulse = Math.sin(now * 0.01) * 3;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.3 + pulse, 0, Math.PI * 2);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Character Body / Cloak
    const bodyGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.3, mainColor);
    bodyGrad.addColorStop(1, darkColor);

    ctx.beginPath();
    ctx.arc(0, -radius * 0.1, radius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Character Head
    ctx.beginPath();
    ctx.arc(0, -radius * 0.75, radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#fed7aa'; // Skin tone
    ctx.fill();
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Headwear per character role
    if (playerIdx === 0) {
      // Red Ninja headband & ribbon
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-radius * 0.45, -radius * 0.88, radius * 0.9, 6);
      ctx.beginPath();
      ctx.moveTo(radius * 0.45, -radius * 0.85);
      ctx.lineTo(radius * 0.85, -radius * 0.95);
      ctx.stroke();
    } else if (playerIdx === 1) {
      // Blue Knight visor
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(-radius * 0.4, -radius * 0.92, radius * 0.8, 6);
    } else if (playerIdx === 2) {
      // Green Archer feather cap
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(0, -radius * 0.95, radius * 0.38, Math.PI, Math.PI * 2);
      ctx.fill();
    } else if (playerIdx === 3) {
      // Gold Prince crown
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-radius * 0.3, -radius * 1.05);
      ctx.lineTo(-radius * 0.15, -radius * 1.25);
      ctx.lineTo(0, -radius * 1.1);
      ctx.lineTo(radius * 0.15, -radius * 1.25);
      ctx.lineTo(radius * 0.3, -radius * 1.05);
      ctx.closePath();
      ctx.fill();
    }

    // Eyes
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(-4, -radius * 0.72, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -radius * 0.72, 2, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    // Update Turn Indicator
    const turnDot = this.container.querySelector('#snl-turn-dot');
    const turnText = this.container.querySelector('#snl-turn-text');
    if (turnDot && turnText) {
      const pColor = this.playerColors[state.currentTurn] || '#ef4444';
      const pName = this.roomInfo.players[state.currentTurn]?.name || this.playerNames[state.currentTurn];
      turnDot.style.background = pColor;
      turnDot.style.boxShadow = `0 0 12px ${pColor}`;
      const isMyTurn = state.currentTurn === this.myPlayerIndex;
      turnText.textContent = isMyTurn ? `Your Turn (${pName})` : `${pName}'s Turn`;
    }

    if (this.diceBtn) {
      const isMyTurn = state.currentTurn === this.myPlayerIndex;
      this.diceBtn.disabled = !isMyTurn || this.isAnimating;
    }

    if (state.lastDice && this.diceBox && !this.diceRolling) {
      this.diceBox.textContent = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][state.lastDice - 1];
    }

    // Queue animation events
    events.forEach(evt => {
      if (evt.type === 'token_moved') {
        const pIdx = evt.playerIndex;
        // Step hopping animation
        this.animQueue.push({
          type: 'hop',
          pIdx,
          fromPos: evt.from,
          toPos: evt.to,
          duration: 400,
          onDone: () => {
            this.app.playSfx('hop');
          }
        });

        // Special event: ladder or snake
        if (evt.specialEvent) {
          if (evt.specialEvent.type === 'ladder_climbed') {
            this.animQueue.push({
              type: 'climb',
              pIdx,
              fromPos: evt.specialEvent.from,
              toPos: evt.specialEvent.to,
              duration: 700,
              onDone: () => {
                this.app.playSfx('fanfare');
                this.app.toast('🪜 Ladder climbed! Soaring high!');
                this.floatingTexts.push({ x: 450, y: 450, text: 'LADDER CLIMB! 🪜', color: '#10b981', alpha: 1.4 });
              }
            });
          } else if (evt.specialEvent.type === 'snake_bitten') {
            this.animQueue.push({
              type: 'slide',
              pIdx,
              fromPos: evt.specialEvent.from,
              toPos: evt.specialEvent.to,
              duration: 800,
              onDone: () => {
                this.app.playSfx('hiss');
                this.app.toast('🐍 Snake bite! Slithered down!');
                this.floatingTexts.push({ x: 450, y: 450, text: 'SNAKE BITE! 🐍', color: '#ef4444', alpha: 1.4 });
              }
            });
          }
        }
      } else if (evt.type === 'extra_turn') {
        this.app.toast('🎲 Rolled a 6! You get an extra roll!');
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
