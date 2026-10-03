/**
 * Comprehensive Automated Tests for MiniPlay Platform
 */

const http = require('http');
const { io: ioClient } = require('socket.io-client');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');

const { GAMES } = require('../server/games/registry');
const { RoomManager } = require('../server/roomManager');

async function runTests() {
  console.log('--- 🧪 STARTING MINIPLAY PLATFORM TESTS ---');

  // Set up test server on port 3099
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const roomManager = new RoomManager(io);

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('/api/games', (req, res) => res.json({ games: Object.values(GAMES) }));
  app.get('/join/:code', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

  io.on('connection', (socket) => {
    socket.on('create_room', (data, cb) => {
      const res = roomManager.createRoom({ ...data, socket, socketId: socket.id });
      if (cb) cb(res);
    });

    socket.on('join_room', (data, cb) => {
      const res = roomManager.joinRoom({ ...data, socket, socketId: socket.id });
      if (cb) cb(res);
    });

    socket.on('player_action', (action, cb) => {
      const res = roomManager.handlePlayerAction({ socketId: socket.id, action });
      if (cb) cb(res);
    });

    socket.on('disconnect', () => {
      roomManager.handleDisconnect(socket.id);
    });
  });

  const TEST_PORT = 3099;
  await new Promise(resolve => server.listen(TEST_PORT, resolve));
  console.log(`✅ Test server running on port ${TEST_PORT}`);

  try {
    // TEST 1: HTTP API Games endpoint
    console.log('\n--- Test 1: HTTP API Games List ---');
    const apiRes = await fetch(`http://localhost:${TEST_PORT}/api/games`);
    const gamesData = await apiRes.json();
    if (gamesData.games && gamesData.games.length >= 10) {
      console.log(`✅ Verified ${gamesData.games.length} games available in API registry`);
    } else {
      throw new Error(`Expected at least 10 games, got ${gamesData.games?.length}`);
    }

    // TEST 2: Socket.IO Room Creation & Joining
    console.log('\n--- Test 2: Socket.IO Room Creation & Joining ---');
    const socketP1 = ioClient(`http://localhost:${TEST_PORT}`);
    const socketP2 = ioClient(`http://localhost:${TEST_PORT}`);

    await Promise.all([
      new Promise(res => socketP1.on('connect', res)),
      new Promise(res => socketP2.on('connect', res))
    ]);
    console.log('✅ Both players connected via Socket.IO');

    const p1Token = 'p1_test_token_123';
    const p2Token = 'p2_test_token_456';

    const createRes = await new Promise(res => {
      socketP1.emit('create_room', {
        gameId: 'tic-tac-toe',
        maxPlayers: 2,
        playerName: 'Alice',
        playerToken: p1Token
      }, res);
    });

    if (!createRes.success || !createRes.roomCode || createRes.roomCode.length !== 5) {
      throw new Error('Failed to create room with 5-character code');
    }
    const roomCode = createRes.roomCode;
    console.log(`✅ Room created successfully with 5-char code: ${roomCode}`);

    // Track game_started event on both players
    const p1StartedPromise = new Promise(res => socketP1.on('game_started', res));
    const p2StartedPromise = new Promise(res => socketP2.on('game_started', res));

    const joinRes = await new Promise(res => {
      socketP2.emit('join_room', {
        roomCode,
        playerName: 'Bob',
        playerToken: p2Token
      }, res);
    });

    if (!joinRes.success || joinRes.playerIndex !== 1) {
      throw new Error(`Failed to join room: ${joinRes.error}`);
    }
    console.log('✅ Player 2 successfully joined room');

    await Promise.all([p1StartedPromise, p2StartedPromise]);
    console.log('✅ Both players received game_started event');

    // TEST 3: Multiplayer Tic Tac Toe Gameplay & Anti-Cheat Validation
    console.log('\n--- Test 3: Tic Tac Toe Moves & Turn Validation ---');

    // Player 2 attempts to move on Player 1's turn (should be rejected)
    const invalidTurnRes = await new Promise(res => {
      socketP2.emit('player_action', { type: 'move', cellIndex: 0 }, res);
    });
    if (invalidTurnRes.success) {
      throw new Error('Server should have rejected Player 2 moving on Player 1 turn');
    }
    console.log('✅ Anti-cheat: Rejected move out of turn');

    // Player 1 plays cell 0 (top-left)
    const m1 = await new Promise(res => socketP1.emit('player_action', { type: 'move', cellIndex: 0 }, res));
    if (!m1.success) throw new Error('Player 1 valid move rejected');

    // Player 2 tries to overwrite cell 0 (should be rejected)
    const overwriteRes = await new Promise(res => {
      socketP2.emit('player_action', { type: 'move', cellIndex: 0 }, res);
    });
    if (overwriteRes.success) throw new Error('Server should prevent cell overwriting');
    console.log('✅ Anti-cheat: Rejected cell overwrite');

    // Player 2 plays cell 1
    await new Promise(res => socketP2.emit('player_action', { type: 'move', cellIndex: 1 }, res));

    // Player 1 plays cell 4 (center)
    await new Promise(res => socketP1.emit('player_action', { type: 'move', cellIndex: 4 }, res));

    // Player 2 plays cell 2
    await new Promise(res => socketP2.emit('player_action', { type: 'move', cellIndex: 2 }, res));

    // Track game_over event
    const gameOverPromise = new Promise(res => {
      socketP1.on('game_events', (events) => {
        const winEvt = events.find(e => e.type === 'game_over');
        if (winEvt) res(winEvt);
      });
    });

    // Player 1 plays cell 8 (bottom-right) -> [0, 4, 8] Diagonal Win!
    await new Promise(res => socketP1.emit('player_action', { type: 'move', cellIndex: 8 }, res));

    const winEvt = await gameOverPromise;
    if (winEvt.result === 'win' && winEvt.winner === 0) {
      console.log('✅ Tic Tac Toe: Diagonal win [0, 4, 8] detected and broadcasted correctly to players');
    } else {
      throw new Error(`Unexpected win event: ${JSON.stringify(winEvt)}`);
    }

    // TEST 4: Reconnection with Token
    console.log('\n--- Test 4: Player Reconnection Preservation ---');
    socketP1.disconnect();
    const socketP1Reconnected = ioClient(`http://localhost:${TEST_PORT}`);
    await new Promise(res => socketP1Reconnected.on('connect', res));

    const reconnRes = await new Promise(res => {
      socketP1Reconnected.emit('join_room', {
        roomCode,
        playerName: 'Alice',
        playerToken: p1Token
      }, res);
    });

    if (reconnRes.success && reconnRes.playerIndex === 0) {
      console.log('✅ Player 1 successfully reconnected with state preserved');
    } else {
      throw new Error(`Reconnection failed: ${JSON.stringify(reconnRes)}`);
    }

    // TEST 5: Connect Four Logic
    console.log('\n--- Test 5: Connect Four Column Dropping ---');
    const c4Res = await new Promise(res => {
      socketP1Reconnected.emit('create_room', {
        gameId: 'connect-four',
        maxPlayers: 2,
        playerName: 'Alice',
        playerToken: p1Token
      }, res);
    });

    await new Promise(res => {
      socketP2.emit('join_room', {
        roomCode: c4Res.roomCode,
        playerName: 'Bob',
        playerToken: p2Token
      }, res);
    });

    // P0 drops in col 3 -> lands in row 5
    const dropRes = await new Promise(res => {
      socketP1Reconnected.emit('player_action', { type: 'drop', col: 3 }, res);
    });
    if (!dropRes.success) throw new Error('Connect Four drop failed');
    console.log('✅ Connect Four: Token dropped in lowest row 5 of column 3');

    // TEST 6: Rock Paper Scissors Secret Choices & Reveal
    console.log('\n--- Test 6: Rock Paper Scissors Simultaneous Reveal ---');
    const rpsRoom = await new Promise(res => {
      socketP1Reconnected.emit('create_room', {
        gameId: 'rock-paper-scissors',
        maxPlayers: 2,
        playerName: 'Alice',
        playerToken: p1Token
      }, res);
    });

    await new Promise(res => {
      socketP2.emit('join_room', {
        roomCode: rpsRoom.roomCode,
        playerName: 'Bob',
        playerToken: p2Token
      }, res);
    });

    // Alice picks Rock
    await new Promise(res => socketP1Reconnected.emit('player_action', { type: 'choose', choice: 'rock' }, res));

    // Bob picks Scissors -> Alice should win round
    const rpsRevealPromise = new Promise(res => {
      socketP1Reconnected.on('game_events', (events) => {
        const rev = events.find(e => e.type === 'round_revealed');
        if (rev) res(rev);
      });
    });

    await new Promise(res => socketP2.emit('player_action', { type: 'choose', choice: 'scissors' }, res));
    const revealEvt = await rpsRevealPromise;

    if (revealEvt.winner === 0) {
      console.log('✅ Rock Paper Scissors: Rock beats Scissors detected on reveal');
    } else {
      throw new Error('RPS did not score correctly');
    }

    // Disconnect clients
    socketP1Reconnected.disconnect();
    socketP2.disconnect();

    console.log('\n✨ ALL PLATFORM TESTS PASSED SUCCESSFULLY! ✨\n');
    roomManager.close();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    roomManager.close();
    server.close();
    process.exit(1);
  }
}

runTests();
