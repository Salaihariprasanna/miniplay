/**
 * Simple Shooting Game Logic (Server)
 * 2 to 4 Players. Fast-paced top-down laser arena.
 */

const ARENA_WIDTH = 800;
const ARENA_HEIGHT = 500;
const PLAYER_SPEED = 4.2;
const BULLET_SPEED = 9;
const PLAYER_RADIUS = 16;
const BULLET_RADIUS = 5;

const PLAYER_COLORS = ['#38bdf8', '#f43f5e', '#a855f7', '#fbbf24'];

function initGameState(options = {}) {
  const playerCount = options.playerCount || 2;
  const players = [];

  const spawns = [
    { x: 100, y: 100 },
    { x: ARENA_WIDTH - 100, y: ARENA_HEIGHT - 100 },
    { x: ARENA_WIDTH - 100, y: 100 },
    { x: 100, y: ARENA_HEIGHT - 100 }
  ];

  for (let i = 0; i < playerCount; i++) {
    players.push({
      id: i,
      x: spawns[i].x,
      y: spawns[i].y,
      aimAngle: 0,
      color: PLAYER_COLORS[i],
      hp: 100,
      kills: 0,
      isDead: false,
      respawnAt: 0,
      inputs: { vx: 0, vy: 0, aimAngle: 0 }
    });
  }

  return {
    arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT },
    playerCount,
    players,
    bullets: [],
    powerups: [{ x: 400, y: 250, type: 'health', radius: 12 }],
    winner: null,
    targetKills: 5,
    isRealtime: true
  };
}

function updateTick(gameState) {
  if (gameState.winner !== null) return [];
  const events = [];
  const now = Date.now();

  // Players
  gameState.players.forEach(p => {
    if (p.isDead) {
      if (now >= p.respawnAt) {
        p.isDead = false;
        p.hp = 100;
        p.x = 80 + Math.random() * (ARENA_WIDTH - 160);
        p.y = 80 + Math.random() * (ARENA_HEIGHT - 160);
        events.push({ type: 'player_respawned', playerId: p.id });
      }
      return;
    }

    // Move
    p.x += (p.inputs.vx || 0) * PLAYER_SPEED;
    p.y += (p.inputs.vy || 0) * PLAYER_SPEED;
    p.aimAngle = p.inputs.aimAngle || 0;

    // Bounds
    p.x = Math.max(PLAYER_RADIUS, Math.min(ARENA_WIDTH - PLAYER_RADIUS, p.x));
    p.y = Math.max(PLAYER_RADIUS, Math.min(ARENA_HEIGHT - PLAYER_RADIUS, p.y));

    // Powerup pickups
    for (let i = gameState.powerups.length - 1; i >= 0; i--) {
      const pu = gameState.powerups[i];
      if (Math.hypot(p.x - pu.x, p.y - pu.y) < PLAYER_RADIUS + pu.radius) {
        if (pu.type === 'health') {
          p.hp = Math.min(100, p.hp + 40);
        }
        gameState.powerups.splice(i, 1);
        events.push({ type: 'powerup_collected', playerId: p.id, powerup: pu });
      }
    }
  });

  // Bullets
  for (let i = gameState.bullets.length - 1; i >= 0; i--) {
    const b = gameState.bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    if (b.x < 0 || b.x > ARENA_WIDTH || b.y < 0 || b.y > ARENA_HEIGHT || b.life <= 0) {
      gameState.bullets.splice(i, 1);
      continue;
    }

    // Check hit
    for (const p of gameState.players) {
      if (!p.isDead && p.id !== b.ownerId && Math.hypot(p.x - b.x, p.y - b.y) < PLAYER_RADIUS + BULLET_RADIUS) {
        p.hp -= 20;
        gameState.bullets.splice(i, 1);
        events.push({ type: 'player_hit', playerId: p.id, hp: p.hp, attackerId: b.ownerId });

        if (p.hp <= 0) {
          p.isDead = true;
          p.respawnAt = now + 1500;
          const attacker = gameState.players[b.ownerId];
          if (attacker) attacker.kills += 1;
          events.push({ type: 'player_eliminated', victimId: p.id, killerId: b.ownerId });

          if (attacker && attacker.kills >= gameState.targetKills) {
            gameState.winner = b.ownerId;
            events.push({ type: 'game_over', winner: b.ownerId });
          }
        }
        break;
      }
    }
  }

  // Periodic powerup spawn
  if (gameState.powerups.length === 0 && Math.random() < 0.015) {
    gameState.powerups.push({
      x: 100 + Math.random() * (ARENA_WIDTH - 200),
      y: 100 + Math.random() * (ARENA_HEIGHT - 200),
      type: 'health',
      radius: 12
    });
  }

  return events;
}

function handleAction(gameState, playerIndex, action) {
  if (action.type === 'input') {
    const player = gameState.players[playerIndex];
    if (player) {
      player.inputs = { ...player.inputs, ...action.inputs };
    }
    return { valid: true, stateChanged: false };
  }

  if (action.type === 'shoot') {
    const player = gameState.players[playerIndex];
    if (!player || player.isDead || gameState.winner !== null) {
      return { valid: false, error: 'Cannot shoot' };
    }

    const angle = action.aimAngle !== undefined ? action.aimAngle : player.aimAngle;
    gameState.bullets.push({
      x: player.x + Math.cos(angle) * (PLAYER_RADIUS + 5),
      y: player.y + Math.sin(angle) * (PLAYER_RADIUS + 5),
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      ownerId: playerIndex,
      life: 90
    });

    return { valid: true, stateChanged: true, events: [{ type: 'laser_fired', ownerId: playerIndex }] };
  }

  if (action.type === 'restart') {
    const newState = initGameState({ playerCount: gameState.playerCount });
    Object.assign(gameState, newState);
    return { valid: true, stateChanged: true, events: [{ type: 'game_restarted' }] };
  }

  return { valid: false, error: 'Unknown action' };
}

function getPublicState(gameState) {
  return {
    arena: gameState.arena,
    playerCount: gameState.playerCount,
    players: gameState.players.map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      aimAngle: p.aimAngle,
      color: p.color,
      hp: p.hp,
      kills: p.kills,
      isDead: p.isDead
    })),
    bullets: gameState.bullets.map(b => ({
      x: b.x,
      y: b.y,
      ownerId: b.ownerId
    })),
    powerups: gameState.powerups,
    winner: gameState.winner,
    targetKills: gameState.targetKills
  };
}

function resetGameState(gameState) {
  return initGameState({ playerCount: gameState.playerCount });
}

module.exports = {
  initGameState,
  handleAction,
  updateTick,
  getPublicState,
  resetGameState
};
