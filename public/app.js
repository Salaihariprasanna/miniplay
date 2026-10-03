/**
 * MiniPlay — Master Frontend Application Coordinator
 * Handles Socket.IO networking, sound effects synthesis, view routing,
 * room lifecycles, and game module mounting.
 */

// Global game client registry
window.MiniPlayGames = window.MiniPlayGames || {};

class MiniPlayApp {
  constructor() {
    this.socket = null;
    this.currentView = 'home';
    this.currentRoom = null;
    this.myPlayerIndex = null;
    this.activeGameModule = null;
    this.gamesList = [];
    this.soundEnabled = localStorage.getItem('miniplay_sound') !== 'false';

    // Player Token for Session Reconnection
    let token = sessionStorage.getItem('miniplay_player_token');
    if (!token) {
      token = 'usr_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      sessionStorage.setItem('miniplay_player_token', token);
    }
    this.playerToken = token;

    this.initAudio();
    this.initElements();
    this.initSocket();
    this.initEventHandlers();
    this.loadGames();
    this.checkUrlForRoomCode();
  }

  // =========================================================================
  // Web Audio SFX Synthesizer
  // =========================================================================
  initAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    } catch (e) {
      console.warn('Web Audio not supported');
    }
  }

  playSfx(type) {
    if (!this.soundEnabled || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'move') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(540, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'win') {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C E G C
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.2, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0, now + idx * 0.1 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.25);
      });
    } else if (type === 'lose') {
      const notes = [440, 370, 311, 261];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.15, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0, now + idx * 0.12 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.2);
      });
    } else if (type === 'dice') {
      for (let i = 0; i < 5; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(150 + Math.random() * 200, now + i * 0.04);
        gain.gain.setValueAtTime(0.1, now + i * 0.04);
        gain.gain.linearRampToValueAtTime(0, now + i * 0.04 + 0.03);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.04);
        osc.stop(now + i * 0.04 + 0.03);
      }
    } else if (type === 'shoot') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.1);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'hit') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'flip') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.06);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'match') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  }

  // =========================================================================
  // Element Cache
  // =========================================================================
  initElements() {
    this.views = {
      home: document.getElementById('view-home'),
      lobby: document.getElementById('view-lobby'),
      game: document.getElementById('view-game')
    };

    this.modals = {
      create: document.getElementById('modal-create-room'),
      join: document.getElementById('modal-join-room'),
      rules: document.getElementById('modal-how-to-play'),
      gameOver: document.getElementById('modal-game-over')
    };

    this.toastEl = document.getElementById('toast');
    this.soundToggleBtn = document.getElementById('btn-sound-toggle');
    this.soundIcon = document.getElementById('sound-icon');
    this.updateSoundIcon();

    // Fill saved player name
    const savedName = localStorage.getItem('miniplay_player_name');
    if (savedName) {
      const createNameInput = document.getElementById('create-player-name');
      const joinNameInput = document.getElementById('join-player-name');
      if (createNameInput) createNameInput.value = savedName;
      if (joinNameInput) joinNameInput.value = savedName;
    }
  }

  updateSoundIcon() {
    if (this.soundIcon) {
      this.soundIcon.textContent = this.soundEnabled ? '🔊' : '🔇';
    }
  }

  // =========================================================================
  // Socket.IO Network Connection
  // =========================================================================
  initSocket() {
    this.socket = io({
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    const connStatus = document.getElementById('connection-status');
    const updateConnIndicator = (connected) => {
      if (!connStatus) return;
      const dot = connStatus.querySelector('.conn-dot');
      const text = connStatus.querySelector('.conn-text');
      if (dot && text) {
        dot.className = `conn-dot ${connected ? 'connected' : 'disconnected'}`;
        text.textContent = connected ? 'Connected' : 'Reconnecting...';
      }
    };

    this.socket.on('connect', () => {
      updateConnIndicator(true);

      // Check if user was in a room before a page reload or connection glitch
      const savedRoomCode = sessionStorage.getItem('miniplay_current_room');
      if (savedRoomCode && !this.currentRoom) {
        this.joinRoom(savedRoomCode, localStorage.getItem('miniplay_player_name') || 'Player');
      }
    });

    this.socket.on('disconnect', () => {
      updateConnIndicator(false);
    });

    this.socket.on('room_updated', (room) => {
      this.currentRoom = room;
      if (this.currentView === 'lobby') {
        this.renderLobby();
      }
      this.updateGameHeader();
    });

    this.socket.on('player_reconnected', ({ name }) => {
      this.toast(`${name} reconnected!`);
    });

    this.socket.on('player_disconnected', ({ name }) => {
      this.toast(`${name} disconnected.`);
    });

    this.socket.on('game_started', (room) => {
      this.currentRoom = room;
      this.launchGame();
    });

    this.socket.on('state_sync', ({ gameState, status }) => {
      if (this.currentRoom) {
        this.currentRoom.gameState = gameState;
        this.currentRoom.status = status;
      }
      this.updateTurnBanner();
      if (this.activeGameModule && this.activeGameModule.onStateUpdate) {
        this.activeGameModule.onStateUpdate(gameState, []);
      }
    });

    this.socket.on('game_events', (events) => {
      if (this.activeGameModule && this.activeGameModule.onStateUpdate && this.currentRoom) {
        this.activeGameModule.onStateUpdate(this.currentRoom.gameState, events);
      }

      events.forEach(evt => {
        if (evt.type === 'game_over') {
          this.handleGameOver(evt);
        }
      });
    });

    this.socket.on('game_over', (data) => {
      this.handleGameOver(data);
    });
  }

  // =========================================================================
  // Event Listeners & UI Wire-Up
  // =========================================================================
  initEventHandlers() {
    // Brand Logo -> Go Home
    document.getElementById('brand-logo').addEventListener('click', () => {
      if (this.currentView === 'game') {
        if (confirm('Leave current game and return to home?')) {
          this.leaveRoom();
        }
      } else {
        this.switchView('home');
      }
    });

    // Sound Toggle
    this.soundToggleBtn.addEventListener('click', () => {
      this.soundEnabled = !this.soundEnabled;
      localStorage.setItem('miniplay_sound', this.soundEnabled);
      this.updateSoundIcon();
      this.playSfx('click');
      this.toast(this.soundEnabled ? 'Sound enabled 🔊' : 'Sound muted 🔇');
    });

    // Hero & Header Buttons
    document.getElementById('btn-header-create').addEventListener('click', () => this.openCreateModal());
    document.getElementById('hero-create-btn').addEventListener('click', () => this.openCreateModal());
    document.getElementById('btn-header-join').addEventListener('click', () => this.openJoinModal());
    document.getElementById('hero-join-btn').addEventListener('click', () => this.openJoinModal());

    // Quick Code Join Strip
    const quickInput = document.getElementById('quick-room-input');
    const quickJoinBtn = document.getElementById('quick-join-btn');

    const handleQuickJoin = () => {
      const code = (quickInput.value || '').trim();
      if (code.length < 3) {
        this.toast('Please enter a valid room code');
        return;
      }
      this.joinRoom(code);
    };

    quickJoinBtn.addEventListener('click', handleQuickJoin);
    quickInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleQuickJoin();
    });

    // Category Tabs
    document.getElementById('category-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.cat-pill');
      if (!btn) return;
      document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.filterGames(btn.dataset.category);
      this.playSfx('click');
    });

    // Create Room Form
    document.getElementById('form-create-room').addEventListener('submit', (e) => {
      e.preventDefault();
      const gameId = document.getElementById('create-game-select').value;
      const playerName = document.getElementById('create-player-name').value.trim() || 'Player 1';
      const selectedRadio = document.querySelector('.player-radio-pill.selected');
      const maxPlayers = selectedRadio ? parseInt(selectedRadio.dataset.players, 10) : 2;

      localStorage.setItem('miniplay_player_name', playerName);
      this.createRoom({ gameId, maxPlayers, playerName });
      this.modals.create.close();
    });

    // Join Room Form
    document.getElementById('form-join-room').addEventListener('submit', (e) => {
      e.preventDefault();
      const code = document.getElementById('join-room-code').value.trim();
      const playerName = document.getElementById('join-player-name').value.trim() || 'Player 2';

      if (!code) {
        this.toast('Enter a room code');
        return;
      }

      localStorage.setItem('miniplay_player_name', playerName);
      this.joinRoom(code, playerName);
      this.modals.join.close();
    });

    // Modal Close buttons
    document.getElementById('modal-create-close').addEventListener('click', () => this.modals.create.close());
    document.getElementById('modal-join-close').addEventListener('click', () => this.modals.join.close());
    document.getElementById('modal-rules-close').addEventListener('click', () => this.modals.rules.close());
    document.getElementById('btn-rules-got-it').addEventListener('click', () => this.modals.rules.close());

    // Lobby Actions
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      if (this.currentRoom) {
        navigator.clipboard.writeText(this.currentRoom.code);
        this.toast('Room code copied to clipboard! 📋');
        this.playSfx('click');
      }
    });

    document.getElementById('btn-copy-link').addEventListener('click', () => {
      if (this.currentRoom) {
        const link = `${window.location.origin}/join/${this.currentRoom.code}`;
        navigator.clipboard.writeText(link);
        this.toast('Game link copied to clipboard! 🔗');
        this.playSfx('click');
      }
    });

    document.getElementById('btn-start-game').addEventListener('click', () => {
      this.playSfx('click');
      this.socket.emit('player_action', { type: 'start_game' }, (res) => {
        if (res && !res.success && res.error) {
          this.toast(res.error);
        }
      });
    });

    document.getElementById('btn-leave-lobby').addEventListener('click', () => {
      this.leaveRoom();
    });

    // In-Game Actions
    document.getElementById('btn-game-invite').addEventListener('click', () => {
      if (this.currentRoom) {
        const link = `${window.location.origin}/join/${this.currentRoom.code}`;
        navigator.clipboard.writeText(link);
        this.toast('Invite link copied to clipboard! 🔗');
        this.playSfx('click');
      }
    });

    document.getElementById('btn-game-rules').addEventListener('click', () => {
      if (this.currentRoom) {
        this.openRulesModal(this.currentRoom.gameMeta);
      }
    });

    document.getElementById('btn-game-leave').addEventListener('click', () => {
      if (confirm('Are you sure you want to leave this game?')) {
        this.leaveRoom();
      }
    });

    // Game Over Actions
    document.getElementById('btn-play-again').addEventListener('click', () => {
      this.modals.gameOver.close();
      this.playSfx('click');
      this.socket.emit('player_action', { type: 'restart' });
    });

    document.getElementById('btn-back-lobby').addEventListener('click', () => {
      this.modals.gameOver.close();
      this.switchView('lobby');
    });

    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
      this.checkUrlForRoomCode();
    });
  }

  // =========================================================================
  // Game Library & Filtering
  // =========================================================================
  async loadGames() {
    try {
      const res = await fetch('/api/games');
      const data = await res.json();
      this.gamesList = data.games || [];
      this.renderQuickPlayPills();
      this.renderGamesGrid(this.gamesList);
      this.populateCreateGameSelect();
    } catch (e) {
      console.error('Failed to load games list', e);
    }
  }

  renderQuickPlayPills() {
    const container = document.getElementById('quick-play-pills');
    if (!container) return;

    // Pick top quick-play 2-player titles
    const quickIds = ['tic-tac-toe', 'connect-four', 'rock-paper-scissors', 'tank-battle', 'chess', 'carrom'];
    const quickGames = this.gamesList.filter(g => quickIds.includes(g.id));

    container.innerHTML = quickGames.map(g => `
      <div class="quick-pill" role="button" data-game-id="${g.id}">
        <span>${g.icon}</span>
        <span>${g.name}</span>
      </div>
    `).join('');

    container.querySelectorAll('.quick-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const gameId = pill.dataset.gameId;
        this.openCreateModal(gameId);
      });
    });
  }

  renderGamesGrid(games) {
    const grid = document.getElementById('games-grid');
    if (!grid) return;

    grid.innerHTML = games.map(game => `
      <div class="game-card" data-game-id="${game.id}">
        <div class="game-card-icon">${game.icon}</div>
        <div class="game-card-header">
          <h3 class="game-card-title">${game.name}</h3>
          <span class="badge-players">${game.minPlayers === game.maxPlayers ? `${game.minPlayers} Players` : `${game.minPlayers}–${game.maxPlayers} Players`}</span>
        </div>
        <p class="game-card-desc">${game.description}</p>
        <div class="game-card-footer">
          <button class="btn-card-play" data-action="play" data-game-id="${game.id}">Play</button>
          <button class="btn-card-info" data-action="info" data-game-id="${game.id}" title="How to play">❓</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('button[data-action="play"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openCreateModal(btn.dataset.gameId);
      });
    });

    grid.querySelectorAll('button[data-action="info"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const game = this.gamesList.find(g => g.id === btn.dataset.gameId);
        if (game) this.openRulesModal(game);
      });
    });
  }

  filterGames(category) {
    if (category === 'all') {
      this.renderGamesGrid(this.gamesList);
    } else {
      const filtered = this.gamesList.filter(g => g.categories && g.categories.includes(category));
      this.renderGamesGrid(filtered);
    }
  }

  populateCreateGameSelect() {
    const select = document.getElementById('create-game-select');
    if (!select) return;

    select.innerHTML = this.gamesList.map(g => `
      <option value="${g.id}">${g.icon} ${g.name}</option>
    `).join('');

    select.addEventListener('change', () => {
      this.updatePlayerRadios(select.value);
    });

    if (this.gamesList.length > 0) {
      this.updatePlayerRadios(this.gamesList[0].id);
    }
  }

  updatePlayerRadios(gameId) {
    const game = this.gamesList.find(g => g.id === gameId);
    const container = document.getElementById('create-player-radios');
    if (!game || !container) return;

    const radios = [];
    for (let count = game.minPlayers; count <= game.maxPlayers; count++) {
      radios.push(`
        <div class="player-radio-pill ${count === game.defaultPlayers ? 'selected' : ''}" data-players="${count}">
          ${count} ${count === 1 ? 'Player' : 'Players'}
        </div>
      `);
    }

    container.innerHTML = radios.join('');
    container.querySelectorAll('.player-radio-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        container.querySelectorAll('.player-radio-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
        this.playSfx('click');
      });
    });
  }

  // =========================================================================
  // Modals & Navigation
  // =========================================================================
  openCreateModal(preselectGameId) {
    const select = document.getElementById('create-game-select');
    if (preselectGameId && select) {
      select.value = preselectGameId;
      this.updatePlayerRadios(preselectGameId);
    }
    this.modals.create.showModal();
    this.playSfx('click');
  }

  openJoinModal(prefillCode) {
    const codeInput = document.getElementById('join-room-code');
    if (prefillCode && codeInput) {
      codeInput.value = prefillCode.toUpperCase();
    }
    this.modals.join.showModal();
    this.playSfx('click');
  }

  openRulesModal(game) {
    document.getElementById('rules-modal-title').textContent = `${game.icon} ${game.name} — Rules`;
    const content = document.getElementById('rules-modal-content');
    content.innerHTML = `
      <p style="margin-bottom:0.75rem; font-weight:600; color:#38bdf8;">${game.tagline || ''}</p>
      <ul>
        ${(game.howToPlay || []).map(r => `<li>${r}</li>`).join('')}
      </ul>
    `;
    this.modals.rules.showModal();
    this.playSfx('click');
  }

  switchView(viewName) {
    Object.keys(this.views).forEach(key => {
      this.views[key].classList.toggle('active', key === viewName);
    });
    this.currentView = viewName;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 2800);
  }

  checkUrlForRoomCode() {
    const path = window.location.pathname;
    const match = path.match(/\/join\/([A-Za-z0-9]+)/);
    if (match && match[1]) {
      this.joinRoom(match[1]);
    }
  }

  // =========================================================================
  // Room Lifecycle (Create, Join, Leave)
  // =========================================================================
  createRoom({ gameId, maxPlayers, playerName }) {
    this.socket.emit('create_room', {
      gameId,
      maxPlayers,
      playerName,
      playerToken: this.playerToken
    }, (res) => {
      if (res && res.success) {
        this.currentRoom = res.room;
        this.myPlayerIndex = res.playerIndex;
        sessionStorage.setItem('miniplay_current_room', res.roomCode);
        history.pushState(null, '', `/join/${res.roomCode}`);

        this.renderLobby();
        this.switchView('lobby');
        this.toast(`Room ${res.roomCode} created! 🎉`);
        this.playSfx('match');
      } else {
        this.toast(res?.error || 'Failed to create room');
      }
    });
  }

  joinRoom(roomCode, playerName) {
    const name = playerName || localStorage.getItem('miniplay_player_name') || 'Player 2';
    this.socket.emit('join_room', {
      roomCode,
      playerName: name,
      playerToken: this.playerToken
    }, (res) => {
      if (res && res.success) {
        this.currentRoom = res.room;
        this.myPlayerIndex = res.playerIndex;
        sessionStorage.setItem('miniplay_current_room', res.roomCode);
        history.pushState(null, '', `/join/${res.roomCode}`);

        if (res.room.status === 'playing') {
          this.launchGame();
        } else {
          this.renderLobby();
          this.switchView('lobby');
        }
        this.toast(`Joined Room ${res.roomCode}! 🎮`);
        this.playSfx('match');
      } else {
        this.toast(res?.error || 'Failed to join room');
      }
    });
  }

  leaveRoom() {
    if (this.activeGameModule && this.activeGameModule.onDestroy) {
      this.activeGameModule.onDestroy();
      this.activeGameModule = null;
    }

    this.socket.emit('leave_room');
    sessionStorage.removeItem('miniplay_current_room');
    this.currentRoom = null;
    this.myPlayerIndex = null;
    history.pushState(null, '', '/');
    this.switchView('home');
    this.toast('Left room');
  }

  // =========================================================================
  // Lobby Rendering
  // =========================================================================
  renderLobby() {
    if (!this.currentRoom) return;

    const r = this.currentRoom;
    document.getElementById('lobby-game-icon').textContent = r.gameMeta?.icon || '🎮';
    document.getElementById('lobby-game-name').textContent = r.gameMeta?.name || 'Mini Game';
    document.getElementById('lobby-room-code').textContent = r.code;
    document.getElementById('lobby-player-count').textContent = r.players.length;
    document.getElementById('lobby-max-players').textContent = r.maxPlayers;

    const statusBadge = document.getElementById('lobby-status-badge');
    const startBtn = document.getElementById('btn-start-game');

    const me = r.players[this.myPlayerIndex];
    const isHost = me ? me.isHost : false;
    const isReady = r.players.length >= r.minPlayers;

    if (isReady) {
      statusBadge.textContent = 'Ready to Start!';
      statusBadge.className = 'status-badge ready';
      startBtn.disabled = !isHost;
      startBtn.textContent = isHost ? '🚀 START GAME' : 'Waiting for host to start...';
    } else {
      statusBadge.textContent = `Waiting for ${r.minPlayers - r.players.length} more player(s)...`;
      statusBadge.className = 'status-badge waiting';
      startBtn.disabled = true;
      startBtn.textContent = 'Waiting for players...';
    }

    // Players slots
    const playersList = document.getElementById('lobby-players-list');
    let slotsHtml = '';
    for (let i = 0; i < r.maxPlayers; i++) {
      const p = r.players[i];
      if (p) {
        slotsHtml += `
          <div class="player-slot occupied">
            <div class="slot-info">
              <div class="slot-avatar">👤</div>
              <div class="slot-name">
                ${p.name}
                ${p.index === this.myPlayerIndex ? '<span style="color:#38bdf8;">(You)</span>' : ''}
                ${p.isHost ? '<span class="host-tag">HOST ★</span>' : ''}
              </div>
            </div>
            <span class="status-badge ready">${p.connected ? '● Ready' : '○ Away'}</span>
          </div>
        `;
      } else {
        slotsHtml += `
          <div class="player-slot waiting">
            <div class="slot-info">
              <div class="slot-avatar">⏳</div>
              <div class="slot-name" style="color:var(--text-dim);">Waiting for Player ${i + 1}...</div>
            </div>
            <span class="status-badge waiting">Empty</span>
          </div>
        `;
      }
    }
    playersList.innerHTML = slotsHtml;

    // Rules
    const rulesList = document.getElementById('lobby-rules-list');
    rulesList.innerHTML = (r.gameMeta?.howToPlay || []).map(rl => `<li>${rl}</li>`).join('');
  }

  // =========================================================================
  // Game Launching & Mounting
  // =========================================================================
  async launchGame() {
    this.switchView('game');
    this.updateGameHeader();
    this.updateTurnBanner();

    const gameId = this.currentRoom.gameId;

    // Ensure client script is loaded
    if (!window.MiniPlayGames[gameId]) {
      const scriptUrl = this.currentRoom.gameMeta?.clientScript || `/games/${gameId}/game.js`;
      await this.loadScript(scriptUrl);
    }

    const gameModule = window.MiniPlayGames[gameId];
    if (!gameModule) {
      this.toast('Game client failed to initialize');
      return;
    }

    const container = document.getElementById('game-stage-container');
    container.innerHTML = '';

    if (this.activeGameModule && this.activeGameModule.onDestroy) {
      this.activeGameModule.onDestroy();
    }

    this.activeGameModule = gameModule;
    gameModule.init(container, this.socket, this.currentRoom, this.myPlayerIndex, this);
    this.playSfx('match');
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) return resolve();

      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });
  }

  updateGameHeader() {
    if (!this.currentRoom) return;
    const r = this.currentRoom;

    document.getElementById('active-game-icon').textContent = r.gameMeta?.icon || '🎮';
    document.getElementById('active-game-title').textContent = r.gameMeta?.name || 'Mini Game';
    document.getElementById('game-room-badge').textContent = `Room: ${r.code}`;
    document.getElementById('game-players-badge').textContent = `Players: ${r.players.length}/${r.maxPlayers}`;

    const myPlayer = r.players[this.myPlayerIndex];
    const myNameEl = document.getElementById('my-player-name');
    if (myNameEl && myPlayer) {
      myNameEl.textContent = `${myPlayer.name} ${myPlayer.isHost ? '★' : ''}`;
    }
  }

  updateTurnBanner() {
    const banner = document.getElementById('game-turn-banner');
    const textEl = document.getElementById('turn-banner-text');
    if (!banner || !textEl || !this.currentRoom || !this.currentRoom.gameState) return;

    const state = this.currentRoom.gameState;
    banner.className = 'turn-banner';

    if (state.winner !== null) {
      banner.classList.add('waiting-turn');
      textEl.textContent = state.winner === 'draw' ? '🤝 Round ended in a Draw!' : `🏆 Game Over!`;
      return;
    }

    if (state.currentTurn !== undefined) {
      const isMyTurn = state.currentTurn === this.myPlayerIndex;
      if (isMyTurn) {
        banner.classList.add('my-turn');
        textEl.textContent = '🎯 It\'s Your Turn!';
      } else {
        banner.classList.add('waiting-turn');
        const currPlayer = this.currentRoom.players[state.currentTurn];
        textEl.textContent = `⏳ Waiting for ${currPlayer ? currPlayer.name : `Player ${state.currentTurn + 1}`}...`;
      }
    } else {
      textEl.textContent = '⚔️ Battle in progress!';
    }
  }

  handleGameOver(evt) {
    const modal = this.modals.gameOver;
    const icon = document.getElementById('game-over-icon');
    const title = document.getElementById('game-over-title');
    const msg = document.getElementById('game-over-message');
    const scoreboard = document.getElementById('game-over-scoreboard');

    if (evt.winner === 'draw' || evt.result === 'draw') {
      icon.textContent = '🤝';
      title.textContent = 'Draw!';
      msg.textContent = 'Well played by both sides!';
      this.playSfx('click');
    } else {
      const winnerIdx = evt.winner !== undefined ? evt.winner : evt.playerIndex;
      const winnerName = this.currentRoom?.players[winnerIdx]?.name || `Player ${winnerIdx + 1}`;

      if (winnerIdx === this.myPlayerIndex) {
        icon.textContent = '🏆';
        title.textContent = 'Victory!';
        msg.textContent = 'Congratulations! You won the match!';
        this.playSfx('win');
      } else {
        icon.textContent = '💥';
        title.textContent = 'Defeat!';
        msg.textContent = `${winnerName} takes the victory!`;
        this.playSfx('lose');
      }
    }

    // Render scoreboard
    if (this.currentRoom && this.currentRoom.gameState?.scores) {
      scoreboard.innerHTML = this.currentRoom.players.map((p, idx) => `
        <div class="score-badge">
          <span class="score-name">${p.name}</span>
          <span class="score-val">${this.currentRoom.gameState.scores[idx] || 0}</span>
        </div>
      `).join('');
      scoreboard.style.display = 'flex';
    } else {
      scoreboard.style.display = 'none';
    }

    modal.showModal();
  }
}

// Instantiate on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  window.MiniPlay = new MiniPlayApp();
});
