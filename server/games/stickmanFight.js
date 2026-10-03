/**
 * Stickman Fight Game Logic (Server)
 * 2 Players. 2D side-view arcade fighting game.
 */

const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 450;
const FLOOR_Y = 360;
const GRAVITY = 0.8;
const MOVE_SPEED = 5;
const JUMP_FORCE = -15;

function createFighter(id, x, facing) {
  return {
    id,
    x,
    y: FLOOR_Y,
    vx: 0,
    vy: 0,
    facing, // 1 = right, -1 = left
    hp: 100,
    maxHp: 100,
    isGrounded: true,
    action: 'idle', // 'idle', 'walk', 'jump', 'punch', 'kick', 'block', 'hit'
    actionTimer: 0,
    isBlocking: false,
    roundsWon: 0
  };
}

function initGameState() {
  return {
    stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT, floorY: FLOOR_Y },
    fighters: [
      createFighter(0, 220, 1),
      createFighter(1, 580, -1)
    ],
    round: 1,
    targetRounds: 2, // Best of 3 (first to 2)
    roundOver: false,
    winner: null,
    isRealtime: true
  };
}

function updateTick(gameState) {
  if (gameState.winner !== null) return [];
  const events = [];

  const [f0, f1] = gameState.fighters;

  // Update both fighters
  for (const f of gameState.fighters) {
    // Gravity & vertical movement
    f.vy += GRAVITY;
    f.y += f.vy;

    if (f.y >= FLOOR_Y) {
      f.y = FLOOR_Y;
      f.vy = 0;
      f.isGrounded = true;
      if (f.action === 'jump') f.action = 'idle';
    } else {
      f.isGrounded = false;
    }

    // Horizontal movement
    f.x += f.vx;
    f.x = Math.max(40, Math.min(STAGE_WIDTH - 40, f.x));

    // Action timer countdown
    if (f.actionTimer > 0) {
      f.actionTimer--;
      if (f.actionTimer === 0) {
        if (f.action !== 'block') {
          f.action = f.isGrounded ? 'idle' : 'jump';
        }
      }
    }
  }

  // Auto face opponent if not attacking
  if (f0.actionTimer === 0) f0.facing = f0.x < f1.x ? 1 : -1;
  if (f1.actionTimer === 0) f1.facing = f1.x < f0.x ? 1 : -1;

  return events;
}

function executeAttack(attacker, defender, damage, range, pushback, attackType) {
  const dist = Math.abs(attacker.x - defender.x);
  const correctDirection = (attacker.facing === 1 && defender.x > attacker.x) || (attacker.facing === -1 && defender.x < attacker.x);

  if (dist <= range && Math.abs(attacker.y - defender.y) < 50 && correctDirection) {
    let actualDamage = damage;
    if (defender.isBlocking) {
      actualDamage = Math.round(damage * 0.2); // 80% damage reduction
    }

    defender.hp = Math.max(0, defender.hp - actualDamage);
    defender.action = 'hit';
    defender.actionTimer = 8;
    defender.vx = attacker.facing * (defender.isBlocking ? pushback * 0.4 : pushback);

    return { hit: true, damage: actualDamage, blocked: defender.isBlocking };
  }

  return { hit: false };
}

function handleAction(gameState, playerIndex, action) {
  const f = gameState.fighters[playerIndex];
  const enemy = gameState.fighters[1 - playerIndex];
  if (!f || gameState.winner !== null) return { valid: false, error: 'Game over or invalid player' };

  if (action.type === 'input') {
    const { moveDir, block } = action;
    if (f.actionTimer === 0 || f.action === 'jump') {
      f.vx = (moveDir || 0) * MOVE_SPEED;
      f.isBlocking = !!block;
      if (block) {
        f.action = 'block';
        f.vx = 0;
      } else if (f.vx !== 0 && f.isGrounded) {
        f.action = 'walk';
      } else if (f.isGrounded && f.action === 'walk') {
        f.action = 'idle';
      }
    }
    return { valid: true, stateChanged: false };
  }

  if (action.type === 'jump') {
    if (f.isGrounded && f.actionTimer === 0) {
      f.vy = JUMP_FORCE;
      f.isGrounded = false;
      f.action = 'jump';
      return { valid: true, stateChanged: true, events: [{ type: 'jumped', playerId: playerIndex }] };
    }
    return { valid: false, error: 'Cannot jump now' };
  }

  if (action.type === 'punch') {
    if (f.actionTimer === 0) {
      f.action = 'punch';
      f.actionTimer = 10;
      f.vx = 0;
      const hitResult = executeAttack(f, enemy, 12, 65, 8, 'punch');
      const events = [{ type: 'punched', playerId: playerIndex, hitResult }];

      if (enemy.hp <= 0 && !gameState.roundOver) {
        handleRoundEnd(gameState, playerIndex, events);
      }
      return { valid: true, stateChanged: true, events };
    }
    return { valid: false, error: 'In action' };
  }

  if (action.type === 'kick') {
    if (f.actionTimer === 0) {
      f.action = 'kick';
      f.actionTimer = 14;
      f.vx = 0;
      const hitResult = executeAttack(f, enemy, 20, 80, 16, 'kick');
      const events = [{ type: 'kicked', playerId: playerIndex, hitResult }];

      if (enemy.hp <= 0 && !gameState.roundOver) {
        handleRoundEnd(gameState, playerIndex, events);
      }
      return { valid: true, stateChanged: true, events };
    }
    return { valid: false, error: 'In action' };
  }

  if (action.type === 'restart') {
    const newState = initGameState();
    Object.assign(gameState, newState);
    return { valid: true, stateChanged: true, events: [{ type: 'game_restarted' }] };
  }

  return { valid: false, error: 'Unknown action' };
}

function handleRoundEnd(gameState, roundWinnerId, events) {
  gameState.roundOver = true;
  gameState.fighters[roundWinnerId].roundsWon += 1;
  events.push({ type: 'round_won', winner: roundWinnerId, round: gameState.round });

  if (gameState.fighters[roundWinnerId].roundsWon >= gameState.targetRounds) {
    gameState.winner = roundWinnerId;
    events.push({ type: 'game_over', winner: roundWinnerId });
  } else {
    // Next round after brief pause
    setTimeout(() => {
      gameState.round += 1;
      gameState.roundOver = false;
      gameState.fighters[0].hp = 100;
      gameState.fighters[0].x = 220;
      gameState.fighters[0].action = 'idle';
      gameState.fighters[0].actionTimer = 0;

      gameState.fighters[1].hp = 100;
      gameState.fighters[1].x = 580;
      gameState.fighters[1].action = 'idle';
      gameState.fighters[1].actionTimer = 0;
    }, 1500);
  }
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
  updateTick,
  getPublicState,
  resetGameState
};
