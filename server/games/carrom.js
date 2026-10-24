/**
 * Carrom Game Logic (Server)
 * 2 Players. Board size: 600x600 normalized coordinates.
 * Authentic 19 carrom men (9 White, 9 Black, 1 Red Queen), Queen cover rule & foul penalties.
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

  // 1 Queen (Red) in exact center
  coins.push({
    id: 'queen',
    type: 'queen',
    x: center.x,
    y: center.y,
    vx: 0,
    vy: 0,
    pocketed: false,
    radius: COIN_RADIUS
  });

  // Inner ring: 6 coins (alternating White & Black)
  const innerCount = 6;
  const innerRadius = 29;
  for (let i = 0; i < innerCount; i++) {
    const angle = (i * 2 * Math.PI) / innerCount;
    const type = (i % 2 === 0) ? 'white' : 'black';
    coins.push({
      id: `coin_in_${i}`,
      type,
      x: center.x + Math.cos(angle) * innerRadius,
      y: center.y + Math.sin(angle) * innerRadius,
      vx: 0,
      vy: 0,
      pocketed: false,
      radius: COIN_RADIUS
    });
  }

  // Outer ring: 12 coins (alternating White & Black)
  const outerCount = 12;
  const outerRadius = 57;
  for (let i = 0; i < outerCount; i++) {
    const angle = (i * 2 * Math.PI) / outerCount + Math.PI / 12;
    const type = (i % 2 === 0) ? 'white' : 'black';
    coins.push({
      id: `coin_out_${i}`,
      type,
      x: center.x + Math.cos(angle) * outerRadius,
      y: center.y + Math.sin(angle) * outerRadius,
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
    pendingQueenCover: null, // { player: 0 | 1 }
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
  const maxSteps = 300;

  for (let step = 0; step < maxSteps; step++) {
    const allObjects = [...coins.filter(c => !c.pocketed), striker];

    // Move objects
    for (const obj of allObjects) {
      obj.x += obj.vx;
      obj.y += obj.vy;
      obj.vx *= FRICTION;
      obj.vy *= FRICTION;

      // Stop micro-jitter
      if (Math.hypot(obj.vx, obj.vy) < 0.08) {
        obj.vx = 0;
        obj.vy = 0;
      }

      // Wall bounce off wooden timber cushions
      const minB = 30 + obj.radius;
      const maxB = BOARD_SIZE - 30 - obj.radius;
      if (obj.x < minB) { obj.x = minB; obj.vx = -obj.vx * 0.85; }
      if (obj.x > maxB) { obj.x = maxB; obj.vx = -obj.vx * 0.85; }
      if (obj.y < minB) { obj.y = minB; obj.vy = -obj.vy * 0.85; }
      if (obj.y > maxB) { obj.y = maxB; obj.vy = -obj.vy * 0.85; }

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

    // Pairwise elastic collisions
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

          // Positional separation
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          // Elastic collision momentum transfer
          const kx = a.vx - b.vx;
          const ky = a.vy - b.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;

          a.vx -= p * nx * 0.92;
          a.vy -= p * ny * 0.92;
          b.vx += p * nx * 0.92;
          b.vy += p * ny * 0.92;
        }
      }
    }

    // Stop early if all objects have come to rest
    const moving = allObjects.some(o => Math.hypot(o.vx, o.vy) > 0.08);
    if (!moving && step > 10) break;
  }

  // Reset striker baseline position
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

    // Execute physics simulation
    const pocketed = simulatePhysics(gameState.coins, gameState.striker, vx, vy, strikerX);

    let pottedOwn = false;
    let strikerFoul = false;
    let queenPottedThisShot = false;

    const myCoinType = playerIndex === 0 ? 'white' : 'black';

    for (const item of pocketed) {
      if (item.type === 'striker') {
        strikerFoul = true;
        gameState.scores[playerIndex] = Math.max(0, gameState.scores[playerIndex] - 5);
      } else if (item.type === 'queen') {
        queenPottedThisShot = true;
      } else if (item.type === 'white') {
        gameState.scores[0] += 10;
        if (playerIndex === 0) pottedOwn = true;
      } else if (item.type === 'black') {
        gameState.scores[1] += 10;
        if (playerIndex === 1) pottedOwn = true;
      }
    }

    // Queen Covering Logic
    let queenCovered = false;
    let queenReturned = false;

    if (queenPottedThisShot) {
      if (pottedOwn && !strikerFoul) {
        // Immediate cover on same shot!
        gameState.scores[playerIndex] += 25;
        queenCovered = true;
        gameState.pendingQueenCover = null;
      } else {
        // Must cover on the next shot
        gameState.pendingQueenCover = { player: playerIndex };
      }
    } else if (gameState.pendingQueenCover && gameState.pendingQueenCover.player === playerIndex) {
      if (pottedOwn && !strikerFoul) {
        // Successfully covered Queen on following shot!
        gameState.scores[playerIndex] += 25;
        queenCovered = true;
        gameState.pendingQueenCover = null;
      } else {
        // Failed to cover Queen! Return Queen to center
        const queen = gameState.coins.find(c => c.type === 'queen');
        if (queen) {
          queen.pocketed = false;
          queen.x = BOARD_SIZE / 2;
          queen.y = BOARD_SIZE / 2;
          queen.vx = 0;
          queen.vy = 0;
        }
        queenReturned = true;
        gameState.pendingQueenCover = null;
      }
    }

    const events = [{
      type: 'shot_executed',
      strikerX,
      vx,
      vy,
      pocketed,
      playerIndex,
      strikerFoul,
      queenCovered,
      queenReturned
    }];

    // Check if remaining target coins are cleared
    const remainingWhite = gameState.coins.filter(c => c.type === 'white' && !c.pocketed);
    const remainingBlack = gameState.coins.filter(c => c.type === 'black' && !c.pocketed);
    const queenLeft = gameState.coins.some(c => c.type === 'queen' && !c.pocketed);

    if (remainingWhite.length === 0 || remainingBlack.length === 0 || (!queenLeft && remainingWhite.length + remainingBlack.length === 0)) {
      gameState.winner = gameState.scores[0] > gameState.scores[1] ? 0 : (gameState.scores[1] > gameState.scores[0] ? 1 : 'draw');
      events.push({ type: 'game_over', winner: gameState.winner, scores: gameState.scores });
    } else {
      // Bonus turn if player potted own coin or covered Queen and no foul
      if ((!pottedOwn && !queenCovered) || strikerFoul) {
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
