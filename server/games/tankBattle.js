/**
 * Tank Battle Game Logic (Server)
 * 2 to 4 Players. Real-time top-down arena.
 */

const ARENA_WIDTH = 800;
const ARENA_HEIGHT = 500;
const TANK_SPEED = 3.5;
const ROT_SPEED = 0.06;
const BULLET_SPEED = 7;
const TANK_RADIUS = 18;
const BULLET_RADIUS = 4;
const RESPAWN_DELAY = 1500; // ms

// Simple symmetrical obstacles
const OBSTACLES = [
  { x: 180, y: 120, w: 40, h: 100 },
  { x: 580, y: 120, w: 40, h: 100 },
  { x: 180, y: 280, w: 40, h: 100 },
  { x: 580, y: 280, w: 40, h: 100 },
  { x: 360, y: 210, w: 80, h: 80 }
];

const SPAWN_POINTS = [
  { x: 80, y: 80, angle: 0 },
  { x: ARENA_WIDTH - 80, y: ARENA_HEIGHT - 80, angle: Math.PI },
  { x: ARENA_WIDTH - 80, y: 80, angle: Math.PI / 2 },
  { x: 80, y: ARENA_HEIGHT - 80, angle: -Math.PI / 2 }
];

const PLAYER_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'];

function initGameState(options = {}) {
  const playerCount = options.playerCount || 2;
  const tanks = [];

  for (let i = 0; i < playerCount; i++) {
    const sp = SPAWN_POINTS[i % SPAWN_POINTS.length];
    tanks.push({
      id: i,
      x: sp.x,
      y: sp.y,
      angle: sp.angle,
      turretAngle: sp.angle,
      color: PLAYER_COLORS[i],
      hp: 100,
      kills: 0,
      isDead: false,
      respawnAt: 0,
      inputs: { forward: 0, rotate: 0, shoot: false, turretAngle: 0 }
    });
  }

  return {
    arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT },
    obstacles: OBSTACLES,
    playerCount,
    tanks,
    bullets: [],
    winner: null,
    targetKills: 5,
    isRealtime: true // Signals roomManager to run loop
  };
}

function checkObstacleCollision(x, y, radius) {
  // Arena borders
  if (x - radius < 0 || x + radius > ARENA_WIDTH || y - radius < 0 || y + radius > ARENA_HEIGHT) {
    return true;
  }
  // Obstacles
  for (const obs of OBSTACLES) {
    if (
      x + radius > obs.x &&
      x - radius < obs.x + obs.w &&
      y + radius > obs.y &&
      y - radius < obs.y + obs.h
    ) {
      return true;
    }
  }
  return false;
}

