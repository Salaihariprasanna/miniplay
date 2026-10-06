/**
 * MiniPlay Server
 * Express + Socket.IO entry point
 */

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const { GAMES } = require('./games/registry');
const { RoomManager } = require('./roomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const roomManager = new RoomManager(io);

// Static assets
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));
app.use(express.json());

// API: List of available games
app.get('/api/games', (req, res) => {
  res.json({ games: Object.values(GAMES) });
});

// API: Specific room info (for link previews or quick check)
app.get('/api/room/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase();
  const room = roomManager.rooms.get(code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({
    code: room.code,
    gameId: room.gameId,
    gameName: room.gameMeta.name,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    status: room.status
  });
});

// Shareable Link handler: /join/:code -> serves index.html
app.get('/join/:code', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Fallback to index.html for client-side navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Real-time Socket.IO events
io.on('connection', (socket) => {
  // 1. Create Room
  socket.on('create_room', (data, callback) => {
    try {
      const { gameId, maxPlayers, playerName, avatar, playerToken } = data;
      const result = roomManager.createRoom({
        gameId,
        maxPlayers,
        playerName,
        avatar,
        socket,
        socketId: socket.id,
        playerToken
      });
      if (typeof callback === 'function') callback(result);
    } catch (err) {
      console.error('Error in create_room:', err);
      if (typeof callback === 'function') callback({ success: false, error: 'Internal server error' });
    }
  });

  // 2. Join Room
  socket.on('join_room', (data, callback) => {
    try {
      const { roomCode, playerName, avatar, playerToken } = data;
      const result = roomManager.joinRoom({
        roomCode,
        playerName,
        avatar,
        socket,
        socketId: socket.id,
        playerToken
      });
      if (typeof callback === 'function') callback(result);
    } catch (err) {
      console.error('Error in join_room:', err);
      if (typeof callback === 'function') callback({ success: false, error: 'Internal server error' });
    }
  });

  // 3. Player Game Action
  socket.on('player_action', (action, callback) => {
    try {
      const result = roomManager.handlePlayerAction({
        socketId: socket.id,
        action
      });
      if (typeof callback === 'function') callback(result);
    } catch (err) {
      console.error('Error in player_action:', err);
      if (typeof callback === 'function') callback({ success: false, error: 'Internal server error' });
    }
  });

  // 4. Leave Room
  socket.on('leave_room', (callback) => {
    try {
      roomManager.handleDisconnect(socket.id);
      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('Error in leave_room:', err);
    }
  });

  // 5. Disconnect
  socket.on('disconnect', () => {
    roomManager.handleDisconnect(socket.id);
  });
});

const os = require('os');

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log('====================================================');
  console.log('  🎮 MiniPlay Server is LIVE!');
  console.log(`  💻 On this PC:          http://localhost:${PORT}`);
  console.log(`  📱 On phones (Wi-Fi):   http://${localIp}:${PORT}`);
  console.log('====================================================');
});
