/**
 * Carrom Game Logic (Server)
 * 2 Players. Board size: 600x600 normalized coordinates.
 */

const BOARD_SIZE = 600;
const POCKET_RADIUS = 28;
const COIN_RADIUS = 14;
const STRIKER_RADIUS = 20;
const FRICTION = 0.982;

const POCKETS = [
  { x: 35, y: 35 },
  { x: BOARD_SIZE - 35, y: 35 },
  { x: 35, y: BOARD_SIZE - 35 },
  { x: BOARD_SIZE - 35, y: BOARD_SIZE - 35 }
];

function initCoins() {
  const center = { x: BOARD_SIZE / 2, y: BOARD_SIZE / 2 };
  const coins = [];

  // Queen (Red) in center
  coins.push({ id: 'queen', type: 'queen', x: center.x, y: center.y, vx: 0, vy: 0, pocketed: false, radius: COIN_RADIUS });

  // Ring of 8 coins: alternating white & black
  const count = 8;
  const ringRadius = 32;
  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count;
    const type = i % 2 === 0 ? 'white' : 'black';
    coins.push({
      id: `coin_${i}`,
      type,
      x: center.x + Math.cos(angle) * ringRadius,
      y: center.y + Math.sin(angle) * ringRadius,
      vx: 0,
      vy: 0,
      pocketed: false,
      radius: COIN_RADIUS
    });
  }

  return coins;
}

function initGameState() {
  return {
    boardSize: BOARD_SIZE,
    coins: initCoins(),
    striker: {
      x: BOARD_SIZE / 2,
      y: BOARD_SIZE - 80,
      vx: 0,
      vy: 0,
      radius: STRIKER_RADIUS,
      active: true
    },
    currentTurn: 0, // 0 = White, 1 = Black
    scores: [0, 0],
    winner: null,
    isSimulating: false,
    history: []
  };
}

function simulatePhysics(coins, striker, shotVx, shotVy, strikerX) {
  // Set striker position & velocity
  striker.x = Math.max(100, Math.min(BOARD_SIZE - 100, strikerX));
  striker.y = BOARD_SIZE - 80;
  striker.vx = shotVx;
  striker.vy = shotVy;
  striker.active = true;

  const newlyPocketed = [];
  const maxSteps = 250;

  for (let step = 0; step < maxSteps; step++) {
    const allObjects = [...coins.filter(c => !c.pocketed), striker];

    // Move
    for (const obj of allObjects) {
      obj.x += obj.vx;
      obj.y += obj.vy;
      obj.vx *= FRICTION;
      obj.vy *= FRICTION;

      // Stop jitter
      if (Math.hypot(obj.vx, obj.vy) < 0.1) {
        obj.vx = 0;
        obj.vy = 0;
      }

      // Wall bounce
      const minB = 30 + obj.radius;
      const maxB = BOARD_SIZE - 30 - obj.radius;
      if (obj.x < minB) { obj.x = minB; obj.vx = -obj.vx * 0.8; }
      if (obj.x > maxB) { obj.x = maxB; obj.vx = -obj.vx * 0.8; }
      if (obj.y < minB) { obj.y = minB; obj.vy = -obj.vy * 0.8; }
      if (obj.y > maxB) { obj.y = maxB; obj.vy = -obj.vy * 0.8; }

      // Pocket check
      for (const pocket of POCKETS) {
        if (Math.hypot(obj.x - pocket.x, obj.y - pocket.y) < POCKET_RADIUS) {
          if (obj === striker) {
            striker.vx = 0;
            striker.vy = 0;
            newlyPocketed.push({ type: 'striker' });
          } else if (!obj.pocketed) {
            obj.pocketed = true;
            obj.vx = 0;
            obj.vy = 0;
            newlyPocketed.push({ id: obj.id, type: obj.type });
          }
        }
      }
    }

    // Pairwise circle collisions
    for (let i = 0; i < allObjects.length; i++) {
      for (let j = i + 1; j < allObjects.length; j++) {
        const a = allObjects[i];
        const b = allObjects[j];
        if (a.pocketed || b.pocketed) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;

        if (dist > 0 && dist < minDist) {
          // Normal vector
          const nx = dx / dist;
          const ny = dy / dist;

          // Separate
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          // Elastic collision
          const kx = a.vx - b.vx;
          const ky = a.vy - b.vy;
          const p = 2 * (nx * kx + ny * ky) / 2; // Equal masses approx

          a.vx -= p * nx * 0.9;
          a.vy -= p * ny * 0.9;
          b.vx += p * nx * 0.9;
          b.vy += p * ny * 0.9;
        }
      }
    }

    // Check if everything has stopped
    const moving = allObjects.some(o => Math.hypot(o.vx, o.vy) > 0.1);
    if (!moving && step > 10) break;
  }

  // Reset striker
  striker.vx = 0;
  striker.vy = 0;
  striker.x = BOARD_SIZE / 2;
  striker.y = BOARD_SIZE - 80;

  return newlyPocketed;
}

function handleAction(gameState, playerIndex, action) {
  if (action.type === 'strike') {
    const { strikerX, vx, vy } = action;

    if (gameState.winner !== null) {
      return { valid: false, error: 'Game is over' };
    }
    if (gameState.currentTurn !== playerIndex) {
      return { valid: false, error: 'Not your turn' };
    }

    // Execute physics
    const pocketed = simulatePhysics(gameState.coins, gameState.striker, vx, vy, strikerX);

    let pottedOwn = false;
    let strikerFoul = false;

    for (const item of pocketed) {
      if (item.type === 'striker') {
        strikerFoul = true;
        gameState.scores[playerIndex] = Math.max(0, gameState.scores[playerIndex] - 5);
      } else if (item.type === 'queen') {
        gameState.scores[playerIndex] += 25;
        pottedOwn = true;
      } else if (item.type === 'white') {
        gameState.scores[0] += 10;
        if (playerIndex === 0) pottedOwn = true;
      } else if (item.type === 'black') {
        gameState.scores[1] += 10;
        if (playerIndex === 1) pottedOwn = true;
      }
    }

    const events = [{
      type: 'shot_executed',
      strikerX,
      vx,
      vy,
      pocketed,
      playerIndex
    }];

    // Check if remaining coins
    const remaining = gameState.coins.filter(c => !c.pocketed);
    if (remaining.length === 0) {
      gameState.winner = gameState.scores[0] > gameState.scores[1] ? 0 : (gameState.scores[1] > gameState.scores[0] ? 1 : 'draw');
      events.push({ type: 'game_over', winner: gameState.winner, scores: gameState.scores });
    } else {
      // Bonus turn if player potted own coin and no foul
      if (!pottedOwn || strikerFoul) {
        gameState.currentTurn = 1 - gameState.currentTurn;
      }
      events.push({ type: 'turn_ended', nextTurn: gameState.currentTurn });
    }

    return { valid: true, stateChanged: true, events };
  }

  if (action.type === 'restart') {
    const newState = initGameState();
    Object.assign(gameState, newState);
    return { valid: true, stateChanged: true, events: [{ type: 'game_restarted' }] };
  }

  return { valid: false, error: 'Unknown action' };
}

function getPublicState(gameState) {
  return gameState;
}

function resetGameState() {
  return initGameState();
}

module.exports = {
  initGameState,
  handleAction,
  getPublicState,
  resetGameState
};
