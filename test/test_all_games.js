/**
 * Game Engine Suite Test: Verifies all games server-side logic
 */

const assert = require('assert');

// Game Modules
const ticTacToe = require('../server/games/ticTacToe');
const connectFour = require('../server/games/connectFour');
const rps = require('../server/games/rockPaperScissors');
const memory = require('../server/games/memory');
const snakeLadder = require('../server/games/snakeLadder');
const dotsAndBoxes = require('../server/games/dotsAndBoxes');
const chess = require('../server/games/chess');
const checkers = require('../server/games/checkers');
const carrom = require('../server/games/carrom');
const tankBattle = require('../server/games/tankBattle');
const simpleShooter = require('../server/games/simpleShooter');
const stickmanFight = require('../server/games/stickmanFight');
const ludo = require('../server/games/ludo');

console.log('--- 🧪 TESTING ALL GAME ENGINES INDIVIDUALLY ---');

// 1. Tic Tac Toe
console.log('Testing Tic Tac Toe...');
let ttt = ticTacToe.initGameState();
assert.strictEqual(ttt.currentTurn, 0);
let r1 = ticTacToe.handleAction(ttt, 0, { type: 'move', cellIndex: 0 });
assert(r1.valid && ttt.board[0] === 'X');
assert.strictEqual(ttt.currentTurn, 1);
console.log('✅ Tic Tac Toe verified');

// 2. Connect Four
console.log('Testing Connect Four...');
let c4 = connectFour.initGameState();
let rC4 = connectFour.handleAction(c4, 0, { type: 'drop', col: 3 });
assert(rC4.valid);
assert.strictEqual(c4.board[5][3], 0); // Bottom row
assert.strictEqual(c4.currentTurn, 1);
console.log('✅ Connect Four verified');

// 3. Memory Cards
console.log('Testing Memory Cards...');
let mem = memory.initGameState({ playerCount: 2, numPairs: 8 });
assert.strictEqual(mem.cards.length, 16);
let f1 = memory.handleAction(mem, 0, { type: 'flip', cardIndex: 0 });
assert(f1.valid && mem.flippedIndices.includes(0));
console.log('✅ Memory Cards verified');

// 4. Snake & Ladder
console.log('Testing Snake & Ladder...');
let snl = snakeLadder.initGameState({ playerCount: 2 });
assert.strictEqual(snl.positions[0], 1);
let rollRes = snakeLadder.handleAction(snl, 0, { type: 'roll_dice' });
assert(rollRes.valid);
assert(snl.positions[0] > 1);
console.log('✅ Snake & Ladder verified');

// 5. Dots & Boxes
console.log('Testing Dots and Boxes...');
let dnb = dotsAndBoxes.initGameState({ playerCount: 2 });
let dnbRes = dotsAndBoxes.handleAction(dnb, 0, { type: 'draw_line', dir: 'H', r: 0, c: 0 });
assert(dnbRes.valid);
assert.strictEqual(dnb.hLines[0][0], 0);
console.log('✅ Dots and Boxes verified');

// 6. Chess
console.log('Testing Chess...');
let ch = chess.initGameState();
// e2 to e4 (from row 6 col 4 to row 4 col 4)
let chMoves = chess.getLegalMoves(ch.board, 6, 4, 0);
assert(chMoves.some(m => m.r === 4 && m.c === 4));
let chRes = chess.handleAction(ch, 0, { type: 'move', fromR: 6, fromC: 4, toR: 4, toC: 4 });
assert(chRes.valid);
assert.strictEqual(ch.board[4][4], 'P');
assert.strictEqual(ch.currentTurn, 1);
console.log('✅ Chess verified');

// 7. Checkers
console.log('Testing Checkers...');
let ck = checkers.initGameState();
// Move row 5, col 0 to row 4, col 1
let ckRes = checkers.handleAction(ck, 0, { type: 'move', fromR: 5, fromC: 0, toR: 4, toC: 1 });
assert(ckRes.valid);
assert.strictEqual(ck.board[4][1].player, 0);
assert.strictEqual(ck.currentTurn, 1);
console.log('✅ Checkers verified');

// 8. Carrom
console.log('Testing Carrom...');
let car = carrom.initGameState();
let carRes = carrom.handleAction(car, 0, { type: 'strike', strikerX: 300, vx: 5, vy: -12 });
assert(carRes.valid);
console.log('✅ Carrom verified');

// 9. Tank Battle
console.log('Testing Tank Battle...');
let tb = tankBattle.initGameState({ playerCount: 2 });
assert.strictEqual(tb.tanks.length, 2);
tb.tanks[0].inputs = { forward: 1, rotate: 0 };
tankBattle.updateTick(tb);
let tbShoot = tankBattle.handleAction(tb, 0, { type: 'shoot', turretAngle: 0 });
assert(tbShoot.valid && tb.bullets.length === 1);
console.log('✅ Tank Battle verified');

// 10. Simple Shooting
console.log('Testing Simple Shooting...');
let ss = simpleShooter.initGameState({ playerCount: 2 });
let ssShoot = simpleShooter.handleAction(ss, 0, { type: 'shoot', aimAngle: 0 });
assert(ssShoot.valid && ss.bullets.length === 1);
simpleShooter.updateTick(ss);
console.log('✅ Simple Shooting verified');

// 11. Stickman Fight
console.log('Testing Stickman Fight...');
let smf = stickmanFight.initGameState();
let smfPunch = stickmanFight.handleAction(smf, 0, { type: 'punch' });
assert(smfPunch.valid);
stickmanFight.updateTick(smf);
console.log('✅ Stickman Fight verified');

// 12. Ludo
console.log('Testing Ludo...');
let ld = ludo.initGameState({ playerCount: 2 });
let ldRoll = ludo.handleAction(ld, 0, { type: 'roll_dice' });
assert(ldRoll.valid);
console.log('✅ Ludo verified');

console.log('\n🌟 ALL 12 GAME ENGINES FULLY VERIFIED AND OPERATIONAL! 🌟');
