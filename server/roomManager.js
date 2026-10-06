/**
 * MiniPlay Room Manager
 * Handles in-memory room lifecycle, player connections, reconnection,
 * action delegation, and real-time tick loops.
 */

const { GAMES } = require('./games/registry');

// Game modules lookup
const GAME_MODULES = {
  'tic-tac-toe': require('./games/ticTacToe'),
  'connect-four': require('./games/connectFour'),
  'rock-paper-scissors': require('./games/rockPaperScissors'),
  'memory': require('./games/memory'),
  'snake-ladder': require('./games/snakeLadder'),
  'dots-and-boxes': require('./games/dotsAndBoxes'),
  'chess': require('./games/chess'),
  'checkers': require('./games/checkers'),
  'carrom': require('./games/carrom'),
  'tank-battle': require('./games/tankBattle'),
  'simple-shooter': require('./games/simpleShooter'),
  'stickman-fight': require('./games/stickmanFight'),
  'ludo': require('./games/ludo')
};

// Character set without confusing letters (0, O, 1, I)
const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // roomCode -> room object
    this.socketToRoom = new Map(); // socketId -> roomCode

    // Run expiration cleanup every 2 minutes (unref so tests or shutdown can exit gracefully)
    this.cleanupInterval = setInterval(() => this.cleanupInactiveRooms(), 2 * 60 * 1000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  close() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    for (const room of this.rooms.values()) {
      this.stopRealtimeLoop(room);
    }
  }

  generateRoomCode() {
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 5; i++) {
        code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  createRoom({ gameId, maxPlayers, playerName, avatar, socket, socketId, playerToken }) {
    const sId = socket?.id || socketId;
    const gameMeta = GAMES[gameId];
    if (!gameMeta) {
      return { success: false, error: 'Unknown game' };
    }

    const roomCode = this.generateRoomCode();
    const effectiveMax = Math.max(gameMeta.minPlayers, Math.min(gameMeta.maxPlayers, maxPlayers || gameMeta.defaultPlayers));
    const gameModule = GAME_MODULES[gameId];

    if (!gameModule) {
      return { success: false, error: 'Game logic module not found' };
    }

    const initialGameState = gameModule.initGameState({ playerCount: effectiveMax });

    const room = {
      code: roomCode,
      gameId,
      gameMeta,
      maxPlayers: effectiveMax,
      minPlayers: gameMeta.minPlayers,
      createdAt: Date.now(),
      lastActive: Date.now(),
      status: 'waiting', // 'waiting' | 'playing' | 'finished'
      players: [],
      gameState: initialGameState,
      tickTimer: null
    };

    const hostPlayer = {
      socketId: sId,
      token: playerToken,
      name: playerName || 'Player 1',
      avatar: avatar || '🦊',
      index: 0,
      isHost: true,
      connected: true,
      joinedAt: Date.now()
    };

    room.players.push(hostPlayer);
    this.rooms.set(roomCode, room);
    this.socketToRoom.set(sId, roomCode);

    if (socket && typeof socket.join === 'function') {
      socket.join(roomCode);
    }

    return {
      success: true,
      roomCode,
      room: this.sanitizeRoomForClient(room, 0),
      playerIndex: 0
    };
  }

  joinRoom({ roomCode, playerName, avatar, socket, socketId, playerToken }) {
    const sId = socket?.id || socketId;
    const code = (roomCode || '').trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      return { success: false, error: 'Room not found. It may have expired or code is incorrect.' };
    }

    room.lastActive = Date.now();

    if (socket && typeof socket.join === 'function') {
      socket.join(code);
    }

    const DEFAULT_AVATARS = ['🦊', '🦁', '🤖', '🚀', '👑', '🐼', '⚡', '🐉'];

    // 1. Check for Reconnection
    if (playerToken) {
      const existingPlayer = room.players.find(p => p.token === playerToken);
      if (existingPlayer) {
        // Re-bind to new socket
        const oldSocketId = existingPlayer.socketId;
        this.socketToRoom.delete(oldSocketId);
        existingPlayer.socketId = sId;
        existingPlayer.connected = true;
        if (playerName) existingPlayer.name = playerName;
        if (avatar) existingPlayer.avatar = avatar;

        this.socketToRoom.set(sId, code);

        this.io.to(code).emit('player_reconnected', {
          playerIndex: existingPlayer.index,
          name: existingPlayer.name
        });

        return {
          success: true,
          roomCode: code,
          room: this.sanitizeRoomForClient(room, existingPlayer.index),
          playerIndex: existingPlayer.index
        };
      }
    }

    // 2. New Player Joining
    if (room.players.length >= room.maxPlayers) {
      return { success: false, error: 'Room is already full.' };
    }

    const newIndex = room.players.length;
    const newPlayer = {
      socketId: sId,
      token: playerToken,
      name: playerName || `Player ${newIndex + 1}`,
      avatar: avatar || DEFAULT_AVATARS[newIndex % DEFAULT_AVATARS.length],
      index: newIndex,
      isHost: false,
      connected: true,
      joinedAt: Date.now()
    };

    room.players.push(newPlayer);
    this.socketToRoom.set(sId, code);

    // Auto-start game if 2-player or full
    if (room.players.length === room.maxPlayers) {
      this.startGame(code);
    }

    // Notify room of new player
    this.io.to(code).emit('room_updated', this.sanitizeRoomForClient(room));

    return {
      success: true,
      roomCode: code,
      room: this.sanitizeRoomForClient(room, newIndex),
      playerIndex: newIndex
    };
  }

  startGame(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    room.status = 'playing';
    room.lastActive = Date.now();

    const gameModule = GAME_MODULES[room.gameId];

    // Check if this game requires a server-side real-time tick loop
    if (room.gameState.isRealtime && !room.tickTimer) {
      room.tickTimer = setInterval(() => {
        if (room.status !== 'playing') return;

        const events = gameModule.updateTick ? gameModule.updateTick(room.gameState) : [];
        if (events && events.length > 0) {
          this.io.to(room.code).emit('game_events', events);
        }

        // Broadcast real-time state sync to all players in the room
        this.broadcastState(room);

        if (room.gameState.winner !== null) {
          room.status = 'finished';
          this.stopRealtimeLoop(room);
          this.io.to(room.code).emit('game_over', {
            winner: room.gameState.winner
          });
        }
      }, 45); // ~22 ticks per sec, very responsive yet low bandwidth
    }

    this.io.to(roomCode).emit('game_started', this.sanitizeRoomForClient(room));
    this.broadcastState(room);
  }

  handlePlayerAction({ socketId, action }) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) {
      return { success: false, error: 'Not in a room' };
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: 'Room does not exist' };
    }

    const player = room.players.find(p => p.socketId === socketId);
    if (!player) {
      return { success: false, error: 'Player not recognized' };
    }

    room.lastActive = Date.now();

    // Check Lobby / Room-level actions
    if (action.type === 'reaction') {
      const emoji = action.emoji || '👍';
      this.io.to(roomCode).emit('player_reaction', {
        playerIndex: player.index,
        playerName: player.name,
        avatar: player.avatar || '🦊',
        emoji
      });
      return { success: true };
    }

    if (action.type === 'start_game') {
      if (!player.isHost) {
        return { success: false, error: 'Only the host can start the game' };
      }
      if (room.players.length < room.minPlayers) {
        return { success: false, error: `Need at least ${room.minPlayers} players to start` };
      }
      this.startGame(roomCode);
      return { success: true };
    }

    // Delegate to Game Module
    const gameModule = GAME_MODULES[room.gameId];
    if (!gameModule) {
      return { success: false, error: 'Game module not found' };
    }

    const result = gameModule.handleAction(room.gameState, player.index, action, room);

    if (result && result.valid) {
      if (result.events && result.events.length > 0) {
        this.io.to(roomCode).emit('game_events', result.events);
      }

      if (result.stateChanged) {
        this.broadcastState(room);
      }

      // Check if game reached end state
      if (room.gameState.winner !== null && room.status === 'playing') {
        room.status = 'finished';
      }

      return { success: true, ...result };
    } else {
      return { success: false, error: result?.error || 'Invalid action' };
    }
  }

  broadcastState(room) {
    const gameModule = GAME_MODULES[room.gameId];
    for (const player of room.players) {
      if (player.connected && player.socketId) {
        const publicState = gameModule.getPublicState ? gameModule.getPublicState(room.gameState, player.index) : room.gameState;
        this.io.to(player.socketId).emit('state_sync', {
          gameState: publicState,
          status: room.status
        });
      }
    }
  }

  handleDisconnect(socketId) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return;

    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return;

    player.connected = false;
    room.lastActive = Date.now();

    this.io.to(roomCode).emit('player_disconnected', {
      playerIndex: player.index,
      name: player.name
    });

    // If host leaves and game is waiting, reassign host
    if (player.isHost && room.status === 'waiting') {
      const nextActive = room.players.find(p => p.connected);
      if (nextActive) {
        player.isHost = false;
        nextActive.isHost = true;
        this.io.to(roomCode).emit('room_updated', this.sanitizeRoomForClient(room));
      }
    }
  }

  stopRealtimeLoop(room) {
    if (room.tickTimer) {
      clearInterval(room.tickTimer);
      room.tickTimer = null;
    }
  }

  sanitizeRoomForClient(room, viewerIndex = null) {
    const gameModule = GAME_MODULES[room.gameId];
    const sanitizedGameState = gameModule && gameModule.getPublicState
      ? gameModule.getPublicState(room.gameState, viewerIndex)
      : room.gameState;

    return {
      code: room.code,
      gameId: room.gameId,
      gameMeta: room.gameMeta,
      maxPlayers: room.maxPlayers,
      minPlayers: room.minPlayers,
      status: room.status,
      players: room.players.map(p => ({
        index: p.index,
        name: p.name,
        avatar: p.avatar || '🦊',
        isHost: p.isHost,
        connected: p.connected
      })),
      gameState: sanitizedGameState
    };
  }

  cleanupInactiveRooms() {
    const now = Date.now();
    const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity

    for (const [code, room] of this.rooms.entries()) {
      const allDisconnected = room.players.every(p => !p.connected);
      const isExpired = (now - room.lastActive > TIMEOUT_MS) || (allDisconnected && now - room.lastActive > 5 * 60 * 1000);

      if (isExpired) {
        this.stopRealtimeLoop(room);
        this.rooms.delete(code);
        // Clean socket lookup
        for (const p of room.players) {
          if (p.socketId) this.socketToRoom.delete(p.socketId);
        }
      }
    }
  }
}

module.exports = { RoomManager };