function updateTick(gameState, dt = 0.05) {
  if (gameState.winner !== null) return [];
  const events = [];
  const now = Date.now();

  // Update tanks
  gameState.tanks.forEach(tank => {
    if (tank.isDead) {
      if (now >= tank.respawnAt) {
        tank.isDead = false;
        tank.hp = 100;
        const sp = SPAWN_POINTS[tank.id % SPAWN_POINTS.length];
        tank.x = sp.x;
        tank.y = sp.y;
        tank.angle = sp.angle;
        events.push({ type: 'tank_respawned', playerId: tank.id });
      }
      return;
    }

    // Rotation
    if (tank.inputs.rotate !== 0) {
      tank.angle += tank.inputs.rotate * ROT_SPEED;
    }
    tank.turretAngle = tank.inputs.turretAngle || tank.angle;

    // Movement
    if (tank.inputs.forward !== 0) {
      const moveDist = tank.inputs.forward * TANK_SPEED;
      const nextX = tank.x + Math.cos(tank.angle) * moveDist;
      const nextY = tank.y + Math.sin(tank.angle) * moveDist;

      if (!checkObstacleCollision(nextX, nextY, TANK_RADIUS)) {
        tank.x = nextX;
        tank.y = nextY;
      }
    }
  });

  // Update bullets
  for (let i = gameState.bullets.length - 1; i >= 0; i--) {
    const b = gameState.bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    // Collision with walls & obstacles
    let bounced = false;
    // Outer walls
    if (b.x < BULLET_RADIUS || b.x > ARENA_WIDTH - BULLET_RADIUS) {
      b.vx = -b.vx;
      b.bounces++;
      bounced = true;
    }
    if (b.y < BULLET_RADIUS || b.y > ARENA_HEIGHT - BULLET_RADIUS) {
      b.vy = -b.vy;
      b.bounces++;
      bounced = true;
    }

    // Obstacle walls
    for (const obs of OBSTACLES) {
      if (
        b.x + BULLET_RADIUS > obs.x &&
        b.x - BULLET_RADIUS < obs.x + obs.w &&
        b.y + BULLET_RADIUS > obs.y &&
        b.y - BULLET_RADIUS < obs.y + obs.h
      ) {
        b.vx = -b.vx;
        b.bounces++;
        bounced = true;
        break;
      }
    }

    if (b.bounces > 1 || b.life <= 0) {
      gameState.bullets.splice(i, 1);
      continue;
    }

    // Check hit on tanks
    for (const tank of gameState.tanks) {
      if (!tank.isDead && Math.hypot(tank.x - b.x, tank.y - b.y) < TANK_RADIUS + BULLET_RADIUS) {
        // Hit!
        tank.hp -= 25;
        events.push({ type: 'tank_hit', playerId: tank.id, hp: tank.hp, attackerId: b.ownerId });
        gameState.bullets.splice(i, 1);

        if (tank.hp <= 0) {
          tank.isDead = true;
          tank.respawnAt = now + RESPAWN_DELAY;
          const attacker = gameState.tanks[b.ownerId];
          if (attacker && b.ownerId !== tank.id) {
            attacker.kills += 1;
          }
          events.push({ type: 'tank_destroyed', victimId: tank.id, killerId: b.ownerId });

          if (attacker && attacker.kills >= gameState.targetKills) {
            gameState.winner = b.ownerId;
            events.push({ type: 'game_over', winner: b.ownerId });
          }
        }
        break;
      }
    }
  }

  return events;
}

function handleAction(gameState, playerIndex, action) {
  if (action.type === 'input') {
    const tank = gameState.tanks[playerIndex];
    if (tank) {
      tank.inputs = { ...tank.inputs, ...action.inputs };
    }
    return { valid: true, stateChanged: false };
  }

  if (action.type === 'shoot') {
    const tank = gameState.tanks[playerIndex];
    if (!tank || tank.isDead || gameState.winner !== null) {
      return { valid: false, error: 'Cannot shoot' };
    }

    // Cap max bullets active per player
    const playerBullets = gameState.bullets.filter(b => b.ownerId === playerIndex);
    if (playerBullets.length >= 3) {
      return { valid: false, error: 'Reloading' };
    }

    const angle = action.turretAngle !== undefined ? action.turretAngle : tank.angle;
    const spawnDist = TANK_RADIUS + 8;
    const bx = tank.x + Math.cos(angle) * spawnDist;
    const by = tank.y + Math.sin(angle) * spawnDist;

    gameState.bullets.push({
      x: bx,
      y: by,
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      ownerId: playerIndex,
      bounces: 0,
      life: 140
    });

    return { valid: true, stateChanged: true, events: [{ type: 'bullet_fired', x: bx, y: by, angle, ownerId: playerIndex }] };
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
    obstacles: gameState.obstacles,
    playerCount: gameState.playerCount,
    tanks: gameState.tanks.map(t => ({
      id: t.id,
      x: t.x,
      y: t.y,
      angle: t.angle,
      turretAngle: t.turretAngle,
      color: t.color,
      hp: t.hp,
      kills: t.kills,
      isDead: t.isDead
    })),
    bullets: gameState.bullets.map(b => ({
      x: b.x,
      y: b.y,
      ownerId: b.ownerId
    })),
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
