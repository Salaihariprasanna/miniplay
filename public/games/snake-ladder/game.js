/**
 * Snake & Ladder Client Module — Super Animations Edition
 * Features:
 * - Dynamic SVG overlay rendering winding gradient snakes with eyes/tongues & 3D wooden ladders
 * - Step-by-step token hopping with arc bounce animations and hop sounds
 * - Smooth ladder climbing with ascending fanfare chimes
 * - Dramatic snake bite with rattle/hiss audio and curved body slide
 * - 3D tumbling dice cube with interactive roll
 * - Live ranking HUD and tile distance indicator
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
    this.playerAvatars = ['🦊', '🦁', '🤖', '🚀'];
    this.isRolling = false;
    this.isAnimating = false;

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

  render() {
    // Generate 100 tiles in boustrophedon order (row 9: 100..91, row 8: 81..90, ..., row 0: 1..10)
    let tilesHtml = '';
    for (let r = 9; r >= 0; r--) {
      const isEvenRow = r % 2 === 1;
      for (let c = 0; c < 10; c++) {
        const num = isEvenRow ? (r * 10 + (10 - c)) : (r * 10 + (c + 1));
        const altClass = num === 100 ? 'tile-100' : `tile-alt-${(r + c) % 4}`;
        tilesHtml += `
          <div class="snl-tile-box ${altClass}" id="snl-tile-${num}" data-tile="${num}">
            <span style="font-size:clamp(0.6rem, 1.8vw, 0.75rem);">${num === 100 ? '🏆 100' : num}</span>
          </div>
        `;
      }
    }

    this.container.innerHTML = `
      <div class="snl-container">
        
        <!-- Board Wrapper with SVG Layer and Tokens Layer -->
        <div class="snl-board-wrapper" id="snl-board-wrapper">
          <div class="snl-board-grid">
            ${tilesHtml}
          </div>

          <!-- SVG Overlay for Realistic Curved Snakes and Wooden Ladders -->
          <svg class="snl-svg-layer" id="snl-svg-layer" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            <defs>
              <linearGradient id="ladder-wood" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#b45309" />
                <stop offset="50%" stop-color="#f59e0b" />
                <stop offset="100%" stop-color="#78350f" />
              </linearGradient>

              <linearGradient id="snake-green" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#10b981" />
                <stop offset="50%" stop-color="#059669" />
                <stop offset="100%" stop-color="#047857" />
              </linearGradient>

              <linearGradient id="snake-red" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ef4444" />
                <stop offset="50%" stop-color="#b91c1c" />
                <stop offset="100%" stop-color="#7f1d1d" />
              </linearGradient>

              <filter id="svg-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="2" dy="5" stdDeviation="4" flood-color="#000000" flood-opacity="0.6"/>
              </filter>
            </defs>
            <g id="svg-ladders-group" filter="url(#svg-shadow)"></g>
            <g id="svg-snakes-group" filter="url(#svg-shadow)"></g>
          </svg>

          <!-- Interactive Animated Tokens Layer -->
          <div class="snl-tokens-layer" id="snl-tokens-layer"></div>
        </div>

        <!-- 3D Tumbling Dice Controls -->
        <div class="snl-controls">
          <div class="dice-container-3d">
            <div class="dice-cube" id="snl-dice-cube" title="Roll 3D Dice">
              <div class="dice-face dice-face-1">
                <div></div><div></div><div></div>
                <div></div><div class="dice-pip" style="background:#dc2626;"></div><div></div>
                <div></div><div></div><div></div>
              </div>
              <div class="dice-face dice-face-6">
                <div class="dice-pip"></div><div></div><div class="dice-pip"></div>
                <div class="dice-pip"></div><div></div><div class="dice-pip"></div>
                <div class="dice-pip"></div><div></div><div class="dice-pip"></div>
              </div>
              <div class="dice-face dice-face-2">
                <div class="dice-pip"></div><div></div><div></div>
                <div></div><div></div><div></div>
                <div></div><div></div><div class="dice-pip"></div>
              </div>
              <div class="dice-face dice-face-5">
                <div class="dice-pip"></div><div></div><div class="dice-pip"></div>
                <div></div><div class="dice-pip"></div><div></div>
                <div class="dice-pip"></div><div></div><div class="dice-pip"></div>
              </div>
              <div class="dice-face dice-face-3">
                <div class="dice-pip"></div><div></div><div></div>
                <div></div><div class="dice-pip"></div><div></div>
                <div></div><div></div><div class="dice-pip"></div>
              </div>
              <div class="dice-face dice-face-4">
                <div class="dice-pip"></div><div></div><div class="dice-pip"></div>
                <div></div><div></div><div></div>
                <div class="dice-pip"></div><div></div><div class="dice-pip"></div>
              </div>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; align-items:flex-start;">
            <div id="snl-turn-info" style="font-weight:800; font-size:1.15rem; color:#38bdf8;">
              Roll the 3D dice!
            </div>
            <div id="snl-sub-info" style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">
              Tap 3D dice to roll!
            </div>
          </div>
        </div>

      </div>
    `;

    this.drawSvgElements();
    this.wireDiceEvents();

    if (this.roomInfo.gameState) {
      this.onStateUpdate(this.roomInfo.gameState, []);
    }
  },

  getTileCenter(tileNum) {
    // Returns {x: 0..1000, y: 0..1000} on SVG canvas
    const rBottom = Math.floor((tileNum - 1) / 10);
    const rTop = 9 - rBottom;
    const isEvenRow = rBottom % 2 === 1;
    const c = isEvenRow ? (9 - ((tileNum - 1) % 10)) : ((tileNum - 1) % 10);

    return {
      x: (c + 0.5) * 100,
      y: (rTop + 0.5) * 100
    };
  },

  drawSvgElements() {
    const laddersGroup = this.container.querySelector('#svg-ladders-group');
    const snakesGroup = this.container.querySelector('#svg-snakes-group');
    if (!laddersGroup || !snakesGroup) return;

    // 1. Draw Ladders
    let laddersSvg = '';
    Object.keys(this.LADDERS).forEach(startStr => {
      const start = parseInt(startStr, 10);
      const end = this.LADDERS[start];
      const p1 = this.getTileCenter(start);
      const p2 = this.getTileCenter(end);

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len;
      const ny = dx / len;
      const width = 16;

      // Rails
      const r1x1 = p1.x + nx * width;
      const r1y1 = p1.y + ny * width;
      const r1x2 = p2.x + nx * width;
      const r1y2 = p2.y + ny * width;

      const r2x1 = p1.x - nx * width;
      const r2y1 = p1.y - ny * width;
      const r2x2 = p2.x - nx * width;
      const r2y2 = p2.y - ny * width;

      laddersSvg += `
        <line x1="${r1x1}" y1="${r1y1}" x2="${r1x2}" y2="${r1y2}" stroke="url(#ladder-wood)" stroke-width="7" stroke-linecap="round" />
        <line x1="${r2x1}" y1="${r2y1}" x2="${r2x2}" y2="${r2y2}" stroke="url(#ladder-wood)" stroke-width="7" stroke-linecap="round" />
      `;

      // Rungs
      const steps = Math.max(3, Math.floor(len / 35));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const rx1 = r1x1 + (r1x2 - r1x1) * t;
        const ry1 = r1y1 + (r1y2 - r1y1) * t;
        const rx2 = r2x1 + (r2x2 - r2x1) * t;
        const ry2 = r2y1 + (r2y2 - r2y1) * t;
        laddersSvg += `<line x1="${rx1}" y1="${ry1}" x2="${rx2}" y2="${ry2}" stroke="url(#ladder-wood)" stroke-width="4.5" stroke-linecap="round" />`;
      }
    });
    laddersGroup.innerHTML = laddersSvg;

    // 2. Draw Realistic Winding Snakes
    let snakesSvg = '';
    const snakeColors = ['url(#snake-green)', 'url(#snake-red)'];
    let sIdx = 0;

    Object.keys(this.SNAKES).forEach(headStr => {
      const head = parseInt(headStr, 10);
      const tail = this.SNAKES[head];
      const pHead = this.getTileCenter(head);
      const pTail = this.getTileCenter(tail);

      const color = snakeColors[sIdx % snakeColors.length];
      sIdx++;

      // Create curvy bezier path for snake spine
      const midX = (pHead.x + pTail.x) / 2 + (sIdx % 2 === 0 ? 50 : -50);
      const midY = (pHead.y + pTail.y) / 2;

      const pathData = `M ${pHead.x} ${pHead.y} Q ${midX} ${midY} ${pTail.x} ${pTail.y}`;

      snakesSvg += `
        <!-- Snake Body with scales -->
        <path d="${pathData}" fill="none" stroke="${color}" stroke-width="15" stroke-linecap="round" stroke-dasharray="10 3" />
        
        <!-- Snake Tail Taper -->
        <circle cx="${pTail.x}" cy="${pTail.y}" r="4" fill="#047857" />

        <!-- Snake Head -->
        <g transform="translate(${pHead.x}, ${pHead.y})">
          <ellipse rx="13" ry="11" fill="#047857" stroke="#ffffff" stroke-width="1.5" />
          <!-- Eyes -->
          <circle cx="-5" cy="-4" r="3" fill="#fef08a" />
          <circle cx="-5" cy="-4" r="1.5" fill="#000000" />
          <circle cx="5" cy="-4" r="3" fill="#fef08a" />
          <circle cx="5" cy="-4" r="1.5" fill="#000000" />
          <!-- Forked Red Tongue -->
          <path d="M 0 11 L 0 16 L -3 19 M 0 16 L 3 19" stroke="#ef4444" stroke-width="2" fill="none" />
        </g>
      `;
    });
    snakesGroup.innerHTML = snakesSvg;
  },

  wireDiceEvents() {
    const diceCube = this.container.querySelector('#snl-dice-cube');
    if (!diceCube) return;

    diceCube.addEventListener('click', () => {
      if (this.isRolling || this.isAnimating) return;
      if (!this.gameState || this.gameState.currentTurn !== this.myPlayerIndex) {
        this.app.toast('Wait for your turn!');
        return;
      }
      if (this.gameState.winner !== null) return;

      this.triggerDiceRoll();
      this.socket.emit('player_action', { type: 'roll_dice' });
    });
  },

  triggerDiceRoll() {
    const diceCube = this.container.querySelector('#snl-dice-cube');
    if (!diceCube) return;

    this.isRolling = true;
    this.app.playSfx('dice');
    diceCube.classList.remove('dice-turn-pulse');
    diceCube.classList.add('rolling');

    setTimeout(() => {
      this.isRolling = false;
      diceCube.classList.remove('rolling');
      if (this.gameState && this.gameState.lastDice) {
        this.setDiceFace(this.gameState.lastDice);
      }
    }, 650);
  },

  setDiceFace(val) {
    const diceCube = this.container.querySelector('#snl-dice-cube');
    if (!diceCube) return;

    const ROTATIONS = {
      1: 'rotateX(0deg) rotateY(0deg)',
      2: 'rotateX(0deg) rotateY(90deg)',
      3: 'rotateX(-90deg) rotateY(0deg)',
      4: 'rotateX(90deg) rotateY(0deg)',
      5: 'rotateX(0deg) rotateY(-90deg)',
      6: 'rotateX(0deg) rotateY(180deg)'
    };

    diceCube.style.transform = ROTATIONS[val] || 'rotateX(0deg) rotateY(0deg)';
  },

  onStateUpdate(state, events = []) {
    this.gameState = state;

    events.forEach(evt => {
      if (evt.type === 'dice_rolled') {
        if (!this.isRolling) this.triggerDiceRoll();
      } else if (evt.type === 'token_moved') {
        this.animateStepHop(evt.playerIndex, evt.from, evt.to, evt.finalPos, evt.specialEvent);
      } else if (evt.type === 'extra_turn') {
        this.app.toast('🎲 Rolled a 6! You get an extra roll!');
      } else if (evt.type === 'game_over') {
        if (evt.winner === this.myPlayerIndex) {
          this.app.playSfx('win');
          this.app.triggerConfetti(120);
        } else {
          this.app.playSfx('lose');
        }
      }
    });

    if (state.lastDice && !this.isRolling) {
      this.setDiceFace(state.lastDice);
    }

    this.updateControlsUI();
    if (!this.isAnimating) {
      this.renderTokens();
    }
  },

  updateControlsUI() {
    const state = this.gameState;
    if (!state) return;

    const diceCube = this.container.querySelector('#snl-dice-cube');
    const turnInfo = this.container.querySelector('#snl-turn-info');
    const subInfo = this.container.querySelector('#snl-sub-info');

    const isMyTurn = state.currentTurn === this.myPlayerIndex;
    const currPlayerName = this.roomInfo.players[state.currentTurn]?.name || `Player ${state.currentTurn + 1}`;

    if (isMyTurn) {
      turnInfo.textContent = '🎲 Your turn to roll!';
      turnInfo.style.color = '#38bdf8';
      subInfo.textContent = 'Tap 3D dice to roll!';
      if (diceCube && !this.isRolling) diceCube.classList.add('dice-turn-pulse');
    } else {
      turnInfo.textContent = `⏳ ${currPlayerName}'s turn...`;
      turnInfo.style.color = 'var(--text-muted)';
      subInfo.textContent = 'Waiting for opponent roll...';
      if (diceCube) diceCube.classList.remove('dice-turn-pulse');
    }
  },

  renderTokens() {
    const tokensLayer = this.container.querySelector('#snl-tokens-layer');
    if (!tokensLayer || !this.gameState) return;

    tokensLayer.innerHTML = '';
    const board = this.container.querySelector('#snl-board-wrapper');
    const boardRect = board.getBoundingClientRect();

    this.gameState.positions.forEach((pos, pIdx) => {
      const pt = this.getTileCenter(pos);
      const token = document.createElement('div');
      token.className = 'snl-player-token';
      token.id = `snl-token-${pIdx}`;
      token.style.background = this.playerColors[pIdx % this.playerColors.length];
      token.textContent = this.roomInfo.players[pIdx]?.avatar || `${pIdx + 1}`;
      token.title = `${this.roomInfo.players[pIdx]?.name || `Player ${pIdx + 1}`}: Tile ${pos}`;

      token.style.left = `${(pt.x / 1000) * 100}%`;
      token.style.top = `${(pt.y / 1000) * 100}%`;

      tokensLayer.appendChild(token);
    });
  },

  async animateStepHop(playerIndex, fromPos, toPos, finalPos, specialEvent) {
    this.isAnimating = true;
    const token = this.container.querySelector(`#snl-token-${playerIndex}`);
    if (!token) {
      this.isAnimating = false;
      this.renderTokens();
      return;
    }

    // Step-by-step walk from fromPos to toPos
    for (let pos = fromPos + 1; pos <= toPos; pos++) {
      const pt = this.getTileCenter(pos);
      token.style.left = `${(pt.x / 1000) * 100}%`;
      token.style.top = `${(pt.y / 1000) * 100}%`;
      token.classList.add('snl-token-hopping');
      this.app.playSfx('hop');

      await new Promise(r => setTimeout(r, 180));
      token.classList.remove('snl-token-hopping');
    }

    // Handle special events: Ladder climb or Snake bite
    if (specialEvent) {
      await new Promise(r => setTimeout(r, 200));

      if (specialEvent.type === 'ladder_climbed') {
        this.app.toast(`🪜 Climbed ladder to Tile ${specialEvent.to}!`);
        this.app.playSfx('fanfare');
        this.app.triggerConfetti(40);

        const destPt = this.getTileCenter(specialEvent.to);
        token.style.transition = 'top 0.6s ease-in-out, left 0.6s ease-in-out';
        token.style.left = `${(destPt.x / 1000) * 100}%`;
        token.style.top = `${(destPt.y / 1000) * 100}%`;

        await new Promise(r => setTimeout(r, 650));
        token.style.transition = '';
      } else if (specialEvent.type === 'snake_bitten') {
        this.app.toast(`🐍 Bitten by snake! Slid to Tile ${specialEvent.to}!`);
        this.app.playSfx('hiss');
        token.classList.add('snl-token-slide-down');

        const destPt = this.getTileCenter(specialEvent.to);
        token.style.transition = 'top 0.7s ease-in, left 0.7s ease-in';
        token.style.left = `${(destPt.x / 1000) * 100}%`;
        token.style.top = `${(destPt.y / 1000) * 100}%`;

        await new Promise(r => setTimeout(r, 750));
        token.classList.remove('snl-token-slide-down');
        token.style.transition = '';
      }
    }

    this.isAnimating = false;
    this.renderTokens();
  },

  onDestroy() {
    this.container.innerHTML = '';
  }
};
