/**
 * Chess Client Module — Real Canvas Character Animation Edition (Zero SVG)
 * Authentic 8x8 Chessboard with 2.5D Animated Character Pieces,
 * Castling, En Passant, Pawn Promotion, Check Danger Aura & Capture FX
 */
window.MiniPlayGames = window.MiniPlayGames || {};

window.MiniPlayGames['chess'] = {
  init(container, socket, roomInfo, myPlayerIndex, app) {
    this.container = container;
    this.socket = socket;
    this.roomInfo = roomInfo;
    this.myPlayerIndex = myPlayerIndex;
    this.app = app;

    this.selectedSquare = null; // { r, c }
    this.validMoves = [];       // array of { r, c, isCastling, isEnPassant }
    this.activeGlide = null;    // { fromR, fromC, toR, toC, piece, progress, isKnight }
    this.particles = [];
    this.floatingTexts = [];
    this.pendingPromotion = null; // { fromR, fromC, toR, toC }

    this.render();
  },

  render() {
    this.container.innerHTML = `
      <div class="chess-wrapper" style="display:flex; flex-direction:column; align-items:center; gap:0.75rem; width:100%; max-width:620px; margin:0 auto;">
        
        <!-- Status & Captured Shelf Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:0.6rem 1rem; background:var(--bg-surface); border-radius:12px; border:1px solid var(--border-color); box-shadow:0 4px 16px rgba(0,0,0,0.3);">
          <div id="chess-turn-status" style="display:flex; align-items:center; gap:0.5rem; font-weight:700; font-size:1rem;">
            <span id="chess-turn-icon" style="font-size:1.2rem;">♔</span>
            <span id="chess-turn-text">White's Turn</span>
          </div>
          <div id="chess-check-badge" style="display:none; padding:0.25rem 0.75rem; background:#ef4444; color:#fff; font-weight:900; font-size:0.85rem; border-radius:20px; animation:pulse 1s infinite;">
            ⚠️ CHECK!
          </div>
          <div style="display:flex; gap:1rem; font-size:0.85rem; color:var(--text-muted);">
            <div>White cap: <span id="chess-cap-w" style="color:#ffffff;"></span></div>
            <div>Black cap: <span id="chess-cap-b" style="color:#ffffff;"></span></div>
          </div>
        </div>

        <!-- HTML5 Canvas Board (Zero SVG) -->
        <div style="position:relative; width:100%; aspect-ratio:1/1; background:#1e140d; border-radius:16px; overflow:hidden; box-shadow:0 12px 36px rgba(0,0,0,0.5), 0 0 0 4px rgba(255,255,255,0.06);">
          <canvas id="chess-canvas" width="800" height="800" style="width:100%; height:100%; display:block; cursor:pointer;"></canvas>
          
          <!-- Promotion Overlay Modal -->
          <div id="chess-promo-modal" style="display:none; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:#0f172a; border:2px solid #fbbf24; border-radius:16px; padding:1.25rem; box-shadow:0 16px 40px rgba(0,0,0,0.8); z-index:20; text-align:center;">
            <div style="font-weight:800; font-size:1.1rem; color:#fde047; margin-bottom:1rem;">Choose Promotion</div>
            <div style="display:flex; gap:0.75rem;">
              <button class="promo-btn" data-piece="Q" style="width:52px; height:52px; font-size:1.8rem; background:#1e293b; border:1px solid #475569; border-radius:10px; cursor:pointer; color:#fff;">♛</button>
              <button class="promo-btn" data-piece="R" style="width:52px; height:52px; font-size:1.8rem; background:#1e293b; border:1px solid #475569; border-radius:10px; cursor:pointer; color:#fff;">♜</button>
              <button class="promo-btn" data-piece="B" style="width:52px; height:52px; font-size:1.8rem; background:#1e293b; border:1px solid #475569; border-radius:10px; cursor:pointer; color:#fff;">♝</button>
              <button class="promo-btn" data-piece="N" style="width:52px; height:52px; font-size:1.8rem; background:#1e293b; border:1px solid #475569; border-radius:10px; cursor:pointer; color:#fff;">♞</button>
            </div>
          </div>
        </div>

        <div style="font-size:0.82rem; color:var(--text-muted); text-align:center;">
          Tap a piece to see valid moves. Full support for <strong>Castling</strong>, <strong>En Passant</strong>, and <strong>Pawn Promotion</strong>!
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#chess-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.promoModal = this.container.querySelector('#chess-promo-modal');

    // Promotion button listeners
    this.promoModal.querySelectorAll('.promo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const promoPiece = btn.dataset.piece;
        this.promoModal.style.display = 'none';
        if (this.pendingPromotion) {
          const { fromR, fromC, toR, toC } = this.pendingPromotion;
          this.pendingPromotion = null;
          this.executeMove(fromR, fromC, toR, toC, promoPiece);
        }
      });
    });

    // Canvas click
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const clickY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

      const margin = 40;
      const boardW = this.canvas.width - margin * 2;
      const cellSize = boardW / 8;

      if (clickX < margin || clickX > margin + boardW || clickY < margin || clickY > margin + boardW) {
        return;
      }

      let c = Math.floor((clickX - margin) / cellSize);
      let r = Math.floor((clickY - margin) / cellSize);

      // Invert view for Black player so their pieces are at bottom
      if (this.myPlayerIndex === 1) {
        r = 7 - r;
        c = 7 - c;
      }

      this.handleSquareClick(r, c);
    });

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }

    this.startLoop();
  },

  handleSquareClick(r, c) {
    if (this.gameState && this.gameState.currentTurn !== this.myPlayerIndex) {
      this.app.toast('Wait for your turn!');
      return;
    }

    const piece = this.gameState.board[r][c];

    // Check if clicking a destination
    if (this.selectedSquare) {
      const targetMove = this.validMoves.find(m => m.r === r && m.c === c);
      if (targetMove) {
        const fromR = this.selectedSquare.r;
        const fromC = this.selectedSquare.c;
        const selectedPiece = this.gameState.board[fromR][fromC];

        // Check if pawn reaches promotion rank
        if (selectedPiece.toLowerCase() === 'p' && ((this.myPlayerIndex === 0 && r === 0) || (this.myPlayerIndex === 1 && r === 7))) {
          this.pendingPromotion = { fromR, fromC, toR: r, toC: c };
          this.promoModal.style.display = 'block';
          this.selectedSquare = null;
          this.validMoves = [];
          return;
        }

        this.selectedSquare = null;
        this.validMoves = [];
        this.executeMove(fromR, fromC, r, c);
        return;
      }
    }

    // Select piece
    if (piece) {
      const isMyPiece = this.myPlayerIndex === 0 ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
      if (isMyPiece) {
        this.selectedSquare = { r, c };
        this.socket.emit('player_action', { type: 'get_valid_moves', fromR: r, fromC: c }, (res) => {
          if (res && res.valid) {
            this.validMoves = res.moves || [];
          }
        });
        this.app.playSfx('click');
        return;
      }
    }

    this.selectedSquare = null;
    this.validMoves = [];
  },

  executeMove(fromR, fromC, toR, toC, promotionPiece = null) {
    const piece = this.gameState.board[fromR][fromC];
    const isKnight = piece.toLowerCase() === 'n';

    // Start visual glide animation
    this.activeGlide = {
      fromR,
      fromC,
      toR,
      toC,
      piece,
      isKnight,
      progress: 0
    };

    this.app.playSfx('move');

    this.socket.emit('player_action', {
      type: 'move',
      fromR,
      fromC,
      toR,
      toC,
      promotionPiece
    }, (res) => {
      if (res && !res.valid && res.error) {
        this.app.toast(res.error);
        this.activeGlide = null;
      }
    });
  },

  startLoop() {
    const loop = () => {
      this.updateGlide();
      this.draw();
      this.animationFrame = requestAnimationFrame(loop);
    };
    this.animationFrame = requestAnimationFrame(loop);
  },

  updateGlide() {
    if (this.activeGlide) {
      this.activeGlide.progress += 0.09;
      if (this.activeGlide.progress >= 1) {
        this.activeGlide = null;
      }
    }
  },

  draw() {
    if (!this.ctx || !this.gameState) return;
    const ctx = this.ctx;
    const W = 800;
    const margin = 40;
    const boardW = W - margin * 2;
    const cellSize = boardW / 8;
    const flip = this.myPlayerIndex === 1;

    ctx.clearRect(0, 0, W, W);

    // 1. Board Border & Frame
    ctx.fillStyle = '#2b1b10';
    ctx.fillRect(0, 0, W, W);

    // Inner gold bevel
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3;
    ctx.strokeRect(margin - 4, margin - 4, boardW + 8, boardW + 8);

    // 2. Rank & File Coordinate Labels
    ctx.fillStyle = '#fed7aa';
    ctx.font = 'bold 15px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    for (let i = 0; i < 8; i++) {
      const fileLabel = flip ? files[7 - i] : files[i];
      const rankLabel = flip ? ranks[7 - i] : ranks[i];
      const cx = margin + (i + 0.5) * cellSize;
      const cy = margin + (i + 0.5) * cellSize;

      ctx.fillText(fileLabel, cx, margin / 2);
      ctx.fillText(fileLabel, cx, W - margin / 2);
      ctx.fillText(rankLabel, margin / 2, cy);
      ctx.fillText(rankLabel, W - margin / 2, cy);
    }

    // 3. Alternating Board Squares
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const renderR = flip ? 7 - r : r;
        const renderC = flip ? 7 - c : c;
        const x = margin + renderC * cellSize;
        const y = margin + renderR * cellSize;

        const isDark = (r + c) % 2 === 1;
        ctx.fillStyle = isDark ? '#78350f' : '#fef3c7';
        ctx.fillRect(x, y, cellSize, cellSize);

        // Highlight Selected Square
        if (this.selectedSquare && this.selectedSquare.r === r && this.selectedSquare.c === c) {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
          ctx.fillRect(x, y, cellSize, cellSize);
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
        }

        // Highlight Last Move
        if (this.gameState.lastMove) {
          const lm = this.gameState.lastMove;
          if ((lm.fromR === r && lm.fromC === c) || (lm.toR === r && lm.toC === c)) {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
            ctx.fillRect(x, y, cellSize, cellSize);
          }
        }
      }
    }

    // 4. King Check Danger Aura
    if (this.gameState.isCheck) {
      const kingPos = this.findKingPos(this.gameState.currentTurn);
      if (kingPos) {
        const renderR = flip ? 7 - kingPos.r : kingPos.r;
        const renderC = flip ? 7 - kingPos.c : kingPos.c;
        const kx = margin + (renderC + 0.5) * cellSize;
        const ky = margin + (renderR + 0.5) * cellSize;

        ctx.beginPath();
        ctx.arc(kx, ky, cellSize * 0.48, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 24;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // 5. Valid Moves Indicator Dots
    this.validMoves.forEach(m => {
      const renderR = flip ? 7 - m.r : m.r;
      const renderC = flip ? 7 - m.c : m.c;
      const mx = margin + (renderC + 0.5) * cellSize;
      const my = margin + (renderR + 0.5) * cellSize;

      const isCapture = !!this.gameState.board[m.r][m.c] || m.isEnPassant;
      ctx.beginPath();
      if (isCapture) {
        ctx.arc(mx, my, cellSize * 0.38, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = 4;
        ctx.stroke();
      } else {
        ctx.arc(mx, my, cellSize * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.75)';
        ctx.fill();
      }
    });

    // 6. Draw Pieces on Board
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        // Skip piece currently in mid-air glide
        if (this.activeGlide && this.activeGlide.fromR === r && this.activeGlide.fromC === c) {
          continue;
        }

        const piece = this.gameState.board[r][c];
        if (piece) {
          const renderR = flip ? 7 - r : r;
          const renderC = flip ? 7 - c : c;
          const px = margin + (renderC + 0.5) * cellSize;
          const py = margin + (renderR + 0.5) * cellSize;
          this.drawChessPiece(ctx, px, py, piece, cellSize * 0.42);
        }
      }
    }

    // 7. Draw Active Glide Piece
    if (this.activeGlide) {
      const g = this.activeGlide;
      const startRenderR = flip ? 7 - g.fromR : g.fromR;
      const startRenderC = flip ? 7 - g.fromC : g.fromC;
      const endRenderR = flip ? 7 - g.toR : g.toR;
      const endRenderC = flip ? 7 - g.toC : g.toC;

      const startX = margin + (startRenderC + 0.5) * cellSize;
      const startY = margin + (startRenderR + 0.5) * cellSize;
      const endX = margin + (endRenderC + 0.5) * cellSize;
      const endY = margin + (endRenderR + 0.5) * cellSize;

      const t = Math.min(1, g.progress);
      let curX = startX + (endX - startX) * t;
      let curY = startY + (endY - startY) * t;

      if (g.isKnight) {
        // High parabolic hop
        curY -= Math.sin(t * Math.PI) * (cellSize * 0.9);
      }

      this.drawChessPiece(ctx, curX, curY, g.piece, cellSize * 0.46, true);
    }

    // 8. Draw Particles & Dust
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

    // 9. Draw Floating Texts
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
      ctx.font = '900 22px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  },

  findKingPos(playerIdx) {
    const target = playerIdx === 0 ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.gameState.board[r][c] === target) return { r, c };
      }
    }
    return null;
  },

  // Draw 2.5D Shaded Character Chess Piece (Zero SVG, Zero plain unicode)
  drawChessPiece(ctx, x, y, piece, radius, isElevated = false) {
    const isWhite = piece === piece.toUpperCase();
    const type = piece.toLowerCase();

    const mainColor = isWhite ? '#ffffff' : '#1e293b';
    const shadeColor = isWhite ? '#cbd5e1' : '#0f172a';
    const strokeColor = isWhite ? '#475569' : '#000000';
    const goldAccent = '#fbbf24';

    ctx.save();
    ctx.translate(x, y);

    // Cast Shadow
    const shadowY = isElevated ? radius * 0.9 : radius * 0.65;
    const shadowScale = isElevated ? 0.7 : 1;
    ctx.beginPath();
    ctx.ellipse(0, shadowY, radius * 0.75 * shadowScale, radius * 0.3 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Pedestal Base
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.5, radius * 0.65, radius * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = shadeColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Body Gradient
    const bodyGrad = ctx.createLinearGradient(-radius * 0.5, -radius * 0.8, radius * 0.5, radius * 0.5);
    bodyGrad.addColorStop(0, mainColor);
    bodyGrad.addColorStop(1, shadeColor);

    if (type === 'p') {
      // Pawn (Armored Squire)
      ctx.beginPath();
      ctx.moveTo(-radius * 0.35, radius * 0.5);
      ctx.lineTo(-radius * 0.2, -radius * 0.1);
      ctx.lineTo(radius * 0.2, -radius * 0.1);
      ctx.lineTo(radius * 0.35, radius * 0.5);
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.stroke();

      // Rounded helm head
      ctx.beginPath();
      ctx.arc(0, -radius * 0.35, radius * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = mainColor;
      ctx.fill();
      ctx.stroke();
    } else if (type === 'n') {
      // Knight (Carved Royal Stallion)
      ctx.beginPath();
      ctx.moveTo(-radius * 0.35, radius * 0.5);
      ctx.lineTo(-radius * 0.4, 0);
      ctx.quadraticCurveTo(-radius * 0.5, -radius * 0.5, -radius * 0.15, -radius * 0.85); // Mane crest
      ctx.lineTo(0, -radius * 0.95); // Ear
      ctx.lineTo(radius * 0.15, -radius * 0.7);
      ctx.lineTo(radius * 0.45, -radius * 0.4); // Muzzle
      ctx.lineTo(radius * 0.3, -radius * 0.15); // Jaw
      ctx.lineTo(radius * 0.35, radius * 0.5);
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.stroke();

      // Horse Eye
      ctx.fillStyle = isWhite ? '#0f172a' : '#ffffff';
      ctx.beginPath(); ctx.arc(radius * 0.1, -radius * 0.55, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'b') {
      // Bishop (Sacred Mitre)
      ctx.beginPath();
      ctx.moveTo(-radius * 0.35, radius * 0.5);
      ctx.lineTo(-radius * 0.25, 0);
      ctx.quadraticCurveTo(-radius * 0.4, -radius * 0.5, 0, -radius * 0.9);
      ctx.quadraticCurveTo(radius * 0.4, -radius * 0.5, radius * 0.25, 0);
      ctx.lineTo(radius * 0.35, radius * 0.5);
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.stroke();

      // Mitre Cross cleft
      ctx.strokeStyle = goldAccent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-4, -radius * 0.5); ctx.lineTo(4, -radius * 0.5);
      ctx.moveTo(0, -radius * 0.65); ctx.lineTo(0, -radius * 0.35);
      ctx.stroke();
    } else if (type === 'r') {
      // Rook (Stone Fortress Tower)
      ctx.beginPath();
      ctx.moveTo(-radius * 0.4, radius * 0.5);
      ctx.lineTo(-radius * 0.3, -radius * 0.35);
      ctx.lineTo(-radius * 0.45, -radius * 0.4);
      ctx.lineTo(-radius * 0.45, -radius * 0.85);
      ctx.lineTo(-radius * 0.2, -radius * 0.85);
      ctx.lineTo(-radius * 0.2, -radius * 0.65);
      ctx.lineTo(-radius * 0.05, -radius * 0.65);
      ctx.lineTo(-radius * 0.05, -radius * 0.85);
      ctx.lineTo(radius * 0.05, -radius * 0.85);
      ctx.lineTo(radius * 0.05, -radius * 0.65);
      ctx.lineTo(radius * 0.2, -radius * 0.65);
      ctx.lineTo(radius * 0.2, -radius * 0.85);
      ctx.lineTo(radius * 0.45, -radius * 0.85);
      ctx.lineTo(radius * 0.45, -radius * 0.4);
      ctx.lineTo(radius * 0.3, -radius * 0.35);
      ctx.lineTo(radius * 0.4, radius * 0.5);
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.stroke();
    } else if (type === 'q') {
      // Queen (Radiating Coronet with Gem)
      ctx.beginPath();
      ctx.moveTo(-radius * 0.45, radius * 0.5);
      ctx.lineTo(-radius * 0.25, 0);
      ctx.lineTo(-radius * 0.45, -radius * 0.7);
      ctx.lineTo(-radius * 0.2, -radius * 0.5);
      ctx.lineTo(0, -radius * 0.85);
      ctx.lineTo(radius * 0.2, -radius * 0.5);
      ctx.lineTo(radius * 0.45, -radius * 0.7);
      ctx.lineTo(radius * 0.25, 0);
      ctx.lineTo(radius * 0.45, radius * 0.5);
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.stroke();

      // Queen center ruby jewel
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(0, -radius * 0.4, 4, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'k') {
      // King (Royal Crown with Cross)
      ctx.beginPath();
      ctx.moveTo(-radius * 0.45, radius * 0.5);
      ctx.lineTo(-radius * 0.3, 0);
      ctx.quadraticCurveTo(-radius * 0.45, -radius * 0.4, -radius * 0.35, -radius * 0.75);
      ctx.lineTo(radius * 0.35, -radius * 0.75);
      ctx.quadraticCurveTo(radius * 0.45, -radius * 0.4, radius * 0.3, 0);
      ctx.lineTo(radius * 0.45, radius * 0.5);
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.stroke();

      // Golden cross on crown
      ctx.strokeStyle = goldAccent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -radius * 0.75); ctx.lineTo(0, -radius * 1.05);
      ctx.moveTo(-5, -radius * 0.95); ctx.lineTo(5, -radius * 0.95);
      ctx.stroke();
    }

    ctx.restore();
  },

  spawnCaptureFX(x, y) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 4,
        color: Math.random() < 0.5 ? '#f59e0b' : '#ffffff',
        life: 22 + Math.random() * 14
      });
    }
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    // Status text & Turn
    const turnIcon = this.container.querySelector('#chess-turn-icon');
    const turnText = this.container.querySelector('#chess-turn-text');
    const checkBadge = this.container.querySelector('#chess-check-badge');

    if (turnIcon && turnText) {
      const isWhiteTurn = state.currentTurn === 0;
      turnIcon.textContent = isWhiteTurn ? '♔' : '♚';
      turnIcon.style.color = isWhiteTurn ? '#fef08a' : '#94a3b8';
      const isMyTurn = state.currentTurn === this.myPlayerIndex;
      turnText.textContent = isMyTurn ? 'Your Turn' : `${isWhiteTurn ? 'White' : 'Black'}'s Turn`;
    }

    if (checkBadge) {
      checkBadge.style.display = state.isCheck ? 'block' : 'none';
    }

    // Captured pieces
    const capW = this.container.querySelector('#chess-cap-w');
    const capB = this.container.querySelector('#chess-cap-b');
    if (capW && state.captured) capW.textContent = state.captured.white.join(' ') || 'None';
    if (capB && state.captured) capB.textContent = state.captured.black.join(' ') || 'None';

    events.forEach(evt => {
      if (evt.type === 'piece_captured') {
        this.app.playSfx('hit');
        this.spawnCaptureFX(400, 400);
      } else if (evt.type === 'check') {
        this.app.toast('⚠️ CHECK! King is under attack!');
        this.floatingTexts.push({ x: 400, y: 350, text: 'CHECK! ⚔️', color: '#ef4444', alpha: 1.4 });
      } else if (evt.type === 'castled') {
        this.app.toast(`🏰 Castled ${evt.side}!`);
      } else if (evt.type === 'pawn_promoted') {
        this.app.playSfx('fanfare');
        this.app.toast('🌟 Pawn Promoted!');
      } else if (evt.type === 'game_over') {
        if (evt.winner === this.myPlayerIndex) {
          this.app.playSfx('win');
          this.app.triggerConfetti?.(140);
        } else if (evt.winner === 'draw') {
          this.app.toast('🤝 Stalemate! Game is a Draw.');
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
