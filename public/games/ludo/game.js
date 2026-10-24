/**
 * Ludo Client Module — Real Canvas Character Animation Edition (Zero SVG)
 * Authentic 15x15 Indian/English Board with 4 Tokens per Player
 * Real animated character pawns (Warrior, Ranger, Monarch, Sorcerer)
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
    this.playerDarkColors = ['#b91c1c', '#047857', '#b45309', '#1d4ed8'];
    this.playerNames = ['Red', 'Green', 'Yellow', 'Blue'];
    this.characterRoles = ['Knight', 'Ranger', 'Monarch', 'Sorcerer'];

    this.isRolling = false;
    this.animatingToken = null; // { pIdx, tIdx, fromCoord, toCoord, progress, onDone }
    this.particles = [];
    this.floatingTexts = [];
    this.diceAngle = 0;
    this.diceRolling = false;
    this.diceDisplayValue = 1;

    // 52 Common Path Track Coordinates on 15x15 grid: [col, row] (0..14)
    this.TRACK_COORDS = [
      [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
      [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
      [7, 0],
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
      [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
      [14, 7],
      [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
      [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
      [7, 14],
      [6, 14], [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
      [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
      [0, 7],
      [0, 6]
    ];

    this.SAFE_TRACK_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];
    this.START_TRACK_INDICES = [0, 13, 26, 39];

    // Home stretch coords: steps 51..56 for each player
    this.HOME_STRETCHES = [
      [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],    // Red (right)
      [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],    // Green (down)
      [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]], // Yellow (left)
      [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]]  // Blue (up)
    ];

    // Yard sockets for 4 tokens per player
    this.BASE_SOCKET_COORDS = [
      [[1.8, 1.8], [3.8, 1.8], [1.8, 3.8], [3.8, 3.8]],         // Red
      [[10.8, 1.8], [12.8, 1.8], [10.8, 3.8], [12.8, 3.8]],     // Green
      [[10.8, 10.8], [12.8, 10.8], [10.8, 12.8], [12.8, 12.8]], // Yellow
      [[1.8, 10.8], [3.8, 10.8], [1.8, 12.8], [3.8, 12.8]]      // Blue
    ];

    this.render();
  },

  render() {
    this.container.innerHTML = `
      <div class="ludo-wrapper" style="display:flex; flex-direction:column; align-items:center; gap:0.75rem; width:100%; max-width:660px; margin:0 auto;">
        
        <!-- Controls & 3D Dice Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:0.5rem 1rem; background:var(--bg-surface); border-radius:12px; border:1px solid var(--border-color); box-shadow:0 4px 16px rgba(0,0,0,0.3);">
          <div id="ludo-turn-indicator" style="display:flex; align-items:center; gap:0.5rem; font-weight:700; font-size:1rem;">
            <span id="ludo-turn-dot" style="width:14px; height:14px; border-radius:50%; background:#ef4444; display:inline-block; box-shadow:0 0 10px #ef4444;"></span>
            <span id="ludo-turn-text">Red's Turn</span>
          </div>

          <div style="display:flex; align-items:center; gap:1rem;">
            <div id="ludo-dice-box" role="button" tabindex="0" style="width:56px; height:56px; background:#ffffff; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.8rem; font-weight:900; color:#0f172a; box-shadow:0 6px 16px rgba(0,0,0,0.4), inset 0 -3px 0 #cbd5e1; cursor:pointer; user-select:none; transition:transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);">
              🎲
            </div>
            <button id="btn-roll-dice" class="btn-cta-primary" style="padding:0.5rem 1.25rem; font-size:0.95rem; font-weight:700; border-radius:8px;">
              ROLL DICE
            </button>
          </div>
        </div>

        <!-- HTML5 Canvas Board (Zero SVG) -->
        <div style="position:relative; width:100%; aspect-ratio:1/1; background:#0f172a; border-radius:16px; overflow:hidden; box-shadow:0 12px 36px rgba(0,0,0,0.5), 0 0 0 4px rgba(255,255,255,0.06);">
          <canvas id="ludo-canvas" width="900" height="900" style="width:100%; height:100%; display:block; cursor:pointer;"></canvas>
        </div>

        <div style="font-size:0.82rem; color:var(--text-muted); text-align:center;">
          Roll <strong>6</strong> to summon a character from base! Tap your glowing character to hop.
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#ludo-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.diceBtn = this.container.querySelector('#btn-roll-dice');
    this.diceBox = this.container.querySelector('#ludo-dice-box');

    const handleRoll = () => {
      if (this.isRolling) return;
      if (this.gameState && this.gameState.currentTurn !== this.myPlayerIndex) {
        this.app.toast('Wait for your turn!');
        return;
      }
      if (this.gameState && this.gameState.hasRolled) {
        this.app.toast('Pick a movable character!');
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

    // Canvas click to select token
    this.canvas.addEventListener('click', (e) => {
      if (!this.gameState || this.gameState.currentTurn !== this.myPlayerIndex || !this.gameState.hasRolled) return;
      const rect = this.canvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const clickY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

      const cellSize = this.canvas.width / 15;
      const myPlayer = this.gameState.players[this.myPlayerIndex];
      if (!myPlayer) return;

      // Find closest movable token
      for (const tokId of this.gameState.movableTokens) {
        const tok = myPlayer.tokens[tokId];
        const coord = this.getTokenCanvasCoord(this.myPlayerIndex, tok);
        const tokX = (coord[0] + 0.5) * cellSize;
        const tokY = (coord[1] + 0.5) * cellSize;
        const dist = Math.hypot(clickX - tokX, clickY - tokY);

        if (dist < cellSize * 0.9) {
          // Select this token!
          this.app.playSfx('click');
          this.socket.emit('player_action', { type: 'move_token', tokenId: tokId }, (res) => {
            if (res && !res.valid && res.error) {
              this.app.toast(res.error);
            }
          });
          break;
        }
      }
    });

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }

    this.startLoop();
  },

  animateDiceRoll() {
    this.diceRolling = true;
    let rolls = 0;
    const interval = setInterval(() => {
      this.diceDisplayValue = Math.floor(Math.random() * 6) + 1;
      this.diceBox.textContent = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][this.diceDisplayValue - 1];
      this.diceBox.style.transform = `rotate(${(Math.random() - 0.5) * 40}deg) scale(1.15)`;
      rolls++;
      if (rolls > 8) {
        clearInterval(interval);
        this.diceRolling = false;
        this.diceBox.style.transform = 'rotate(0deg) scale(1)';
        if (this.gameState && this.gameState.diceValue) {
          this.diceBox.textContent = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][this.gameState.diceValue - 1];
        }
      }
    }, 45);
  },

  getTokenCanvasCoord(pIdx, tok) {
    if (tok.status === 'base') {
      return this.BASE_SOCKET_COORDS[pIdx][tok.id] || [2, 2];
    }
    if (tok.status === 'track') {
      const globalIdx = (this.START_TRACK_INDICES[pIdx] + tok.step) % 52;
      return this.TRACK_COORDS[globalIdx];
    }
    if (tok.status === 'home_stretch') {
      const stretchIdx = tok.step - 51;
      return this.HOME_STRETCHES[pIdx][Math.min(5, Math.max(0, stretchIdx))];
    }
    // 'home'
    return [7, 7];
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
    const W = 900;
    const cellSize = W / 15;
    const now = Date.now();

    ctx.clearRect(0, 0, W, W);

    // Board Base Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, W);

    // Draw 15x15 Track Cells
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        // Skip corner yard areas (0..5, 0..5), (9..14, 0..5), (0..5, 9..14), (9..14, 9..14)
        const inRedYard = r < 6 && c < 6;
        const inGreenYard = r < 6 && c > 8;
        const inBlueYard = r > 8 && c < 6;
        const inYellowYard = r > 8 && c > 8;
        const inCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8;

        if (inRedYard || inGreenYard || inBlueYard || inYellowYard || inCenter) continue;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2);

        // Grid border
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2);
      }
    }

    // Colored Home Runways
    // Red runway: r=7, c=1..6
    for (let c = 1; c <= 6; c++) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(c * cellSize + 1, 7 * cellSize + 1, cellSize - 2, cellSize - 2);
    }
    // Green runway: c=7, r=1..6
    for (let r = 1; r <= 6; r++) {
      ctx.fillStyle = '#10b981';
      ctx.fillRect(7 * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2);
    }
    // Yellow runway: r=7, c=8..13
    for (let c = 8; c <= 13; c++) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(c * cellSize + 1, 7 * cellSize + 1, cellSize - 2, cellSize - 2);
    }
    // Blue runway: c=7, r=8..13
    for (let r = 8; r <= 13; r++) {
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(7 * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2);
    }

    // Start Tiles
    const startTiles = [
      { col: 1, row: 6, color: '#ef4444' },
      { col: 8, row: 1, color: '#10b981' },
      { col: 13, row: 8, color: '#f59e0b' },
      { col: 6, row: 13, color: '#3b82f6' }
    ];
    startTiles.forEach(st => {
      ctx.fillStyle = st.color;
      ctx.fillRect(st.col * cellSize + 1, st.row * cellSize + 1, cellSize - 2, cellSize - 2);
    });

    // 4 Corner Yards
    const yards = [
      { x: 0, y: 0, color: '#ef4444', dark: '#991b1b', name: 'RED YARD' },
      { x: 9 * cellSize, y: 0, color: '#10b981', dark: '#065f46', name: 'GREEN YARD' },
      { x: 9 * cellSize, y: 9 * cellSize, color: '#f59e0b', dark: '#92400e', name: 'YELLOW YARD' },
      { x: 0, y: 9 * cellSize, color: '#3b82f6', dark: '#1e40af', name: 'BLUE YARD' }
    ];

    yards.forEach((yd, pIdx) => {
      // Outer colored block
      ctx.fillStyle = yd.color;
      ctx.fillRect(yd.x, yd.y, 6 * cellSize, 6 * cellSize);

      // Inner white card
      const pad = cellSize * 0.75;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 12;
      ctx.fillRect(yd.x + pad, yd.y + pad, 6 * cellSize - pad * 2, 6 * cellSize - pad * 2);
      ctx.shadowBlur = 0;

      // 4 Base pedestals
      this.BASE_SOCKET_COORDS[pIdx].forEach(coord => {
        const cx = (coord[0] + 0.5) * cellSize;
        const cy = (coord[1] + 0.5) * cellSize;
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = yd.color;
        ctx.fill();
        ctx.strokeStyle = yd.dark;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      });
    });

    // Safe Stars ⭐ on 8 safe tiles
    this.SAFE_TRACK_INDICES.forEach(trackIdx => {
      const coord = this.TRACK_COORDS[trackIdx];
      const sx = (coord[0] + 0.5) * cellSize;
      const sy = (coord[1] + 0.5) * cellSize;
      this.drawCanvasStar(ctx, sx, sy, 5, cellSize * 0.32, cellSize * 0.16, '#fbbf24', '#b45309');
    });

    // Center Home Finish Quadrants & Trophy
    const mid = 7.5 * cellSize;
    // Red triangle (left)
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.moveTo(6 * cellSize, 6 * cellSize); ctx.lineTo(mid, mid); ctx.lineTo(6 * cellSize, 9 * cellSize); ctx.fill();
    // Green triangle (top)
    ctx.fillStyle = '#10b981';
    ctx.beginPath(); ctx.moveTo(6 * cellSize, 6 * cellSize); ctx.lineTo(mid, mid); ctx.lineTo(9 * cellSize, 6 * cellSize); ctx.fill();
    // Yellow triangle (right)
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.moveTo(9 * cellSize, 6 * cellSize); ctx.lineTo(mid, mid); ctx.lineTo(9 * cellSize, 9 * cellSize); ctx.fill();
    // Blue triangle (bottom)
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.moveTo(6 * cellSize, 9 * cellSize); ctx.lineTo(mid, mid); ctx.lineTo(9 * cellSize, 9 * cellSize); ctx.fill();

    // Center Golden Trophy Crown
    ctx.save();
    ctx.translate(mid, mid);
    ctx.beginPath();
    ctx.arc(0, 0, cellSize * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Crown emblem in center
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 24px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👑', 0, 0);
    ctx.restore();

    // Draw All Player Character Pawns
    if (this.gameState && this.gameState.players) {
      const isMyTurn = this.gameState.currentTurn === this.myPlayerIndex;
      const movableTokens = this.gameState.movableTokens || [];

      this.gameState.players.forEach((player, pIdx) => {
        player.tokens.forEach(tok => {
          const coord = this.getTokenCanvasCoord(pIdx, tok);
          const cx = (coord[0] + 0.5) * cellSize;
          const cy = (coord[1] + 0.5) * cellSize;

          const isMovable = isMyTurn && pIdx === this.myPlayerIndex && this.gameState.hasRolled && movableTokens.includes(tok.id);
          const bob = Math.sin(now * 0.006 + tok.id * 1.5) * 3;

          this.drawCharacterPawn(ctx, cx, cy + bob, pIdx, tok.id, isMovable, cellSize * 0.44);
        });
      });
    }

    // Draw Particles & Comic Explosions
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

    // Draw Floating Texts
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

  drawCanvasStar(ctx, cx, cy, spikes, outerRadius, innerRadius, fill, stroke) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  },

  drawCharacterPawn(ctx, x, y, playerIdx, tokenId, isMovable, radius) {
    const mainColor = this.playerColors[playerIdx];
    const darkColor = this.playerDarkColors[playerIdx];
    const now = Date.now();

    ctx.save();
    ctx.translate(x, y);

    // Dynamic ground shadow
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.9, radius * 0.8, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Movable pulsing aura & bounce arrow
    if (isMovable) {
      const pulse = Math.sin(now * 0.01) * 4;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.35 + pulse, 0, Math.PI * 2);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Tap Me indicator
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 12px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼', 0, -radius * 1.5 - pulse);
    }

    // Pawn Body (Pedestal Base with 3D gradient)
    const baseGrad = ctx.createLinearGradient(-radius, 0, radius, radius);
    baseGrad.addColorStop(0, '#ffffff');
    baseGrad.addColorStop(0.3, mainColor);
    baseGrad.addColorStop(1, darkColor);

    // Wide skirt base
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.6, radius * 0.75, radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = darkColor;
    ctx.fill();

    // Slender waist / torso
    ctx.beginPath();
    ctx.moveTo(-radius * 0.45, radius * 0.6);
    ctx.quadraticCurveTo(-radius * 0.2, 0, -radius * 0.35, -radius * 0.1);
    ctx.lineTo(radius * 0.35, -radius * 0.1);
    ctx.quadraticCurveTo(radius * 0.2, 0, radius * 0.45, radius * 0.6);
    ctx.closePath();
    ctx.fillStyle = baseGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Collar ring
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.1, radius * 0.42, radius * 0.14, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();

    // Character Head (Sphere)
    const headGrad = ctx.createRadialGradient(-radius * 0.15, -radius * 0.65, radius * 0.08, 0, -radius * 0.55, radius * 0.45);
    headGrad.addColorStop(0, '#ffffff');
    headGrad.addColorStop(0.4, mainColor);
    headGrad.addColorStop(1, darkColor);

    ctx.beginPath();
    ctx.arc(0, -radius * 0.55, radius * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = headGrad;
    ctx.fill();
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Role-specific real character features:
    if (playerIdx === 0) {
      // Knight (Visor & plume)
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-radius * 0.28, -radius * 0.62, radius * 0.56, 4);
      // Red plume feather
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(0, -radius * 1.05, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (playerIdx === 1) {
      // Ranger (Green Archer hood & eyes)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-radius * 0.2, -radius * 0.6, 3, 3);
      ctx.fillRect(radius * 0.1, -radius * 0.6, 3, 3);
    } else if (playerIdx === 2) {
      // Monarch (Golden Crown)
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(-radius * 0.3, -radius * 0.85);
      ctx.lineTo(-radius * 0.15, -radius * 1.05);
      ctx.lineTo(0, -radius * 0.9);
      ctx.lineTo(radius * 0.15, -radius * 1.05);
      ctx.lineTo(radius * 0.3, -radius * 0.85);
      ctx.closePath();
      ctx.fill();
    } else if (playerIdx === 3) {
      // Sorcerer (Pointed magic hat)
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.moveTo(-radius * 0.35, -radius * 0.8);
      ctx.lineTo(0, -radius * 1.25);
      ctx.lineTo(radius * 0.35, -radius * 0.8);
      ctx.closePath();
      ctx.fill();
      // Glowing star on tip
      ctx.fillStyle = '#fde047';
      ctx.beginPath(); ctx.arc(0, -radius * 1.25, 3, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    // Update Turn Indicator & Dice Box
    const turnDot = this.container.querySelector('#ludo-turn-dot');
    const turnText = this.container.querySelector('#ludo-turn-text');
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
      this.diceBtn.disabled = !isMyTurn || state.hasRolled;
      this.diceBtn.textContent = state.hasRolled ? 'CHOOSE TOKEN' : 'ROLL DICE';
    }

    if (state.diceValue && this.diceBox && !this.diceRolling) {
      this.diceBox.textContent = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][state.diceValue - 1];
    }

    // Process events
    events.forEach(evt => {
      if (evt.type === 'token_spawned' || evt.type === 'token_advanced') {
        this.app.playSfx('hop');
      } else if (evt.type === 'token_captured') {
        this.app.playSfx('hit');
        this.app.toast(`💥 Token captured! Sent back to yard.`);
        this.floatingTexts.push({ x: 450, y: 450, text: 'CAPTURED! 💥', color: '#ef4444', alpha: 1.2 });
      } else if (evt.type === 'token_home') {
        this.app.playSfx('fanfare');
        this.floatingTexts.push({ x: 450, y: 450, text: 'HOME! 🏆', color: '#fbbf24', alpha: 1.4 });
      } else if (evt.type === 'three_sixes_penalty') {
        this.app.toast('⚠️ Three 6s rolled in a row! Turn forfeited.');
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
